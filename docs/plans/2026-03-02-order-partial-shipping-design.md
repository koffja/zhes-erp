# 订单分次发货与付款追踪功能设计

**日期**: 2026-03-02

## 需求背景

客户订单可能有下订付款但要求分次发货的场景，需要：
1. 在订单列表容易看出还有多少未发货、已发出多少
2. 记录应付、已付货款

## 设计方案

### 数据结构

**orders 表（新增字段）：**
- `shipping_status` - 整体发货状态：pending(未发货)/partial(部分发货)/shipped(已发货)

**order_items 表（新增字段）：**
- `shipped_quantity` - 已发数量，默认 0
- `shipping_status` - 项的发货状态：pending(未发货)/partial(部分发货)/shipped(已发货)

### 接口设计

**GET /api/orders/:id**
返回订单详情时，每项包含：
- `quantity` - 订购数量
- `shipped_quantity` - 已发数量
- `shipping_status` - 发货状态

**POST /api/orders/:id/ship**
创建发货记录，请求体：
```json
{
  "items": [
    { "item_id": 1, "ship_quantity": 5 }
  ]
}
```

### 界面展示

**订单列表：**
- 发货状态列：未发货/部分发货/已发货
- 已发/总数列：显示如 "3/10件"

**订单详情弹窗：**
- 每个产品项显示：
  - 状态标签（未发货/部分发货/已发货）+ 已发/总数
  - 例如："部分发货 3/10件"
- 付款状态：未付/部分付款/已付清

## 实现任务

1. 数据库迁移：orders 和 order_items 表新增字段
2. 后端 API：
   - 更新订单列表返回发货统计
   - 更新订单详情返回每项发货状态
   - 新增发货接口 POST /api/orders/:id/ship
3. 前端：
   - 订单列表增加发货状态列
   - 订单详情弹窗显示每项发货状态
