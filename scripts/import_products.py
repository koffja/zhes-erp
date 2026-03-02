#!/usr/bin/env python3
"""
产品数据导入脚本
从 Excel 导入产品数据到 products_new 表
"""
import pandas as pd
import sqlite3
import re
import os

# Excel 文件路径
EXCEL_FILE = '2025产品全数据20260210.xlsx'
# 数据库路径
DB_PATH = 'data/erp.db'

# 产区代码映射
ORIGIN_CODES = {
    '非洲': 'AF',
    '中\n南\n美\n洲': 'CA',
    '中南美洲': 'CA',
    '亚洲': 'AS',
    '折石\n配方\n咖啡\n（意式）': 'BLEND',
    '其他': 'OT'
}

# 有效的产区列表
VALID_ORIGINS = ['非洲', '中\n南\n美\n洲', '中南美洲', '亚洲', '折石\n配方\n咖啡\n（意式）']

# 烘焙度代码
ROAST_CODES = {
    '浅焙': 'L',
    '中浅焙': 'ML',
    '中焙': 'M',
    '中深焙': 'MD',
    '深焙': 'D'
}

def clean_price(value):
    """清理价格字符串"""
    if pd.isna(value):
        return 0
    # 移除货币符号和空格，取第一个数字
    str_val = str(value)
    # 提取数字
    import re
    match = re.search(r'[\d.]+', str_val)
    if match:
        return float(match.group())
    return 0

def generate_sku(origin, name_short, weight_grams):
    """生成SKU编码"""
    # 处理换行符
    origin_clean = origin.replace('\n', '') if origin else '其他'
    origin_code = ORIGIN_CODES.get(origin_clean, ORIGIN_CODES.get(origin, 'OT'))

    # 从名称中提取有意义的部分（去除特殊字符）
    name = str(name_short).replace('\n', ' ').strip() if name_short else ''

    # 提取名称中的字母数字作为SKU后缀
    # 例如："花魁XS" -> "XS", "天堂92朗姆酒" -> "92"
    name_suffix = ''
    match = re.search(r'([A-Za-z]+\d*|\d+)', name)
    if match:
        name_suffix = match.group()[:4].upper()
    else:
        # 使用名称前3个字符
        name_suffix = ''.join([c for c in name if c.isalnum()])[:3].upper()

    weight_code = str(weight_grams)

    return f"{origin_code}-{weight_code}-{name_suffix}"

def parse_excel_sheet(sheet_name):
    """解析Excel表格"""
    try:
        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name, header=4)
        return df
    except Exception as e:
        print(f"Error reading sheet {sheet_name}: {e}")
        return None

