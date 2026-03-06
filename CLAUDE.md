# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

折石ERP (Coffee ERP) - An Express-based ERP system for coffee shop management using SQLite database.

## Tech Stack

- **Backend**: Node.js + Express.js (端口 5126)
- **Database**: SQLite + Drizzle ORM
- **Frontend**: Vue 3 + Vite (端口 5271)
- **PDF Generation**: PDFKit
- **Routing**: Vue Router 4 SPA

## Commands

```bash
# Install dependencies
npm install

# Start the server (development)
node temp.js

# Service management (start/stop/restart/status)
./server.sh start
./server.sh stop
./server.sh restart
./server.sh status

# Enable macOS开机自启动 (requires sudo)
sudo cp com.coffee.erp.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.coffee.erp.plist
```

## Architecture

- **Main Server**: `temp.js` - Express server running on port 5126
- **Database**: SQLite at `data/erp.db` + Drizzle ORM
- **Frontend**: Vue 3 + Vite at `frontend/` (dev: port 5271)
- **PDF Generation**: Generates order PDFs stored in `data/`
- **Service Script**: `server.sh` handles daemonization and process management
- **LaunchDaemon**: `com.coffee.erp.plist` for macOS boot startup

### Backend Structure (Modular)

```
server/
├── db/
│   ├── index.js           # 数据库连接和迁移 (better-sqlite3)
│   ├── drizzle.js         # Drizzle ORM 连接
│   └── drizzleHelpers.js  # Drizzle 查询示例
├── routes/                # API 路由
│   ├── index.js
│   ├── orders.js
│   ├── customers.js       # 已迁移到 Drizzle
│   ├── products.js
│   ├── stats.js
│   ├── stock.js
│   ├── suppliers.js
│   ├── purchases.js
│   └── orderItems.js
└── utils/
    ├── helpers.js
    └── pdf.js

schemas/
└── index.js              # 手动维护的 Schema 文档

drizzle/
└── *.sql                 # Drizzle 生成的迁移文件

schemas/drizzle/
└── schema.js             # Drizzle 表结构定义
```

### Frontend Structure (Vue 3)

```
frontend/
├── src/
│   ├── views/        # 页面组件
│   │   ├── Products.vue   # 产品资料（inline编辑）
│   │   ├── Orders.vue     # 订单
│   │   ├── Customers.vue  # 客户
│   │   ├── Stock.vue      # 库存
│   │   └── Purchases.vue  # 进货
│   ├── router/       # Vue Router 配置
│   ├── api/          # API 调用
│   ├── style.css     # 品牌色彩变量
│   └── App.vue       # 主布局
├── vite.config.js    # Vite 配置
└── index.html        # 入口HTML
```

## Key Tables

- `orders` - Order records
- `order_items` - Line items for orders
- `products` - Product catalog
- `product_aliases` - Product name aliases
- `customers` - Customer information
- `inventory` - Stock/inventory tracking
- `suppliers` - Supplier information
- `purchases` - Purchase records

## Color System - 折石咖啡品牌色彩 (Morandi Porphyry)

所有页面配色必须使用 CSS 变量，禁止使用硬编码颜色值。前端文件位于 `frontend/src/style.css`。

### 基础色板 (Base Colors)

```css
--zhe-dark-porphyry: #3A2E35;    /* 暗斑岩 - 主要文字/按钮 */
--zhe-ash-rose: #C4B1AE;        /* 灰燼粉 - 强调/点睛 */
--zhe-tuff-white: #EAE5E1;       /* 凝灰白 - 背景基底 */
--zhe-oatmeal-stone: #F5F0EB;    /* 燕麦白 - 更亮的基底 */
--zhe-obsidian-ash: #1A1518;     /* 黑曜灰 - 极深文字 */
--zhe-weathered-gray: #7A7074;    /* 风化岩 - 次要信息 */
--zhe-ash-rose-hover: #D8C9C6;   /* 霞光微亮 - 悬停状态 */
--zhe-ash-rose-active: #AD9794;  /* 沉岩暗影 - 按下状态 */
--zhe-terracotta: #C17D6B;       /* 莫兰迪赤陶 - 删除/危险操作 */
--zhe-terracotta-hover: #A86858; /* 赤陶悬停状态 */
```

### 语义化变量 (Semantic Variables)

```css
--bg-app: var(--zhe-oatmeal-stone);     /* 应用全局背景 */
--bg-card: #FFFFFF;                      /* 卡片背景 */
--bg-elevated: var(--zhe-tuff-white);  /* 浮起元素 */

--text-primary: var(--zhe-dark-porphyry);  /* 主要文字 */
--text-secondary: var(--zhe-dark-porphyry); /* 次要信息 */
--text-muted: var(--zhe-weathered-gray);   /* 禁用/注释 */
--text-inverse: var(--zhe-tuff-white);     /* 反白文字 */

--border-subtle: #D1C9C7;                  /* 分割线 */
--border-strong: var(--zhe-dark-porphyry); /* 强调边框 */

--action-primary: var(--zhe-dark-porphyry);      /* 主要按钮 */
--action-primary-hover: var(--zhe-obsidian-ash); /* 主要按钮悬停 */
--action-accent: var(--zhe-ash-rose);           /* 强调按钮 */
--action-accent-hover: var(--zhe-ash-rose-hover); /* 强调悬停 */
```

