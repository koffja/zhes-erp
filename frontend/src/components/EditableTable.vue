<template>
  <div class="editable-table-wrapper">
    <table class="editable-table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            @click="col.sortable !== false && $emit('sort', col.key)"
            :class="{ sortable: col.sortable !== false }"
          >
            {{ col.label }}
            <span v-if="col.sortable !== false" class="sort-icon">
              {{ getSortIcon(col.key) }}
            </span>
          </th>
          <th v-if="showActions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.id">
          <td v-for="col in columns" :key="col.key">
            <!-- 编辑模式 -->
            <template v-if="isEditing(row.id, col.key)">
              <input
                v-if="col.type === 'select'"
                v-model="editValue"
                :options="col.options"
                class="edit-input"
                @keyup.enter="saveEdit(row)"
                @keyup.escape="cancelEdit"
              />
              <input
                v-else
                v-model="editValue"
                type="col.type === 'number' ? 'number' : 'text'"
                class="edit-input"
                @keyup.enter="saveEdit(row)"
                @keyup.escape="cancelEdit"
                @blur="saveEdit(row)"
              />
            </template>
            <!-- 显示模式 -->
            <template v-else>
              <span
                @dblclick="col.editable !== false && startEdit(row, col.key)"
                :class="{ editable: col.editable !== false }"
              >
                {{ formatValue(row[col.key], col) }}
              </span>
            </template>
          </td>
          <td v-if="showActions" class="actions">
            <slot name="actions" :row="row"></slot>
          </td>
        </tr>
        <tr v-if="data.length === 0">
          <td :colspan="columns.length + (showActions ? 1 : 0)" class="empty">
            暂无数据
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  data: { type: Array, required: true },
  columns: { type: Array, required: true },
  sortKey: { type: String, default: '' },
  sortOrder: { type: String, default: 'desc' },
  showActions: { type: Boolean, default: true }
})

const emit = defineEmits(['sort', 'update'])

const editingId = ref(null)
const editingField = ref(null)
const editValue = ref('')

const isEditing = (id, field) => {
  return editingId.value === id && editingField.value === field
}

const startEdit = (row, field) => {
  editingId.value = row.id
  editingField.value = field
  editValue.value = row[field] ?? ''
}

const cancelEdit = () => {
  editingId.value = null
  editingField.value = null
  editValue.value = ''
}

const saveEdit = (row) => {
  if (editValue.value !== row[editingField.value]) {
    emit('update', {
      id: row.id,
      field: editingField.value,
      value: editValue.value
    })
  }
  cancelEdit()
}

const getSortIcon = (key) => {
  if (props.sortKey !== key) return '⇅'
  return props.sortOrder === 'asc' ? '↑' : '↓'
}

const formatValue = (value, col) => {
  if (value === null || value === undefined) return '-'

  if (col.formatter) {
    return col.formatter(value)
  }

  if (col.type === 'price') {
    return `¥${parseFloat(value).toFixed(2)}`
  }

  if (col.type === 'date' && value) {
    return new Date(value).toLocaleDateString('zh-CN')
  }

  if (col.type === 'status') {
    const map = col.map || {}
    return map[value] || value
  }

  return value
}
</script>

<style scoped>
.editable-table-wrapper {
  overflow-x: auto;
}

.editable-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.editable-table th,
.editable-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle);
}

.editable-table th {
  background: var(--zhe-tuff-white);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.editable-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.editable-table th.sortable:hover {
  background: var(--zhe-ash-rose);
}

.sort-icon {
  margin-left: 4px;
  font-size: 12px;
}

.editable-table tbody tr:nth-child(odd) {
  background: var(--zhe-oatmeal-stone);
}

.editable-table tbody tr:nth-child(even) {
  background: var(--bg-card);
}

.editable-table tbody tr:hover {
  background: var(--zhe-ash-rose-hover);
}

.editable-table td .editable {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
}

.editable-table td .editable:hover {
  background: var(--zhe-ash-rose);
}

.edit-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--action-primary);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.actions {
  white-space: nowrap;
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 40px !important;
}
</style>
