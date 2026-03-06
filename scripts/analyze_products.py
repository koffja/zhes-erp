#!/usr/bin/env python3
"""
产品名称数据分析脚本
分析数据质量问题并生成清洗建议
"""

import sqlite3
import re

DB_PATH = './data/erp.db'

def get_products():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM products ORDER BY name")
    products = cursor.fetchall()
    conn.close()
    return [(p['id'], p['name']) for p in products]

def generate_clean_suggestions():
    """生成清洗建议"""
    products = get_products()
    suggestions = []

    for id, name in products:
        original = name.strip()
        cleaned = original

        # 去除开头的不正常字符
        if cleaned.startswith('、'):
            cleaned = cleaned[1:]
        if cleaned.startswith('（') or cleaned.startswith('('):
            cleaned = cleaned[1:]
        if cleaned.startswith('+') or cleaned.startswith('.') or cleaned.startswith('/') or cleaned.startswith(':'):
            cleaned = cleaned[1:]
        if cleaned.startswith(' '):
            cleaned = cleaned[1:]

        # 去除结尾的不正常字符
        if cleaned.endswith('）') or cleaned.endswith(')'):
            cleaned = cleaned[:-1]
        if cleaned.endswith('各') and len(cleaned) <= 4:
            cleaned = cleaned[:-1]

        # 去除"（之前预定"等无意义后缀
        if '（之前预定' in cleaned:
            cleaned = cleaned.split('（之前预定')[0]
        if '（先寄' in cleaned:
            cleaned = cleaned.split('（先寄')[0]
        if '（先烘' in cleaned:
            cleaned = cleaned.split('（先烘')[0]
        if '（共' in cleaned:
            cleaned = cleaned.split('（共')[0]
        if '（实际烘' in cleaned:
            cleaned = cleaned.split('（实际烘')[0]
        if '（已经订购生豆' in cleaned:
            cleaned = cleaned.split('（已经订购生豆')[0]
        if '（是' in cleaned and len(cleaned) < 5:
            cleaned = cleaned.split('（是')[0]
        if '（生豆总共需要' in cleaned:
            cleaned = cleaned.split('（生豆总共需要')[0]
        if '（这吱吱订单）' in cleaned:
            cleaned = cleaned.split('（这吱吱订单）')[0]

        cleaned = cleaned.strip()

        # 简单处理：只保留前面的产品名，去除后面的规格/备注
        # 去掉末尾的括号内容
        # 例如: "黑洞（100克）" -> "黑洞"
        match = re.match(r'^(.+?)[\（\(]', cleaned)
        if match and len(match.group(1)) > 1:
            potential = match.group(1).strip()
            # 只有当处理后的名称看起来合理时才替换
            if len(potential) >= 2 and not potential.endswith('各'):
                cleaned = potential

        if cleaned != original and cleaned and len(cleaned) >= 2:
            suggestions.append({
                'id': id,
                'original': original,
                'suggested': cleaned
            })

    return suggestions

def main():
    print("=" * 60)
    print("产品名称数据分析报告")
    print("=" * 60)

    suggestions = generate_clean_suggestions()

    print(f"\n【需要清洗的记录】共 {len(suggestions)} 条\n")

    # 输出详细信息
    for s in suggestions[:30]:
        print(f"ID {s['id']}: {s['original']}")
        print(f"   建议改为: {s['suggested']}")

    if len(suggestions) > 30:
        print(f"\n... 还有 {len(suggestions) - 30} 条")

    # 输出所有建议到文件
    with open('./data/product_clean_suggestions.txt', 'w', encoding='utf-8') as f:
        f.write("产品名称清洗建议\n")
        f.write("=" * 60 + "\n\n")

        f.write(f"共 {len(suggestions)} 条可修复\n\n")

        for s in suggestions:
            f.write(f"ID: {s['id']}\n")
            f.write(f"  原名称: {s['original']}\n")
            f.write(f"  建议改为: {s['suggested']}\n")
            f.write("\n")

    print(f"\n详细建议已保存到: data/product_clean_suggestions.txt")

if __name__ == '__main__':
    main()
