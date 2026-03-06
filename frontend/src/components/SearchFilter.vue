<template>
  <div class="filter-container">
    <button class="filter-toggle" @click="toggle">
      {{ show ? '收起筛选' : '显示筛选' }}
    </button>

    <div v-if="show" class="filter-panel">
      <slot></slot>

      <div class="filter-actions">
        <button class="btn-primary" @click="apply">应用筛选</button>
        <button class="btn-secondary" @click="clear">清除</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:modelValue', 'apply', 'clear'])

const show = ref(false)

const toggle = () => {
  show.value = !show.value
}

const apply = () => {
  emit('apply')
}

const clear = () => {
  emit('clear')
}

defineExpose({ show })
</script>

<style scoped>
.filter-container {
  margin-bottom: 16px;
}

.filter-toggle {
  padding: 8px 16px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.filter-toggle:hover {
  background: var(--zhe-tuff-white);
}

.filter-panel {
  margin-top: 12px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.btn-primary {
  padding: 8px 16px;
  background: var(--action-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:hover {
  background: var(--action-primary-hover);
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--action-accent);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: var(--zhe-ash-rose-hover);
}
</style>
