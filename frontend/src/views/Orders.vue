<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const orders = ref([])
const loading = ref(true)
const sortKey = ref('order_date')
const sortOrder = ref('desc')
const selectedOrder = ref(null)
const showModal = ref(false)
const showShipModal = ref(false)
const shipItems = ref([])

// 分页相关
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const totalPages = ref(0)

// 筛选相关
const showFilters = ref(false)
const filters = ref({
  from: '',
  to: '',
  customer: '',
  product: '',
  shipping_status: '',
  payment_status: '',
  has_items: ''
})

// Inline 编辑相关
const editingId = ref(null)
const editField = ref(null)
const editValue = ref('')

const orderFields = [
  { key: 'order_no', label: '订单号' },
  { key: 'shipping_name', label: '收件人' },
  { key: 'shipping_phone', label: '电话' },
  { key: 'shipping_address', label: '地址' },
  { key: 'total_amount', label: '金额' },
  { key: 'note', label: '备注' },
]

const loadOrders = async () => {
  loading.value = true
  // 构建筛选参数
  const filterParams = {}
  if (filters.value.from) filterParams.from = filters.value.from
  if (filters.value.to) filterParams.to = filters.value.to
  if (filters.value.customer) filterParams.customer = filters.value.customer
  if (filters.value.product) filterParams.product = filters.value.product
  if (filters.value.shipping_status) filterParams.shipping_status = filters.value.shipping_status
  if (filters.value.payment_status) filterParams.payment_status = filters.value.payment_status
  if (filters.value.has_items) filterParams.has_items = filters.value.has_items

  const result = await api.getOrders(currentPage.value, pageSize.value, filterParams)
  orders.value = result.data
  total.value = result.total
  totalPages.value = result.totalPages
  loading.value = false
}

const applyFilters = () => {
  currentPage.value = 1
  loadOrders()
}

const clearFilters = () => {
  filters.value = {
    from: '',
    to: '',
    customer: '',
    product: '',
    shipping_status: '',
    payment_status: '',
    has_items: ''
  }
  currentPage.value = 1
  loadOrders()
}

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    loadOrders()
  }
}

const sortedOrders = computed(() => {
  return [...orders.value].sort((a, b) => {
    let valA = a[sortKey.value]
    let valB = b[sortKey.value]

    // 处理日期排序
    if (sortKey.value === 'order_date') {
      valA = new Date(valA).getTime()
      valB = new Date(valB).getTime()
    }

    // 处理数字排序
    if (sortKey.value === 'total_amount') {
      valA = parseFloat(valA) || 0
      valB = parseFloat(valB) || 0
    }

    if (sortOrder.value === 'asc') {
      return valA > valB ? 1 : -1
    } else {
      return valA < valB ? 1 : -1
    }
  })
})

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

