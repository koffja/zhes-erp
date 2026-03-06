# 折石ERP (Zhe Coffee ERP)

咖啡店管理系统 - 基于 Express + SQLite 的 ERP 系统。

## 功能特性

### 核心功能
- **订单管理** - 创建、查询、筛选订单，支持日期/客户/商品筛选
- **分次发货** - 订单项单独追踪已发数量，支持部分发货
- **客户管理** - 客户信息维护（姓名、电话、地址）
- **商品管理** - 产品目录管理，支持别名匹配
- **库存管理** - 库存追踪与预警
- **销售统计** - 销售数据统计与报表

### 特色功能
- **PDF 导出** - 订单 PDF 生成，支持中文显示和浮水印
- **暗色模式** - 紫岩霞光品牌配色系统
- **响应式设计** - 支持移动端访问
- **Inline编辑** - 订单、客户、商品支持点击单元格直接编辑

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 启动后端服务
node temp.js

# 或使用服务脚本（后台运行）
./server.sh start
```

服务启动后访问：
- 后端 API: http://localhost:5126
- 前端页面: http://localhost:5271

### 服务管理命令

```bash
./server.sh start    # 启动服务
./server.sh stop     # 停止服务
./server.sh restart  # 重启服务
./server.sh status   # 查看状态
```

### macOS 开机自启动（可选）

```bash
sudo cp com.coffee.erp.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.coffee.erp.plist
```

## 技术栈

- **后端**: Express.js + SQLite + Drizzle ORM
- **前端**: Vue 3 + Vite
- **PDF**: pdfkit
- **字体**: 思源黑体 + 阿里普惠体

## 项目结构

```
.
├── temp.js              # 后端服务器入口
├── server.sh            # 服务管理脚本
├── com.coffee.erp.plist # macOS LaunchDaemon 配置
├── drizzle.config.ts    # Drizzle ORM 配置
├── server/              # 后端模块化代码
│   ├── db/              # 数据库层
│   │   ├── index.js     # better-sqlite3 连接
│   │   ├── drizzle.js   # Drizzle ORM 连接
│   │   └── drizzleHelpers.js  # Drizzle 查询示例
│   ├── routes/          # API 路由
│   └── utils/           # 工具函数
├── schemas/             # 数据库 Schema 文档
│   ├── index.js         # 人类可读的 Schema
│   └── drizzle/         # Drizzle 表定义
├── drizzle/             # Drizzle 迁移文件
├── frontend/            # Vue 3 前端
│   ├── src/
│   │   ├── views/       # 页面组件
│   │   ├── components/ # 公共组件
│   │   ├── api/         # API 调用
│   │   └── style.css    # 品牌样式
│   └── vite.config.js
├── public/
│   ├── fonts/           # 中文字体
│   └── stamp.png        # PDF 浮水印图片
├── data/
│   ├── erp.db           # SQLite 数据库
│   └── *.pdf            # 导出的订单 PDF
└── package.json
```

## Drizzle ORM

本项目使用 **Drizzle ORM** 进行数据库操作，提供类型安全的查询。

### 数据库操作

```javascript
// 引入 Drizzle
const { db, schema } = require('./server/db/drizzle');
const { eq, like, desc } = require('drizzle-orm');

// 查询示例
const customers = await db
  .select()
  .from(schema.customers)
  .orderBy(schema.customers.name);

// 条件查询
const order = await db
  .select()
  .from(schema.orders)
  .where(eq(schema.orders.id, 123));
