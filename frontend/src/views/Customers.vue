<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const customers = ref([])
const loading = ref(true)

// 排序相关
const sortKey = ref('total_receivable')
const sortOrder = ref('desc')

// 筛选相关
const showFilters = ref(false)
const filters = ref({
  search: ''
})

// 分页相关
const currentPage = ref(1)
const pageSize = ref(100)
const total = ref(0)
const totalPages = ref(0)

// Inline 编辑相关
const editingId = ref(null)
const editField = ref(null)
const editValue = ref('')

// 详情弹窗
const showDetail = ref(false)
const detailCustomer = ref(null)
const detailOrders = ref([])
const detailLoading = ref(false)

// 查看客户详情
const viewDetail = async (c) => {
  detailCustomer.value = c
  showDetail.value = true
  detailLoading.value = true
  try {
    // 获取客户订单
    const res = await fetch(`http://localhost:5126/api/orders?customer_id=${c.id}`)
    const data = await res.json()
    detailOrders.value = Array.isArray(data) ? data : (data.data || [])
  } catch (e) {
    console.error('获取订单失败:', e)
    detailOrders.value = []
  }
  detailLoading.value = false
}

const closeDetail = () => {
  showDetail.value = false
  detailCustomer.value = null
  detailOrders.value = []
}

const customerFields = [
  { key: 'name', label: '客户' },
  { key: 'phone', label: '电话' },
  { key: 'address', label: '地址' },
]

// 格式化显示电话
const formatPhone = (c) => {
  return c.phone || '-'
}

// 格式化显示地址
const formatAddress = (c) => {
  return c.address || '-'
}

const loadCustomers = async () => {
  loading.value = true
  const filterParams = {
    sortBy: sortKey.value,
    sortOrder: sortOrder.value,
    page: currentPage.value,
    pageSize: pageSize.value
  }
  if (filters.value.search) {
    filterParams.search = filters.value.search
  }

  const result = await api.getCustomers(true, filterParams)
  customers.value = result.data || result
  if (result.total !== undefined) {
    total.value = result.total
    totalPages.value = result.totalPages
  }
  loading.value = false
}

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
  loadCustomers()
}

const getSortIcon = (key) => {
  if (sortKey.value !== key) return '⇅'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

const formatPrice = (price) => {
  return price ? `¥${price.toFixed(2)}` : '¥0.00'
}

const applyFilters = () => {
  currentPage.value = 1
  loadCustomers()
}

const clearFilters = () => {
  filters.value.search = ''
  currentPage.value = 1
  loadCustomers()
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    loadCustomers()
  }
}

// Inline 编辑函数
const startEdit = (customer, field) => {
  editingId.value = customer.id
  editField.value = field
  editValue.value = customer[field] || ''
}

const saveEdit = async (customer) => {
  const data = { id: customer.id }
  data[editField.value] = editValue.value

  await api.updateCustomer(customer.id, data)
  customer[editField.value] = data[editField.value]

  editingId.value = null
  editField.value = null
}

const cancelEdit = () => {
  editingId.value = null
  editField.value = null
}

const saveNote = async (customer) => {
  await api.updateCustomer(customer.id, { note: customer.note })
}

const saveDetail = async (customer) => {
  await api.updateCustomer(customer.id, {
    name: customer.name,
    phone: customer.phone,
    phone2: customer.phone2,
    address: customer.address,
    address2: customer.address2,
    note: customer.note
  })
  // 刷新列表
  loadCustomers()
}

onMounted(loadCustomers)
</script>

