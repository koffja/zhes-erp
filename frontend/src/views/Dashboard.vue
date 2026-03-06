<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../api'

const stats = ref(null)
const topProducts = ref([])
const topCustomers = ref([])
const period = ref('all')
const customFrom = ref('')
const customTo = ref('')
const showCustom = ref(false)

const loadData = async () => {
  const from = period.value === 'custom' ? customFrom.value : ''
  const to = period.value === 'custom' ? customTo.value : ''
  stats.value = await api.getStats(period.value, from, to)
  topProducts.value = await api.getTopProducts(period.value, from, to)
  topCustomers.value = await api.getTopCustomers(period.value, from, to)
}

const totalRevenue = computed(() => {
  return stats.value?.totalAmount || 0
})

const totalOrders = computed(() => {
  return stats.value?.orderCount || 0
})

const totalCustomers = computed(() => {
  return stats.value?.customerCount || 0
})

const periods = [
  { value: 'today', label: '今日' },
  { value: '7days', label: '7天' },
  { value: '15days', label: '15天' },
  { value: '30days', label: '30天' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
  { value: 'custom', label: '自定义' },
]

const selectPeriod = (p) => {
  period.value = p
  showCustom.value = (p === 'custom')
  if (p !== 'custom') {
    loadData()
  }
}

const applyCustomRange = () => {
  if (customFrom.value && customTo.value) {
    loadData()
  }
}

onMounted(loadData)
</script>

<template>
  <div class="dashboard">
    <h1>📊 数据概览</h1>

    <div class="period-selector mb-4">
      <button
        v-for="p in periods"
        :key="p.value"
        :class="{ active: period === p.value }"
        @click="selectPeriod(p.value)"
      >
        {{ p.label }}
      </button>
    </div>

    <div v-if="showCustom" class="custom-range mb-4">
      <input type="date" v-model="customFrom">
      <span>至</span>
      <input type="date" v-model="customTo">
      <button class="primary" @click="applyCustomRange">应用</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">订单数</div>
        <div class="stat-value">{{ totalOrders }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">销售总额</div>
        <div class="stat-value">¥{{ totalRevenue.toFixed(2) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">客户数</div>
        <div class="stat-value">{{ totalCustomers }}</div>
      </div>
    </div>

    <div class="ranking-grid">
      <div class="card">
        <h3>🏆 热销产品</h3>
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>产品</th>
              <th>销量</th>
              <th>销售额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in topProducts" :key="i">
              <td>{{ i + 1 }}</td>
              <td>{{ p.name }}</td>
              <td>{{ p.total_quantity }}</td>
              <td class="highlight">¥{{ p.total_amount?.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>👥 客户排名</h3>
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>客户</th>
              <th>订单数</th>
              <th>消费额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in topCustomers" :key="i">
              <td>{{ i + 1 }}</td>
              <td>{{ c.name }}</td>
              <td>{{ c.order_count }}</td>
              <td class="highlight">¥{{ c.total_amount?.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
h1 {
  margin: 0 0 20px;
  font-size: 24px;
}

.period-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.period-selector button {
  background: var(--bg-app);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.period-selector button.active {
  background: var(--action-primary);
  color: var(--text-inverse);
}

.custom-range {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.custom-range input[type="date"] {
  padding: 6px 12px;
}

.custom-range span {
  color: var(--text-muted);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-label {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--action-primary);
}

.ranking-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.card h3 {
  margin: 0 0 16px;
  font-size: 18px;
}

.highlight {
  color: var(--action-accent);
  font-weight: 600;
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
