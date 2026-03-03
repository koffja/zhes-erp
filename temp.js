const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 5126;
const db = new Database(path.join(__dirname, 'data/erp.db'));

// 数据库迁移 - 添加发货字段
try {
    db.exec(`
        ALTER TABLE order_items ADD COLUMN shipped_quantity INTEGER DEFAULT 0;
        ALTER TABLE order_items ADD COLUMN shipping_status TEXT DEFAULT 'pending';
        ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'pending';
    `);
    console.log('Database migration: shipping fields added');
} catch (e) {
    // 字段可能已存在，忽略错误
    if (!e.message.includes('duplicate column name')) {
        console.log('Database migration note:', e.message);
    }
}

// 数据库迁移 - 添加订单日期字段
try {
    db.exec(`ALTER TABLE orders ADD COLUMN order_date DATE;`);
} catch (e) {
    // 字段可能已存在
}

// 修复订单日期（从订单号正确提取）
db.exec(`
    UPDATE orders SET order_date =
        '20' || substr(order_no, 6, 2) || '-' ||
        substr(order_no, 8, 2) || '-' ||
        substr(order_no, 10, 2)
    WHERE order_no LIKE 'XSD%' AND LENGTH(order_no) >= 12 AND order_date IS NULL
`);
db.exec(`
    UPDATE orders SET order_date = date(created_at)
    WHERE order_no LIKE 'ORD%' AND order_date IS NULL
`);
console.log('Database migration: order_date field updated');

// 数据库迁移 - 产品新数据表
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS products_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku_code TEXT UNIQUE,
            name_short TEXT NOT NULL,
            name_full TEXT,
            origin TEXT,
            region TEXT,
            variety TEXT,
            process TEXT,
            altitude TEXT,
            grade TEXT,
            description TEXT,
            tags TEXT,
            cupping_notes TEXT,
            roast_level TEXT,
            flavor_type TEXT,
            acidity TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS product_specs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            spec_name TEXT NOT NULL,
            spec_code TEXT NOT NULL,
            weight_grams INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (product_id) REFERENCES products_new(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS product_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            spec_id INTEGER NOT NULL,
            price_type TEXT NOT NULL,
            price REAL NOT NULL,
            min_quantity INTEGER DEFAULT 1,
            valid_from DATE,
            FOREIGN KEY (spec_id) REFERENCES product_specs(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS product_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            category_type TEXT NOT NULL,
            category_name TEXT NOT NULL,
            FOREIGN KEY (product_id) REFERENCES products_new(id)
        )
    `);

    console.log('Database migration: product tables created');
} catch (e) {
    if (!e.message.includes('already exists')) {
        console.log('Database migration note:', e.message);
    }
}

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

// 获取所有订单（支持分页和筛选）
app.get('/api/orders', (req, res) => {
    const { from, to, product, customer, shipping_status, payment_status, has_items, page = 1, pageSize = 50 } = req.query;

    let whereClause = '';
    const params = [];

    // 日期筛选（使用 order_date）
    if (from && to) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += " date(o.order_date) BETWEEN ? AND ?";
        params.push(from, to);
    } else if (from) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += " date(o.order_date) >= ?";
        params.push(from);
    } else if (to) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += " date(o.order_date) <= ?";
        params.push(to);
    }

    // 发货状态筛选
    if (shipping_status) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += ' o.shipping_status = ?';
        params.push(shipping_status);
    }

    // 付款状态筛选
    if (payment_status) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += ' o.payment_status = ?';
        params.push(payment_status);
    }

    // 是否有明细筛选
    if (has_items !== undefined) {
        if (has_items === '0') {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += ' o.id NOT IN (SELECT DISTINCT order_id FROM order_items)';
        } else if (has_items === '1') {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += ' o.id IN (SELECT DISTINCT order_id FROM order_items)';
        }
    }

    // 先获取总数
    const countSql = `SELECT COUNT(*) as total FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ${whereClause}`;
    const totalResult = db.prepare(countSql).get(...params);
    const total = totalResult.total;

    // 分页参数
    const currentPage = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (currentPage - 1) * size;

    let orders = db.prepare(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone,
            (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as total_items,
            (SELECT SUM(COALESCE(oi.shipped_quantity, 0)) FROM order_items oi WHERE oi.order_id = o.id) as shipped_items,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.shipping_status = 'shipped') as fully_shipped_items,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.shipping_status = 'partial') as partial_shipped_items
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        ${whereClause}
        ORDER BY o.order_date DESC
        LIMIT ? OFFSET ?
    `).all(...params, size, offset);

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

    // 计算整体发货状态并返回
    const ordersWithItems = orders.map(order => {
        // 优先使用数据库中存储的发货状态，只在有明细且数量不匹配时才重新计算
        let shipping_status = order.shipping_status || 'pending';
        const totalItems = order.total_items || 0;
        const shippedItems = order.shipped_items || 0;

        // 如果有明细且发货数量不匹配，才重新计算
        if (totalItems > 0) {
            if (shippedItems > 0 && shippedItems < totalItems) {
                shipping_status = 'partial';
            } else if (shippedItems >= totalItems) {
                shipping_status = 'shipped';
            }
        }

        const items = db.prepare(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(order.id);
        return { ...order, items, shipping_status, total_items: totalItems, shipped_items: shippedItems };
    });

    res.json({
        data: ordersWithItems,
        total: total,
        page: currentPage,
        pageSize: size,
        totalPages: Math.ceil(total / size)
    });
});

