# 产品资料数据结构设计

## 背景

折石ERP需要建立完善的产品数据资料体系，用于：
- 订单管理
- 报价单生成
- 产品资料维护
- 销售统计

## 目标

构建灵活、可扩展的产品数据结构，支持：
- 多规格（200g/500g/100g）
- 多价格档次（零售/商户/大量/超大量）
- 多维度分类（产区+产品类型）
- 完整的咖啡专业字段

## 数据表设计

### 1. products 表（产品基础信息）

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | INTEGER | 主键 | 1 |
| sku_code | TEXT | SKU编码 | ETJ-200-LMH |
| name_short | TEXT | 简称（内部使用） | 柠檬花 |
| name_full | TEXT | 产品全名 | 埃塞俄比亚耶加雪菲柠檬花 |
| origin | TEXT | 产区 | 非洲/埃塞俄比亚 |
| region | TEXT | 产区细分 | 耶加雪菲 |
| variety | TEXT | 品种/豆种 | 原生种 |
| process | TEXT | 处理法 | 水洗/日晒/厌氧 |
| altitude | TEXT | 海拔 | 1800-1950m |
| grade | TEXT | 等级 | AA/G1/AA TOP |
| description | TEXT | 详细介绍 | 风味描述、庄园故事等 |
| tags | TEXT | 标签/推荐 | ★★★畅销、★★★★限量 |
| cupping_notes | TEXT | 杯测风味 | 柠檬花、蜂蜜红茶 |
| roast_level | TEXT | 烘焙度 | 中浅焙 |
| flavor_type | TEXT | 香型 | 清新果香 |
| acidity | TEXT | 果酸感 | ♤♤♤♤ |
| is_active | INTEGER | 是否启用 | 1 |
| created_at | DATETIME | 创建时间 | |

### 2. product_specs 表（产品规格）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| product_id | INTEGER | 关联产品 |
| spec_name | TEXT | 规格名称 |
| spec_code | TEXT | 规格代码 |
| weight_grams | INTEGER | 重量(克) |

### 3. product_prices 表（价格档次）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| spec_id | INTEGER | 关联规格 |
| price_type | TEXT | 价格类型 |
| price | REAL | 价格 |
| min_quantity | INTEGER | 最低数量 |

### 4. product_categories 表（产品分类）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| product_id | INTEGER | 关联产品 |
| category_type | TEXT | 分类类型 |
| category_name | TEXT | 分类名称 |

## SKU编码规则

格式：`{产区代码}-{规格}-{简称拼音首字母}`

示例：
- 埃塞俄比亚耶加雪菲柠檬花 200g → ETJ-200-LMH
- 肯尼亚乌克栗栗 200g → KEN-200-WKLL

## 字段来源说明

来源于Excel表格"豆单_批发（2602）"：
- 产区 → origin
- 简称 → name_short
- 咖啡/商品名称 → name_full + description
- 规格 → product_specs
- 享味价/商户优惠/大量优惠/超大量 → product_prices
- 烘焙度 → roast_level
- 香型 → flavor_type
- 果酸感 → acidity

## 实施计划

1. 创建新的数据表
2. 从Excel导入现有产品数据
3. 更新前端页面支持新产品结构
4. 添加SKU自动生成功能

## 状态

- [x] 需求分析
- [x] 设计方案确认
- [ ] 实施中
