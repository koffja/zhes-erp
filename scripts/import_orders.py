#!/usr/bin/env python3
"""
旧订单数据导入脚本
功能：将 orders_for_erp.json 导入到 ERP 数据库
- 客户按电话号码去重
- 商品通过 alias 匹配，找不到则创建新产品
- 金额暂时设为0，后续根据商品价格推断
"""

import json
import sqlite3
import re
from datetime import datetime
from collections import defaultdict

DB_PATH = '/Users/opikr/Projects/zhes-erp/data/erp.db'
JSON_PATH = '/Users/opikr/Projects/zhes-erp/orders_for_erp.json'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def load_json():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data['订单列表']

def get_product_id_by_alias(conn, alias_name):
    """通过别名查找商品ID"""
    # 精确匹配
    row = conn.execute(
        "SELECT product_id FROM product_aliases WHERE alias = ?",
        (alias_name,)
    ).fetchone()
    if row:
        return row[0]

    # 模糊匹配（包含）
    row = conn.execute(
        "SELECT product_id FROM product_aliases WHERE alias LIKE ?",
        (f'%{alias_name}%',)
    ).fetchone()
    if row:
        return row[0]

    return None

def get_or_create_product(conn, alias_name):
    """获取或创建商品"""
    # 1. 先尝试通过别名精确查找
    row = conn.execute(
        "SELECT product_id FROM product_aliases WHERE alias = ?",
        (alias_name,)
    ).fetchone()
    if row:
        product = conn.execute("SELECT * FROM products WHERE id = ?", (row[0],)).fetchone()
        return row[0], product['name'], False

    # 2. 检查商品表是否已存在同名商品
    product = conn.execute("SELECT * FROM products WHERE name = ?", (alias_name,)).fetchone()
    if product:
        # 创建别名关联
        conn.execute("INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)", (product['id'], alias_name))
        conn.commit()
        return product['id'], product['name'], False

    # 3. 创建新产品
    conn.execute(
        "INSERT INTO products (name, category, price) VALUES (?, ?, ?)",
        (alias_name, '生豆', 0)
    )
    product_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    # 创建别名
    conn.execute("INSERT INTO product_aliases (product_id, alias) VALUES (?, ?)", (product_id, alias_name))
    conn.commit()

    return product_id, alias_name, True

def get_or_create_customer(conn, name, phone, address):
    """获取或创建客户（按电话去重）"""
    if not phone:
        # 没有电话，创建匿名客户
        return None

    customer = conn.execute(
        "SELECT * FROM customers WHERE phone = ?",
        (phone,)
    ).fetchone()

    if customer:
        # 更新地址（如果原来没有）
        if not customer['address'] and address:
            conn.execute(
                "UPDATE customers SET address = ? WHERE id = ?",
                (address, customer['id'])
            )
            conn.commit()
        return customer['id']

    # 创建新客户
    conn.execute(
        "INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)",
        (name if name else '未知', phone, address)
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]

def parse_quantity(qty_str):
    """解析数量字符串，返回(数量, 单位)"""
    qty_str = qty_str.strip()

    # 提取数字
    numbers = re.findall(r'[\d]+', qty_str)
    if not numbers:
        return 1, qty_str  # 无法解析默认为1

    quantity = int(numbers[0])

    # 提取单位（去掉数字后的部分）
    unit = re.sub(r'[\d]+', '', qty_str).strip()

    return quantity, unit

def import_orders():
    conn = get_db()
    orders = load_json()

    print(f"开始导入 {len(orders)} 条订单...")

    # 统计
    stats = {
        'orders_created': 0,
        'customers_created': 0,
        'products_created': 0,
        'items_created': 0,
        'skipped_no_phone': 0,
        'product_not_found': []
    }

    # 用于追踪已处理的客户电话
    customer_map = {}  # phone -> customer_id

    # 追踪已创建的商品简称
    product_cache = {}  # alias -> (product_id, product_name, is_new)

    for idx, order in enumerate(orders):
        try:
            # 解析基本信息
            order_no = f"OLD-{order['排序ID']:04d}"
            order_date = order['订购时间'][:10]  # YYYY-MM-DD
            shipping_name = order['收件人']
            shipping_phone = order.get('收件人电话', '')
            shipping_address = order.get('收件地址', '')
            note = order.get('备注', '')

            # 获取或创建客户
            if shipping_phone:
                if shipping_phone not in customer_map:
                    customer_id = get_or_create_customer(
                        conn, shipping_name, shipping_phone, shipping_address
                    )
                    if customer_id:
                        customer_map[shipping_phone] = customer_id
                        if customer_id:  # 新创建
                            stats['customers_created'] += 1
                else:
                    customer_id = customer_map[shipping_phone]
            else:
                customer_id = None
                stats['skipped_no_phone'] += 1

            # 检查订单是否已存在
            existing = conn.execute(
                "SELECT id FROM orders WHERE order_no = ?",
                (order_no,)
            ).fetchone()
            if existing:
                print(f"  跳过已存在的订单: {order_no}")
                continue

            # 创建订单
            conn.execute("""
                INSERT INTO orders (
                    order_no, customer_id, total_amount, status,
                    shipping_name, shipping_phone, shipping_address,
                    note, order_date, payment_status, shipping_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                order_no, customer_id, 0, 'completed',
                shipping_name, shipping_phone, shipping_address,
                note, order_date, 'paid', 'shipped'
            ))
            conn.commit()
            order_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            stats['orders_created'] += 1

            # 处理商品明细
            products_str = order.get('订购货品', '')
            quantities_str = order.get('货品订购数量', '')

            if products_str and quantities_str:
                product_list = [p.strip() for p in products_str.split(',')]
                quantity_list = [q.strip() for q in quantities_str.split(',')]

                for i, product_name in enumerate(product_list):
                    if i >= len(quantity_list):
                        break

                    # 获取或创建商品
                    if product_name not in product_cache:
                        product_id, db_name, is_new = get_or_create_product(conn, product_name)
                        product_cache[product_name] = (product_id, db_name, is_new)
                        if is_new:
                            stats['products_created'] += 1
                            print(f"    新建商品: {product_name} (ID: {product_id})")
                    else:
                        product_id, db_name, _ = product_cache[product_name]

                    # 解析数量和单位
                    quantity, unit = parse_quantity(quantity_list[i])

                    # 过滤无效商品名称（单个字符或无意义词汇）
                    invalid_products = ['入', 'g', '克', '袋', '箱', '包', 'kg', '以上各', '都是', '附送', '']
                    if product_name.strip() in invalid_products:
                        print(f"    跳过无效商品: {product_name}")
                        continue

                    # 创建订单明细
                    conn.execute("""
                        INSERT INTO order_items (
                            order_id, product_id, product_name,
                            quantity, unit_price, subtotal, unit
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        order_id, product_id, db_name,
                        quantity, 0, 0, unit
                    ))
                    conn.commit()
                    stats['items_created'] += 1

            if (idx + 1) % 100 == 0:
                print(f"已处理 {idx + 1}/{len(orders)} 条订单...")

        except Exception as e:
            print(f"  错误: 订单 {order.get('排序ID')} - {e}")
            continue

    conn.close()

    print("\n" + "="*50)
    print("导入完成!")
    print(f"  订单: {stats['orders_created']}")
    print(f"  新客户: {stats['customers_created']}")
    print(f"  新商品: {stats['products_created']}")
    print(f"  订单明细: {stats['items_created']}")
    print(f"  无电话跳过: {stats['skipped_no_phone']}")
    print("="*50)

if __name__ == '__main__':
    import_orders()
