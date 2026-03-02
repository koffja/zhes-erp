<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const orders = ref([])
const loading = ref(true)
const sortKey = ref('created_at')
const sortOrder = ref('desc')
const selectedOrder = ref(null)
const showModal = ref(false)
const showShipModal = ref(false)
const shipItems = ref([])

const loadOrders = async () => {
  loading.value = true
  orders.value = await api.getOrders()
  loading.value = false
}

const sortedOrders = computed(() => {
  return [...orders.value].sort((a, b) => {
    let valA = a[sortKey.value]
    let valB = b[sortKey.value]

    // 处理日期排序
    if (sortKey.value === 'created_at') {
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
  const paid = order.paid_amount || 0
  const total = order.total_amount || 0
  if (paid >= total && total > 0) return '已付清'
  if (paid > 0) return '部分付款'
  return '未付款'
}

const viewOrder = async (order) => {
  selectedOrder.value = await api.getOrder(order.id)
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedOrder.value = null
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

    <div class="card">
      <table>
        <thead>
          <tr>
            <th @click="sortBy('created_at')" class="sortable">
              日期 <span class="sort-icon">{{ getSortIcon('created_at') }}</span>
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
            <td>{{ formatDate(order.created_at) }}</td>
            <td>{{ order.order_no }}</td>
            <td>{{ order.shipping_name || '-' }}</td>
            <td class="highlight">{{ formatPrice(order.total_amount) }}</td>
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
              <span class="label">日期：</span>
              <span>{{ formatDate(selectedOrder.created_at) }}</span>
            </div>
            <div class="info-row">
              <span class="label">客户：</span>
              <span>{{ selectedOrder.shipping_name || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">电话：</span>
              <span>{{ selectedOrder.shipping_phone || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">地址：</span>
              <span>{{ selectedOrder.shipping_address || '-' }}</span>
            </div>
            <div class="info-row">
              <span class="label">状态：</span>
              <span :class="['status', selectedOrder.status]">
                {{ { pending: '待处理', confirmed: '已确认', shipped: '已发货', completed: '已完成' }[selectedOrder.status] || selectedOrder.status }}
              </span>
            </div>
            <div class="info-row total">
              <span class="label">订单金额：</span>
              <span class="highlight">{{ formatPrice(selectedOrder.total_amount) }}</span>
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
                <th>已发</th>
                <th>状态</th>
                <th>小计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in selectedOrder.items" :key="item.id">
                <td>{{ index + 1 }}</td>
                <td>{{ item.product_name || item.name }}</td>
                <td>{{ item.specs || '-' }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ (item.shipped_quantity || 0) }} / {{ item.quantity }}</td>
                <td>
                  <span :class="['status', 'shipping-' + (item.shipping_status || 'pending')]">
                    {{ { pending: '未发', partial: '部分发', shipped: '已发' }[item.shipping_status] || '未发' }}
                  </span>
                </td>
                <td>{{ formatPrice(item.price * item.quantity) }}</td>
              </tr>
            </tbody>
          </table>

          <div class="modal-footer">
            <button class="primary" @click="openShipModal">发货</button>
            <button class="primary" @click="exportPDF(selectedOrder)">导出 PDF</button>
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
h1 {
  margin: 0 0 20px;
  font-size: 24px;
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
