#!/usr/bin/env python3
"""
产品数据合并脚本 - 从豆单_批发表单读取正确数据
"""

import pandas as pd
import sqlite3
import json

EXCEL_FILE = '2025产品全数据20260210.xlsx'
DB_FILE = 'data/erp.db'

def get_excel_products():
    """从Excel豆单_批发表读取产品数据"""
    xlsx = pd.ExcelFile(EXCEL_FILE)
    df = pd.read_excel(xlsx, sheet_name='豆单_批发（2602) ', header=None)

    products = []
    # Data starts from row 5
    for idx in range(5, 50):
        if idx >= len(df):
            break

        row = df.iloc[idx]
        short_name = row.iloc[7]  # 简称
        full_name = row.iloc[8]  # 咖啡/商品名称

        if pd.isna(short_name) or short_name == '':
            continue

        # 解析全称（取#之前的部分）
        full_name_str = str(full_name) if pd.notna(full_name) else ''
        # 提取风味信息（#之后的内容）
        tasting_notes = ''
        if '#' in full_name_str:
            parts = full_name_str.split('#')
            full_name_str = parts[0].strip()
            tasting_notes = '#'.join(parts[1:]).strip()
        # 去掉星级
        full_name_str = full_name_str.replace('★', '').replace('☆', '').strip()

        # 规格
        specs = str(row.iloc[4]) if pd.notna(row.iloc[4]) else ''

        # 香型
        flavor = str(row.iloc[5]) if pd.notna(row.iloc[5]) else ''
        flavor = flavor.replace('\n', ' ').strip()

        # 烘焙度
        roast = str(row.iloc[3]) if pd.notna(row.iloc[3]) else ''

        # 产区
        region = str(row.iloc[1]) if pd.notna(row.iloc[1]) else ''

        # 价格
        xwei_price = row.iloc[9] if pd.notna(row.iloc[9]) else None  # 享味价
        merchant_price = row.iloc[10] if pd.notna(row.iloc[10]) else None  # 商户合作优惠
        bulk_price = row.iloc[11] if pd.notna(row.iloc[11]) else None  # 大量订购优惠
        super_bulk_price = row.iloc[12] if pd.notna(row.iloc[12]) else None  # 超大量优惠

        product = {
            'short_name': str(short_name).strip(),
            'full_name': full_name_str,
            'tasting_notes': tasting_notes,
            'specs': specs,
            'flavor': flavor,
            'roast': roast,
            'region': region,
            'xwei_price': float(xwei_price) if xwei_price else None,
            'merchant_price': float(merchant_price) if merchant_price else None,
            'bulk_price': float(bulk_price) if bulk_price else None,
            'super_bulk_price': float(super_bulk_price) if super_bulk_price else None,
        }
        products.append(product)

    return products

def find_db_product(short_name):
    """根据简称查找数据库产品"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 先尝试精确匹配简称
    cursor.execute("SELECT id, name, specs, price FROM products WHERE name = ?", (short_name,))
    row = cursor.fetchone()

    if not row:
        # 尝试别名匹配
        cursor.execute("""
            SELECT p.id, p.name, p.specs, p.price
            FROM products p
            JOIN product_aliases a ON p.id = a.product_id
            WHERE a.alias = ?
        """, (short_name,))
        row = cursor.fetchone()

    if not row:
        # 尝试模糊匹配
        cursor.execute("SELECT id, name, specs, price FROM products WHERE name LIKE ?", (f'%{short_name}%',))
        row = cursor.fetchone()

    conn.close()

    if row:
        return {'id': row[0], 'name': row[1], 'specs': row[2], 'price': row[3]}
    return None

def update_product(product_id, excel_product):
    """更新产品信息"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 构建价格信息
    pricing_info = {
        'full_name': excel_product['full_name'],
        'tasting_notes': excel_product['tasting_notes'],
        'flavor': excel_product['flavor'],
        'roast': excel_product['roast'],
        'region': excel_product['region'],
        'taobao_price': None,
        'cost': None,
        'green_bean_cost': None,
        'merchant_price': excel_product['merchant_price'],
        'bulk_price': excel_product['bulk_price'],
        'super_bulk_price': excel_product['super_bulk_price']
    }

    new_note = json.dumps(pricing_info, ensure_ascii=False)

    # 更新产品
    cursor.execute("""
        UPDATE products
        SET price = ?, specs = ?, note = ?
        WHERE id = ?
    """, (excel_product['xwei_price'], excel_product['specs'], new_note, product_id))

    conn.commit()
    conn.close()

def merge_products():
    """执行产品数据合并"""
    excel_products = get_excel_products()

    print("=" * 80)
    print("产品数据合并 (从豆单_批发表单)")
    print("=" * 80)
    print(f"读取到 {len(excel_products)} 个产品\n")

    updated_count = 0
    results = []

    for excel_prod in excel_products:
        db_product = find_db_product(excel_prod['short_name'])

        if db_product:
            update_product(db_product['id'], excel_prod)
            results.append({
                'short_name': excel_prod['short_name'],
                'full_name': excel_prod['full_name'],
                'db_id': db_product['id'],
                'db_name': db_product['name'],
                'action': 'updated',
                'price': excel_prod['xwei_price'],
                'merchant': excel_prod['merchant_price'],
                'bulk': excel_prod['bulk_price'],
                'super_bulk': excel_prod['super_bulk_price']
            })
            print(f"  ✅ {excel_prod['short_name']:15} | 享味价:{excel_prod['xwei_price']:6.0f} | 商户:{excel_prod['merchant_price']:6.0f} | 批发:{excel_prod['bulk_price']:6.0f} | 超大批:{excel_prod['super_bulk_price']:6.0f}")
            updated_count += 1
        else:
            results.append({
                'short_name': excel_prod['short_name'],
                'action': 'not_found'
            })
            print(f"  ❌ 未找到: {excel_prod['short_name']}")

    # 保存结果
    with open('scripts/merge_report.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print(f"合并完成! 更新了 {updated_count} 个产品")
    print("=" * 80)

    return updated_count, results

if __name__ == '__main__':
    merge_products()
