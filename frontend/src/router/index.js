import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Orders from '../views/Orders.vue'
import Products from '../views/Products.vue'
import Customers from '../views/Customers.vue'
import Stock from '../views/Stock.vue'
import Purchases from '../views/Purchases.vue'

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard },
  { path: '/orders', name: 'orders', component: Orders },
  { path: '/products', name: 'products', component: Products },
  { path: '/customers', name: 'customers', component: Customers },
  { path: '/stock', name: 'stock', component: Stock },
  { path: '/purchases', name: 'purchases', component: Purchases },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
