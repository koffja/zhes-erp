<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from '../api'

const products = ref([])
const loading = ref(true)
const editingId = ref(null)
const editField = ref(null)
const editValue = ref('')

// 筛选相关
const searchQuery = ref('')
const selectedCategory = ref('all')
const selectedTag = ref('all')
const categories = ref([])
const tags = ref([])

// 列选择相关
const showColumnPicker = ref(false)
const allFields = [
  { key: 'sku_code', label: '唯一编码' },
  { key: 'full_name', label: '产品全称' },
  { key: 'name', label: '简称' },
  { key: 'category', label: '分类' },
  { key: 'specs', label: '规格' },
  { key: 'tags', label: '标签' },
  { key: 'roast', label: '烘焙' },
  { key: 'flavor', label: '香型' },
  { key: 'region', label: '产区' },
  { key: 'tasting_notes', label: '风味' },
  { key: 'price', label: '享味价' },
  { key: 'merchant_price', label: '商户价' },
  { key: 'bulk_price', label: '批发价' },
  { key: 'super_bulk_price', label: '超大批价' },
  { key: 'stock', label: '库存' },
]

// 用户选择的列（默认全选）
const visibleFields = ref([...allFields.map(f => f.key)])

// 详情弹窗
const showDetail = ref(false)
const detailProduct = ref(null)
const productOrders = ref([])
const detailLoading = ref(false)

// 订单弹窗
const showOrderModal = ref(false)
const orderModalTitle = ref('')
const orderModalOrders = ref([])
const orderModalLoading = ref(false)

// 订单详情弹窗
const showOrderDetailModal = ref(false)
const orderDetailData = ref(null)
const orderDetailLoading = ref(false)

const viewOrderDetail = async (orderId) => {
  showOrderDetailModal.value = true
  orderDetailLoading.value = true
  try {
    orderDetailData.value = await api.getOrder(orderId)
  } catch (e) {
    console.error('获取订单详情失败:', e)
    orderDetailData.value = null
  }
  orderDetailLoading.value = false
}

const loadProducts = async () => {
  loading.value = true
  products.value = await api.getProducts(searchQuery.value, selectedCategory.value, selectedTag.value)
  loading.value = false
}

const loadCategories = async () => {
  categories.value = await api.getProductCategories()
}

const loadTags = async () => {
  tags.value = await api.getProductTags()
}

const applyFilters = () => {
  loadProducts()
}

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = 'all'
  selectedTag.value = 'all'
  loadProducts()
}

// 防抖搜索
let searchTimeout = null
const onSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadProducts()
  }, 300)
}

const formatPrice = (val) => {
  if (val === null || val === undefined || val === '') return '-'
  return `¥${Number(val).toFixed(2)}`
}

const startEdit = (product, field) => {
  editingId.value = product.id
  editField.value = field
  editValue.value = product[field] ?? ''
}

const saveEdit = async (product) => {
  const field = editField.value

  // 防止重复触发
  if (!field) {
    return
  }

  console.log('saveEdit - field:', field, 'editValue:', editValue.value)

  // 判断字段类型
  let data = {}
  if (field.includes('price') || field === 'stock') {
    data[field] = parseFloat(editValue.value) || 0
  } else {
    data[field] = editValue.value
  }

  // 映射到数据库字段名（camelCase 转 snake_case）
  const fieldMap = {
    'fullName': 'full_name',
    'merchantPrice': 'merchant_price',
    'bulkPrice': 'bulk_price',
    'superBulkPrice': 'super_bulk_price',
    'tastingNotes': 'tasting_notes',
  }

  // 转换为数据库字段名
  const dbField = fieldMap[field] || field
  const dbData = { id: product.id }
  dbData[dbField] = data[field]

  console.log('saveEdit - dbData:', JSON.stringify(dbData))

  try {
    const result = await api.updateProduct(product.id, dbData)
    console.log('saveEdit - result:', result)

    if (result.error) {
      alert(result.error)
    } else {
      // 直接更新本地数据，Vue 自动响应式更新
      product[field] = data[field]
      if (fieldMap[field]) {
        product[fieldMap[field]] = data[field]
      }
    }
  } catch (e) {
    console.error('saveEdit - error:', e)
    alert('保存失败: ' + e.message)
  }

  editingId.value = null
  editField.value = null
}

const cancelEdit = () => {
  editingId.value = null
  editField.value = null
}

const deleteProduct = async (id) => {
  if (!confirm('确定要删除这个产品吗？')) return
  await api.deleteProduct(id)
  loadProducts()
}

