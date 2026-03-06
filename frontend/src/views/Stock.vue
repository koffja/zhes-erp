<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const products = ref([])
const loading = ref(true)

const loadStock = async () => {
  loading.value = true
  products.value = await api.getProducts()
  loading.value = false
}

const saveStock = async () => {
  const stocks = products.value.map(p => ({
    product_id: p.id,
    stock: parseInt(p.stock) || 0
  }))
  await api.updateStock(stocks)
  alert('库存已保存！')
}

onMounted(loadStock)
</script>

<template>
  <div class="stock-page">
    <div class="page-header">
      <h1>📦 库存盘点</h1>
      <button @click="saveStock">💾 保存库存</button>
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>产品</th>
            <th>分类</th>
            <th>规格</th>
            <th>库存</th>
            <th>价值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td>{{ p.name }}</td>
            <td>{{ p.category || '-' }}</td>
            <td>{{ p.specs || '-' }}</td>
            <td>
              <input type="number" v-model="p.stock" class="stock-input" />
            </td>
            <td>¥{{ ((p.stock || 0) * (p.price || 0)).toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
}

.stock-input {
  width: 80px;
  padding: 6px 10px;
}
</style>
