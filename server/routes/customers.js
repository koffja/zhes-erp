const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { db: drizzleDb, schema } = require('../db/drizzle');
const { eq, like, desc, or, and } = require('drizzle-orm');

// 获取所有客户（带订单统计）
router.get('/', async (req, res) => {
    const { search } = req.query;

    try {
        let customers;
        let sql;
        let params = [];

        if (search) {
            // 带搜索的SQL - 使用原生SQL获取统计数据
            const searchTerm = `%${search}%`;
            sql = `
                SELECT c.id, c.name, c.phone, c.phone2, c.address, c.address2, c.note, c.created_at,
                    COALESCE(o.order_count, 0) as order_count,
                    COALESCE(o.total_amount, 0) as total_receivable,
                    COALESCE(o.paid_amount, 0) as total_paid,
                    COALESCE(o.total_amount, 0) - COALESCE(o.paid_amount, 0) as outstanding
                FROM customers c
                LEFT JOIN (
                    SELECT customer_id,
                        COUNT(*) as order_count,
                        SUM(total_amount) as total_amount,
                        SUM(paid_amount) as paid_amount
                    FROM orders
                    GROUP BY customer_id
                ) o ON c.id = o.customer_id
                WHERE c.name LIKE ? OR c.phone LIKE ? OR c.phone2 LIKE ? OR c.address LIKE ? OR c.address2 LIKE ?
                ORDER BY c.name
            `;
            params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
        } else {
            // 不带搜索的SQL
            sql = `
                SELECT c.id, c.name, c.phone, c.phone2, c.address, c.address2, c.note, c.created_at,
                    COALESCE(o.order_count, 0) as order_count,
                    COALESCE(o.total_amount, 0) as total_receivable,
                    COALESCE(o.paid_amount, 0) as total_paid,
                    COALESCE(o.total_amount, 0) - COALESCE(o.paid_amount, 0) as outstanding
                FROM customers c
                LEFT JOIN (
                    SELECT customer_id,
                        COUNT(*) as order_count,
                        SUM(total_amount) as total_amount,
                        SUM(paid_amount) as paid_amount
                    FROM orders
                    GROUP BY customer_id
                ) o ON c.id = o.customer_id
                ORDER BY c.name
            `;
        }

        const stmt = db.prepare(sql);
        customers = stmt.all(...params);

        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取客户详情
router.get('/:id', async (req, res) => {
    try {
        const [customer] = await db
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.id, parseInt(req.params.id)));

        if (!customer) {
            return res.status(404).json({ error: '客户不存在' });
        }

        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建客户
router.post('/', async (req, res) => {
    const { name, phone, phone2, address, address2, note } = req.body;

    try {
        // Drizzle 会自动返回 lastInsertRowid
        const result = await db
            .insert(schema.customers)
            .values({
                name,
                phone,
                phone2,
                address,
                address2,
                note
            })
            .run();

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新客户
router.put('/:id', async (req, res) => {
    const { name, phone, phone2, address, address2, note } = req.body;
    const id = parseInt(req.params.id);

    try {
        const result = await db
            .update(schema.customers)
            .set({
                name,
                phone,
                phone2,
                address,
                address2,
                note
            })
            .where(eq(schema.customers.id, id))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除客户
router.delete('/:id', async (req, res) => {
    try {
        const result = await db
            .delete(schema.customers)
            .where(eq(schema.customers.id, parseInt(req.params.id)))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