<template>
  <div class="customers-page">
    <h1>👥 客户列表</h1>

    <!-- 筛选区域 -->
    <div class="filter-bar">
      <button class="secondary" @click="showFilters = !showFilters">
        {{ showFilters ? '收起筛选' : '显示筛选' }}
      </button>
      <span class="filter-summary" v-if="!showFilters && filters.search">
        搜索: {{ filters.search }}
      </span>
    </div>

    <div v-if="showFilters" class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>搜索</label>
          <input type="text" v-model="filters.search" placeholder="姓名/电话/地址" @keyup.enter="applyFilters" />
        </div>
        <div class="filter-group filter-actions">
          <button class="primary" @click="applyFilters">搜索</button>
          <button class="secondary" @click="clearFilters">清除</button>
        </div>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('name')" class="sortable">
              客户 <span class="sort-icon">{{ getSortIcon('name') }}</span>
            </th>
            <th>电话</th>
            <th>地址</th>
            <th @click="sortBy('order_count')" class="sortable">
              订单数 <span class="sort-icon">{{ getSortIcon('order_count') }}</span>
            </th>
            <th @click="sortBy('total_receivable')" class="sortable">
              消费总额 <span class="sort-icon">{{ getSortIcon('total_receivable') }}</span>
            </th>
            <th @click="sortBy('total_paid')" class="sortable">
              已收款 <span class="sort-icon">{{ getSortIcon('total_paid') }}</span>
            </th>
            <th @click="sortBy('outstanding')" class="sortable">
              应收款 <span class="sort-icon">{{ getSortIcon('outstanding') }}</span>
            </th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id">
            <td class="editable" @click="viewDetail(c)" @dblclick="startEdit(c, 'name')">
              <template v-if="editingId === c.id && editField === 'name'">
                <input v-model="editValue" @blur="saveEdit(c)" @keyup.enter="saveEdit(c)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else>{{ c.name }}</template>
            </td>
            <td class="editable" @click="startEdit(c, 'phone')">
              <template v-if="editingId === c.id && editField === 'phone'">
                <input v-model="editValue" @blur="saveEdit(c)" @keyup.enter="saveEdit(c)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else>{{ formatPhone(c) }}</template>
            </td>
            <td class="editable" @click="startEdit(c, 'address')">
              <template v-if="editingId === c.id && editField === 'address'">
                <input v-model="editValue" @blur="saveEdit(c)" @keyup.enter="saveEdit(c)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else :title="formatAddress(c)">{{ formatAddress(c).substring(0, 15) }}{{ formatAddress(c).length > 15 ? '...' : '' }}</template>
            </td>
            <td>{{ c.order_count || 0 }}</td>
            <td class="highlight">{{ formatPrice(c.total_receivable) }}</td>
            <td>{{ formatPrice(c.total_paid) }}</td>
            <td :class="{ 'text-danger': (c.outstanding || 0) > 0 }">
              {{ formatPrice(c.outstanding || 0) }}
            </td>
            <td>
              <button class="detail-btn" @click="viewDetail(c)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分页控件 -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" @click="goToPage(1)" :disabled="currentPage === 1">首页</button>
        <button class="page-btn" @click="goToPage(currentPage - 1)" :disabled="currentPage === 1">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页 (共 {{ total }} 条)</span>
        <button class="page-btn" @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages">下一页</button>
        <button class="page-btn" @click="goToPage(totalPages)" :disabled="currentPage === totalPages">末页</button>
      </div>
    </div>
  </div>

  <!-- 客户详情弹窗 -->
  <div v-if="showDetail" class="modal-overlay" @click.self="closeDetail">
    <div class="modal-content">
      <div class="modal-header">
        <h2>客户详情</h2>
        <button class="close-btn" @click="closeDetail">&times;</button>
      </div>
      <div class="modal-body" v-if="detailCustomer">
        <div class="detail-section">
          <h3>基本信息 <button class="save-btn" @click="saveDetail(detailCustomer)">保存</button></h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>客户名称</label>
              <input v-model="detailCustomer.name" class="detail-input" />
            </div>
            <div class="detail-item">
              <label>电话</label>
              <input v-model="detailCustomer.phone" class="detail-input" placeholder="主要电话" />
            </div>
            <div class="detail-item">
              <label>备用电话</label>
              <input v-model="detailCustomer.phone2" class="detail-input" placeholder="备用电话" />
            </div>
            <div class="detail-item full-width">
              <label>地址</label>
              <input v-model="detailCustomer.address" class="detail-input" placeholder="主要地址" />
            </div>
            <div class="detail-item full-width">
              <label>备用地址</label>
              <input v-model="detailCustomer.address2" class="detail-input" placeholder="备用地址" />
            </div>
            <div class="detail-item full-width">
              <label>备注</label>
              <input v-model="detailCustomer.note" class="detail-input" placeholder="添加备注..." />
            </div>
          </div>
        </div>
        <div class="detail-section">
          <h3>订单记录 ({{ detailOrders.length }})</h3>
          <div v-if="detailLoading" class="loading">加载中...</div>
          <div v-else-if="detailOrders.length === 0" class="empty">暂无订单</div>
          <div v-else class="order-list">
            <div v-for="order in detailOrders.slice(0, 10)" :key="order.id" class="order-item">
              <span class="order-date">{{ order.order_date?.substring(0, 10) }}</span>
              <span class="order-no">{{ order.order_no }}</span>
              <span class="order-amount">¥{{ (order.total_amount || 0).toFixed(2) }}</span>
              <span :class="['order-status', order.status]">{{ order.status || '已完成' }}</span>
            </div>
            <div v-if="detailOrders.length > 10" class="more-orders">
              还有 {{ detailOrders.length - 10 }} 条订单...
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
h1 {
  margin: 0 0 20px;
  font-size: 24px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-summary {
  color: var(--text-secondary);
  font-size: 14px;
}

.filter-panel {
  background: var(--bg-elevated);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  color: var(--text-muted);
}

.filter-group input,
.filter-group select {
  padding: 6px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.filter-actions {
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
}

.editable {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
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
  font-family: inherit;
  background: var(--bg-card);
  color: var(--text-primary);
}

.edit-input:focus {
  outline: none;
  border-color: var(--zhe-dark-porphyry);
}

.highlight {
  font-weight: 600;
}

.text-danger {
  color: #f44336;
}

/* 表格列宽 */
table {
  table-layout: fixed;
}
table th:nth-child(1), table td:nth-child(1) { width: 10%; }  /* 客户 */
table th:nth-child(2), table td:nth-child(2) { width: 12%; }  /* 电话 */
table th:nth-child(3), table td:nth-child(3) { width: 26%; }  /* 地址 */
table th:nth-child(4), table td:nth-child(4) { width: 6%; }   /* 订单数 */
table th:nth-child(5), table td:nth-child(5) { width: 10%; }  /* 消费总额 */
table th:nth-child(6), table td:nth-child(6) { width: 9%; }   /* 已收款 */
table th:nth-child(7), table td:nth-child(7) { width: 9%; }   /* 应收款 */
table th:nth-child(8), table td:nth-child(8) { width: 8%; }   /* 操作 */

table td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sortable {
  cursor: pointer;
  user-select: none;
}

.sortable:hover {
  background: var(--zhe-ash-rose-hover);
}

.sort-icon {
  font-size: 12px;
  margin-left: 4px;
  opacity: 0.7;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 16px;
}

.page-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.page-btn:hover:not(:disabled) {
  background: var(--zhe-ash-rose-hover);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  padding: 0 16px;
  color: var(--text-secondary);
  font-size: 14px;
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
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.detail-item span {
  font-size: 14px;
  color: var(--text-primary);
}

.note-input, .detail-input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.note-input:focus, .detail-input:focus {
  outline: none;
  border-color: var(--action-accent);
}

.detail-btn {
  padding: 4px 12px;
  background: var(--action-accent);
  color: var(--zhe-dark-porphyry);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.detail-btn:hover {
  background: var(--zhe-ash-rose-hover);
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

.detail-section h3 {
  display: flex;
  align-items: center;
}

.order-list {
  max-height: 200px;
  overflow-y: auto;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
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
}

.order-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background: var(--zhe-ash-rose);
  color: var(--zhe-dark-porphyry);
}

.order-status.completed, .order-status.已完成 {
  background: #e8f5e9;
  color: #2e7d32;
}

.order-status.cancelled, .order-status.已取消 {
  background: #ffebee;
  color: #c62828;
}

.loading, .empty {
  text-align: center;
  padding: 20px;
  color: var(--text-muted);
}

.more-orders {
  text-align: center;
  padding: 8px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
