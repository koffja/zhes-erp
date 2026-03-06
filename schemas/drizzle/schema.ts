import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ============ 订单相关 ============

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNo: text('order_no').unique(),
  customerId: integer('customer_id'),
  totalAmount: real('total_amount'),
  status: text('status').default('pending'), // pending/confirmed/shipped/completed
  shippingName: text('shipping_name'),
  shippingPhone: text('shipping_phone'),
  shippingAddress: text('shipping_address'),
  note: text('note'),
  createdAt: text('created_at').default(new Date().toISOString()),
  paidAmount: real('paid_amount').default(0),
  paymentStatus: text('payment_status').default('unpaid'), // unpaid/paid/partial
  shippingStatus: text('shipping_status').default('pending'), // pending/partial/shipped
  orderDate: text('order_date'),
  shippingFee: real('shipping_fee').default(0)
});

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull(),
  productId: integer('product_id'),
  productName: text('product_name'),
  quantity: integer('quantity'),
  unitPrice: real('unit_price'),
  subtotal: real('subtotal'),
  shippedQuantity: integer('shipped_quantity').default(0),
  shippingStatus: text('shipping_status').default('pending'), // pending/partial/shipped
  unit: text('unit')
});

// ============ 客户相关 ============

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  note: text('note'),
  createdAt: text('created_at').default(new Date().toISOString())
});

// ============ 产品相关 ============

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  category: text('category'), // 生豆/熟豆/粉/挂耳/周边
  specs: text('specs'), // 规格：100g/200g/500g/1kg
  price: real('price'), // 售价
  cost: real('cost'), // 成本
  stock: integer('stock').default(0), // 库存数量
  note: text('note'),
  createdAt: text('created_at').default(new Date().toISOString())
});

export const productAliases = sqliteTable('product_aliases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  alias: text('alias').notNull()
});

// ============ 新产品相关（扩展表） ============

export const productsNew = sqliteTable('products_new', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skuCode: text('sku_code').unique(),
  nameShort: text('name_short').notNull(),
  nameFull: text('name_full'),
  origin: text('origin'),
  region: text('region'),
  variety: text('variety'),
  process: text('process'),
  altitude: text('altitude'),
  grade: text('grade'),
  description: text('description'),
  tags: text('tags'),
  cuppingNotes: text('cupping_notes'),
  roastLevel: text('roast_level'),
  flavorType: text('flavor_type'),
  acidity: text('acidity'),
  isActive: integer('is_active').default(1),
  createdAt: text('created_at').default(new Date().toISOString())
});

export const productSpecs = sqliteTable('product_specs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  specName: text('spec_name').notNull(),
  specCode: text('spec_code').notNull(),
  weightGrams: integer('weight_grams').notNull(),
  isActive: integer('is_active').default(1)
});

export const productPrices = sqliteTable('product_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  specId: integer('spec_id').notNull(),
  priceType: text('price_type').notNull(),
  price: real('price').notNull(),
  minQuantity: integer('min_quantity').default(1),
  validFrom: text('valid_from')
});

export const productCategories = sqliteTable('product_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  categoryType: text('category_type').notNull(),
  categoryName: text('category_name').notNull()
});

// ============ 供应商相关 ============

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category'),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  address: text('address'),
  bank: text('bank'),
  account: text('account'),
  note: text('note'),
  createdAt: text('created_at').default(new Date().toISOString())
});

// ============ 进货相关 ============

export const purchases = sqliteTable('purchases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierId: integer('supplier_id'),
  productName: text('product_name'),
  category: text('category'),
  specs: text('specs'),
  quantity: real('quantity'),
  unitPrice: real('unit_price'),
  totalAmount: real('total_amount'),
  purchaseDate: text('purchase_date'),
  note: text('note'),
  createdAt: text('created_at').default(new Date().toISOString())
});

// ============ 类型导出 ============

export type Order = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderItemInsert = typeof orderItems.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type SupplierInsert = typeof suppliers.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseInsert = typeof purchases.$inferInsert;