// 查看产品详情
const viewDetail = async (product) => {
  detailProduct.value = { ...product }
  showDetail.value = true
}

// 查看产品订单
const viewProductOrders = async (product) => {
  orderModalTitle.value = `${product.name || product.full_name || product.sku_code} - 订单列表`
  orderModalLoading.value = true
  showOrderModal.value = true

  try {
    orderModalOrders.value = await api.getProductOrders(product.id)
  } catch (e) {
    console.error('获取订单失败:', e)
    orderModalOrders.value = []
  }
  orderModalLoading.value = false
}

// 保存详情
const saveDetail = async () => {
  const p = detailProduct.value
  const data = {
    name: p.name,
    category: p.category,
    specs: p.specs,
    price: p.price,
    cost: p.cost,
    stock: p.stock,
    note: p.note,
    sku_code: p.sku_code,
    full_name: p.full_name,
    tags: p.tags,
    roast: p.roast,
    flavor: p.flavor,
    region: p.region,
    tasting_notes: p.tasting_notes,
    merchant_price: p.merchant_price,
    bulk_price: p.bulk_price,
    super_bulk_price: p.super_bulk_price,
  }

  await api.updateProduct(p.id, data)
  loadProducts()
  showDetail.value = false
}

// 列选择
const toggleField = (key) => {
  const idx = visibleFields.value.indexOf(key)
  if (idx >= 0) {
    visibleFields.value.splice(idx, 1)
  } else {
    visibleFields.value.push(key)
  }
}

const getCellValue = (product, field) => {
  if (field.includes('price')) {
    return formatPrice(product[field])
  }
  return product[field] ?? '-'
}

// 获取字段显示
const visibleFieldsList = computed(() => {
  return allFields.filter(f => visibleFields.value.includes(f.key))
})

onMounted(async () => {
  await loadCategories()
  await loadTags()
  loadProducts()
})
</script>

