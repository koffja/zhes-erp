const express = require('express');
const router = express.Router();
const { db, schema } = require('../db/drizzle');
const { eq } = require('drizzle-orm');
const { findProduct } = require('../utils/helpers');

// 更新订单明细
router.put('/:id', (req, res) => {
    const { quantity, unit_price, specs } = req.body;

    const fields = [];
    const values = [];

    if (quantity !== undefined) {
        fields.push('quantity = ?');
        values.push(quantity);
    }
    if (unit_price !== undefined) {
        fields.push('unit_price = ?');
        values.push(unit_price);
    }
    if (specs !== undefined) {
        fields.push('specs = ?');
        values.push(specs);
    }

    if (fields.length > 0) {
        // 重新计算小计
        fields.push('subtotal = quantity * unit_price');
        values.push(req.params.id);

        const result = db.prepare(`UPDATE order_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);

        // 更新订单总额
        const item = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(req.params.id);
        if (item) {
            const total = db.prepare('SELECT SUM(subtotal) as total FROM order_items WHERE order_id = ?').get(item.order_id);
            db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(total.total || 0, item.order_id);
        }

        res.json({ success: true, changes: result.changes });
    } else {
        res.json({ success: true, changes: 0 });
    }
});

// 删除订单明细
router.delete('/:id', (req, res) => {
    try {
        const item = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(req.params.id);

        const result = db.prepare('DELETE FROM order_items WHERE id = ?').run(req.params.id);

        // 更新订单总额
        if (item) {
            const total = db.prepare('SELECT SUM(subtotal) as total FROM order_items WHERE order_id = ?').get(item.order_id);
            db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(total.total || 0, item.order_id);
        }

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 添加订单明细
router.post('/', (req, res) => {
    const { order_id, product_name, quantity, unit_price, specs } = req.body;

    try {
        const product = findProduct(product_name);

        const result = db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price, specs, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(order_id, product ? product.id : null, quantity, unit_price, specs, (quantity || 0) * (unit_price || 0));

        // 更新订单总额
        const total = db.prepare('SELECT SUM(subtotal) as total FROM order_items WHERE order_id = ?').get(order_id);
        db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(total.total || 0, order_id);

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
