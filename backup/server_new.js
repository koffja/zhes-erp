

// ============ 统计API ============

// 热销产品排行
app.get('/api/stats/top-products', (req, res) => {
    const products = db.prepare(`
        SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        GROUP BY oi.product_name
        ORDER BY total_qty DESC
        LIMIT 10
    `).all();
    res.json(products);
});

// 热销客户排行
app.get('/api/stats/top-customers', (req, res) => {
    const customers = db.prepare(`
        SELECT c.name, COUNT(o.id) as order_count, 
            COALESCE(SUM(o.total_amount), 0) as total,
            COALESCE(SUM(o.paid_amount), 0) as paid
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id
        HAVING order_count > 0
        ORDER BY total DESC
        LIMIT 10
    `).all();
    res.json(customers);
});

// 产品销售统计
app.get('/api/stats/product-sales', (req, res) => {
    const products = db.prepare(`
        SELECT p.name, p.category, p.specs, p.price,
            COALESCE(SUM(oi.quantity), 0) as total_qty,
            COALESCE(SUM(oi.subtotal), 0) as total
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        GROUP BY p.id
        HAVING total_qty > 0
        ORDER BY total_qty DESC
    `).all();
    res.json(products);
});

// 更新客户API（带订单数）
app.get('/api/customers', (req, res) => {
    const customers = db.prepare(`
        SELECT c.*, 
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.total_amount), 0) as total_receivable,
            COALESCE(SUM(o.paid_amount), 0) as total_paid
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id
        ORDER BY total_receivable DESC
    `).all();
    res.json(customers);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`咖啡ERP系统已启动: http://0.0.0.0:${PORT}`);
});
