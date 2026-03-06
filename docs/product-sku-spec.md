# 产品SKU编码规范

## 编码格式

```
分类代码 + 4位序号 + 规格后缀（可选）
```

示例：`DS0035-200`

---

## 分类代码

| 分类 | 代码 | 说明 |
|------|------|------|
| 单品熟豆 | DS | 精品咖啡单品豆 |
| 熟豆 | DS | 通用熟豆 |
| 意式豆 | ES | Espresso配方豆 |
| 生豆 | GB | Green Bean生豆 |
| 挂耳咖啡 | DP | Drip Coffee挂耳包 |
| 周边产品 | AC | Accessories周边 |
| 材料/物料 | MT | Material物料 |
| 粉末 | PW | Powder粉类 |
| 市集饮品 | DR | Drinks饮品 |

---

## 规格后缀

| 规格 | 后缀 | 示例 |
|------|------|------|
| 100g | -100 | DS0001-100 |
| 200g | -200 | DS0001-200 |
| 500g | -500 | ES0001-500 |
| 1kg | -1K | GB0001-1K |
| 1个/份 | -1U | DP0001-1U |
| 无规格 | (无) | GB0001 |

---

## 生成规则

1. **自动递增**：新建产品时，该分类的最大序号+1
2. **补零**：序号固定4位，不足前面补0
3. **自动提取**：规格从产品规格字段自动提取数字

---

## 前端使用

- 产品列表显示SKU编码（可编辑）
- 搜索支持SKU编码
- 详情弹窗可查看和编辑SKU

---

## 数据库字段

- `products.sku_code` - 产品SKU编码
- `products.category` - 产品分类
- `products.specs` - 产品规格

---

## API接口

- `GET /api/products` - 产品列表（含SKU）
- `GET /api/products/:id` - 产品详情
- `POST /api/products` - 创建产品（自动生成SKU）
- `PUT /api/products/:id` - 更新产品

---

## 创建新产品示例

```javascript
// POST /api/products
{
  "name": "耶加雪菲新批次",
  "category": "单品熟豆",
  "specs": "200g",
  "price": 88,
  "stock": 100
}

// 响应
{
  "success": true,
  "id": 123,
  "sku_code": "DS0058-200"  // 自动生成
}
```
