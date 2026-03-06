#!/usr/bin/env python3
"""
Excel产品数据匹配分析脚本
分析Excel报价单与现有数据库产品的匹配情况
"""

import pandas as pd
import sqlite3
import json
from pathlib import Path

EXCEL_FILE = '2025产品全数据20260210.xlsx'
DB_FILE = 'data/erp.db'

def get_excel_products():
    """从Excel定价表读取产品数据"""
    df = pd.read_excel(EXCEL_FILE, sheet_name='定价表', header=0)

    # 产品数据从第2行开始 (pandas index 1)
    products = []
    for idx in range(1, 50):  # rows 1-49
        row = df.iloc[idx]
        name = row.iloc[4]  # 产品内部名称
        specs = row.iloc[5]  # 规格

        if pd.isna(name) or name == '':
            continue

        # 提取简称（第一个\n之前的内容作为简称）
        short_name = str(name).split('\n')[0].strip()

        product = {
            'name': str(name).strip(),
            'short_name': short_name,
            'specs': str(specs).strip() if pd.notna(specs) else '',
            'green_bean_cost': row.iloc[6] if pd.notna(row.iloc[6]) else None,
            'cost': row.iloc[7] if pd.notna(row.iloc[7]) else None,
            'taobao_price': row.iloc[8] if pd.notna(row.iloc[8]) else None,
            'xwei_price': row.iloc[9] if pd.notna(row.iloc[9]) else None,
            'merchant_price': row.iloc[14] if pd.notna(row.iloc[14]) else None,
            'bulk_price': row.iloc[16] if pd.notna(row.iloc[16]) else None,
            'super_bulk_price': row.iloc[18] if pd.notna(row.iloc[18]) else None,
        }
        products.append(product)

    return products

def get_db_products():
    """从数据库读取现有产品"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 读取products表
    cursor.execute("SELECT id, name, specs, price FROM products")
    products = {row[0]: {'id': row[0], 'name': row[1], 'specs': row[2], 'price': row[3]} for row in cursor.fetchall()}

    # 读取aliases
    cursor.execute("SELECT product_id, alias FROM product_aliases")
    aliases = {}
    for row in cursor.fetchall():
        pid, alias = row
        if pid not in aliases:
            aliases[pid] = []
        aliases[pid].append(alias)

    conn.close()

    # 添加aliases到products
    for pid, alias_list in aliases.items():
        if pid in products:
            products[pid]['aliases'] = alias_list

    return products

def fuzzy_match(excel_product, db_products):
    """模糊匹配Excel产品与数据库产品"""
    excel_name = excel_product['short_name'].lower()
    matches = []

    for pid, db_product in db_products.items():
        # 检查名称
        db_name = db_product.get('name', '').lower()

        # 检查别名
        aliases = db_product.get('aliases', [])

        # 精确匹配名称
        if excel_name == db_name:
            matches.append({'id': pid, 'type': 'exact_name', 'name': db_product['name'], 'score': 100})
            continue

        # 精确匹配别名
        for alias in aliases:
            if excel_name == alias.lower():
                matches.append({'id': pid, 'type': 'exact_alias', 'name': db_product['name'], 'alias': alias, 'score': 95})
                break

        # 包含匹配
        if excel_name in db_name or db_name in excel_name:
            matches.append({'id': pid, 'type': 'contains', 'name': db_product['name'], 'score': 80})

        # 相似度匹配
        for alias in aliases:
            if excel_name in alias.lower() or alias.lower() in excel_name:
                matches.append({'id': pid, 'type': 'alias_contains', 'name': db_product['name'], 'alias': alias, 'score': 70})

    # 返回最佳匹配
    if matches:
        best = max(matches, key=lambda x: x['score'])
        return best

    return None

def analyze_matches():
    """分析匹配情况"""
    excel_products = get_excel_products()
    db_products = get_db_products()

    results = []

    for excel_prod in excel_products:
        match = fuzzy_match(excel_prod, db_products)

        result = {
            'excel_name': excel_prod['name'],
            'short_name': excel_prod['short_name'],
            'specs': excel_prod['specs'],
            'xwei_price': excel_prod['xwei_price'],
            'matched': match is not None,
            'match': match
        }
        results.append(result)

    return results

def generate_report(results):
    """生成匹配报告"""
    matched = [r for r in results if r['matched']]
    unmatched = [r for r in results if not r['matched']]

    print("=" * 80)
    print("Excel产品数据匹配分析报告")
    print("=" * 80)
    print(f"\n总计: {len(results)} 个Excel产品")
    print(f"已匹配: {len(matched)} 个")
    print(f"未匹配: {len(unmatched)} 个")

    print("\n" + "=" * 80)
    print("已匹配产品:")
    print("=" * 80)
    for r in matched:
        match = r['match']
        print(f"  {r['short_name']:20} -> ID:{match['id']:3} {match['name'][:30]:30} (分数:{match['score']})")

    print("\n" + "=" * 80)
    print("未匹配产品 (需要新建):")
    print("=" * 80)
    for r in unmatched:
        print(f"  {r['short_name']:20} 规格:{r['specs']:6} 价格:{r['xwei_price']}")

    # 返回未匹配产品列表供后续使用
    return unmatched

if __name__ == '__main__':
    results = analyze_matches()
    unmatched = generate_report(results)

    # 保存匹配结果到JSON
    output = {
        'results': results,
        'unmatched': [
            {
                'name': r['excel_name'],
                'short_name': r['short_name'],
                'specs': r['specs'],
                'xwei_price': r['xwei_price']
            }
            for r in unmatched
        ]
    }

    with open('scripts/match_report.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n匹配报告已保存到: scripts/match_report.json")
