
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 5271;
const db = new Database(path.join(__dirname, 'data/erp.db'));

app.use(express.json());
app.use(express.static('public'));

function getDateFilter(period) {
    switch(period) {
        case 'today': return "AND o.created_at >= date('now')";
        case 'week': return "AND o.created_at >= date('now', '-7 days')";
        case 'month': return "AND o.created_at >= date('now', 'start of month')";
        case 'year': return "AND o.created_at >= date('now', 'start of year')";
        default: return '';
    }
}

app.get('/api/orders', (req, res) => {
    const orders = db.prepare('SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ORDER BY o.created_at DESC').all();
    const result = orders.map(o => {
        const items = db.prepare('SELECT oi.*, p.name as product_name FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?').all(o.id);
        return {...o, items};
    });
    res.json(result);
});

app.get('/api/stats', (req, res) => {
    const period = req.query.period || 'all';
    const dateFilter = getDateFilter(period);
    const today = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) t FROM orders WHERE created_at >= date('now')").get();
    const total = db.prepare('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) t FROM orders o WHERE 1=1 ' + dateFilter).get();
    const top = db.prepare('SELECT oi.product_name, p.category, SUM(oi.quantity) qty, SUM(oi.subtotal) tot FROM order_items oi JOIN orders o ON oi.order_id=o.id LEFT JOIN products p ON oi.product_id=p.id WHERE 1=1 ' + dateFilter + ' GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5').all();
    const stock = db.prepare('SELECT id, name, category, specs, stock, price FROM products ORDER BY category, name').all();
    const rec = db.prepare('SELECT COALESCE(SUM(total_amount),0) t, COALESCE(SUM(paid_amount),0) p FROM orders o WHERE 1=1 ' + dateFilter).get();
    res.json({ today, total: {count:total.c, total:total.t}, topProducts: top, stock, receivable:{total:rec.t, paid:rec.p, outstanding:rec.t-rec.p} });
});

app.get('/api/stats/top-products', (req, res) => {
    const period = req.query.period || 'all';
    const dateFilter = getDateFilter(period);
    res.json(db.prepare('SELECT oi.product_name, p.category, SUM(oi.quantity) qty, SUM(oi.subtotal) tot FROM order_items oi JOIN orders o ON oi.order_id=o.id LEFT JOIN products p ON oi.product_id=p.id WHERE 1=1 ' + dateFilter + ' GROUP BY oi.product_name ORDER BY qty DESC LIMIT 10').all());
});

app.get('/api/stats/top-customers', (req, res) => {
    const period = req.query.period || 'all';
    const dateFilter = getDateFilter(period);
    res.json(db.prepare('SELECT c.name, COUNT(o.id) c, COALESCE(SUM(o.total_amount),0) t, COALESCE(SUM(o.paid_amount),0) p FROM customers c JOIN orders o ON c.id=o.customer_id WHERE 1=1 ' + dateFilter + ' GROUP BY c.id ORDER BY t DESC LIMIT 10').all());
});

app.get('/api/customers', (req, res) => {
    res.json(db.prepare('SELECT c.*, COUNT(o.id) oc, COALESCE(SUM(o.total_amount),0) tr, COALESCE(SUM(o.paid_amount),0) tp FROM customers c LEFT JOIN orders o ON c.id=o.customer_id GROUP BY c.id ORDER BY tr DESC').all());
});

app.get('/api/purchases', (req, res) => {
    res.json(db.prepare('SELECT p.*, s.name sn FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.purchase_date DESC').all());
});

app.listen(PORT, '0.0.0.0', () => console.log('折石ERP:5271'));
