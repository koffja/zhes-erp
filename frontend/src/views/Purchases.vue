<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const purchases = ref([])
const suppliers = ref([])
const loading = ref(true)

const loadData = async () => {
  loading.value = true
  purchases.value = await api.getPurchases()
  suppliers.value = await api.getSuppliers()
  loading.value = false
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

const formatPrice = (price) => {
  return price ? `¥${price.toFixed(2)}` : '¥0.00'
}

onMounted(loadData)
</script>

<template>
  <div class="purchases-page">
    <h1>🚚 进货记录</h1>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>商品</th>
            <th>分类</th>
            <th>规格</th>
            <th>数量</th>
            <th>单价</th>
            <th>总额</th>
            <th>供应商</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in purchases" :key="p.id">
            <td>{{ formatDate(p.purchase_date) }}</td>
            <td>{{ p.product_name }}</td>
            <td>{{ p.category || '-' }}</td>
            <td>{{ p.specs || '-' }}</td>
            <td>{{ p.quantity }}</td>
            <td>{{ formatPrice(p.unit_price) }}</td>
            <td class="highlight">{{ formatPrice(p.total_amount) }}</td>
            <td>{{ p.supplier_name || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
h1 {
  margin: 0 0 20px;
  font-size: 24px;
}

.highlight {
  font-weight: 600;
  color: var(--action-accent);
}
</style>
