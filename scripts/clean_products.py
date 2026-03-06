#!/usr/bin/env python3
"""
产品名称清洗脚本 - 处理重复名称问题
"""

import sqlite3
import re
import shutil
from datetime import datetime

DB_PATH = './data/erp.db'

def clean_name(name):
    if not name:
        return name
    original = name.strip()
    cleaned = original

    if cleaned.startswith('、'):
        cleaned = cleaned[1:]
    if cleaned.startswith('（') or cleaned.startswith('('):
        cleaned = cleaned[1:]
    if cleaned.startswith('+') or cleaned.startswith('.') or cleaned.startswith('/') or cleaned.startswith(':'):
        cleaned = cleaned[1:]
    if cleaned.startswith(' '):
        cleaned = cleaned[1:]
    if cleaned.endswith('）') or cleaned.endswith(')'):
        cleaned = cleaned[:-1]
    if cleaned.endswith('各') and len(cleaned) <= 4:
        cleaned = cleaned[:-1]

    suffixes = ['（之前预定', '（先寄', '（先烘', '（共', '（实际烘', '（已经订购生豆', '（是', '（生豆总共需要', '（这吱吱订单）']
    for suffix in suffixes:
        if suffix in cleaned:
            cleaned = cleaned.split(suffix)[0]

    match = re.match(r'^(.+?)[\（\(]', cleaned)
    if match and len(match.group(1)) > 1:
        potential = match.group(1).strip()
        if len(potential) >= 2 and not potential.endswith('各'):
            cleaned = potential

    cleaned = cleaned.strip()
    return cleaned if cleaned else original

def main():
    print("=" * 60)
    print("产品名称清洗工具 (处理重复)")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 获取所有产品
    cursor.execute("SELECT id, name FROM products ORDER BY name")
    products = cursor.fetchall()

    # 计算清洗后的名称
    cleaned_map = {}
    for p in products:
        cleaned = clean_name(p[1])
        cleaned_map[p[0]] = (p[1], cleaned)

    # 找出重复的清洗后名称
    name_to_ids = {}
    for pid, (original, cleaned) in cleaned_map.items():
        if cleaned not in name_to_ids:
            name_to_ids[cleaned] = []
        name_to_ids[cleaned].append((pid, original))

    # 检查哪些清洗后会重复
    duplicates = {k: v for k, v in name_to_ids.items() if len(v) > 1}

    print(f"\n发现 {len(duplicates)} 组清洗后会重复的名称：\n")
    for name, items in duplicates.items():
        print(f"  清洗后名称: {name}")
        for pid, original in items:
            print(f"    - ID {pid}: {original}")
        print()

    # 执行清洗（跳过会导致重复的）
    updated_products = 0
    updated_items = 0

    for pid, (original, cleaned) in cleaned_map.items():
        if cleaned == original:
            continue

        # 检查是否会导致重复
        if cleaned in duplicates:
            print(f"跳过 (会导致重复): ID {pid} {original} -> {cleaned}")
            continue

        # 更新 products
        cursor.execute("UPDATE products SET name = ? WHERE id = ?", (cleaned, pid))
        if cursor.rowcount > 0:
            updated_products += 1
            # 同步更新 order_items
            cursor.execute("""
                UPDATE order_items
                SET product_name = ?
                WHERE product_id = ? AND product_name IS NOT NULL
            """, (cleaned, pid))
            updated_items += cursor.rowcount

    conn.commit()
    conn.close()

    print("-" * 60)
    print(f"✅ 清洗完成！")
    print(f"   更新产品: {updated_products} 条")
    print(f"   更新订单明细: {updated_items} 条")
    print(f"\n备份文件: ./data/erp_backup_before_clean_20260304_*.db")

if __name__ == '__main__':
    # 先备份
    backup_path = f"./data/erp_backup_before_clean_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    shutil.copy(DB_PATH, backup_path)
    print(f"已备份到: {backup_path}\n")

    main()
