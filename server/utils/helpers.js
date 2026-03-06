const { db } = require('../db');

/**
 * 查找产品（支持精确匹配、模糊匹配、别名匹配）
 */
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

/**
 * 生成订单号
 */
function generateOrderNo(type = 'ORD') {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    const prefix = type === 'XSD' ? 'XSD' : 'ORD';
    return `${prefix}${year}${month}${day}${random}`;
}

/**
 * 构建订单筛选条件
 */
function buildOrderFilter(params) {
    const { from, to, product, customer, shipping_status, payment_status, has_items } = params;
    let whereClause = '';
    const queryParams = [];

    // 日期筛选（使用 order_date）
    if (from && to) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += " date(o.order_date) BETWEEN ? AND ?";
        queryParams.push(from, to);
    } else if (from) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += " date(o.order_date) >= ?";
        queryParams.push(from);
    } else if (to) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += " date(o.order_date) <= ?";
        queryParams.push(to);
    }

    // 发货状态筛选
    if (shipping_status) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += ' o.shipping_status = ?';
        queryParams.push(shipping_status);
    }

    // 付款状态筛选
    if (payment_status) {
        whereClause += whereClause ? ' AND ' : ' WHERE ';
        whereClause += ' o.payment_status = ?';
        queryParams.push(payment_status);
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

    return { whereClause, queryParams };
}

module.exports = {
    findProduct,
    generateOrderNo,
    buildOrderFilter
};
