<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const customers = ref([])
const loading = ref(true)

// Inline 编辑相关
const editingId = ref(null)
const editField = ref(null)
const editValue = ref('')

const customerFields = [
  { key: 'name', label: '客户' },
  { key: 'phone', label: '电话' },
  { key: 'address', label: '地址' },
]

const loadCustomers = async () => {
  loading.value = true
  customers.value = await api.getCustomers()
  loading.value = false
}

const formatPrice = (price) => {
  return price ? `¥${price.toFixed(2)}` : '¥0.00'
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

onMounted(loadCustomers)
</script>

<template>
  <div class="customers-page">
    <h1>👥 客户列表</h1>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>客户</th>
            <th>电话</th>
            <th>订单数</th>
            <th>消费总额</th>
            <th>已收款</th>
            <th>应收款</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in customers" :key="c.id">
            <td class="editable" @click="startEdit(c, 'name')">
              <template v-if="editingId === c.id && editField === 'name'">
                <input v-model="editValue" @blur="saveEdit(c)" @keyup.enter="saveEdit(c)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else>{{ c.name }}</template>
            </td>
            <td class="editable" @click="startEdit(c, 'phone')">
              <template v-if="editingId === c.id && editField === 'phone'">
                <input v-model="editValue" @blur="saveEdit(c)" @keyup.enter="saveEdit(c)" @keyup.escape="cancelEdit" autofocus class="edit-input" />
              </template>
              <template v-else>{{ c.phone || '-' }}</template>
            </td>
            <td>{{ c.order_count || 0 }}</td>
            <td class="highlight">{{ formatPrice(c.total_receivable) }}</td>
            <td>{{ formatPrice(c.total_paid) }}</td>
            <td :class="{ 'text-danger': (c.total_receivable - c.total_paid) > 0 }">
              {{ formatPrice((c.total_receivable || 0) - (c.total_paid || 0)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
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

h1 {
  margin: 0 0 20px;
  font-size: 24px;
}

.highlight {
  font-weight: 600;
}

.text-danger {
  color: #f44336;
}
</style>
