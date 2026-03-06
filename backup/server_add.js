

// 获取时间范围SQL条件
function getDateRangeFilter(period) {
    const now = new Date();
    let startDate = null;
    
    switch(period) {
        case 'today':
            startDate = now.toISOString().split('T')[0];
            return \`AND date(created_at) = date('\${startDate}')\`;
        case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return \`AND date(created_at) >= date('\${weekAgo.toISOString().split('T')[0]}')\`;
        case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
            return \`AND date(created_at) >= date('\${monthAgo.toISOString().split('T')[0]}')\`;
        case 'quarter':
            const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
            const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
            return \`AND date(created_at) >= date('\${quarterStart.toISOString().split('T')[0]}')\`;
        case 'year':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            return \`AND date(created_at) >= date('\${yearStart.toISOString().split('T')[0]}')\`;
        default:
            return '';
    }
}

// 热销产品（支持时间筛选）
app.get('/api/stats/top-products', (req, res) => {
    const period = req.query.period || 'all';
    const dateFilter = getDateRangeFilter(period);
    
    const products = db.prepare(\`
        SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE 1=1 \${dateFilter}
        GROUP BY oi.product_name
        ORDER BY total_qty DESC
        LIMIT 10
    \`).all();
    res.json(products);
});

// 热销客户（支持时间筛选）
app.get('/api/stats/top-customers', (req, res) => {
    const period = req.query.period || 'all';
    const dateFilter = getDateRangeFilter(period);
    
    const customers = db.prepare(\`
        SELECT c.name, COUNT(o.id) as order_count, 
            COALESCE(SUM(o.total_amount), 0) as total,
            COALESCE(SUM(o.paid_amount), 0) as paid
        FROM customers c
        JOIN orders o ON c.id = o.customer_id
        WHERE 1=1 \${dateFilter}
        GROUP BY c.id
        HAVING order_count > 0
        ORDER BY total DESC
        LIMIT 10
    \`).all();
    res.json(customers);
});

// 销售统计（含时间筛选）
app.get('/api/stats', (req, res) => {
    const period = req.query.period || 'all';
    const dateFilter = getDateRangeFilter(period);
    
    const todayOrders = db.prepare(\`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
        FROM orders
        WHERE date(created_at) = date('now')
    \`).get();
    
    const totalOrders = db.prepare(\`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
        FROM orders
        WHERE 1=1 \${dateFilter}
    \`).get();
    
    const topProducts = db.prepare(\`
        SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE 1=1 \${dateFilter}
        GROUP BY oi.product_name
        ORDER BY total_qty DESC
        LIMIT 5
    \`).all();
    
    const stockList = db.prepare(\`
        SELECT id, name, category, specs, stock, price
        FROM products
        ORDER BY category, name
    \`).all();
    
    const receivable = db.prepare(\`
        SELECT 
            COALESCE(SUM(total_amount), 0) as total,
            COALESCE(SUM(paid_amount), 0) as paid
        FROM orders
        WHERE 1=1 \${dateFilter}
    \`).get();
    
    res.json({
        today: todayOrders,
        total: totalOrders,
        topProducts,
        stock: stockList,
        receivable: {
            total: receivable.total,
            paid: receivable.paid,
            outstanding: receivable.total - receivable.paid
        }
    });
});

// 进货记录API
app.get('/api/purchases', (req, res) => {
    const purchases = db.prepare(\`
        SELECT p.*, s.name as supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.purchase_date DESC, p.id DESC
    \`).all();
    res.json(purchases);
});

// 添加进货记录
app.post('/api/purchases', (req, res) => {
    const { supplier_name, product_name, category, specs, quantity, unit_price, purchase_date, note } = req.body;
    
    try {
        // 查找或创建供应商
        let supplier = db.prepare('SELECT id FROM suppliers WHERE name LIKE ?').get('%' + supplier_name + '%');
        let supplierId;
        if (supplier) {
            supplierId = supplier.id;
        } else {
            const result = db.prepare('INSERT INTO suppliers (name) VALUES (?)').run(supplier_name);
            supplierId = result.lastInsertRowid;
        }
        
        const totalAmount = quantity * unit_price;
        
        const result = db.prepare(\`
            INSERT INTO purchases (supplier_id, product_name, category, specs, quantity, unit_price, total_amount, purchase_date, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`).run(supplierId, product_name, category || '生豆', specs, quantity, unit_price, totalAmount, purchase_date, note);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 客户去重合并API
app.post('/api/customers/merge', (req, res) => {
    const { source_ids, target_name, target_phone, target_address } = req.body;
    
    try {
        // 创建或找到目标客户
        let target = db.prepare('SELECT id FROM customers WHERE name = ?').get(target_name);
        let targetId;
        
        if (target) {
            targetId = target.id;
        } else {
            const result = db.prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)').run(target_name, target_phone || '', target_address || '');
            targetId = result.lastInsertRowid;
        }
        
        // 将源客户的订单转移到目标客户
        const updateOrders = db.prepare('UPDATE orders SET customer_id = ? WHERE customer_id IN (' + source_ids.join(',') + ')').run(targetId);
        
        // 删除源客户
        db.prepare('DELETE FROM customers WHERE id IN (' + source_ids.join(',') + ')').run();
        
        res.json({ success: true, merged_to: targetId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`咖啡ERP系统已启动: http://0.0.0.0:\${PORT}\`);
});