```

详细使用说明见 [CLAUDE.md](CLAUDE.md)。

## 数据库表

| 表名 | 说明 |
|------|------|
| orders | 订单记录 |
| order_items | 订单明细 |
| products | 产品目录 |
| product_aliases | 产品别名 |
| customers | 客户信息 |
| inventory | 库存 |
| suppliers | 供应商 |
| purchases | 进货记录 |

---

## API 接口文档

### 订单 API

#### 获取订单列表
```
GET /api/orders
```

**查询参数 (Query Parameters):**

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| page | number | 页码，默认1 | ?page=1 |
| pageSize | number | 每页数量，默认50 | ?pageSize=50 |
| from | string | 开始日期 (YYYY-MM-DD) | ?from=2024-01-01 |
| to | string | 结束日期 (YYYY-MM-DD) | ?to=2024-12-31 |
| customer | string | 客户姓名搜索 | ?customer=张三 |
| product | string | 商品名称搜索 | ?product=黑洞 |
| shipping_status | string | 发货状态 | ?shipping_status=shipped |
| payment_status | string | 付款状态 | ?payment_status=paid |
| has_items | string | 是否有商品明细 | ?has_items=1 (有) / ?has_items=0 (无) |

**发货状态值:** `pending`(未发货) / `partial`(部分发货) / `shipped`(已发货)

**付款状态值:** `unpaid`(未付款) / `partial`(部分付款) / `paid`(已付款)

**返回格式:**
```json
{
  "data": [...],
  "total": 2098,
  "page": 1,
  "pageSize": 50,
  "totalPages": 42
}
```

---

#### 获取订单详情
```
GET /api/orders/:id
```

**返回格式:**
```json
{
  "id": 1,
  "order_no": "ORD123456",
  "customer_id": 1,
  "total_amount": 500,
  "status": "completed",
  "shipping_name": "张三",
  "shipping_phone": "13800138000",
  "shipping_address": "上海市...",
  "note": "",
  "order_date": "2024-01-15",
  "payment_status": "paid",
  "shipping_status": "shipped",
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "黑洞",
      "quantity": 10,
      "unit_price": 50,
      "subtotal": 500,
      "shipped_quantity": 10,
      "shipping_status": "shipped",
      "unit": "包"
    }
  ]
}
```

---

#### 创建订单
```
POST /api/orders
```

**请求体:**
```json
{
  "customer_name": "张三",
  "customer_phone": "13800138000",
  "customer_address": "上海市...",
  "items": [
    { "product_name": "黑洞", "quantity": 10, "unit_price": 50 }
  ],
  "note": ""
}
```

---

#### 更新订单
```
PUT /api/orders/:id
```

**可更新字段:**
```json
{
  "order_no": "ORD123456",
  "customer_id": 1,
  "total_amount": 500,
  "status": "completed",
  "shipping_name": "张三",
  "shipping_phone": "13800138000",
  "shipping_address": "上海市...",
  "note": "",
  "order_date": "2024-01-15",
  "paid_amount": 500,
  "payment_status": "paid",
  "shipping_status": "shipped"
}
```

---

#### 订单发货
```
POST /api/orders/:id/ship
```

**请求体:**
```json
{
  "items": [
    { "item_id": 1, "ship_quantity": 5 }
  ]
}
```

---

#### 导出PDF
```
GET /api/orders/:id/pdf
```

---

### 订单明细 API

#### 更新订单明细
```
PUT /api/order-items/:id
```

**可更新字段:**
```json
{
  "product_name": "黑洞",
  "quantity": 10,
  "unit_price": 50,
  "unit": "包",
  "shipped_quantity": 10,
  "shipping_status": "shipped"
}
```

---

#### 删除订单明细
```
DELETE /api/order-items/:id
```

---

#### 新增订单明细
```
POST /api/order-items
```

**请求体:**
```json
{
  "order_id": 1,
  "product_name": "黑洞",
  "quantity": 10,
  "unit_price": 50,
  "unit": "包"
}
```

---

### 客户 API

#### 获取客户列表
```
GET /api/customers
```

**查询参数:**

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| all | string | 返回所有客户(含无订单) | ?all=1 |
| search | string | 搜索姓名/电话/地址 | ?search=张三 |
| sortBy | string | 排序字段 | ?sortBy=name / order_count / total_receivable |
| sortOrder | string | 排序方向 | ?sortOrder=asc / desc |
| page | number | 页码 | ?page=1 |
| pageSize | number | 每页数量 | ?pageSize=100 |

**返回格式 (all=1时):**
```json
{
  "data": [
    {
      "id": 1,
      "name": "张三",
      "phone": "13800138000",
      "address": "上海市...",
      "order_count": 10,
      "total_receivable": 5000,
      "total_paid": 5000,
      "outstanding": 0
    }
  ],
  "total": 550,
  "page": 1,
  "pageSize": 100,
  "totalPages": 6
}
```

---

#### 创建客户
```
POST /api/customers
```

**请求体:**
```json
{
  "name": "张三",
  "phone": "13800138000",
  "address": "上海市...",
  "note": ""
}
```

---

#### 更新客户
```
PUT /api/customers/:id
```

**请求体:**
```json
{
  "name": "张三",
  "phone": "13800138000",
  "address": "上海市...",
  "note": ""
}
```

---

### 商品 API

#### 获取商品列表
```
GET /api/products
```

返回商品列表，包含别名信息。

---

#### 创建商品
```
POST /api/products
```

---

#### 更新商品
```
PUT /api/products/:id
```

---

#### 删除商品
```
DELETE /api/products/:id
```

---

### 库存 API

#### 获取库存
```
GET /api/inventory
```

---

#### 批量更新库存
```
POST /api/stock/batch
```

**请求体:**
```json
{
  "stocks": [
    { "product_id": 1, "stock": 100 }
  ]
}
```

---

### 统计 API

#### 销售统计
```
GET /api/stats
```

支持查询参数: from, to, groupBy (month/year)

---

## 品牌色彩

使用紫岩霞光（Morandi Porphyry）配色系统：

- `--zhe-dark-porphyry`: #3A2E35（深紫灰）
- `--zhe-ash-rose`: #C4B1AE（灰玫瑰）
- `--zhe-tuff-white`: #EAE5E1（凝灰白）
- `--zhe-oatmeal-stone`: #F5F0EB（燕麦灰）

## 许可证

ISC
