<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const products = ref([])
const loading = ref(true)
const useNewProducts = ref(true) // 切换新产品/旧产品
const editingProduct = ref(null)

const loadProducts = async () => {
  loading.value = true
  if (useNewProducts.value) {
    products.value = await api.getProductsNew()
  } else {
    products.value = await api.getProducts()
  }
  loading.value = false
}

const formatPrice = (val) => {
  if (val === null || val === undefined || val === '') return '-'
  return `¥${val}`
}

const toggleView = () => {
  useNewProducts.value = !useNewProducts.value
  loadProducts()
}

// 获取零售价
const getRetailPrice = (product) => {
  if (!product.specs || product.specs.length === 0) return '-'
  const spec = product.specs[0]
  if (!spec.prices || spec.prices.length === 0) return '-'
  const retail = spec.prices.find(p => p.price_type === 'retail')
  return retail ? formatPrice(retail.price) : '-'
}

// 获取批发价
const getWholesalePrice = (product) => {
  if (!product.specs || product.specs.length === 0) return '-'
  const spec = product.specs[0]
  if (!spec.prices || spec.prices.length === 0) return '-'
  const wholesale = spec.prices.find(p => p.price_type === 'wholesale')
  return wholesale ? formatPrice(wholesale.price) : '-'
}

onMounted(loadProducts)
</script>

<template>
  <div class="products-page">
    <div class="page-header">
      <h1>📋 产品资料</h1>
      <button class="secondary" @click="toggleView">
        {{ useNewProducts ? '查看旧产品' : '查看新产品' }}
      </button>
    </div>

    <div class="card">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="products.length === 0" class="empty">暂无产品数据</div>
      <div v-else class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>序号</th>
              <th>SKU</th>
              <th>产品名称</th>
              <th>产区</th>
              <th>烘焙度</th>
              <th>规格</th>
              <th>零售价</th>
              <th>批发价</th>
              <th>大量价</th>
              <th>超大量价</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="useNewProducts">
              <tr v-for="(p, idx) in products" :key="p.id">
                <td>{{ idx + 1 }}</td>
                <td>{{ p.sku_code || '-' }}</td>
                <td>{{ p.name_short }}</td>
                <td>{{ p.origin || '-' }}</td>
                <td>{{ p.roast_level || '-' }}</td>
                <td>
                  <span v-for="(spec, i) in p.specs" :key="spec.id" class="spec-tag">
                    {{ spec.weight_grams }}g
                  </span>
                </td>
                <td class="price">{{ getRetailPrice(p) }}</td>
                <td class="price">{{ getWholesalePrice(p) }}</td>
                <td class="price">
                  <template v-if="p.specs && p.specs[0] && p.specs[0].prices">
                    {{ formatPrice(p.specs[0].prices.find(x => x.price_type === 'bulk')?.price) }}
                  </template>
                </td>
                <td class="price">
                  <template v-if="p.specs && p.specs[0] && p.specs[0].prices">
                    {{ formatPrice(p.specs[0].prices.find(x => x.price_type === 'super_bulk')?.price) }}
                  </template>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="(p, idx) in products" :key="p.id">
                <td>{{ idx + 1 }}</td>
                <td>-</td>
                <td>{{ p.name }}</td>
                <td>{{ p.region || '-' }}</td>
                <td>{{ p.roast || '-' }}</td>
                <td>{{ p.specs || '-' }}</td>
                <td class="price">{{ formatPrice(p.price) }}</td>
                <td class="price">{{ formatPrice(p.merchant_price) }}</td>
                <td class="price">{{ formatPrice(p.bulk_price) }}</td>
                <td class="price">{{ formatPrice(p.super_bulk_price) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
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
  color: var(--text-primary);
}

.table-wrapper {
  overflow-x: auto;
}

.spec-tag {
  display: inline-block;
  background: var(--zhe-ash-rose);
  padding: 2px 6px;
  border-radius: 4px;
  margin: 2px;
  font-size: 12px;
}

.price {
  font-weight: 600;
  color: var(--action-accent);
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.secondary {
  padding: 8px 16px;
  background: var(--action-accent);
  color: var(--text-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.secondary:hover {
  background: var(--zhe-ash-rose-hover);
}
</style>
