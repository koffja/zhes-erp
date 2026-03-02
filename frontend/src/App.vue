<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isDark = ref(false)
const isCollapsed = ref(false)

const navItems = [
  { path: '/', label: '📊 概览', name: 'dashboard' },
  { path: '/orders', label: '📝 订单', name: 'orders' },
  { path: '/products', label: '🎁 产品资料', name: 'products' },
  { path: '/customers', label: '👥 客户', name: 'customers' },
  { path: '/stock', label: '📦 库存', name: 'stock' },
  { path: '/purchases', label: '🚚 进货', name: 'purchases' },
]

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem('sidebar-collapsed', isCollapsed.value ? '1' : '0')
}

// 初始化主题
const initTheme = () => {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

// 初始化侧边栏状态
const initSidebar = () => {
  const saved = localStorage.getItem('sidebar-collapsed')
  if (saved === '1') {
    isCollapsed.value = true
  }
}

initTheme()
initSidebar()
</script>

<template>
  <div class="layout">
    <!-- 侧边栏 -->
    <nav class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="sidebar-header">
        <button class="collapse-btn" @click="toggleSidebar" :title="isCollapsed ? '展开' : '收起'">
          {{ isCollapsed ? '→' : '←' }}
        </button>
      </div>
      <div class="logo" v-show="!isCollapsed">
        <h2>☕ 折石ERP</h2>
      </div>
      <ul class="nav-list">
        <li v-for="item in navItems" :key="item.path">
          <router-link :to="item.path" :class="{ active: route.name === item.name }">
            <span class="nav-icon">{{ item.label.split(' ')[0] }}</span>
            <span class="nav-label" v-show="!isCollapsed">{{ item.label.split(' ')[1] }}</span>
          </router-link>
        </li>
      </ul>
      <div class="sidebar-footer" v-show="!isCollapsed">
        <button @click="toggleTheme" class="theme-btn">
          {{ isDark ? '☀️ 亮色' : '🌙 暗色' }}
        </button>
      </div>
    </nav>

    <!-- 主内容区 -->
    <main class="main-content" :class="{ expanded: isCollapsed }">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  background: var(--bg-card);
  border-right: 1px solid var(--border-subtle);
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  overflow-y: auto;
  transition: width 0.3s ease;
  z-index: 100;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 0 12px 12px;
  display: flex;
  justify-content: flex-end;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-app);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.collapse-btn:hover {
  background: var(--zhe-ash-rose-hover);
}

.logo {
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 16px;
}

.logo h2 {
  margin: 0;
  font-size: 16px;
  color: var(--action-primary);
  white-space: nowrap;
}

.nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
}

.nav-list li {
  margin: 2px 8px;
}

.nav-list a {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--text-primary);
  transition: all 0.2s ease;
  gap: 8px;
}

.nav-list a:hover {
  background: var(--zhe-ash-rose-hover);
}

.nav-list a.active {
  background: var(--action-primary);
  color: var(--text-inverse);
}

.nav-icon {
  font-size: 16px;
  min-width: 24px;
  text-align: center;
}

.nav-label {
  font-size: 14px;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
}

.theme-btn {
  width: 100%;
  background: var(--bg-app);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  padding: 6px 8px;
}

.main-content {
  flex: 1;
  margin-left: 220px;
  padding: 30px 40px;
  min-height: 100vh;
  transition: margin-left 0.3s ease;
}

.main-content.expanded {
  margin-left: 64px;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .sidebar {
    background: var(--bg-card);
  }
}
</style>
