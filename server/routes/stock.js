const express = require('express');
const router = express.Router();
const { db: drizzleDb, schema } = require('../db/drizzle');
const { db: sqlDb } = require('../db');
const { eq } = require('drizzle-orm');

// 获取库存
router.get('/', async (req, res) => {
    const { search } = req.query;

    try {
        // 查询库存并关联产品名称
        const stock = sqlDb.prepare(`
            SELECT i.*, p.name as product_name
            FROM inventory i
            LEFT JOIN products p ON i.product_id = p.id
            ORDER BY p.name
        `).all();

        let filteredStock = stock;
        if (search) {
            filteredStock = stock.filter(s => s.product_name && s.product_name.includes(search));
        }

        res.json(filteredStock);
    } catch (error) {
        // 如果 inventory 表不存在，返回空数组
        if (error.message.includes('no such table')) {
            return res.json([]);
        }
        res.status(500).json({ error: error.message });
    }
});

// 批量更新库存
router.post('/batch', async (req, res) => {
    const { items } = req.body; // [{ product_id, quantity, type: 'in'|'out'|'adjust' }]

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: '请提供库存明细' });
    }

    try {
        // 使用事务处理
        sqlDb.transaction(() => {
            for (const item of items) {
                const { product_id, quantity, type } = item;

                if (type === 'adjust') {
                    // 直接调整库存
                    sqlDb.prepare(`
                        UPDATE inventory SET quantity = ?, updated_at = datetime('now')
                        WHERE product_id = ?
                    `).run(quantity, product_id);
                } else if (type === 'in') {
                    // 入库
                    const current = sqlDb.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product_id);
                    if (current) {
                        sqlDb.prepare(`
                            UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now')
                            WHERE product_id = ?
                        `).run(quantity, product_id);
                    } else {
                        sqlDb.prepare(`
                            INSERT INTO inventory (product_id, quantity)
                            VALUES (?, ?)
                        `).run(product_id, quantity);
                    }
                } else if (type === 'out') {
                    // 出库
                    sqlDb.prepare(`
                        UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now')
                        WHERE product_id = ?
                    `).run(quantity, product_id);
                }
            }
        })();

        res.json({ success: true });
    } catch (error) {
        if (error.message.includes('no such table')) {
            return res.status(500).json({ error: '库存表不存在，请先创建' });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