const getSortIcon = (key) => {
  if (sortKey.value !== key) return '⇅'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

const formatPrice = (price) => {
  return price ? `¥${parseFloat(price).toFixed(2)}` : '¥0.00'
}

const getShippingStatus = (order) => {
  const status = order.shipping_status || 'pending'
  const map = { pending: '未发货', partial: '部分发货', shipped: '已发货' }
  return map[status] || '未发货'
}

const getPaymentStatus = (order) => {
  // 如果 payment_status 已经是 paid，直接返回已付清
  if (order.payment_status === 'paid') return '已付清'

  const paid = order.paid_amount || 0
  const total = order.total_amount || 0
  if (paid >= total && total > 0) return '已付清'
  if (paid > 0) return '部分付款'
  return '未付款'
}

// Inline 编辑函数
const startEdit = (order, field) => {
  editingId.value = order.id
  editField.value = field
  editValue.value = order[field] || ''
}

const saveEdit = async (order) => {
  const data = { id: order.id }
  data[editField.value] = editField.value === 'total_amount'
    ? parseFloat(editValue.value) || 0
    : editValue.value

  await api.updateOrder(order.id, data)
  order[editField.value] = data[editField.value]

  editingId.value = null
  editField.value = null
}

const cancelEdit = () => {
  editingId.value = null
  editField.value = null
}

const saveOrderStatus = async () => {
  await api.updateOrder(selectedOrder.value.id, {
    status: selectedOrder.value.status
  })
}

const getCellValue = (order, field) => {
  if (field === 'total_amount') return formatPrice(order[field])
  return order[field] || ''
}

const viewOrder = async (order) => {
  selectedOrder.value = await api.getOrder(order.id)
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedOrder.value = null
}

// 订单明细编辑相关
const editingItemId = ref(null)
const editItemField = ref(null)
const editItemValue = ref('')
const showAddItem = ref(false)
const newItemName = ref('')
const newItemQty = ref(1)
const newItemUnit = ref('包')
const newItemPrice = ref(0)

const startEditItem = (item, field) => {
  editingItemId.value = item.id
  editItemField.value = field
  editItemValue.value = item[field] || ''
}

const saveEditItem = async (item) => {
  const data = {}
  if (editItemField.value === 'quantity') {
    data.quantity = parseFloat(editItemValue.value) || 1
  } else if (editItemField.value === 'unit_price') {
    data.unit_price = parseFloat(editItemValue.value) || 0
  } else {
    data[editItemField.value] = editItemValue.value
  }

  await api.updateOrderItem(item.id, data)
  item[editItemField.value] = data[editItemField.value]
  if (data.quantity !== undefined) item.quantity = data.quantity
  if (data.unit_price !== undefined) item.unit_price = data.unit_price
  if (data.quantity !== undefined || data.unit_price !== undefined) {
    item.subtotal = (item.quantity || 0) * (item.unit_price || 0)
  }

  editingItemId.value = null
  editItemField.value = null
}

const cancelEditItem = () => {
  editingItemId.value = null
  editItemField.value = null
}

const deleteItem = async (item) => {
  if (!confirm('确定要删除这个商品吗？')) return
  await api.deleteOrderItem(item.id)
  selectedOrder.value.items = selectedOrder.value.items.filter(i => i.id !== item.id)
}

const addItem = async () => {
  if (!newItemName.value.trim()) {
    alert('请输入商品名称')
    return
  }
  const newItem = await api.createOrderItem({
    order_id: selectedOrder.value.id,
    product_name: newItemName.value.trim(),
    quantity: newItemQty.value,
    unit: newItemUnit.value,
    unit_price: newItemPrice.value
  })
  selectedOrder.value.items.push(newItem)
  newItemName.value = ''
  newItemQty.value = 1
  newItemUnit.value = '包'
  newItemPrice.value = 0
  showAddItem.value = false
}

const exportPDF = async (order) => {
  // 调用后端 PDF 导出 API
  window.open(`/api/order/${order.id}/pdf`, '_blank')
}

const openShipModal = () => {
  shipItems.value = selectedOrder.value.items.map(item => ({
    item_id: item.id,
    product_name: item.product_name || item.name,
    quantity: item.quantity,
    shipped_quantity: item.shipped_quantity || 0,
    ship_quantity: item.quantity - (item.shipped_quantity || 0)
  }))
  showShipModal.value = true
}

const closeShipModal = () => {
  showShipModal.value = false
  shipItems.value = []
}

const submitShip = async () => {
  const itemsToShip = shipItems.value
    .filter(item => item.ship_quantity > 0)
    .map(item => ({ item_id: item.item_id, ship_quantity: item.ship_quantity }))

  if (itemsToShip.length === 0) {
    alert('请输入发货数量')
    return
  }

  try {
    await fetch(`/api/orders/${selectedOrder.value.id}/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsToShip })
    })
    // 刷新订单详情
    selectedOrder.value = await api.getOrder(selectedOrder.value.id)
    // 刷新列表
    await loadOrders()
    closeShipModal()
  } catch (e) {
    alert('发货失败: ' + e.message)
  }
}

onMounted(loadOrders)
</script>

<template>
  <div class="orders-page">
    <h1>📝 订单列表</h1>

    <!-- 筛选区域 -->
    <div class="filter-bar">
      <button class="secondary" @click="showFilters = !showFilters">
        {{ showFilters ? '收起筛选' : '显示筛选' }}
      </button>
      <span class="filter-summary" v-if="!showFilters">
        <span v-if="filters.from || filters.to">日期: {{ filters.from }} ~ {{ filters.to }}</span>
        <span v-if="filters.shipping_status" style="margin-left: 10px;">发货: {{ { pending: '未发', partial: '部分发', shipped: '已发' }[filters.shipping_status] }}</span>
        <span v-if="filters.payment_status" style="margin-left: 10px;">付款: {{ { unpaid: '未付', partial: '部分付', paid: '已付' }[filters.payment_status] }}</span>
        <span v-if="filters.has_items" style="margin-left: 10px;">商品: {{ filters.has_items === '1' ? '有' : '无' }}</span>
        <span v-if="filters.customer" style="margin-left: 10px;">客户: {{ filters.customer }}</span>
        <span v-if="filters.product" style="margin-left: 10px;">商品: {{ filters.product }}</span>
      </span>
    </div>

    <div v-if="showFilters" class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>开始日期</label>
          <input type="date" v-model="filters.from" />
        </div>
        <div class="filter-group">
          <label>结束日期</label>
          <input type="date" v-model="filters.to" />
        </div>
        <div class="filter-group">
          <label>发货状态</label>
          <select v-model="filters.shipping_status">
            <option value="">全部</option>
            <option value="pending">未发货</option>
            <option value="partial">部分发货</option>
            <option value="shipped">已发货</option>
          </select>
        </div>
        <div class="filter-group">
          <label>付款状态</label>
          <select v-model="filters.payment_status">
            <option value="">全部</option>
            <option value="unpaid">未付款</option>
            <option value="partial">部分付款</option>
            <option value="paid">已付款</option>
          </select>
        </div>
        <div class="filter-group">
          <label>商品明细</label>
          <select v-model="filters.has_items">
            <option value="">全部</option>
            <option value="1">有商品</option>
            <option value="0">无商品</option>
          </select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <label>客户搜索</label>
          <input type="text" v-model="filters.customer" placeholder="客户姓名/电话" />
        </div>
        <div class="filter-group">
          <label>商品搜索</label>
          <input type="text" v-model="filters.product" placeholder="商品名称" />
        </div>
        <div class="filter-group filter-actions">
          <button class="primary" @click="applyFilters">应用筛选</button>
          <button class="secondary" @click="clearFilters">清除</button>
        </div>
      </div>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('order_date')" class="sortable">
              日期 <span class="sort-icon">{{ getSortIcon('order_date') }}</span>
            </th>
            <th @click="sortBy('order_no')" class="sortable">
              订单号 <span class="sort-icon">{{ getSortIcon('order_no') }}</span>
            </th>
            <th>客户</th>
            <th @click="sortBy('total_amount')" class="sortable">
              金额 <span class="sort-icon">{{ getSortIcon('total_amount') }}</span>
            </th>
            <th>发货状态</th>
            <th>已发/总数</th>
            <th>付款状态</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in sortedOrders" :key="order.id">
            <td>{{ formatDate(order.order_date) }}</td>
            <td class="editable" @click="startEdit(order, 'order_no')">
              <template v-if="editingId === order.id && editField === 'order_no'">
                <input v-model="editValue" @blur="saveEdit(order)" @keyup.enter="saveEdit(order)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else>{{ order.order_no }}</template>
            </td>
            <td class="editable" @click="startEdit(order, 'shipping_name')">
              <template v-if="editingId === order.id && editField === 'shipping_name'">
                <input v-model="editValue" @blur="saveEdit(order)" @keyup.enter="saveEdit(order)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else>{{ order.shipping_name || '-' }}</template>
            </td>
            <td class="editable highlight" @click="startEdit(order, 'total_amount')">
              <template v-if="editingId === order.id && editField === 'total_amount'">
                <input v-model="editValue" @blur="saveEdit(order)" @keyup.enter="saveEdit(order)" @keyup.escape="cancelEdit" autofocus class="edit-input" type="number" step="0.01" />
              </template>
              <template v-else>{{ formatPrice(order.total_amount) }}</template>
            </td>
            <td>
              <span :class="['status', 'shipping-' + (order.shipping_status || 'pending')]">
                {{ getShippingStatus(order) }}
              </span>
            </td>
            <td>{{ (order.shipped_items || 0) }} / {{ (order.total_items || 0) }}</td>
            <td>
              <span :class="['status', getPaymentStatus(order) === '已付清' ? 'completed' : getPaymentStatus(order) === '部分付款' ? 'confirmed' : 'pending']">
                {{ getPaymentStatus(order) }}
              </span>
            </td>
            <td>
              <span :class="['status', order.status]">
                {{ { pending: '待处理', confirmed: '已确认', shipped: '已发货', completed: '已完成' }[order.status] || order.status }}
              </span>
            </td>
            <td>
              <button class="secondary" @click="viewOrder(order)">查看</button>
              <button class="primary" @click="exportPDF(order)" style="margin-left: 4px;">PDF</button>
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

    <!-- 订单详情弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>订单详情</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="modal-body" v-if="selectedOrder">
          <div class="order-info">
            <div class="info-row">
              <span class="label">订单号：</span>
              <span>{{ selectedOrder.order_no }}</span>
            </div>
            <div class="info-row">
              <span class="label">订购日期：</span>
              <span>{{ formatDate(selectedOrder.order_date) }}</span>
            </div>
            <div class="info-row">
              <span class="label">记录创建：</span>
              <span>{{ formatDate(selectedOrder.created_at) }}</span>
            </div>
            <div class="info-row">
              <span class="label">客户：</span>
              <span class="editable" @click="startEdit(selectedOrder, 'shipping_name')">
                <template v-if="editingId === selectedOrder.id && editField === 'shipping_name'">
                  <input v-model="editValue" @blur="saveEdit(selectedOrder)" @keyup.enter="saveEdit(selectedOrder)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
                </template>
                <template v-else>{{ selectedOrder.shipping_name || '-' }}</template>
              </span>
            </div>
            <div class="info-row">
              <span class="label">电话：</span>
              <span class="editable" @click="startEdit(selectedOrder, 'shipping_phone')">
                <template v-if="editingId === selectedOrder.id && editField === 'shipping_phone'">
                  <input v-model="editValue" @blur="saveEdit(selectedOrder)" @keyup.enter="saveEdit(selectedOrder)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
                </template>
                <template v-else>{{ selectedOrder.shipping_phone || '-' }}</template>
              </span>
            </div>
            <div class="info-row">
              <span class="label">地址：</span>
              <span class="editable" @click="startEdit(selectedOrder, 'shipping_address')">
                <template v-if="editingId === selectedOrder.id && editField === 'shipping_address'">
                  <input v-model="editValue" @blur="saveEdit(selectedOrder)" @keyup.enter="saveEdit(selectedOrder)" @keyup.escape="cancelEdit" autofocus class="edit-input" style="width: 300px;" />
                </template>
                <template v-else>{{ selectedOrder.shipping_address || '-' }}</template>
              </span>
            </div>
            <div class="info-row">
              <span class="label">状态：</span>
              <select v-model="selectedOrder.status" @change="saveOrderStatus" class="status-select">
                <option value="pending">待处理</option>
                <option value="confirmed">已确认</option>
                <option value="shipped">已发货</option>
                <option value="completed">已完成</option>
              </select>
            </div>
            <div class="info-row total">
              <span class="label">订单金额：</span>
              <span class="editable" @click="startEdit(selectedOrder, 'total_amount')">
                <template v-if="editingId === selectedOrder.id && editField === 'total_amount'">
                  <input v-model="editValue" @blur="saveEdit(selectedOrder)" @keyup.enter="saveEdit(selectedOrder)" @keyup.escape="cancelEdit" autofocus class="edit-input" type="number" step="0.01" style="width: 100px;" />
                </template>
                <template v-else class="highlight">{{ formatPrice(selectedOrder.total_amount) }}</template>
              </span>
            </div>
          </div>

          <h3>订单项目</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>产品</th>
                <th>规格</th>
                <th>数量</th>
                <th>单价</th>
                <th>小计</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in selectedOrder.items" :key="item.id">
                <td>{{ index + 1 }}</td>
                <td class="editable" @click="startEditItem(item, 'product_name')">
                  <template v-if="editingItemId === item.id && editItemField === 'product_name'">
                    <input v-model="editItemValue" @blur="saveEditItem(item)" @keyup.enter="saveEditItem(item)" @keyup.escape="cancelEditItem" autofocus class="edit-input" />
                  </template>
                  <template v-else>{{ item.product_name || item.name }}</template>
                </td>
                <td>{{ item.specs || '-' }}</td>
                <td class="editable" @click="startEditItem(item, 'quantity')">
                  <template v-if="editingItemId === item.id && editItemField === 'quantity'">
                    <input v-model="editItemValue" @blur="saveEditItem(item)" @keyup.enter="saveEditItem(item)" @keyup.escape="cancelEditItem" autofocus class="edit-input" type="number" style="width: 60px;" />
                  </template>
                  <template v-else>{{ item.quantity }} {{ item.unit || '' }}</template>
                </td>
                <td class="editable" @click="startEditItem(item, 'unit_price')">
                  <template v-if="editingItemId === item.id && editItemField === 'unit_price'">
                    <input v-model="editItemValue" @blur="saveEditItem(item)" @keyup.enter="saveEditItem(item)" @keyup.escape="cancelEditItem" autofocus class="edit-input" type="number" step="0.01" style="width: 80px;" />
                  </template>
                  <template v-else>{{ formatPrice(item.unit_price || 0) }}</template>
                </td>
                <td class="highlight">{{ formatPrice((item.unit_price || 0) * item.quantity) }}</td>
                <td>
                  <button class="danger-btn" @click="deleteItem(item)" title="删除">×</button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 新增商品 -->
          <div v-if="showAddItem" class="add-item-form">
            <input v-model="newItemName" placeholder="商品名称" class="edit-input" />
            <input v-model="newItemQty" type="number" placeholder="数量" class="edit-input" style="width: 60px;" />
            <input v-model="newItemUnit" placeholder="单位" class="edit-input" style="width: 60px;" />
            <input v-model="newItemPrice" type="number" step="0.01" placeholder="单价" class="edit-input" style="width: 80px;" />
            <button class="primary" @click="addItem">确认</button>
            <button class="secondary" @click="showAddItem = false">取消</button>
          </div>
          <button v-else class="secondary" @click="showAddItem = true" style="margin-top: 10px;">+ 添加商品</button>

          <div class="modal-footer">
            <button class="secondary" @click="closeModal">关闭</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 发货弹窗 -->
    <div v-if="showShipModal" class="modal-overlay" @click="closeShipModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>订单发货</h2>
          <button class="close-btn" @click="closeShipModal">×</button>
        </div>
        <div class="modal-body">
          <table class="items-table">
            <thead>
              <tr>
                <th>产品</th>
                <th>总数</th>
                <th>已发</th>
                <th>本次发货</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in shipItems" :key="item.item_id">
                <td>{{ item.product_name }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.shipped_quantity }}</td>
                <td>
                  <input type="number" min="0" :max="item.quantity - item.shipped_quantity"
                    v-model.number="item.ship_quantity" style="width: 60px;">
                </td>
              </tr>
            </tbody>
          </table>
          <div class="modal-footer">
            <button class="primary" @click="submitShip">确认发货</button>
            <button class="secondary" @click="closeShipModal">取消</button>
          </div>
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
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filter-row:last-child {
  margin-bottom: 0;
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

h1 {
  margin: 0 0 20px;
  font-size: 24px;
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

.danger-btn {
  background: var(--zhe-terracotta);
  color: white;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.danger-btn:hover {
  background: var(--zhe-terracotta-hover);
}

.add-item-form {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 8px;
}

.status-select {
  padding: 4px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
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

.highlight {
  font-weight: 600;
  color: var(--action-accent);
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.status.pending { background: #fff3e0; color: #f57c00; }
.status.confirmed { background: #e3f2fd; color: #1976d2; }
.status.shipped { background: #f3e5f5; color: #7b1fa2; }
.status.completed { background: #e8f5e9; color: #388e3c; }
.status.shipping-pending { background: #fff3e0; color: #f57c00; }
.status.shipping-partial { background: #e3f2fd; color: #1976d2; }
.status.shipping-shipped { background: #e8f5e9; color: #388e3c; }

.secondary {
  padding: 4px 12px;
  font-size: 12px;
}

.primary {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--action-primary);
  color: var(--text-inverse);
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

.modal {
  background: var(--bg-card);
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--zhe-ash-rose-hover);
}

.modal-body {
  padding: 24px;
}

.order-info {
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.info-row .label {
  width: 80px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.info-row.total {
  border-bottom: none;
  padding-top: 16px;
  font-size: 18px;
}

.info-row.total .label {
  width: auto;
}

h3 {
  margin: 0 0 12px;
  font-size: 16px;
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

.items-table {
  margin-bottom: 24px;
}

.items-table th,
.items-table td {
  padding: 10px 12px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}
</style>