### 深色模式

支持手动切换和系统偏好：

```css
/* 手动切换类（通过JS添加） */
.dark {
  --bg-app: var(--zhe-obsidian-ash);
  --bg-card: var(--zhe-dark-porphyry);
  --text-primary: var(--zhe-tuff-white);
  --action-primary: var(--zhe-tuff-white);
  /* ...其他变量映射 */
}

/* 系统偏好自动切换 */
@media (prefers-color-scheme: dark) {
  :root { /* ... */ }
}
```

### 按钮颜色规范

- **删除/危险操作**: 使用 `var(--zhe-terracotta)` 和 `var(--zhe-terracotta-hover)`，禁止使用纯红 `#f44336`
- **主按钮**: 使用 `var(--action-primary)`
- **次要按钮**: 使用 `var(--action-accent)`

### 表格配色示例

```css
tbody tr:nth-child(odd) {
  background: var(--zhe-oatmeal-stone);
  color: var(--text-primary);  /* 必须显式设置，深色模式需要 */
}
tbody tr:nth-child(even) {
  background: var(--bg-card);
  color: var(--text-primary);  /* 必须显式设置 */
}
tbody tr:hover { background: var(--zhe-ash-rose-hover); }
```

## Code Writing Principles

### 技术原则

1. **前端**: Vue 3 + Vite，使用 CSS 变量
2. **后端**: Express.js + SQLite，保持简单
3. **API 设计**: RESTful 风格，JSON 格式
4. **样式**: 使用 CSS 变量，禁止硬编码颜色（包括按钮颜色）
5. **暗色模式**: 必须同时设置背景色和文字颜色

### 命名规范

- JavaScript: camelCase (变量/函数)
- CSS: kebab-case (类名/变量)
- 数据库: 小写下划线 (表名/字段)

### 文件组织

- 后端逻辑: `temp.js` (单文件应用)
- 前端: `frontend/` (Vue 3 + Vite 项目)
- 样式: `frontend/src/style.css` (品牌色彩变量)
- 脚本: `scripts/*.py` (Python 数据处理)

### 数据库

- 使用 SQLite + Drizzle ORM
- 字段: id, name, category, specs, price, cost, stock, note, created_at
- 关联表: product_aliases, orders, order_items, customers, suppliers, purchases

## Drizzle ORM 使用规范 (必须遵循)

### 数据库操作优先级

**必须优先使用 Drizzle ORM**，只有在以下情况可使用原生 SQL：
1. Drizzle 不支持的复杂查询
2. 性能关键的聚合查询
3. 现有代码尚未迁移的模块

### Drizzle 引入方式

```javascript
// 方式1：使用 Drizzle 助手函数 (推荐)
const { getOrders, createOrder } = require('./server/db/drizzleHelpers.js');

// 方式2：直接使用 Drizzle (高级用法)
const { db, schema } = require('./server/db/drizzle');
const { eq, like, desc } = require('drizzle-orm');
```

### 常见查询示例

```javascript
// 查询列表
const customers = await db
  .select()
  .from(schema.customers)
  .orderBy(schema.customers.name);

// 条件查询
const results = await db
  .select()
  .from(schema.orders)
  .where(eq(schema.orders.customerId, 123));

// 模糊搜索
const products = await db
  .select()
  .from(schema.products)
  .where(like(schema.products.name, '%咖啡%'));

// 插入数据
const result = await db
  .insert(schema.customers)
  .values({ name: '新客户', phone: '13800000000' })
  .run();

// 更新数据
await db
  .update(schema.customers)
  .set({ name: '新名字' })
  .where(eq(schema.customers.id, 123))
  .run();

// 删除数据
await db
  .delete(schema.customers)
  .where(eq(schema.customers.id, 123))
  .run();
```

### 表结构定义

所有表结构定义在 `schemas/drizzle/schema.js`，字段使用驼峰命名：
- 数据库字段: `order_no` → Drizzle: `orderNo`
- 数据库字段: `customer_id` → Drizzle: `customerId`

### Schema 参考

- `schemas/index.js` - 手动维护的 Schema 文档（人类可读）
- `schemas/drizzle/schema.js` - Drizzle 表结构定义（机器可读）
- `drizzle/*.sql` - 生成的迁移文件

### Excel 处理

- 使用 pandas + openpyxl
- 遵循 xlsx skill 规范
- 所有计算使用 Excel 公式，不硬编码值

### 代码审查清单

- [ ] 是否使用了品牌色彩变量？
- [ ] 删除按钮是否使用了 `var(--zhe-terracotta)` 而非纯红？
- [ ] 表格是否同时设置了背景色和文字颜色（深色模式）？
- [ ] 是否有调试代码（console.log）？
- [ ] 错误处理是否完整？
- [ ] **数据库操作是否优先使用 Drizzle ORM？**
- [ ] 代码是否有必要的注释？
