const { db, schema } = require('./drizzle');
const { eq, like, desc, sql, and, gte, lte } = require('drizzle-orm');

/**
 * Drizzle ORM 查询示例
 *
 * 以下展示如何使用 Drizzle 进行常见数据库操作
 * 详细文档: https://orm.drizzle.team
 */

// ============ 订单查询示例 ============

/**
 * 获取订单列表（支持筛选和分页）
 */
async function getOrders({ from, to, customer, page = 1, pageSize = 50 }) {
  const conditions = [];

  if (from) {
    conditions.push(gte(schema.orders.orderDate, from));
  }
  if (to) {
    conditions.push(lte(schema.orders.orderDate, to));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (page - 1) * pageSize;

  // Drizzle 查询
  const orders = await db
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
    .where(whereClause)
    .orderBy(desc(schema.orders.orderDate))
    .limit(pageSize)
    .offset(offset);

  // 获取总数
  const countResult = await db
    .select({ count: sql`count(*)`.mapWith(Number) })
    .from(schema.orders)
    .where(whereClause);

  return {
    data: orders,
    total: countResult[0]?.count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((countResult[0]?.count || 0) / pageSize)
  };
}

/**
 * 获取单个订单详情（含明细）
 */
async function getOrderById(id) {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, id));

  if (!order) return null;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, id));

  return { ...order, items };
}

/**
 * 创建订单
 */
async function createOrder(orderData) {
  const result = await db
    .insert(schema.orders)
    .values({
      orderNo: orderData.orderNo,
      customerId: orderData.customerId,
      totalAmount: orderData.totalAmount,
      status: orderData.status || 'pending',
      shippingName: orderData.shippingName,
      shippingPhone: orderData.shippingPhone,
      shippingAddress: orderData.shippingAddress,
      note: orderData.note,
      paidAmount: orderData.paidAmount || 0,
      paymentStatus: orderData.paymentStatus || 'unpaid',
      shippingStatus: orderData.shippingStatus || 'pending',
      orderDate: orderData.orderDate,
      shippingFee: orderData.shippingFee || 0
    })
    .run();

  return { id: result.lastInsertRowid, ...orderData };
}

/**
 * 更新订单
 */
async function updateOrder(id, data) {
  const updates = {};

  if (data.totalAmount !== undefined) updates.totalAmount = data.totalAmount;
  if (data.status !== undefined) updates.status = data.status;
  if (data.shippingName !== undefined) updates.shippingName = data.shippingName;
  if (data.shippingPhone !== undefined) updates.shippingPhone = data.shippingPhone;
  if (data.shippingAddress !== undefined) updates.shippingAddress = data.shippingAddress;
  if (data.note !== undefined) updates.note = data.note;
  if (data.paidAmount !== undefined) updates.paidAmount = data.paidAmount;
  if (data.paymentStatus !== undefined) updates.paymentStatus = data.paymentStatus;
  if (data.shippingStatus !== undefined) updates.shippingStatus = data.shippingStatus;

  const result = await db
    .update(schema.orders)
    .set(updates)
    .where(eq(schema.orders.id, id))
    .run();

  return result.changes > 0;
}

// ============ 客户查询示例 ============

/**
 * 获取客户列表
 */
async function getCustomers(search) {
  if (search) {
    return db
      .select()
      .from(schema.customers)
      .where(like(schema.customers.name, `%${search}%`));
  }
  return db.select().from(schema.customers).orderBy(desc(schema.customers.createdAt));
}

/**
 * 获取客户详情
 */
async function getCustomerById(id) {
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id));
  return customer || null;
}

/**
 * 创建客户
 */
async function createCustomer(data) {
  const result = await db
    .insert(schema.customers)
    .values({
      name: data.name,
      phone: data.phone,
      address: data.address,
      note: data.note
    })
    .run();

  return { id: result.lastInsertRowid, ...data };
}

// ============ 产品查询示例 ============

/**
 * 获取产品列表
 */
async function getProducts(search) {
  if (search) {
    return db
      .select()
      .from(schema.products)
      .where(like(schema.products.name, `%${search}%`));
  }
  return db.select().from(schema.products);
}

/**
 * 搜索产品（支持别名）
 */
async function searchProducts(query) {
  // 精确匹配
  let results = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.name, query));

  if (results.length === 0) {
    // 模糊匹配
    results = await db
      .select()
      .from(schema.products)
      .where(like(schema.products.name, `%${query}%`));
  }

  if (results.length === 0) {
    // 别名匹配
    const aliases = await db
      .select()
      .from(schema.productAliases)
      .where(like(schema.productAliases.alias, `%${query}%`));

    if (aliases.length > 0) {
      const productIds = [...new Set(aliases.map(a => a.productId))];
      results = await db
        .select()
        .from(schema.products)
        .where(sql`${schema.products.id} IN (${productIds.join(',')})`);
    }
  }

  return results;
}

module.exports = {
  // 订单
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  // 客户
  getCustomers,
  getCustomerById,
  createCustomer,
  // 产品
  getProducts,
  searchProducts,
  // 导出 db 和 schema 供高级用法
  db,
  schema
};
