# 订单分次发货与付款追踪功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现订单分次发货功能，支持订单项单独追踪已发数量，并在订单列表和详情中展示发货状态

**Architecture:** 在 order_items 表增加 shipped_quantity 和 shipping_status 字段，后端提供发货接口，前端展示发货状态

**Tech Stack:** Node.js + Express + SQLite (后端), Vue 3 (前端)

---

### Task 1: 数据库迁移 - 新增发货字段

**Files:**
- Modify: `temp.js`

**Step 1: 添加数据库字段**

在 temp.js 中添加迁移语句，执行：
```javascript
// 在现有表结构后添加
db.exec(`
    ALTER TABLE order_items ADD COLUMN shipped_quantity INTEGER DEFAULT 0;
    ALTER TABLE order_items ADD COLUMN shipping_status TEXT DEFAULT 'pending';
    ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'pending';
`);
```

**Step 2: 测试数据库**

Run: `sqlite3 data/erp.db ".schema order_items"`
Expected: 应显示新增字段

**Step 3: 重启后端服务**

Run: `pkill -f "node temp.js"; node temp.js > /dev/null 2>&1 &`

---

### Task 2: 后端 API - 更新订单列表返回发货统计

**Files:**
- Modify: `temp.js:35-87` (GET /api/orders)

**Step 1: 更新订单查询 SQL**

修改 orders 查询，增加每订单的发货统计：
```javascript
// 在订单查询中添加发货统计子查询
let orders = db.prepare(`
    SELECT o.*,
        (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) as total_items,
        (SELECT SUM(COALESCE(oi.shipped_quantity, 0)) FROM order_items oi WHERE oi.order_id = o.id) as shipped_items,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.shipping_status = 'shipped') as fully_shipped_items,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.shipping_status = 'partial') as partial_shipped_items
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ${whereClause}
    ORDER BY o.created_at DESC
`).all(...params);
```

**Step 2: 计算整体发货状态**

在返回前计算：
```javascript
ordersWithItems = orders.map(order => {
    // 计算整体发货状态
    let shipping_status = 'pending';
    if (order.shipped_items > 0 && order.shipped_items < order.total_items) {
        shipping_status = 'partial';
    } else if (order.shipped_items >= order.total_items && order.total_items > 0) {
        shipping_status = 'shipped';
    }
    return { ...order, shipping_status, total_items: order.total_items || 0, shipped_items: order.shipped_items || 0 };
});
```

**Step 3: 测试 API**

Run: `curl http://localhost:5126/api/orders | jq '.[0]'`
Expected: 应显示 total_items, shipped_items, shipping_status 字段

---

### Task 3: 后端 API - 更新订单详情返回发货状态

**Files:**
- Modify: `temp.js:728-750` (GET /api/orders/:id)

**Step 1: 更新订单详情查询**

在 order_items 查询中添加 shipped_quantity 和 shipping_status 字段：
```javascript
const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.specs
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
`).all(order.id);
```

**Step 2: 返回数据已包含新字段**

SQLite ALTER TABLE 添加的字段会自动包含在查询结果中

**Step 3: 测试订单详情 API**

Run: `curl http://localhost:5126/api/orders/1 | jq '.items[0]'`
Expected: 应显示 shipped_quantity, shipping_status 字段

---

### Task 4: 后端 API - 新增发货接口

**Files:**
- Modify: `temp.js` (在现有 API 后添加新路由)

**Step 1: 添加发货接口**

```javascript
// 发货接口
app.post('/api/orders/:id/ship', (req, res) => {
    const { items } = req.body; // items: [{ item_id: 1, ship_quantity: 5 }]

    try {
        items.forEach(item => {
            // 获取当前订单项信息
            const orderItem = db.prepare('SELECT * FROM order_items WHERE id = ?').get(item.item_id);
            if (!orderItem) return;

            const newShippedQty = (orderItem.shipped_quantity || 0) + item.ship_quantity;
            const status = newShippedQty >= orderItem.quantity ? 'shipped' :
                         newShippedQty > 0 ? 'partial' : 'pending';

            db.prepare(`
                UPDATE order_items
                SET shipped_quantity = ?, shipping_status = ?
                WHERE id = ?
            `).run(newShippedQty, status, item.item_id);
        });

        // 更新订单整体发货状态
        const orderItems = db.prepare(`
            SELECT shipping_status FROM order_items WHERE order_id = ?
        `).all(req.params.id);

        let orderStatus = 'pending';
        const shippedCount = orderItems.filter(i => i.shipping_status === 'shipped').length;
        const partialCount = orderItems.filter(i => i.shipping_status === 'partial').length;

        if (shippedCount === orderItems.length && orderItems.length > 0) {
            orderStatus = 'shipped';
        } else if (shippedCount > 0 || partialCount > 0) {
            orderStatus = 'partial';
        }

        db.prepare('UPDATE orders SET shipping_status = ? WHERE id = ?')
          .run(orderStatus, req.params.id);

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
```

