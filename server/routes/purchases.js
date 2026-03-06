const express = require('express');
const router = express.Router();
const { db: drizzleDb, schema } = require('../db/drizzle');
const { db: sqlDb } = require('../db');
const { eq, desc } = require('drizzle-orm');

// 获取所有进货记录
router.get('/', (req, res) => {
    const { from, to, supplier_id } = req.query;

    let whereClause = '';
    const params = [];

    if (from && to) {
        whereClause = 'WHERE date(purchase_date) BETWEEN ? AND ?';
        params.push(from, to);
    } else if (from) {
        whereClause = 'WHERE date(purchase_date) >= ?';
        params.push(from);
    } else if (to) {
        whereClause = 'WHERE date(purchase_date) <= ?';
        params.push(to);
    }

    if (supplier_id) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += ' supplier_id = ?';
        params.push(supplier_id);
    }

    // 使用原生 SQL 因为包含 LEFT JOIN
    const purchases = sqlDb.prepare(`
        SELECT p.*, s.name as supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${whereClause}
        ORDER BY p.purchase_date DESC
    `).all(...params);

    res.json(purchases);
});

// 获取进货详情（使用 Drizzle）
router.get('/:id', async (req, res) => {
    try {
        const [purchase] = await drizzleDb
            .select()
            .from(schema.purchases)
            .where(eq(schema.purchases.id, parseInt(req.params.id)));

        if (!purchase) {
            return res.status(404).json({ error: '进货记录不存在' });
        }

        // 获取供应商名称
        if (purchase.supplierId) {
            const [supplier] = await drizzleDb
                .select({ name: schema.suppliers.name })
                .from(schema.suppliers)
                .where(eq(schema.suppliers.id, purchase.supplierId));
            if (supplier) {
                purchase.supplier_name = supplier.name;
            }
        }

        // 进货明细使用原生 SQL（因为没有对应的 schema）
        const items = sqlDb.prepare(`
            SELECT pi.*, p.name as product_name
            FROM purchase_items pi
            LEFT JOIN products p ON pi.product_id = p.id
            WHERE pi.purchase_id = ?
        `).all(purchase.id);

        res.json({ ...purchase, items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建进货记录
router.post('/', async (req, res) => {
    const { supplier_id, total_amount, note, items } = req.body;

    try {
        // 使用 Drizzle 插入进货记录
        const result = await drizzleDb
            .insert(schema.purchases)
            .values({
                supplierId: supplier_id || null,
                totalAmount: total_amount || 0,
                note: note,
                purchaseDate: new Date().toISOString().split('T')[0]
            })
            .run();

        const purchaseId = result.lastInsertRowid;

        // 添加进货明细（使用原生 SQL，因为 purchase_items 没有 schema）
        if (items && items.length > 0) {
            const insertItem = sqlDb.prepare(`
                INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_price, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                insertItem.run(
                    purchaseId,
                    item.product_id,
                    item.quantity,
                    item.unit_price,
                    (item.quantity || 0) * (item.unit_price || 0)
                );
            }
        }

        res.json({ success: true, id: purchaseId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
