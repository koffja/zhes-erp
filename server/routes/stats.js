const express = require('express');
const router = express.Router();
const { db } = require('../db');

// 注意：stats API 使用原生 SQL 因为包含复杂的聚合查询和 JOIN
// 这是 Drizzle 合适的例外情况

// 获取统计数据
router.get('/', (req, res) => {
    const { from, to } = req.query;

    let dateFilter = '';
    const params = [];

    if (from && to) {
        dateFilter = "WHERE date(order_date) BETWEEN ? AND ?";
        params.push(from, to);
    } else if (from) {
        dateFilter = "WHERE date(order_date) >= ?";
        params.push(from);
    } else if (to) {
        dateFilter = "WHERE date(order_date) <= ?";
        params.push(to);
    }

    // 订单数
    const orderCount = db.prepare(`SELECT COUNT(*) as count FROM orders ${dateFilter}`).get(...params).count;

    // 订单总额
    const totalAmount = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM orders ${dateFilter}`).get(...params).total;

    // 客户数
    const customerCount = db.prepare(`
        SELECT COUNT(DISTINCT customer_id) as count FROM orders ${dateFilter}
    `).get(...params).count;

    // 待发货订单
    const pendingShip = db.prepare(`
        SELECT COUNT(*) as count FROM orders WHERE shipping_status = 'pending'
    `).get().count;

    // 待付款订单
    const pendingPayment = db.prepare(`
        SELECT COUNT(*) as count FROM orders WHERE payment_status = 'pending'
    `).get().count;

    // 每日订单趋势
    const dailyOrders = db.prepare(`
        SELECT date(order_date) as date, COUNT(*) as count, SUM(total_amount) as amount
        FROM orders ${dateFilter}
        GROUP BY date(order_date)
        ORDER BY date DESC
        LIMIT 30
    `).all(...params);

    res.json({
        orderCount,
        totalAmount,
        customerCount,
        pendingShip,
        pendingPayment,
        dailyOrders
    });
});

// 客户排行榜
router.get('/top-customers', (req, res) => {
    const { from, to, limit = 10 } = req.query;

    let dateFilter = '';
    const params = [];

    if (from && to) {
        dateFilter = "WHERE date(o.order_date) BETWEEN ? AND ?";
        params.push(from, to);
    }

    const customers = db.prepare(`
        SELECT c.id, c.name, c.phone,
            COUNT(o.id) as order_count,
            SUM(o.total_amount) as total_amount,
            SUM(o.paid_amount) as paid_amount
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        ${dateFilter}
        GROUP BY c.id
        ORDER BY total_amount DESC
        LIMIT ?
    `).all(...params, parseInt(limit));

    res.json(customers);
});

// 产品排行榜
router.get('/top-products', (req, res) => {
    const { from, to, limit = 10 } = req.query;

    let dateFilter = '';
    const params = [];

    if (from && to) {
        dateFilter = "WHERE date(o.order_date) BETWEEN ? AND ?";
        params.push(from, to);
    }

    const products = db.prepare(`
        SELECT p.id, p.name, p.category,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.subtotal) as total_amount
        FROM products p
        JOIN order_items oi ON p.id = oi.product_id
        JOIN orders o ON oi.order_id = o.id
        ${dateFilter}
        GROUP BY p.id
        ORDER BY total_amount DESC
        LIMIT ?
    `).all(...params, parseInt(limit));

    res.json(products);
});

module.exports = router;