// 获取订单详情
app.get('/api/orders/:id', (req, res) => {
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

    res.json({ ...order, items });
});

// 更新订单
app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const {
        order_no, customer_id, total_amount, status,
        shipping_name, shipping_phone, shipping_address,
        note, order_date, paid_amount, payment_status, shipping_status
    } = req.body;

    const fields = [];
    const values = [];

    if (order_no !== undefined) { fields.push('order_no = ?'); values.push(order_no); }
    if (customer_id !== undefined) { fields.push('customer_id = ?'); values.push(customer_id); }
    if (total_amount !== undefined) { fields.push('total_amount = ?'); values.push(total_amount); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (shipping_name !== undefined) { fields.push('shipping_name = ?'); values.push(shipping_name); }
    if (shipping_phone !== undefined) { fields.push('shipping_phone = ?'); values.push(shipping_phone); }
    if (shipping_address !== undefined) { fields.push('shipping_address = ?'); values.push(shipping_address); }
    if (note !== undefined) { fields.push('note = ?'); values.push(note); }
    if (order_date !== undefined) { fields.push('order_date = ?'); values.push(order_date); }
    if (paid_amount !== undefined) { fields.push('paid_amount = ?'); values.push(paid_amount); }
    if (payment_status !== undefined) { fields.push('payment_status = ?'); values.push(payment_status); }
    if (shipping_status !== undefined) { fields.push('shipping_status = ?'); values.push(shipping_status); }

    if (fields.length === 0) {
        return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(id);
    const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`;

    try {
        db.prepare(sql).run(...values);
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 发货接口
app.post('/api/orders/:id/ship', (req, res) => {
    const { items } = req.body; // items: [{ item_id: 1, ship_quantity: 5 }]

    try {
        items.forEach(item => {
            // 获取当前订单项信息
            const orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(item.item_id);
            if (!orderItem) return;

            const newShippedQty = (orderItem.shipped_quantity || 0) + item.ship_quantity;
            const status = newShippedQty >= orderItem.quantity ? 'shipped' :
                         newShippedQty > 0 ? 'partial' : 'pending';

            db.prepare(`
                UPDATE order_items
                SET shipped_quantity = ?, shipping_status = ?
                WHERE id = ?
            `).run(newShippedQty, status, item.item_id);
        });

        // 更新订单整体发货状态
        const orderItems = db.prepare(`
            SELECT shipping_status FROM order_items WHERE order_id = ?
        `).all(req.params.id);

        let orderStatus = 'pending';
        const shippedCount = orderItems.filter(i => i.shipping_status === 'shipped').length;
        const partialCount = orderItems.filter(i => i.shipping_status === 'partial').length;

        if (shippedCount === orderItems.length && orderItems.length > 0) {
            orderStatus = 'shipped';
        } else if (shippedCount > 0 || partialCount > 0) {
            orderStatus = 'partial';
        }

        db.prepare('UPDATE orders SET shipping_status = ? WHERE id = ?')
          .run(orderStatus, req.params.id);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 更新订单明细
app.put('/api/order-items/:id', (req, res) => {
    const { id } = req.params;
    const { product_name, quantity, unit_price, unit, shipped_quantity, shipping_status } = req.body;

    const fields = [];
    const values = [];

    if (product_name !== undefined) { fields.push('product_name = ?'); values.push(product_name); }
    if (quantity !== undefined) { fields.push('quantity = ?'); values.push(parseFloat(quantity)); }
    if (unit_price !== undefined) { fields.push('unit_price = ?'); values.push(parseFloat(unit_price)); }
    if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
    if (shipped_quantity !== undefined) { fields.push('shipped_quantity = ?'); values.push(parseFloat(shipped_quantity)); }
    if (shipping_status !== undefined) { fields.push('shipping_status = ?'); values.push(shipping_status); }

    if (fields.length === 0) {
        return res.status(400).json({ error: '没有要更新的字段' });
    }

    // 计算小计
    const item = db.prepare('SELECT quantity, unit_price FROM order_items WHERE id = ?').get(id);
    if (item) {
        const qty = quantity !== undefined ? parseFloat(quantity) : item.quantity;
        const price = unit_price !== undefined ? parseFloat(unit_price) : item.unit_price;
        fields.push('subtotal = ?');
        values.push(qty * price);
    }

    values.push(id);
    const sql = `UPDATE order_items SET ${fields.join(', ')} WHERE id = ?`;

    try {
        db.prepare(sql).run(...values);
        const updatedItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(id);
        res.json(updatedItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 删除订单明细
app.delete('/api/order-items/:id', (req, res) => {
    const { id } = req.params;

    try {
        db.prepare('DELETE FROM order_items WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 新增订单明细
app.post('/api/order-items', (req, res) => {
    const { order_id, product_id, product_name, quantity, unit_price, unit } = req.body;

    if (!order_id || !product_name) {
        return res.status(400).json({ error: '订单ID和商品名称必填' });
    }

    const qty = parseFloat(quantity) || 1;
    const price = parseFloat(unit_price) || 0;

    try {
        db.prepare(`
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal, unit, shipping_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(order_id, product_id || null, product_name, qty, price, qty * price, unit || '包', 'pending');

        const newItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(db.prepare('SELECT last_insert_rowid()').get()['last_insert_rowid()']);
        res.json(newItem);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
            INSERT INTO orders (order_no, customer_id, total_amount, status, shipping_name, shipping_phone, shipping_address, note, payment_status, order_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', date('now'))
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

// 更新客户
app.put('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const { name, phone, address, note } = req.body;

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }
    if (note !== undefined) { fields.push('note = ?'); values.push(note); }

    if (fields.length === 0) {
        return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(id);
    const sql = `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`;

    try {
        db.prepare(sql).run(...values);
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
        res.json(customer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
        // 解析note中的价格信息
        if (p.note && p.note.startsWith('{')) {
            try {
                const pricing = JSON.parse(p.note);
                p.pricing = {
                    full_name: pricing.full_name,
                    tasting_notes: pricing.tasting_notes,
                    flavor: pricing.flavor,
                    roast: pricing.roast,
                    region: pricing.region,
                    taobao_price: pricing.taobao_price,
                    cost: pricing.cost,
                    green_bean_cost: pricing.green_bean_cost,
                    merchant_price: pricing.merchant_price,
                    bulk_price: pricing.bulk_price,
                    super_bulk_price: pricing.super_bulk_price
                };
            } catch (e) {
                p.pricing = null;
            }
        } else {
            p.pricing = null;
        }
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
    // 解析价格信息
    products.forEach(p => {
        if (p.note && p.note.startsWith('{')) {
            try {
                const pricing = JSON.parse(p.note);
                p.pricing = {
                    full_name: pricing.full_name,
                    tasting_notes: pricing.tasting_notes,
                    flavor: pricing.flavor,
                    roast: pricing.roast,
                    region: pricing.region,
                    taobao_price: pricing.taobao_price,
                    cost: pricing.cost,
                    green_bean_cost: pricing.green_bean_cost,
                    merchant_price: pricing.merchant_price,
                    bulk_price: pricing.bulk_price,
                    super_bulk_price: pricing.super_bulk_price
                };
            } catch (e) {
                p.pricing = null;
            }
        } else {
            p.pricing = null;
        }
    });
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

// 更新产品
app.put('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    const { name, category, specs, price, cost, stock, full_name, roast, flavor, region, tasting_notes, merchant_price, bulk_price, super_bulk_price } = req.body;

    try {
        // 先获取现有note
        const existing = db.prepare('SELECT note FROM products WHERE id = ?').get(productId);
        let pricing = {};
        if (existing && existing.note && existing.note.startsWith('{')) {
            try { pricing = JSON.parse(existing.note); } catch(e) {}
        }

        // 更新pricing字段
        if (full_name !== undefined) pricing.full_name = full_name;
        if (roast !== undefined) pricing.roast = roast;
        if (flavor !== undefined) pricing.flavor = flavor;
        if (region !== undefined) pricing.region = region;
        if (tasting_notes !== undefined) pricing.tasting_notes = tasting_notes;
        if (merchant_price !== undefined) pricing.merchant_price = merchant_price;
        if (bulk_price !== undefined) pricing.bulk_price = bulk_price;
        if (super_bulk_price !== undefined) pricing.super_bulk_price = super_bulk_price;

        const newNote = JSON.stringify(pricing);

        // 更新产品
        db.prepare(`
            UPDATE products
            SET name = COALESCE(?, name),
                category = COALESCE(?, category),
                specs = COALESCE(?, specs),
                price = COALESCE(?, price),
                cost = COALESCE(?, cost),
                stock = COALESCE(?, stock),
                note = ?
            WHERE id = ?
        `).run(name, category, specs, price, cost, stock, newNote, productId);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除产品
app.delete('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    try {
        db.prepare('DELETE FROM product_aliases WHERE product_id = ?').run(productId);
        db.prepare('DELETE FROM products WHERE id = ?').run(productId);
        res.json({ success: true });
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

// ============ 新产品数据 API ============

// 获取新产品列表
app.get('/api/products-new', (req, res) => {
    const { origin, active } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (origin) {
        whereClause += ' AND p.origin = ?';
        params.push(origin);
    }

    if (active !== undefined) {
        whereClause += ' AND p.is_active = ?';
        params.push(active === 'true' ? 1 : 0);
    }

    // 先获取产品列表
    const products = db.prepare(`
        SELECT * FROM products_new p
        ${whereClause}
        ORDER BY p.name_short
    `).all(...params);

    // 获取每个产品的规格和价格
    const result = products.map(p => {
        const specs = db.prepare(`
            SELECT s.*,
                (SELECT json_group_array(json_object(
                    'price_type', pp.price_type,
                    'price', pp.price,
                    'min_quantity', pp.min_quantity
                )) FROM product_prices pp WHERE pp.spec_id = s.id) as prices_json
            FROM product_specs s
            WHERE s.product_id = ? AND s.is_active = 1
        `).all(p.id);

        return {
            ...p,
            specs: specs.map(s => ({
                id: s.id,
                spec_name: s.spec_name,
                spec_code: s.spec_code,
                weight_grams: s.weight_grams,
                prices: JSON.parse(s.prices_json || '[]')
            }))
        };
    });

    res.json(result);
});

// 获取新产品详情
app.get('/api/products-new/:id', (req, res) => {
    const product = db.prepare('SELECT * FROM products_new WHERE id = ?').get(req.params.id);

    if (!product) {
        return res.status(404).json({ error: '产品不存在' });
    }

    // 获取规格和价格
    const specs = db.prepare(`
        SELECT s.*,
            (SELECT json_group_array(json_object(
                'price_type', pp.price_type,
                'price', pp.price,
                'min_quantity', pp.min_quantity
            )) FROM product_prices pp WHERE pp.spec_id = s.id) as prices_json
        FROM product_specs s
        WHERE s.product_id = ? AND s.is_active = 1
    `).all(product.id);

    // 获取分类
    const categories = db.prepare(`
        SELECT * FROM product_categories WHERE product_id = ?
    `).all(product.id);

    res.json({
        ...product,
        specs: specs.map(s => ({
            id: s.id,
            spec_name: s.spec_name,
            spec_code: s.spec_code,
            weight_grams: s.weight_grams,
            prices: JSON.parse(s.prices_json || '[]')
        })),
        categories: categories.map(c => ({
            category_type: c.category_type,
            category_name: c.category_name
        }))
    });
});

// 统计报表
app.get('/api/stats', (req, res) => {
    const { period, from, to } = req.query;

    let dateFilter = '';
    let todayFilter = "date(order_date) = date('now')";
    let periodSql = '';
    let periodParams = [];

    if (period === 'today') {
        dateFilter = "date(order_date) = date('now')";
    } else if (period === '7days') {
        dateFilter = "date(order_date) >= date('now', '-7 days')";
    } else if (period === '15days') {
        dateFilter = "date(order_date) >= date('now', '-15 days')";
    } else if (period === '30days') {
        dateFilter = "date(order_date) >= date('now', '-30 days')";
    } else if (period === 'month') {
        // 自然月：当月1号到今天
        dateFilter = "date(order_date) >= date('now', 'start of month')";
    } else if (period === 'year') {
        dateFilter = "date(order_date) >= date('now', '-365 days')";
    } else if (period === 'custom' && from && to) {
        dateFilter = "date(order_date) >= ? AND date(order_date) <= ?";
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

    // 期间客户数
    const periodCustomers = db.prepare(`
        SELECT COUNT(DISTINCT customer_id) as cnt
        FROM orders
        ${periodSql}
    `).get(...periodParams);

    res.json({
        today: { count: todayOrders.cnt, total: todayOrders.tot },
        total: { count: periodOrders.cnt, total: periodOrders.tot },
        period_count: periodOrders.cnt,
        period_total: periodOrders.tot,
        period_customers: periodCustomers.cnt,
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
        dateFilter = "date(o.order_date) = date('now')";
    } else if (period === '7days') {
        dateFilter = "date(o.order_date) >= date('now', '-7 days')";
    } else if (period === '15days') {
        dateFilter = "date(o.order_date) >= date('now', '-15 days')";
    } else if (period === '30days') {
        dateFilter = "date(o.order_date) >= date('now', '-30 days')";
    } else if (period === 'month') {
        dateFilter = "date(o.order_date) >= date('now', 'start of month')";
    } else if (period === 'year') {
        dateFilter = "date(o.order_date) >= date('now', '-365 days')";
    } else if (period === 'custom' && from && to) {
        dateFilter = "date(o.order_date) >= date(?) AND date(o.order_date) <= date(?)";
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

// 生成PDF订单 - 使用 pdfkit
const PDFDocument = require('pdfkit');
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

    // 创建 PDF 文档
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="order_${order.order_no}.pdf"`);
    doc.pipe(res);

    // 加载中文字体 - 阿里妈妈普惠体
    let fontName = 'Helvetica';
    let fontBoldName = 'Helvetica-Bold';
    try {
        const fontPath = path.join(__dirname, 'node_modules', '@fontpkg', 'alibaba-puhuiti-2-0', 'AlibabaPuHuiTi-2-55-Regular.ttf');
        const fontBoldPath = path.join(__dirname, 'node_modules', '@fontpkg', 'alibaba-puhuiti-2-0', 'AlibabaPuHuiTi-2-85-Bold.ttf');
        if (fs.existsSync(fontPath)) {
            doc.registerFont('Alibaba-Regular', fontPath);
            doc.registerFont('Alibaba-Bold', fontBoldPath);
            fontName = 'Alibaba-Regular';
            fontBoldName = 'Alibaba-Bold';
            console.log('Alibaba PuHuiTi font loaded successfully');
        }
    } catch (e) {
        console.error('Font loading error:', e.message);
    }

    // 标题
    doc.font(fontBoldName).fontSize(20).text('折石咖啡订单', { align: 'center' });
    doc.font(fontName).fontSize(10).text('上海欧焙客贸易有限公司', { align: 'center' });
    doc.moveDown();

    // 订单信息
    doc.font(fontName).fontSize(11);
    doc.text(`订单号: ${order.order_no}`);
    doc.text(`日期: ${order.created_at}`);
    doc.text(`订购人: ${order.customer_name || '-'}`);
    doc.text(`收件人: ${order.shipping_name || order.customer_name || '-'}`);
    doc.text(`电话: ${order.shipping_phone || order.customer_phone || '-'}`);
    doc.text(`地址: ${order.shipping_address || order.customer_address || '-'}`);
    doc.moveDown();

    // 表格
    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('序号', 50, tableTop);
    doc.text('产品', 80, tableTop);
    doc.text('规格', 220, tableTop);
    doc.text('数量', 320, tableTop);
    doc.text('单价', 380, tableTop);
    doc.text('小计', 460, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    let subtotal = 0;
    items.forEach((item, index) => {
        doc.text((index + 1).toString(), 50, y);
        doc.text((item.product_name || '-').substring(0, 18), 80, y);
        doc.text((item.specs || '-').substring(0, 12), 220, y);
        doc.text(item.quantity.toString(), 320, y);
        doc.text('¥' + item.unit_price, 380, y);
        doc.text('¥' + item.subtotal, 460, y);
        subtotal += item.subtotal || 0;
        y += 18;
    });

    // 获取运费（从备注中解析或使用默认值）
    const shippingFee = order.shipping_fee || 0;
    const totalWithShipping = subtotal + shippingFee;

    // 总计
    y += 10;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 15;
    if (shippingFee > 0) {
        doc.fontSize(11).text(`产品小计: ¥${subtotal}`, 320, y);
        doc.text(`运费: ¥${shippingFee}`, 320, y + 16);
        doc.fontSize(12).text(`合计: ¥${totalWithShipping}`, 380, y + 34);
    } else {
        doc.fontSize(12).text(`合计: ¥${order.total_amount}`, 380, y);
    }
    doc.text(`已付: ¥${order.paid_amount || 0}`, 380, y + 18);
    if (outstanding > 0) {
        doc.text(`应收: ¥${outstanding}`, 380, y + 36, { color: '#ff0000' });
    }

    // 备注
    if (order.note) {
        doc.moveDown(3);
        doc.text(`备注: ${order.note}`);
    }

    // 添加公章浮水印 - 在 end() 之前
    try {
        const stampPath = path.join(__dirname, 'public', 'stamp.png');
        if (fs.existsSync(stampPath)) {
            doc.image(stampPath, 200, 250, {
                fit: [150, 150],
                opacity: 0.2
            });
        }
    } catch (e) {
        console.error('Stamp image error:', e.message);
    }

    doc.end();
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
        dateFilter = "date(o.order_date) = date('now')";
    } else if (period === '7days') {
        dateFilter = "date(o.order_date) >= date('now', '-7 days')";
    } else if (period === '15days') {
        dateFilter = "date(o.order_date) >= date('now', '-15 days')";
    } else if (period === '30days') {
        dateFilter = "date(o.order_date) >= date('now', '-30 days')";
    } else if (period === 'month') {
        dateFilter = "date(o.order_date) >= date('now', 'start of month')";
    } else if (period === 'year') {
        dateFilter = "date(o.order_date) >= date('now', '-365 days')";
    } else if (period === 'custom' && from && to) {
        dateFilter = "date(o.order_date) >= date(?) AND date(o.order_date) <= date(?)";
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