def import_products():
    """导入产品数据"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 清空现有数据（可选）
    # cursor.execute("DELETE FROM product_prices")
    # cursor.execute("DELETE FROM product_specs")
    # cursor.execute("DELETE FROM product_categories")
    # cursor.execute("DELETE FROM products_new")

    sheet_names = ['豆单_批发（2602) ']

    for sheet_name in sheet_names:
        df = parse_excel_sheet(sheet_name)
        if df is None or len(df) == 0:
            continue

        print(f"Processing sheet: {sheet_name}")

        # 对齐列数
        while len(df.columns) < 13:
            df[len(df.columns)] = None
        df = df.iloc[:, :13]

        # 重命名列
        df.columns = ['_', 'origin', 'seq', 'roast', 'spec', 'flavor', 'acidity',
                      'name_short', 'name_full', 'price_retail', 'price_wholesale',
                      'price_bulk', 'price_super_bulk']

        # 清理数据 - 跳过空行和产区行
        products_data = []
        current_origin = None

        for idx, row in df.iterrows():
            # 产区行判断：origin列有值且在有效产区列表中
            origin_val = row.get('origin')
            if pd.notna(origin_val):
                origin_str = str(origin_val).strip()
                if origin_str in VALID_ORIGINS:
                    current_origin = origin_str
                    continue

            # 跳过空行
            if pd.isna(row.get('name_short')):
                continue

            origin = current_origin or '其他'
            name_short = str(row['name_short']).strip() if pd.notna(row['name_short']) else ''
            name_full = str(row['name_full']).strip() if pd.notna(row.get('name_full')) else name_short
            roast = str(row['roast']).strip() if pd.notna(row.get('roast')) else '中焙'
            spec = str(row['spec']).strip() if pd.notna(row.get('spec')) else '200克'
            flavor = str(row['flavor']).replace('\n', ' ').strip() if pd.notna(row.get('flavor')) else ''
            acidity = str(row['acidity']).strip() if pd.notna(row.get('acidity')) else ''

            # 解析规格
            weight_match = re.search(r'(\d+)', spec)
            weight_grams = int(weight_match.group(1)) if weight_match else 200

            # 解析价格
            price_retail = clean_price(row.get('price_retail'))
            price_wholesale = clean_price(row.get('price_wholesale')) or price_retail
            price_bulk = clean_price(row.get('price_bulk')) or price_wholesale
            price_super_bulk = clean_price(row.get('price_super_bulk')) or price_bulk

            # 生成SKU
            sku = generate_sku(origin, name_short, weight_grams)

            # 查找是否已存在
            cursor.execute("SELECT id FROM products_new WHERE sku_code = ?", (sku,))
            existing = cursor.fetchone()

            if existing:
                product_id = existing[0]
                # 更新
                cursor.execute("""
                    UPDATE products_new SET
                        name_short = ?, name_full = ?, origin = ?, roast_level = ?,
                        flavor_type = ?, acidity = ?, is_active = 1
                    WHERE id = ?
                """, (name_short, name_full, origin, roast, flavor, acidity, product_id))
            else:
                # 插入新产品
                cursor.execute("""
                    INSERT INTO products_new (sku_code, name_short, name_full, origin, roast_level, flavor_type, acidity)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (sku, name_short, name_full, origin, roast, flavor, acidity))
                product_id = cursor.lastrowid

            # 插入规格
            cursor.execute("SELECT id FROM product_specs WHERE product_id = ? AND weight_grams = ?",
                          (product_id, weight_grams))
            spec_exists = cursor.fetchone()

            if not spec_exists:
                cursor.execute("""
                    INSERT INTO product_specs (product_id, spec_name, spec_code, weight_grams)
                    VALUES (?, ?, ?, ?)
                """, (product_id, spec, spec, weight_grams))
                spec_id = cursor.lastrowid
            else:
                spec_id = spec_exists[0]

            # 插入价格
            # 零售价
            cursor.execute("""
                INSERT OR REPLACE INTO product_prices (spec_id, price_type, price, min_quantity)
                VALUES (?, 'retail', ?, 1)
            """, (spec_id, price_retail))

            # 商户批发价
            cursor.execute("""
                INSERT OR REPLACE INTO product_prices (spec_id, price_type, price, min_quantity)
                VALUES (?, 'wholesale', ?, 1)
            """, (spec_id, price_wholesale))

            # 大量订购价
            cursor.execute("""
                INSERT OR REPLACE INTO product_prices (spec_id, price_type, price, min_quantity)
                VALUES (?, 'bulk', ?, 24)
            """, (spec_id, price_bulk))

            # 超大量订购价
            cursor.execute("""
                INSERT OR REPLACE INTO product_prices (spec_id, price_type, price, min_quantity)
                VALUES (?, 'super_bulk', ?, 60)
            """, (spec_id, price_super_bulk))

            # 插入分类
            cursor.execute("SELECT id FROM product_categories WHERE product_id = ? AND category_type = 'origin'",
                          (product_id,))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO product_categories (product_id, category_type, category_name)
                    VALUES (?, 'origin', ?)
                """, (product_id, origin))

            print(f"  Imported: {name_short} ({sku})")

        conn.commit()
        print(f"Sheet {sheet_name} done!")

    conn.close()
    print("\nImport completed!")

if __name__ == '__main__':
    # 切换到项目目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.join(script_dir, '..'))

    import_products()
