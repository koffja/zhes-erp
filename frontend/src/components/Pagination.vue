<template>
  <div class="pagination">
    <span class="pagination-info">
      共 {{ total }} 条，第 {{ currentPage }}/{{ totalPages }} 页
    </span>
    <div class="pagination-buttons">
      <button @click="goToPage(1)" :disabled="currentPage <= 1">首页</button>
      <button @click="goToPage(currentPage - 1)" :disabled="currentPage <= 1">上一页</button>
      <span class="page-numbers">
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goToPage(page)"
          :class="{ active: page === currentPage }"
        >
          {{ page }}
        </button>
      </span>
      <button @click="goToPage(currentPage + 1)" :disabled="currentPage >= totalPages">下一页</button>
      <button @click="goToPage(totalPages)" :disabled="currentPage >= totalPages">末页</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  total: { type: Number, required: true },
  maxVisible: { type: Number, default: 5 }
})

const emit = defineEmits(['page-change'])

const visiblePages = computed(() => {
  const pages = []
  const total = props.totalPages
  const current = props.currentPage
  const max = props.maxVisible

  if (total <= max) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    let start = Math.max(1, current - Math.floor(max / 2))
    let end = Math.min(total, start + max - 1)
    if (end - start < max - 1) {
      start = Math.max(1, end - max + 1)
    }
    for (let i = start; i <= end; i++) pages.push(i)
  }
  return pages
})

const goToPage = (page) => {
  if (page >= 1 && page <= props.totalPages) {
    emit('page-change', page)
  }
}
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  flex-wrap: wrap;
  gap: 10px;
}

.pagination-info {
  color: var(--text-muted);
  font-size: 14px;
}

.pagination-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.pagination-buttons button {
  padding: 6px 12px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.pagination-buttons button:hover:not(:disabled) {
  background: var(--zhe-ash-rose);
  border-color: var(--zhe-ash-rose);
}

.pagination-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-buttons button.active {
  background: var(--action-primary);
  color: var(--text-inverse);
  border-color: var(--action-primary);
}

.page-numbers {
  display: flex;
  gap: 2px;
}
</style>
