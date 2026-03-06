#!/usr/bin/env python3
"""
合并同名客户脚本
- 以ID最小的记录为主记录
- 将其他记录的phone填入phone2，address填入address2
- 收集所有不重复的phone和address，用顿号分隔
- "未知"客户不合并
"""

import sqlite3

DB_PATH = 'data/erp.db'

def merge_customers():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. 找出所有同名客户（排除"未知"）
    cursor.execute("""
        SELECT name, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
        FROM customers
        WHERE name != '未知'
        GROUP BY name
        HAVING cnt > 1
        ORDER BY cnt DESC
    """)

    duplicate_groups = cursor.fetchall()
    print(f"找到 {len(duplicate_groups)} 组同名客户需要合并\n")

    merged_count = 0
    deleted_count = 0

    for name, cnt, ids_str in duplicate_groups:
        ids = [int(x) for x in ids_str.split(',')]
        main_id = min(ids)  # ID最小的为主记录
        other_ids = [x for x in ids if x != main_id]

        print(f"合并: {name} (主ID: {main_id}, 合并: {other_ids})")

        # 2. 收集所有phone和address
        cursor.execute("SELECT id, phone, address FROM customers WHERE id IN ({})".format(
            ','.join('?' * len(ids))
        ), ids)

        records = cursor.fetchall()

        phones = []
        addresses = []

        for rec_id, phone, address in records:
            if rec_id == main_id:
                main_phone = phone
                main_address = address
            else:
                if phone and phone.strip():
                    phones.append(phone.strip())
                if address and address.strip():
                    addresses.append(address.strip())

        # 3. 更新主记录
        # 合并phone：用顿号分隔
        all_phones = [main_phone] if main_phone and main_phone.strip() else []
        all_phones.extend(phones)
        unique_phones = []
        for p in all_phones:
            if p and p not in unique_phones:
                unique_phones.append(p)
        merged_phone = '、'.join(unique_phones)

        # 合并address：用顿号分隔
        all_addresses = [main_address] if main_address and main_address.strip() else []
        all_addresses.extend(addresses)
        unique_addresses = []
        for a in all_addresses:
            if a and a not in unique_addresses:
                unique_addresses.append(a)
        merged_address = '、'.join(unique_addresses)

        # 如果有多个phone，设置phone2
        if len(unique_phones) > 1:
            phone2 = '、'.join(unique_phones[1:])
        else:
            phone2 = None

        # 如果有多个address，设置address2
        if len(unique_addresses) > 1:
            address2 = '、'.join(unique_addresses[1:])
        else:
            address2 = None

        # 更新主记录
        cursor.execute("""
            UPDATE customers
            SET phone = ?, address = ?, phone2 = ?, address2 = ?
            WHERE id = ?
        """, (merged_phone, merged_address, phone2, address2, main_id))

        # 4. 更新订单引用：将被合并客户的订单改为主客户
        for other_id in other_ids:
            cursor.execute("""
                UPDATE orders SET customer_id = ? WHERE customer_id = ?
            """, (main_id, other_id))

        # 5. 删除被合并的记录
        cursor.execute("DELETE FROM customers WHERE id IN ({})".format(
            ','.join('?' * len(other_ids))
        ), other_ids)

        merged_count += 1
        deleted_count += len(other_ids)

        print(f"  -> 合并后: phone={merged_phone[:50]}..., address={merged_address[:50]}...")
        print(f"  -> 更新了 {len(other_ids)} 个订单引用")
        print(f"  -> 删除了 {len(other_ids)} 条记录\n")

    conn.commit()

    # 验证
    cursor.execute("SELECT COUNT(*) FROM customers")
    customer_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM orders WHERE customer_id IS NOT NULL")
    orders_with_customer = cursor.fetchone()[0]

    print(f"\n合并完成!")
    print(f"  - 合并了 {merged_count} 条重复记录")
    print(f"  - 删除了 {deleted_count} 条被合并客户记录")
    print(f"  - 现有客户数: {customer_count}")
    print(f"  - 有customer_id的订单数: {orders_with_customer}")

    # 检查是否还有同名客户（排除未知）
    cursor.execute("""
        SELECT name, COUNT(*) as cnt
        FROM customers
        WHERE name != '未知'
        GROUP BY name
        HAVING cnt > 1
    """)
    remaining = cursor.fetchall()
    if remaining:
        print(f"\n警告: 仍有 {len(remaining)} 组同名客户:")
        for name, cnt in remaining:
            print(f"  - {name}: {cnt}条")
    else:
        print("\n所有同名客户已合并完成!")

    conn.close()

if __name__ == '__main__':
    merge_customers()
