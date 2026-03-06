const express = require('express');
const router = express.Router();
const { db: drizzleDb, schema } = require('../db/drizzle');
const { db: sqlDb } = require('../db');  // 原生 SQL 用于复杂查询
const { eq, desc, sql, and, or, like, gte, lte } = require('drizzle-orm');
const { findProduct, generateOrderNo } = require('../utils/helpers');

// 简化：大部分复杂查询使用原生 SQL，只有简单 CRUD 使用 Drizzle
// sqlDb 用于原生 SQL，drizzleDb 用于 Drizzle

// 获取订单日期范围（最早和最晚日期）
router.get('/date-range', (req, res) => {
    try {
        const result = sqlDb.prepare(`
            SELECT
                MIN(date(order_date)) as earliest,
                MAX(date(order_date)) as latest
            FROM orders
            WHERE order_date IS NOT NULL
        `).get();

        res.json({
            earliest: result?.earliest || null,
            latest: result?.latest || new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        res.json({
            earliest: null,
            latest: new Date().toISOString().split('T')[0]
        });
    }
});

// 获取所有订单（支持分页和筛选）
// 注意：列表查询包含复杂聚合和子查询，保留原生 SQL
router.get('/', (req, res) => {
    const { from, to, product, customer, shipping_status, payment_status, has_items, page = 1, pageSize = 50 } = req.query;

    // 构建筛选条件
    let whereClause = '';
    const params = [];

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

    if (shipping_status) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += ' o.shipping_status = ?';
        params.push(shipping_status);
    }

    if (payment_status) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += ' o.payment_status = ?';
        params.push(payment_status);
    }

    if (has_items !== undefined) {
        if (has_items === '0') {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += ' o.id NOT IN (SELECT DISTINCT order_id FROM order_items)';
        } else if (has_items === '1') {
            whereClause += whereClause ? ' AND ' : ' WHERE ';
            whereClause += ' o.id IN (SELECT DISTINCT order_id FROM order_items)';
        }
    }

    // 产品筛选 - 需要在 SQL 中处理
    // 转义 SQL LIKE 中的特殊字符（%, _, \）
    let productFilter = '';
    let productParams = [];
    if (product) {
        const escapedProduct = product.replace(/[%_\\]/g, '\\$&');  // 转义: % _ \
        productParams = [escapedProduct];
        const joinWord = whereClause ? ' AND ' : ' WHERE ';
        productFilter = `${joinWord} o.id IN (SELECT DISTINCT oi.order_id FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE p.name LIKE '%' || ? || '%' ESCAPE '\\')`;
    }

    // 先获取总数（使用原生SQL）
    const countSql = `SELECT COUNT(*) as total FROM orders o LEFT JOIN customers c ON o.customer_id = c.id ${whereClause}${productFilter}`;
    const countParams = [...params, ...productParams];
    const totalResult = sqlDb.prepare(countSql).get(...countParams);
    const total = totalResult.total;

    // 分页参数
    const currentPage = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (currentPage - 1) * size;

    let orders = sqlDb.prepare(`
        SELECT o.*, c.name as customer_name, c.phone as customer_phone,
            (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as total_items,
            (SELECT SUM(COALESCE(oi.shipped_quantity, 0)) FROM order_items oi WHERE oi.order_id = o.id) as shipped_items,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.shipping_status = 'shipped') as fully_shipped_items,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.shipping_status = 'partial') as partial_shipped_items
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        ${whereClause}${productFilter}
        ORDER BY o.order_date DESC
        LIMIT ? OFFSET ?
    `).all(...countParams, size, offset);

    // 客户筛选 - 这个可以在内存中过滤，因为客户名是主查询的一部分
    if (customer) {
        orders = orders.filter(o => o.customer_name && o.customer_name.includes(customer));
    }

    // 计算发货状态并获取明细
    const ordersWithItems = orders.map(order => {
        let shippingStatus = order.shipping_status || 'pending';
        const totalItems = order.total_items || 0;
        const shippedItems = order.shipped_items || 0;

        if (totalItems > 0) {
            if (shippedItems > 0 && shippedItems < totalItems) {
                shippingStatus = 'partial';
            } else if (shippedItems >= totalItems) {
                shippingStatus = 'shipped';
            }
        }

        const items = sqlDb.prepare(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(order.id);

        return { ...order, items, shipping_status: shippingStatus, total_items: totalItems, shipped_items: shippedItems };
    });

    res.json({
        data: ordersWithItems,
        total: total,
        page: currentPage,
        pageSize: size,
        totalPages: Math.ceil(total / size)
    });
});

// 获取订单详情（使用 Drizzle）
router.get('/:id', async (req, res) => {
    try {
        const [order] = await drizzleDb
            .select({
                id: schema.orders.id,
                orderNo: schema.orders.orderNo,
                customerId: schema.orders.customerId,
                totalAmount: schema.orders.totalAmount,
                status: schema.orders.status,
                shippingName: schema.orders.shippingName,
                shippingPhone: schema.orders.shippingPhone,
                shippingAddress: schema.orders.shippingAddress,
                note: schema.orders.note,
                createdAt: schema.orders.createdAt,
                paidAmount: schema.orders.paidAmount,
                paymentStatus: schema.orders.paymentStatus,
                shippingStatus: schema.orders.shippingStatus,
                orderDate: schema.orders.orderDate,
                shippingFee: schema.orders.shippingFee
            })
            .from(schema.orders)
            .where(eq(schema.orders.id, parseInt(req.params.id)));

        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        // 获取关联客户信息
        if (order.customerId) {
            const [customer] = await drizzleDb
                .select({
                    name: schema.customers.name,
                    phone: schema.customers.phone,
                    address: schema.customers.address
                })
                .from(schema.customers)
                .where(eq(schema.customers.id, order.customerId));

            if (customer) {
                order.customer_name = customer.name;
                order.customer_phone = customer.phone;
                order.customer_address = customer.address;
            }
        }

        // 获取订单明细
        const items = await drizzleDb
            .select({
                id: schema.orderItems.id,
                orderId: schema.orderItems.orderId,
                productId: schema.orderItems.productId,
                productName: schema.orderItems.productName,
                quantity: schema.orderItems.quantity,
                unitPrice: schema.orderItems.unitPrice,
                subtotal: schema.orderItems.subtotal,
                shippedQuantity: schema.orderItems.shippedQuantity,
                shippingStatus: schema.orderItems.shippingStatus,
                unit: schema.orderItems.unit
            })
            .from(schema.orderItems)
            .where(eq(schema.orderItems.orderId, order.id));

        // 获取产品名称
        for (const item of items) {
            if (item.productId) {
                const [product] = await drizzleDb
                    .select({ name: schema.products.name, specs: schema.products.specs })
                    .from(schema.products)
                    .where(eq(schema.products.id, item.productId));
                if (product) {
                    item.product_name = product.name;
                    item.specs = product.specs;
                }
            }
        }

        res.json({ ...order, items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新订单（使用 Drizzle）
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        order_no, customer_id, total_amount, status,
        shipping_name, shipping_phone, shipping_address,
        note, order_date, paid_amount, payment_status, shipping_status
    } = req.body;

    const updates = {};

    if (order_no !== undefined) updates.orderNo = order_no;
    if (customer_id !== undefined) updates.customerId = customer_id;
    if (total_amount !== undefined) updates.totalAmount = total_amount;
    if (status !== undefined) updates.status = status;
    if (shipping_name !== undefined) updates.shippingName = shipping_name;
    if (shipping_phone !== undefined) updates.shippingPhone = shipping_phone;
    if (shipping_address !== undefined) updates.shippingAddress = shipping_address;
    if (note !== undefined) updates.note = note;
    if (order_date !== undefined) updates.orderDate = order_date;
    if (paid_amount !== undefined) updates.paidAmount = paid_amount;
    if (payment_status !== undefined) updates.paymentStatus = payment_status;
    if (shipping_status !== undefined) updates.shippingStatus = shipping_status;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: '没有要更新的字段' });
    }

    try {
        const result = await drizzleDb
            .update(schema.orders)
            .set(updates)
            .where(eq(schema.orders.id, parseInt(id)))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 发货（保留原生事务处理）
router.post('/:id/ship', (req, res) => {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: '请提供发货明细' });
    }

    try {
        const updateStmt = sqlDb.prepare('UPDATE order_items SET shipped_quantity = ?, shipping_status = ? WHERE id = ?');

        sqlDb.transaction(() => {
            for (const item of items) {
                const { orderItemId, shippedQuantity } = item;
                let shippingStatus = 'pending';
                const current = sqlDb.prepare('SELECT quantity FROM order_items WHERE id = ?').get(orderItemId);
                if (current && shippedQuantity >= current.quantity) {
                    shippingStatus = 'shipped';
                } else if (shippedQuantity > 0) {
                    shippingStatus = 'partial';
                }
                updateStmt.run(shippedQuantity, shippingStatus, orderItemId);
            }

            // 更新订单整体发货状态
            const orderItems = sqlDb.prepare('SELECT SUM(quantity) as total, SUM(shipped_quantity) as shipped FROM order_items WHERE order_id = ?').get(id);
            let shippingStatus = 'pending';
            if (orderItems && orderItems.shipped > 0) {
                if (orderItems.shipped >= orderItems.total) {
                    shippingStatus = 'shipped';
                } else {
                    shippingStatus = 'partial';
                }
            }
            sqlDb.prepare('UPDATE orders SET shipping_status = ? WHERE id = ?').run(shippingStatus, id);
        })();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建订单（部分使用 Drizzle）
router.post('/', async (req, res) => {
    const {
        order_no, customer_id, total_amount, status,
        shipping_name, shipping_phone, shipping_address,
        note, items
    } = req.body;

    const newOrderNo = order_no || generateOrderNo('XSD');

    try {
        // 使用 Drizzle 插入订单
        const result = await drizzleDb
            .insert(schema.orders)
            .values({
                orderNo: newOrderNo,
                customerId: customer_id || null,
                totalAmount: total_amount || 0,
                status: status || 'pending',
                shippingName: shipping_name,
                shippingPhone: shipping_phone,
                shippingAddress: shipping_address,
                note: note,
                orderDate: new Date().toISOString().split('T')[0]
            })
            .run();

        const orderId = result.lastInsertRowid;

        // 添加订单明细
        if (items && items.length > 0) {
            for (const item of items) {
                const product = findProduct(item.product_name);
                await drizzleDb
                    .insert(schema.orderItems)
                    .values({
                        orderId: orderId,
                        productId: product ? product.id : null,
                        productName: item.product_name,
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        specs: item.specs,
                        subtotal: (item.quantity || 0) * (item.unit_price || 0)
                    })
                    .run();
            }
        }

        res.json({ success: true, id: orderId, order_no: newOrderNo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取客户订单（保留原生 SQL）
router.get('/customer/:id', (req, res) => {
    const orders = sqlDb.prepare(`
        SELECT o.*, (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as total_items
        FROM orders o
        WHERE o.customer_id = ?
        ORDER BY o.created_at DESC
    `).all(req.params.id);

    res.json(orders);
});

// 删除订单（使用 Drizzle）
router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);

    try {
        // 先删除关联的订单明细
        await drizzleDb
            .delete(schema.orderItems)
            .where(eq(schema.orderItems.orderId, id))
            .run();

        // 再删除订单
        const result = await drizzleDb
            .delete(schema.orders)
            .where(eq(schema.orders.id, id))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