**Step 2: 测试发货接口**

Run: `curl -X POST http://localhost:5126/api/orders/1/ship -H "Content-Type: application/json" -d '{"items":[{"item_id":1,"ship_quantity":2}]}'`
Expected: `{"success":true}`

---

### Task 5: 前端 - 订单列表增加发货状态列

**Files:**
- Modify: `frontend/src/views/Orders.vue`

**Step 1: 在表格表头添加发货相关列**

```vue
<th @click="sortBy('created_at')" class="sortable">
    日期 <span class="sort-icon">{{ getSortIcon('created_at') }}</span>
</th>
<th>订单号</th>
<th>客户</th>
<th>金额</th>
<th>发货状态</th>
<th>已发/总数</th>
<th>付款状态</th>
<th>操作</th>
```

**Step 2: 添加发货状态计算属性**

```javascript
const getShippingStatus = (order) => {
    if (!order.shipping_status) return '未发货'
    const map = { pending: '未发货', partial: '部分发货', shipped: '已发货' }
    return map[order.shipping_status] || '未发货'
}

const getPaymentStatus = (order) => {
    const paid = order.paid_amount || 0
    const total = order.total_amount || 0
    if (paid >= total && total > 0) return '已付清'
    if (paid > 0) return '部分付款'
    return '未付款'
}
```

**Step 3: 在表格行中添加发货列**

```vue
<td>
    <span :class="['status', 'shipping-' + (order.shipping_status || 'pending')]">
        {{ getShippingStatus(order) }}
    </span>
</td>
<td>
    {{ (order.shipped_items || 0) }} / {{ (order.total_items || 0) }} 件
</td>
<td>
    <span :class="['status', getPaymentStatus(order) === '已付清' ? 'completed' : getPaymentStatus(order) === '部分付款' ? 'confirmed' : 'pending']">
        {{ getPaymentStatus(order) }}
    </span>
</td>
```

**Step 4: 添加状态样式**

```css
.status.shipping-pending { background: #fff3e0; color: #f57c00; }
.status.shipping-partial { background: #e3f2fd; color: #1976d2; }
.status.shipping-shipped { background: #e8f5e9; color: #388e3c; }
```

**Step 5: 测试前端**

访问 http://localhost:5271/orders
Expected: 应显示发货状态列和已发/总数列

---

### Task 6: 前端 - 订单详情弹窗显示每项发货状态

**Files:**
- Modify: `frontend/src/views/Orders.vue` (订单详情弹窗部分)

**Step 1: 更新订单项目表格**

```vue
<h3>订单项目</h3>
<table class="items-table">
    <thead>
        <tr>
            <th>序号</th>
            <th>产品</th>
            <th>规格</th>
            <th>数量</th>
            <th>已发</th>
            <th>状态</th>
            <th>小计</th>
        </tr>
    </thead>
    <tbody>
        <tr v-for="item in selectedOrder.items" :key="item.id">
            <td>{{ selectedOrder.items.indexOf(item) + 1 }}</td>
            <td>{{ item.product_name || item.name }}</td>
            <td>{{ item.specs || '-' }}</td>
            <td>{{ item.quantity }}</td>
            <td>{{ item.shipped_quantity || 0 }} / {{ item.quantity }}</td>
            <td>
                <span :class="['status', 'shipping-' + (item.shipping_status || 'pending')]">
                    {{ { pending: '未发', partial: '部分发', shipped: '已发' }[item.shipping_status] || '未发' }}
                </span>
            </td>
            <td>{{ formatPrice(item.price * item.quantity) }}</td>
        </tr>
    </tbody>
</table>
```

**Step 2: 添加发货按钮**

在弹窗底部添加"发货"按钮：
```vue
<div class="modal-footer">
    <button class="primary" @click="showShipModal = true">发货</button>
    <button class="primary" @click="exportPDF(selectedOrder)">导出 PDF</button>
    <button class="secondary" @click="closeModal">关闭</button>
</div>
```

**Step 3: 添加发货弹窗**

添加发货弹窗组件，用于选择要发货的项目和数量：
```vue
<div v-if="showShipModal" class="modal-overlay" @click="showShipModal = false">
    <div class="modal" @click.stop>
        <!-- 发货表单 -->
    </div>
</div>
```

**Step 4: 测试**

打开订单详情，应显示每项的发货状态

---

### Task 7: 测试完整流程

**Step 1: 创建测试订单**

Run: 使用前端创建测试订单

**Step 2: 测试发货功能**

- 打开订单详情
- 点击"发货"按钮
- 选择部分数量发货
- 确认状态更新

**Step 3: 验证显示**

- 订单列表显示发货状态和已发/总数
- 订单详情显示每项发货状态

---

**Plan complete and saved to `docs/plans/2026-03-02-order-partial-shipping-design.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
