// API service
const API_BASE = '/api'

export const api = {
  // Products
  async getProducts() {
    const res = await fetch(`${API_BASE}/products`)
    return res.json()
  },

  // New Products (with specs and prices)
  async getProductsNew() {
    const res = await fetch(`${API_BASE}/products-new`)
    return res.json()
  },

  async getProductNew(id) {
    const res = await fetch(`${API_BASE}/products-new/${id}`)
    return res.json()
  },

  async getProduct(id) {
    const res = await fetch(`${API_BASE}/products/${id}`)
    return res.json()
  },

  async updateProduct(id, data) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async deleteProduct(id) {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' })
    return res.json()
  },

  async searchProducts(q) {
    const res = await fetch(`${API_BASE}/products/search?q=${encodeURIComponent(q)}`)
    return res.json()
  },

  // Orders
  async getOrders(page = 1, pageSize = 50, filters = {}) {
    const params = new URLSearchParams({
      page: page,
      pageSize: pageSize,
      ...filters
    })
    const res = await fetch(`${API_BASE}/orders?${params}`)
    return res.json()
  },

  async getOrder(id) {
    const res = await fetch(`${API_BASE}/orders/${id}`)
    return res.json()
  },

  async createOrder(data) {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async updateOrder(id, data) {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // Order Items CRUD
  async updateOrderItem(id, data) {
    const res = await fetch(`${API_BASE}/order-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async deleteOrderItem(id) {
    const res = await fetch(`${API_BASE}/order-items/${id}`, {
      method: 'DELETE'
    })
    return res.json()
  },

  async createOrderItem(data) {
    const res = await fetch(`${API_BASE}/order-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // Customers
  async getCustomers(all = false) {
    const res = await fetch(`${API_BASE}/customers${all ? '?all=1' : ''}`)
    return res.json()
  },

  async createCustomer(data) {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  async updateCustomer(id, data) {
    const res = await fetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // Stock
  async getStock() {
    const res = await fetch(`${API_BASE}/stock`)
    return res.json()
  },

  async updateStock(data) {
    const res = await fetch(`${API_BASE}/stock/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stocks: data })
    })
    return res.json()
  },

  // Stats
  async getStats(period = 'all', from = '', to = '') {
    let url = `${API_BASE}/stats?period=${period}`
    if (period === 'custom' && from && to) {
      url += `&from=${from}&to=${to}`
    }
    const res = await fetch(url)
    return res.json()
  },

  async getTopProducts(period = 'all', from = '', to = '') {
    let url = `${API_BASE}/stats/top-products?period=${period}`
    if (period === 'custom' && from && to) {
      url += `&from=${from}&to=${to}`
    }
    const res = await fetch(url)
    return res.json()
  },

  async getTopCustomers(period = 'all', from = '', to = '') {
    let url = `${API_BASE}/stats/top-customers?period=${period}`
    if (period === 'custom' && from && to) {
      url += `&from=${from}&to=${to}`
    }
    const res = await fetch(url)
    return res.json()
  },

  // Purchases
  async getPurchases() {
    const res = await fetch(`${API_BASE}/purchases`)
    return res.json()
  },

  async createPurchase(data) {
    const res = await fetch(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  },

  // Suppliers
  async getSuppliers() {
    const res = await fetch(`${API_BASE}/suppliers`)
    return res.json()
  },

  async createSupplier(data) {
    const res = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.json()
  }
}
