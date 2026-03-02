<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const products = ref([])
const loading = ref(true)
const editingId = ref(null)
const editField = ref(null)
const editValue = ref('')

const fields = [
  { key: 'full_name', label: '产品全称' },
  { key: 'name', label: '简称' },
  { key: 'category', label: '分类' },
  { key: 'specs', label: '规格' },
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

const loadProducts = async () => {
  loading.value = true
  products.value = await api.getProducts()
  loading.value = false
}

const formatPrice = (val) => {
  if (val === null || val === undefined || val === '') return '无价格'
  return `¥${val}`
}

const startEdit = (product, field) => {
  editingId.value = product.id
  editField.value = field
  const pricing = product.pricing || {}
  editValue.value = pricing[field] ?? product[field] ?? ''
}

const saveEdit = async (product) => {
  const data = { id: product.id }

  // 判断是 pricing 字段还是产品字段
  if (['merchant_price', 'bulk_price', 'super_bulk_price', 'full_name', 'tasting_notes', 'roast', 'flavor', 'region'].includes(editField.value)) {
    data[editField.value] = editField.value.includes('price') ? parseFloat(editValue.value) || 0 : editValue.value
  } else {
    data[editField.value] = editField.value === 'price' || editField.value === 'stock'
      ? parseFloat(editValue.value) || 0
      : editValue.value
  }

  await api.updateProduct(product.id, data)

  // 更新本地数据
  if (['merchant_price', 'bulk_price', 'super_bulk_price', 'full_name', 'tasting_notes', 'roast', 'flavor', 'region'].includes(editField.value)) {
    if (!product.pricing) product.pricing = {}
    product.pricing[editField.value] = data[editField.value]
  } else {
    product[editField.value] = data[editField.value]
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

const getCellValue = (product, field) => {
  const pricing = product.pricing || {}
  if (['merchant_price', 'bulk_price', 'super_bulk_price', 'full_name', 'tasting_notes', 'roast', 'flavor', 'region'].includes(field)) {
    const val = pricing[field]
    if (field.includes('price') && val !== null && val !== undefined) return formatPrice(val)
    return val || ''
  }
  if (field === 'price') return formatPrice(product.price)
  return product[field] ?? ''
}

onMounted(loadProducts)
</script>

<template>
  <div class="products-page">
    <div class="page-header">
      <h1>📋 产品资料</h1>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>序号</th>
              <th v-for="f in fields" :key="f.key">{{ f.label }}</th>
              <th>创建日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, idx) in products" :key="p.id">
              <td>{{ idx + 1 }}</td>
              <td v-for="f in fields" :key="f.key"
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
              <td>{{ p.created_at?.split(' ')[0] || '-' }}</td>
              <td>
                <button class="danger" @click="deleteProduct(p.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.editable {
  cursor: pointer;
  padding: 8px;
  min-width: 80px;
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
</style>
