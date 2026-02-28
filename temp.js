const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 5271;
const db = new Database(path.join(__dirname, 'data/erp.db'));

app.use(express.json());
app.use(express.static('public'));

// ============ 辅助函数 ============

function findProduct(name) {
    if (!name) return null;
    // 精确匹配
    let product = db.prepare('SELECT * FROM products WHERE name = ?').get(name);
    if (product) return product;
    
    // 模糊匹配
    product = db.prepare('SELECT * FROM products WHERE name LIKE ?').get('%' + name + '%');
    if (product) return product;
    
    // 别名匹配
    const alias = db.prepare('SELECT p.* FROM products p JOIN product_aliases a ON p.id = a.product_id WHERE a.alias = ?').get(name);
    if (alias) return alias;
    
    return null;
}

// ============ API 接口 ============

// 获取所有订单
app.get('/api/orders', (req, res) => {
    const { from, to, product, customer } = req.query;

    let whereClause = '';
    const params = [];

    if (from && to) {
        whereClause += ' WHERE date(o.created_at) BETWEEN ? AND ?';
        params.push(from, to);
    } else if (from) {
        whereClause += ' WHERE date(o.created_at) >= ?';
        params.push(from);
    } else if (to) {
        whereClause += ' WHERE date(o.created_at) <= ?';
        params.push(to);
    }

    let orders = db.prepare(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        ${whereClause}
        ORDER BY o.created_at DESC
    `).all(...params);

    // 如果有客户筛选
    if (customer) {
        orders = orders.filter(o => o.customer_name && o.customer_name.includes(customer));
    }

    // 如果有品名筛选，需要先获取订单ID
    if (product) {
        const productOrders = db.prepare(`
            SELECT DISTINCT order_id FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE p.name LIKE ?
        `).all('%' + product + '%');
        const orderIds = new Set(productOrders.map(o => o.order_id));
        orders = orders.filter(o => orderIds.has(o.id));
    }

    const ordersWithItems = orders.map(order => {
        const items = db.prepare(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(order.id);
        return { ...order, items };
    });

    res.json(ordersWithItems);
});

// 创建订单
app.post('/api/orders', (req, res) => {
    const { customer_name, customer_phone, customer_address, items, note, status } = req.body;
    
    try {
        const orderNo = 'ORD' + Date.now();
        let totalAmount = 0;
        
        const processedItems = items.map(item => {
            const product = findProduct(item.product_name);
            const unitPrice = item.unit_price || (product ? product.price : 0);
            const subtotal = item.quantity * unitPrice;
            totalAmount += subtotal;
            
            return {
                product_id: product ? product.id : null,
                product_name: product ? product.name : item.product_name,
                quantity: item.quantity,
                unit_price: unitPrice,
                subtotal: subtotal
            };
        });
        
        let custId = null;
        if (customer_name) {
            const existingCustomer = db.prepare('SELECT id FROM customers WHERE name = ?').get(customer_name);
            if (existingCustomer) {
                custId = existingCustomer.id;
            } else {
                const result = db.prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)').run(customer_name, customer_phone, customer_address);
                custId = result.lastInsertRowid;
            }
        }
        
        const orderResult = db.prepare(`
            INSERT INTO orders (order_no, customer_id, total_amount, status, shipping_name, shipping_phone, shipping_address, note, payment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')
        `).run(orderNo, custId, totalAmount, status || 'pending', customer_name, customer_phone, customer_address, note);
        
        const orderId = orderResult.lastInsertRowid;
        
        const insertItem = db.prepare(`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        processedItems.forEach(item => {
            insertItem.run(orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.subtotal);
        });
        
        res.json({ success: true, order_id: orderId, order_no: orderNo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新订单付款状态
app.patch('/api/order/:id/payment', (req, res) => {
    const { paid_amount, payment_status } = req.body;
    try {
        db.prepare(`
            UPDATE orders 
            SET paid_amount = COALESCE(?, paid_amount), 
                payment_status = COALESCE(?, payment_status)
            WHERE id = ?
        `).run(paid_amount, payment_status, req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取客户订单历史
app.get('/api/customer/:id/orders', (req, res) => {
    const customerId = req.params.id;
    const orders = db.prepare(`
        SELECT o.*, c.name as customer_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
    `).all(customerId);
    
    const ordersWithItems = orders.map(order => {
        const items = db.prepare(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(order.id);
        return { ...order, items };
    });
    
    const totalReceivable = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalPaid = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
    
    res.json({
        orders: ordersWithItems,
        summary: {
            total_orders: orders.length,
            total_receivable: totalReceivable,
            total_paid: totalPaid,
            outstanding: totalReceivable - totalPaid
        }
    });
});

// 获取客户列表（带应收款）
app.get('/api/customers', (req, res) => {
    const { all } = req.query;
    let sql;
    if (all) {
        sql = `
            SELECT c.*,
                COUNT(o.id) as order_count,
                COALESCE(SUM(o.total_amount), 0) as total_receivable,
                COALESCE(SUM(o.paid_amount), 0) as total_paid
            FROM customers c
            LEFT JOIN orders o ON c.id = o.customer_id
            GROUP BY c.id
            ORDER BY total_receivable DESC, c.name
        `;
    } else {
        sql = `
            SELECT c.*,
                COUNT(o.id) as order_count,
                COALESCE(SUM(o.total_amount), 0) as total_receivable,
                COALESCE(SUM(o.paid_amount), 0) as total_paid
            FROM customers c
            INNER JOIN orders o ON c.id = o.customer_id
            GROUP BY c.id
            ORDER BY total_receivable DESC, c.name
        `;
    }
    const customers = db.prepare(sql).all();
    res.json(customers);
});

// 获取产品列表
app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products ORDER BY category, name').all();
    const aliases = db.prepare('SELECT * FROM product_aliases').all();
    const aliasMap = {};
    aliases.forEach(a => {
        if (!aliasMap[a.product_id]) aliasMap[a.product_id] = [];
        aliasMap[a.product_id].push(a.alias);
    });
    products.forEach(p => {
        p.aliases = aliasMap[p.id] || [];
    });
    res.json(products);
});

// 搜索产品
app.get('/api/products/search', (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);
    const products = db.prepare(`
        SELECT p.*, a.alias FROM products p
        LEFT JOIN product_aliases a ON p.id = a.product_id
        WHERE p.name LIKE ? OR a.alias LIKE ?
        LIMIT 10
    `).all('%' + q + '%', '%' + q + '%');
    res.json(products);
});

// 添加产品
app.post('/api/products', (req, res) => {
    const { name, category, specs, price, cost, stock } = req.body;
    try {
        const result = db.prepare(`
            INSERT INTO products (name, category, specs, price, cost, stock)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, category, specs, price, cost, stock || 0);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 添加产品别名
app.post('/api/products/:id/aliases', (req, res) => {
    const { aliases } = req.body;
    const productId = req.params.id;
    try {
        const insertAlias = db.prepare('INSERT OR IGNORE INTO product_aliases (product_id, alias) VALUES (?, ?)');
        aliases.forEach(alias => {
            insertAlias.run(productId, alias);
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 统计报表
app.get('/api/stats', (req, res) => {
    const { period, from, to } = req.query;

    let dateFilter = '';
    let todayFilter = "date(created_at) = date('now')";
    let periodSql = '';
    let periodParams = [];

    if (period === 'today') {
        dateFilter = "date(created_at) = date('now')";
    } else if (period === 'week') {
        dateFilter = "date(created_at) >= date('now', '-7 days')";
    } else if (period === 'month') {
        dateFilter = "date(created_at) >= date('now', '-30 days')";
    } else if (period === 'year') {
        dateFilter = "date(created_at) >= date('now', '-365 days')";
    } else if (period === 'custom' && from && to) {
        dateFilter = "date(created_at) >= ? AND date(created_at) <= ?";
        periodParams = [from, to];
    }

    // 构建筛选期间的SQL
    if (dateFilter) {
        if (period === 'custom' && from && to) {
            periodSql = `WHERE ${dateFilter}`;
        } else {
            periodSql = `WHERE ${dateFilter}`;
        }
    }

    // 筛选期间的订单统计
    const periodOrders = db.prepare(`
        SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as tot
        FROM orders
        ${periodSql}
    `).get(...periodParams);

    // 今日订单（始终显示）
    const todayOrders = db.prepare(`
        SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as tot
        FROM orders
        WHERE ${todayFilter}
    `).get();

    // 全部订单
    const totalOrders = db.prepare(`
        SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount), 0) as tot
        FROM orders
    `).get();

    // 热销产品（根据筛选）
    let productFilter = '';
    let productParams = [];
    if (dateFilter) {
        if (period === 'custom' && from && to) {
            productFilter = `AND ${dateFilter}`;
            productParams = [from + ' 00:00:00', to + ' 23:59:59'];
        } else {
            productFilter = `AND ${dateFilter}`;
        }
    }

    const topProducts = db.prepare(`
        SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN orders o ON oi.order_id = o.id
        ${dateFilter ? 'WHERE ' + dateFilter.replace(/created_at/g, 'o.created_at') : ''}
        GROUP BY oi.product_name
        ORDER BY total_qty DESC
        LIMIT 10
    `).all(...(period === 'custom' && from && to ? [from + ' 00:00:00', to + ' 23:59:59'] : []));

    const stockList = db.prepare(`
        SELECT id, name, category, specs, stock, price
        FROM products
        ORDER BY category, name
    `).all();

    // 应收款统计（根据筛选）
    const receivable = db.prepare(`
        SELECT
            COALESCE(SUM(total_amount), 0) as total,
            COALESCE(SUM(paid_amount), 0) as paid
        FROM orders
        ${periodSql}
    `).get(...periodParams);

    res.json({
        today: { count: todayOrders.cnt, total: todayOrders.tot },
        total: { count: periodOrders.cnt, total: periodOrders.tot },
        topProducts,
        stock: stockList,
        receivable: {
            total: receivable.total,
            paid: receivable.paid,
            outstanding: receivable.total - receivable.paid
        }
    });
});

// 客户消费排行
app.get('/api/stats/top-customers', (req, res) => {
    const { period, from, to } = req.query;

    let dateFilter = '';
    if (period === 'today') {
        dateFilter = "date(o.created_at) = date('now')";
    } else if (period === 'week') {
        dateFilter = "date(o.created_at) >= date('now', '-7 days')";
    } else if (period === 'month') {
        dateFilter = "date(o.created_at) >= date('now', '-30 days')";
    } else if (period === 'year') {
        dateFilter = "date(o.created_at) >= date('now', '-365 days')";
    } else if (period === 'custom' && from && to) {
        dateFilter = "date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)";
    }

    let sql, params = [];
    if (dateFilter) {
        if (period === 'custom' && from && to) {
            sql = `
                SELECT c.name, COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total
                FROM customers c
                INNER JOIN orders o ON c.id = o.customer_id AND ${dateFilter}
                GROUP BY c.id
                HAVING order_count > 0
                ORDER BY total DESC
                LIMIT 10
            `;
            params = [from, to];
        } else {
            sql = `
                SELECT c.name, COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total
                FROM customers c
                INNER JOIN orders o ON c.id = o.customer_id AND ${dateFilter}
                GROUP BY c.id
                HAVING order_count > 0
                ORDER BY total DESC
                LIMIT 10
            `;
        }
    } else {
        sql = `
            SELECT c.name, COUNT(o.id) as order_count, COALESCE(SUM(o.total_amount), 0) as total
            FROM customers c
            LEFT JOIN orders o ON c.id = o.customer_id
            GROUP BY c.id
            HAVING order_count > 0
            ORDER BY total DESC
            LIMIT 10
        `;
    }

    const topCustomers = db.prepare(sql).all(...params);
    res.json(topCustomers);
});

// 批量更新库存
app.post('/api/stock/batch', (req, res) => {
    const { stocks } = req.body;
    try {
        const update = db.prepare('UPDATE products SET stock = ? WHERE id = ?');
        stocks.forEach(s => {
            update.run(s.stock, s.product_id);
        });
        res.json({ success: true, count: stocks.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取供应商
app.get('/api/suppliers', (req, res) => {
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name').all();
    res.json(suppliers);
});

// 生成PDF订单 - 使用 pdf-lib
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

app.get('/api/order/:id/pdf', async (req, res) => {
    const order = db.prepare(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
    `).get(req.params.id);

    if (!order) {
        return res.status(404).json({ error: '订单不存在' });
    }

    const items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.specs
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `).all(order.id);

    const outstanding = (order.total_amount || 0) - (order.paid_amount || 0);

    // 创建 PDF
    const pdfDoc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="order_${order.order_no}.pdf"`);
    pdfDoc.pipe(res);

    // 嵌入中文字体
    let font = StandardFonts.Helvetica;
    let fontBold = StandardFonts.HelveticaBold;
    try {
        const fontPath = path.join(__dirname, 'public', 'fonts', 'SourceHanSansSC-Regular.otf');
        const fontBoldPath = path.join(__dirname, 'public', 'fonts', 'SourceHanSansSC-Bold.otf');
        if (fs.existsSync(fontPath)) {
            const fontBytes = fs.readFileSync(fontPath);
            const fontBoldBytes = fs.readFileSync(fontBoldPath);
            font = await pdfDoc.embedFont(fontBytes);
            fontBold = await pdfDoc.embedFont(fontBoldBytes);
        }
    } catch (e) {
        console.error('Font embedding error:', e.message);
    }

    // 添加公章浮水印
    let stampImageDoc = null;
    try {
        const stampImage = fs.readFileSync(path.join(__dirname, 'public', 'stamp.png'));
        stampImageDoc = await pdfDoc.embedPng(stampImage);
    } catch (e) {
        // 没有公章图片
    }

    // 标题
    pdfDoc.font(fontBold).fontSize(20).text('折石咖啡订单', { align: 'center' });
    pdfDoc.moveDown();

    // 订单信息
    pdfDoc.font(font).fontSize(11);
    pdfDoc.text(`订单号: ${order.order_no}`);
    pdfDoc.text(`日期: ${order.created_at}`);
    pdfDoc.text(`客户: ${order.shipping_name || order.customer_name || '-'}`);
    pdfDoc.text(`电话: ${order.shipping_phone || order.customer_phone || '-'}`);
    pdfDoc.text(`地址: ${order.shipping_address || order.customer_address || '-'}`);
    pdfDoc.moveDown();

    // 表格
    const tableTop = pdfDoc.y;
    pdfDoc.fontSize(10);
    pdfDoc.text('产品', 50, tableTop);
    pdfDoc.text('规格', 200, tableTop);
    pdfDoc.text('数量', 320, tableTop);
    pdfDoc.text('单价', 380, tableTop);
    pdfDoc.text('小计', 460, tableTop);

    pdfDoc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    items.forEach(item => {
        pdfDoc.text((item.product_name || '-').substring(0, 20), 50, y);
        pdfDoc.text((item.specs || '-').substring(0, 15), 200, y);
        pdfDoc.text(item.quantity.toString(), 320, y);
        pdfDoc.text('¥' + item.unit_price, 380, y);
        pdfDoc.text('¥' + item.subtotal, 460, y);
        y += 18;
    });

    // 总计
    y += 10;
    pdfDoc.moveTo(50, y).lineTo(550, y).stroke();
    y += 15;
    pdfDoc.fontSize(12).text(`合计: ¥${order.total_amount}`, 380, y);
    pdfDoc.text(`已付: ¥${order.paid_amount || 0}`, 380, y + 18);
    if (outstanding > 0) {
        pdfDoc.text(`应收: ¥${outstanding}`, 380, y + 36, { color: rgb(1, 0, 0) });
    }

    // 备注
    if (order.note) {
        pdfDoc.moveDown(3);
        pdfDoc.text(`备注: ${order.note}`);
    }

    // 添加公章浮水印
    if (stampImageDoc) {
        const stampDims = stampImageDoc.scale(0.4);
        pdfDoc.image(stampImageDoc, 200, 250, {
            width: stampDims.width,
            height: stampDims.height,
            opacity: 0.2
        });
    }

    pdfDoc.end();
});

// 获取订单详情
app.get('/api/order/:id', (req, res) => {
    const order = db.prepare(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
    `).get(req.params.id);
    
    if (order) {
        const items = db.prepare(`
            SELECT oi.*, p.name as product_name, p.specs
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(order.id);
        order.items = items;
    }
    res.json(order);
});


// 热销产品排行
app.get('/api/stats/top-products', (req, res) => {
    const { period, from, to } = req.query;

    let dateFilter = '';
    if (period === 'today') {
        dateFilter = "date(o.created_at) = date('now')";
    } else if (period === 'week') {
        dateFilter = "date(o.created_at) >= date('now', '-7 days')";
    } else if (period === 'month') {
        dateFilter = "date(o.created_at) >= date('now', '-30 days')";
    } else if (period === 'year') {
        dateFilter = "date(o.created_at) >= date('now', '-365 days')";
    } else if (period === 'custom' && from && to) {
        dateFilter = "date(o.created_at) >= date(?) AND date(o.created_at) <= date(?)";
    }

    let sql, params = [];
    if (dateFilter) {
        if (period === 'custom' && from && to) {
            sql = `
                SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                INNER JOIN orders o ON oi.order_id = o.id AND ${dateFilter}
                GROUP BY oi.product_name
                ORDER BY total_qty DESC
                LIMIT 10
            `;
            params = [from, to];
        } else {
            sql = `
                SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                INNER JOIN orders o ON oi.order_id = o.id AND ${dateFilter}
                GROUP BY oi.product_name
                ORDER BY total_qty DESC
                LIMIT 10
            `;
        }
    } else {
        sql = `
            SELECT oi.product_name, p.category, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            GROUP BY oi.product_name
            ORDER BY total_qty DESC
            LIMIT 10
        `;
    }

    const products = db.prepare(sql).all(...params);
    res.json(products);
});

// 进货记录API
app.get('/api/purchases', (req, res) => {
    const purchases = db.prepare(`
        SELECT p.id, p.supplier_id, p.product_name, p.category, p.specs,
               p.quantity, p.unit_price, p.total_amount, p.purchase_date,
               p.note, p.created_at, s.name as supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ORDER BY p.purchase_date DESC, p.id DESC
    `).all();
    res.json(purchases);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('折石ERP:5271');
});
