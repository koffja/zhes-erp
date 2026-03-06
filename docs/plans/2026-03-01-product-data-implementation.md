# 产品资料数据结构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建新的产品数据表结构，支持多规格、多价格、多分类和完整的咖啡专业字段，并从Excel导入现有数据

**Architecture:** 在现有SQLite数据库中添加新表，通过Node.js脚本解析Excel并导入数据

**Tech Stack:** SQLite (better-sqlite3), Python (pandas/openpyxl), Express.js

---

## 实施步骤

### Task 1: 创建新的数据表

**Files:**
- Modify: `temp.js` - 添加建表SQL

**Step 1: 添加产品表SQL**

在 temp.js 中添加以下建表语句：

```javascript
// 产品基础信息表
db.exec(`
  CREATE TABLE IF NOT EXISTS products_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku_code TEXT UNIQUE,
    name_short TEXT NOT NULL,
    name_full TEXT,
    origin TEXT,
    region TEXT,
    variety TEXT,
    process TEXT,
    altitude TEXT,
    grade TEXT,
    description TEXT,
    tags TEXT,
    cupping_notes TEXT,
    roast_level TEXT,
    flavor_type TEXT,
    acidity TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// 产品规格表
db.exec(`
  CREATE TABLE IF NOT EXISTS product_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    spec_name TEXT NOT NULL,
    spec_code TEXT NOT NULL,
    weight_grams INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (product_id) REFERENCES products_new(id)
  )
`)

// 产品价格表
db.exec(`
  CREATE TABLE IF NOT EXISTS product_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spec_id INTEGER NOT NULL,
    price_type TEXT NOT NULL,
    price REAL NOT NULL,
    min_quantity INTEGER DEFAULT 1,
    valid_from DATE,
    FOREIGN KEY (spec_id) REFERENCES product_specs(id)
  )
`)

// 产品分类表
db.exec(`
  CREATE TABLE IF NOT EXISTS product_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    category_type TEXT NOT NULL,
    category_name TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products_new(id)
  )
`)
```

**Step 2: 运行测试**

启动服务后访问 http://localhost:5271/api/products 检查是否正常

**Step 3: 提交**

```bash
git add temp.js && git commit -m "feat: 添加产品新数据结构表"
```

---

### Task 2: 解析Excel数据并生成导入脚本

**Files:**
- Create: `scripts/import_products.py` - Python导入脚本

**Step 1: 创建Python导入脚本**

使用 pandas 解析 Excel "豆单_批发（2602）" sheet，生成SQL INSERT语句

**Step 2: 运行脚本导入数据**

```bash
python3 scripts/import_products.py
```

**Step 3: 验证数据**

```bash
sqlite3 data/erp.db "SELECT COUNT(*) FROM products_new"
```

**Step 4: 提交**

```bash
git add scripts/import_products.py && git commit -m "feat: 添加产品数据导入脚本"
```

---

### Task 3: 创建API接口

**Files:**
- Modify: `temp.js` - 添加新产品的API接口

**Step 1: 添加获取产品列表API**

```javascript
app.get('/api/products-new', (req, res) => {
  const { category, spec, price_type } = req.query
  // 查询逻辑
})
```

**Step 2: 添加获取产品详情API**

```javascript
app.get('/api/products-new/:id', (req, res) => {
  // 查询逻辑
})
```

**Step 3: 测试API**

```bash
curl http://localhost:5271/api/products-new
```

**Step 4: 提交**

```bash
git add temp.js && git commit -m "feat: 添加新产品API接口"
```

---

### Task 4: 更新前端页面

**Files:**
- Modify: `public/index.html` - 添加产品管理页面

**Step 1: 添加产品管理Tab**

**Step 2: 添加产品列表展示**

**Step 3: 添加产品编辑功能**

**Step 4: 测试**

**Step 5: 提交**

```bash
git add public/index.html && git commit -m "feat: 添加产品管理前端页面"
```

---

### Task 5: SKU自动生成功能

**Files:**
- Modify: `scripts/import_products.py` - 添加SKU生成逻辑

**Step 1: 实现SKU生成函数**

```python
def generate_sku(origin_code, weight, name_short):
    # 格式: {产区代码}-{规格}-{简称拼音首字母}
    return f"{origin_code}-{weight}-{name_short[:3].upper()}"
```

**Step 2: 测试生成逻辑**

**Step 3: 提交**

---

## 执行方式选择

**Plan complete and saved to `docs/plans/2026-03-01-product-data-implementation.md`. Two execution options:**

1. **Subagent-Driven (this session)** - 任务制实施，代码审查
2. **Parallel Session (separate)** - 新建会话批量执行

Which approach?
