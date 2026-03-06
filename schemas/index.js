/**
 * 折石ERP数据库 Schema 定义
 *
 * 本文件定义了所有数据表的字段结构，供AI在开发时参考
 * 不包含外键约束定义（SQLite中外键是可选的）
 */

const schemas = {
  // ============ 订单相关 ============

  orders: {
    table: 'orders',
    description: '订单主表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'order_no', type: 'TEXT', unique: true, description: '订单号（如 XSD2603010001）' },
      { name: 'customer_id', type: 'INTEGER', description: '客户ID，关联customers表' },
      { name: 'total_amount', type: 'REAL', description: '订单总金额' },
      { name: 'status', type: 'TEXT', default: 'pending', description: '订单状态：pending/confirmed/shipped/completed' },
      { name: 'shipping_name', type: 'TEXT', description: '收货人姓名' },
      { name: 'shipping_phone', type: 'TEXT', description: '收货人电话' },
      { name: 'shipping_address', type: 'TEXT', description: '收货地址' },
      { name: 'note', type: 'TEXT', description: '备注' },
      { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP', description: '创建时间' },
      { name: 'paid_amount', type: 'REAL', default: 0, description: '已付金额' },
      { name: 'payment_status', type: 'TEXT', default: 'unpaid', description: '付款状态：unpaid/paid/partial' },
      { name: 'shipping_status', type: 'TEXT', default: 'pending', description: '发货状态：pending/partial/shipped' },
      { name: 'order_date', type: 'DATE', description: '订单日期（从订单号提取）' },
      { name: 'shipping_fee', type: 'REAL', default: 0, description: '运费' }
    ]
  },

  order_items: {
    table: 'order_items',
    description: '订单明细表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'order_id', type: 'INTEGER', notnull: true, description: '订单ID，关联orders表' },
      { name: 'product_id', type: 'INTEGER', description: '产品ID，关联products表' },
      { name: 'product_name', type: 'TEXT', description: '产品名称（冗余存储）' },
      { name: 'quantity', type: 'INTEGER', description: '数量' },
      { name: 'unit_price', type: 'REAL', description: '单价' },
      { name: 'subtotal', type: 'REAL', description: '小计（quantity * unit_price）' },
      { name: 'shipped_quantity', type: 'INTEGER', default: 0, description: '已发货数量' },
      { name: 'shipping_status', type: 'TEXT', default: 'pending', description: '发货状态：pending/partial/shipped' },
      { name: 'unit', type: 'TEXT', description: '单位' }
    ]
  },

  // ============ 客户相关 ============

  customers: {
    table: 'customers',
    description: '客户表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'name', type: 'TEXT', notnull: true, description: '客户名称' },
      { name: 'phone', type: 'TEXT', description: '电话' },
      { name: 'address', type: 'TEXT', description: '地址' },
      { name: 'note', type: 'TEXT', description: '备注' },
      { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP', description: '创建时间' }
    ]
  },

  // ============ 产品相关 ============

  products: {
    table: 'products',
    description: '产品资料表（原有）',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'name', type: 'TEXT', notnull: true, unique: true, description: '产品名称' },
      { name: 'category', type: 'TEXT', description: '分类：生豆/熟豆/粉/挂耳/周边' },
      { name: 'specs', type: 'TEXT', description: '规格：100g/200g/500g/1kg' },
      { name: 'price', type: 'REAL', description: '售价' },
      { name: 'cost', type: 'REAL', description: '成本' },
      { name: 'stock', type: 'INTEGER', default: 0, description: '库存数量' },
      { name: 'note', type: 'TEXT', description: '备注' },
      { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP', description: '创建时间' }
    ]
  },

  product_aliases: {
    table: 'product_aliases',
    description: '产品别名表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'product_id', type: 'INTEGER', notnull: true, description: '产品ID，关联products表' },
      { name: 'alias', type: 'TEXT', notnull: true, description: '别名' }
    ]
  },

  // ============ 新产品相关（扩展表） ============

  products_new: {
    table: 'products_new',
    description: '新产品资料表（扩展版）',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'sku_code', type: 'TEXT', unique: true, description: 'SKU编码' },
      { name: 'name_short', type: 'TEXT', notnull: true, description: '产品简称' },
      { name: 'name_full', type: 'TEXT', description: '产品全称' },
      { name: 'origin', type: 'TEXT', description: '原产地' },
      { name: 'region', type: 'TEXT', description: '产区' },
      { name: 'variety', type: 'TEXT', description: '品种' },
      { name: 'process', type: 'TEXT', description: '处理法' },
      { name: 'altitude', type: 'TEXT', description: '海拔' },
      { name: 'grade', type: 'TEXT', description: '等级' },
      { name: 'description', type: 'TEXT', description: '描述' },
      { name: 'tags', type: 'TEXT', description: '标签（逗号分隔）' },
      { name: 'cupping_notes', type: 'TEXT', description: '杯测笔记' },
      { name: 'roast_level', type: 'TEXT', description: '烘焙度' },
      { name: 'flavor_type', type: 'TEXT', description: '风味类型' },
      { name: 'acidity', type: 'TEXT', description: '酸度' },
      { name: 'is_active', type: 'INTEGER', default: 1, description: '是否启用' },
      { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP', description: '创建时间' }
    ]
  },

  product_specs: {
    table: 'product_specs',
    description: '产品规格表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'product_id', type: 'INTEGER', notnull: true, description: '产品ID，关联products_new表' },
      { name: 'spec_name', type: 'TEXT', notnull: true, description: '规格名称（如：100g）' },
      { name: 'spec_code', type: 'TEXT', notnull: true, description: '规格代码' },
      { name: 'weight_grams', type: 'INTEGER', notnull: true, description: '重量（克）' },
      { name: 'is_active', type: 'INTEGER', default: 1, description: '是否启用' }
    ]
  },

  product_prices: {
    table: 'product_prices',
    description: '产品价格表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'spec_id', type: 'INTEGER', notnull: true, description: '规格ID，关联product_specs表' },
      { name: 'price_type', type: 'TEXT', notnull: true, description: '价格类型（如：retail批发/ wholesale零售）' },
      { name: 'price', type: 'REAL', notnull: true, description: '价格' },
      { name: 'min_quantity', type: 'INTEGER', default: 1, description: '最小起订量' },
      { name: 'valid_from', type: 'DATE', description: '生效日期' }
    ]
  },

  product_categories: {
    table: 'product_categories',
    description: '产品分类表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'product_id', type: 'INTEGER', notnull: true, description: '产品ID，关联products_new表' },
      { name: 'category_type', type: 'TEXT', notnull: true, description: '分类类型（如：process处理法）' },
      { name: 'category_name', type: 'TEXT', notnull: true, description: '分类名称' }
    ]
  },

  // ============ 供应商相关 ============

  suppliers: {
    table: 'suppliers',
    description: '供应商表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'name', type: 'TEXT', notnull: true, description: '供应商名称' },
      { name: 'category', type: 'TEXT', description: '分类' },
      { name: 'contact_person', type: 'TEXT', description: '联系人' },
      { name: 'phone', type: 'TEXT', description: '电话' },
      { name: 'address', type: 'TEXT', description: '地址' },
      { name: 'bank', type: 'TEXT', description: '开户银行' },
      { name: 'account', type: 'TEXT', description: '银行账号' },
      { name: 'note', type: 'TEXT', description: '备注' },
      { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP', description: '创建时间' }
    ]
  },

  // ============ 进货相关 ============

  purchases: {
    table: 'purchases',
    description: '进货记录表',
    columns: [
      { name: 'id', type: 'INTEGER', primary: true, description: '主键ID' },
      { name: 'supplier_id', type: 'INTEGER', description: '供应商ID，关联suppliers表' },
      { name: 'product_name', type: 'TEXT', description: '产品名称' },
      { name: 'category', type: 'TEXT', description: '分类' },
      { name: 'specs', type: 'TEXT', description: '规格' },
      { name: 'quantity', type: 'REAL', description: '数量' },
      { name: 'unit_price', type: 'REAL', description: '单价' },
      { name: 'total_amount', type: 'REAL', description: '总金额' },
      { name: 'purchase_date', type: 'DATE', description: '进货日期' },
      { name: 'note', type: 'TEXT', description: '备注' },
      { name: 'created_at', type: 'DATETIME', default: 'CURRENT_TIMESTAMP', description: '创建时间' }
    ]
  }
};

/**
 * 获取表结构
 * @param {string} tableName - 表名
 * @returns {object|null} 表结构对象
 */
function getTableSchema(tableName) {
  return schemas[tableName] || null;
}

/**
 * 获取所有表名
 * @returns {string[]} 表名数组
 */
function getAllTableNames() {
  return Object.keys(schemas);
}

module.exports = {
  schemas,
  getTableSchema,
  getAllTableNames
};