<template>
  <div class="products-page">
    <div class="page-header">
      <h1>📋 产品资料</h1>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-bar">
      <div class="search-box">
        <input
          type="text"
          v-model="searchQuery"
          @input="onSearchInput"
          @keyup.enter="applyFilters"
          placeholder="搜索产品名称..."
          class="search-input"
        />
      </div>

      <select v-model="selectedCategory" @change="applyFilters" class="category-select">
        <option value="all">全部分类</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <select v-model="selectedTag" @change="applyFilters" class="category-select">
        <option value="all">全部标签</option>
        <option v-for="tag in tags" :key="tag" :value="tag">{{ tag }}</option>
      </select>

      <button class="secondary" @click="clearFilters" v-if="searchQuery || selectedCategory !== 'all' || selectedTag !== 'all'">
        清除筛选
      </button>

      <button class="secondary" @click="showColumnPicker = !showColumnPicker">
        {{ showColumnPicker ? '隐藏列选择' : '选择列' }}
      </button>

      <span class="product-count">共 {{ products.length }} 个产品</span>
    </div>

    <!-- 列选择面板 -->
    <div v-if="showColumnPicker" class="column-picker">
      <div class="column-picker-title">选择显示的列：</div>
      <div class="column-options">
        <label v-for="f in allFields" :key="f.key" class="column-option">
          <input
            type="checkbox"
            :checked="visibleFields.includes(f.key)"
            @change="toggleField(f.key)"
          />
          {{ f.label }}
        </label>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>序号</th>
              <th v-for="f in visibleFieldsList" :key="f.key">{{ f.label }}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, idx) in products" :key="p.id">
              <td>{{ idx + 1 }}</td>
              <td v-for="f in visibleFieldsList" :key="f.key"
                  class="editable"
                  @click="startEdit(p, f.key)">
                <template v-if="editingId === p.id && editField === f.key">
                  <input
                    v-model="editValue"
                    @blur="saveEdit(p)"
                    @keyup.enter="saveEdit(p)"
                    @keyup.escape="cancelEdit"
                    autofocus
                    class="edit-input"
                  />
                </template>
                <template v-else>
                  {{ getCellValue(p, f.key) }}
                </template>
              </td>
              <td class="action-cell">
                <button class="action-btn" @click="viewProductOrders(p)" title="查看订单">📋</button>
                <button class="action-btn" @click="viewDetail(p)" title="详情">👁</button>
                <button class="danger" @click="deleteProduct(p.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 产品详情弹窗 -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>产品详情</h2>
          <button class="close-btn" @click="showDetail = false">&times;</button>
        </div>
        <div class="modal-body" v-if="detailProduct">
          <div class="detail-section">
            <h3>基本信息 <button class="save-btn" @click="saveDetail">保存</button></h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>唯一编码</label>
                <input v-model="detailProduct.sku_code" class="detail-input" placeholder="SKU编码" />
              </div>
              <div class="detail-item">
                <label>产品简称</label>
                <input v-model="detailProduct.name" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>产品全称</label>
                <input v-model="detailProduct.full_name" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>分类</label>
                <input v-model="detailProduct.category" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>规格</label>
                <input v-model="detailProduct.specs" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>标签(TAG)</label>
                <input v-model="detailProduct.tags" class="detail-input" placeholder="用逗号分隔" />
              </div>
              <div class="detail-item">
                <label>烘焙度</label>
                <input v-model="detailProduct.roast" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>香型</label>
                <input v-model="detailProduct.flavor" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>产区</label>
                <input v-model="detailProduct.region" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>风味描述</label>
                <input v-model="detailProduct.tasting_notes" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>享味价</label>
                <input v-model.number="detailProduct.price" type="number" step="0.01" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>商户价</label>
                <input v-model.number="detailProduct.merchant_price" type="number" step="0.01" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>批发价</label>
                <input v-model.number="detailProduct.bulk_price" type="number" step="0.01" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>超大批价</label>
                <input v-model.number="detailProduct.super_bulk_price" type="number" step="0.01" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>成本价</label>
                <input v-model.number="detailProduct.cost" type="number" step="0.01" class="detail-input" />
              </div>
              <div class="detail-item">
                <label>库存</label>
                <input v-model.number="detailProduct.stock" type="number" class="detail-input" />
              </div>
              <div class="detail-item full-width">
                <label>备注</label>
                <input v-model="detailProduct.note" class="detail-input" placeholder="备注信息" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 产品订单弹窗 -->
    <div v-if="showOrderModal" class="modal-overlay" @click.self="showOrderModal = false">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>{{ orderModalTitle }}</h2>
          <button class="close-btn" @click="showOrderModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="orderModalLoading" class="loading">加载中...</div>
          <div v-else-if="orderModalOrders.length === 0" class="empty">暂无订单</div>
          <div v-else class="order-list">
            <div v-for="order in orderModalOrders" :key="order.id" class="order-item clickable" @click="viewOrderDetail(order.id)">
              <span class="order-date">{{ order.orderDate?.substring(0, 10) || '-' }}</span>
              <span class="order-no">{{ order.orderNo }}</span>
              <span class="order-amount">¥{{ (order.totalAmount || 0).toFixed(2) }}</span>
              <span class="order-paid">已付: ¥{{ (order.paidAmount || 0).toFixed(2) }}</span>
              <span :class="['order-status', order.status]">{{ order.status || '已完成' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 订单详情弹窗 -->
    <div v-if="showOrderDetailModal" class="modal-overlay" @click.self="showOrderDetailModal = false">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>订单详情 - {{ orderDetailData?.orderNo }}</h2>
          <button class="close-btn" @click="showOrderDetailModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="orderDetailLoading" class="loading">加载中...</div>
          <div v-else-if="orderDetailData" class="order-detail">
            <div class="detail-section">
              <h3>订单信息</h3>
              <div class="detail-grid">
                <div class="detail-item">
                  <label>订单号</label>
                  <span>{{ orderDetailData.orderNo }}</span>
                </div>
                <div class="detail-item">
                  <label>订单日期</label>
                  <span>{{ orderDetailData.orderDate?.substring(0, 10) || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>订单状态</label>
                  <span :class="['status-badge', orderDetailData.status]">{{ orderDetailData.status || '已完成' }}</span>
                </div>
                <div class="detail-item">
                  <label>支付状态</label>
                  <span>{{ orderDetailData.paymentStatus || '未支付' }}</span>
                </div>
                <div class="detail-item">
                  <label>发货状态</label>
                  <span>{{ orderDetailData.shippingStatus || '待发货' }}</span>
                </div>
                <div class="detail-item">
                  <label>客户</label>
                  <span>{{ orderDetailData.customer_name || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>电话</label>
                  <span>{{ orderDetailData.customer_phone || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>地址</label>
                  <span>{{ orderDetailData.customer_address || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>收货人</label>
                  <span>{{ orderDetailData.shippingName || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>收货电话</label>
                  <span>{{ orderDetailData.shippingPhone || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>收货地址</label>
                  <span>{{ orderDetailData.shippingAddress || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>运费</label>
                  <span>¥{{ (orderDetailData.shippingFee || 0).toFixed(2) }}</span>
                </div>
                <div class="detail-item">
                  <label>订单金额</label>
                  <span class="amount">¥{{ (orderDetailData.totalAmount || 0).toFixed(2) }}</span>
                </div>
                <div class="detail-item">
                  <label>已付金额</label>
                  <span class="amount-paid">¥{{ (orderDetailData.paidAmount || 0).toFixed(2) }}</span>
                </div>
                <div class="detail-item full-width">
                  <label>备注</label>
                  <span>{{ orderDetailData.note || '-' }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h3>订单明细</h3>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>产品</th>
                    <th>规格</th>
                    <th>数量</th>
                    <th>单价</th>
                    <th>小计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in orderDetailData.items" :key="item.id">
                    <td>{{ item.product_name || item.productName || '-' }}</td>
                    <td>{{ item.specs || '-' }}</td>
                    <td>{{ item.quantity }}{{ item.unit || '个' }}</td>
                    <td>¥{{ (item.unitPrice || 0).toFixed(2) }}</td>
                    <td>¥{{ (item.subtotal || 0).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="empty">无法加载订单详情</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--action-accent);
}

.category-select {
  padding: 8px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
  min-width: 120px;
}

.category-select:focus {
  outline: none;
  border-color: var(--action-accent);
}

.product-count {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 14px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.table-wrapper {
  overflow-x: auto;
}

.column-picker {
  background: var(--bg-elevated);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.column-picker-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.column-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.column-option {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
}

.column-option input {
  cursor: pointer;
}

.editable {
  cursor: pointer;
  padding: 8px;
  min-width: 60px;
}

.editable:hover {
  background: var(--zhe-ash-rose-hover);
}

.edit-input {
  width: 100%;
  padding: 4px 8px;
  border: 2px solid var(--action-accent);
  border-radius: 4px;
  font-size: inherit;
}

.action-cell {
  white-space: nowrap;
}

.action-btn {
  background: var(--action-accent);
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 4px;
  font-size: 14px;
}

.action-btn:hover {
  background: var(--zhe-ash-rose-hover);
}

.danger {
  background: var(--zhe-terracotta);
  color: white;
  padding: 4px 12px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.danger:hover {
  background: var(--zhe-terracotta-hover);
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-item label {
  font-size: 12px;
  color: var(--text-muted);
}

.detail-input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.detail-input:focus {
  outline: none;
  border-color: var(--action-accent);
}

.save-btn {
  margin-left: 12px;
  padding: 4px 12px;
  background: var(--action-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.save-btn:hover {
  background: var(--action-primary-hover);
}

.order-list {
  max-height: 400px;
  overflow-y: auto;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.order-item.clickable {
  cursor: pointer;
  transition: background 0.2s;
}

.order-item.clickable:hover {
  background: var(--zhe-ash-rose-hover);
}

.order-item:last-child {
  border-bottom: none;
}

.order-date {
  color: var(--text-muted);
  width: 90px;
}

.order-no {
  flex: 1;
  color: var(--text-secondary);
}

.order-amount {
  font-weight: 600;
  color: var(--text-primary);
  width: 90px;
  text-align: right;
}

.order-paid {
  color: var(--text-muted);
  width: 90px;
  text-align: right;
}

.order-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--zhe-ash-rose);
  color: var(--zhe-dark-porphyry);
  width: 70px;
  text-align: center;
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.order-detail .detail-section {
  margin-bottom: 24px;
}

.order-detail .detail-section h3 {
  margin-bottom: 12px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 8px;
}

.order-detail .detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.order-detail .detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-detail .detail-item.full-width {
  grid-column: 1 / -1;
}

.order-detail .detail-item label {
  font-size: 12px;
  color: var(--text-muted);
}

.order-detail .amount {
  font-size: 18px;
  font-weight: bold;
  color: var(--zhe-dark-porphyry);
}

.order-detail .amount-paid {
  font-weight: bold;
  color: var(--zhe-terracotta);
}

.order-detail .status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.order-detail .status-badge.completed {
  background: #e8f5e9;
  color: #2e7d32;
}

.order-detail .status-badge.pending {
  background: #fff3e0;
  color: #ef6c00;
}

.order-detail .status-badge.cancelled {
  background: #ffebee;
  color: #c62828;
}

.order-detail .items-table {
  width: 100%;
  border-collapse: collapse;
}

.order-detail .items-table th,
.order-detail .items-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}

.order-detail .items-table th {
  background: var(--bg-elevated);
  font-weight: 600;
}
</style>
