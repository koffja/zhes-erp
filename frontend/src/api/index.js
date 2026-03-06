// API service
const API_BASE = '/api'

export const api = {
  // Products
  async getProducts(search = '', category = '', tag = '') {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (category && category !== 'all') params.append('category', category)
    if (tag && tag !== 'all') params.append('tag', tag)
    const res = await fetch(`${API_BASE}/products?${params}`)
    return res.json()
  },

  async getProductCategories() {
    const res = await fetch(`${API_BASE}/products/categories`)
    return res.json()
  },

  async getProductTags() {
    const res = await fetch(`${API_BASE}/products/tags`)
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

  async getProductOrders(id) {
    const res = await fetch(`${API_BASE}/products/${id}/orders`)
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

  async getOrderDateRange() {
    const res = await fetch(`${API_BASE}/orders/date-range`)
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
  async getCustomers(all = false, filters = {}) {
    const params = new URLSearchParams({ all: '1', ...filters }).toString()
    const res = await fetch(`${API_BASE}/customers?${params}`)
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
    // Convert period to from/to dates
    const today = new Date()
    let startDate = ''
    let endDate = today.toISOString().split('T')[0]

    if (period === 'custom' && from && to) {
      startDate = from
      endDate = to
    } else if (period === 'today') {
      startDate = endDate
    } else if (period === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      startDate = d.toISOString().split('T')[0]
    } else if (period === '15days') {
      const d = new Date()
      d.setDate(d.getDate() - 15)
      startDate = d.toISOString().split('T')[0]
    } else if (period === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      startDate = d.toISOString().split('T')[0]
    } else if (period === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      startDate = d.toISOString().split('T')[0]
    }
    // 'all' period means no date filter

    let url = `${API_BASE}/stats`
    if (startDate && endDate) {
      url += `?from=${startDate}&to=${endDate}`
    }
    const res = await fetch(url)
    return res.json()
  },

  async getTopProducts(period = 'all', from = '', to = '') {
    // Convert period to from/to dates
    const today = new Date()
    let startDate = ''
    let endDate = today.toISOString().split('T')[0]

    if (period === 'custom' && from && to) {
      startDate = from
      endDate = to
    } else if (period === 'today') {
      startDate = endDate
    } else if (period === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      startDate = d.toISOString().split('T')[0]
    } else if (period === '15days') {
      const d = new Date()
      d.setDate(d.getDate() - 15)
      startDate = d.toISOString().split('T')[0]
    } else if (period === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      startDate = d.toISOString().split('T')[0]
    } else if (period === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      startDate = d.toISOString().split('T')[0]
    }

    let url = `${API_BASE}/stats/top-products`
    if (startDate && endDate) {
      url += `?from=${startDate}&to=${endDate}`
    }
    const res = await fetch(url)
    return res.json()
  },

  async getTopCustomers(period = 'all', from = '', to = '') {
    // Convert period to from/to dates
    const today = new Date()
    let startDate = ''
    let endDate = today.toISOString().split('T')[0]

    if (period === 'custom' && from && to) {
      startDate = from
      endDate = to
    } else if (period === 'today') {
      startDate = endDate
    } else if (period === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      startDate = d.toISOString().split('T')[0]
    } else if (period === '15days') {
      const d = new Date()
      d.setDate(d.getDate() - 15)
      startDate = d.toISOString().split('T')[0]
    } else if (period === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      startDate = d.toISOString().split('T')[0]
    } else if (period === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      startDate = d.toISOString().split('T')[0]
    }

    let url = `${API_BASE}/stats/top-customers`
    if (startDate && endDate) {
      url += `?from=${startDate}&to=${endDate}`
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
