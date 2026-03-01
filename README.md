# 折石ERP (Zhe Coffee ERP)

咖啡店管理系统 - 基于 Express + SQLite 的 ERP 系统。

## 功能特性

### 核心功能
- **订单管理** - 创建、查询、筛选订单，支持日期/客户/商品筛选
- **客户管理** - 客户信息维护（姓名、电话、地址）
- **商品管理** - 产品目录管理，支持别名匹配
- **库存管理** - 库存追踪与预警
- **销售统计** - 销售数据统计与报表

### 特色功能
- **PDF 导出** - 订单 PDF 生成，支持中文显示和浮水印
- **暗色模式** - 紫岩霞光品牌配色系统
- **响应式设计** - 支持移动端访问

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式
node temp.js

# 或使用服务脚本（后台运行）
./server.sh start
```

服务启动后访问 http://localhost:5271

### 服务管理命令

```bash
./server.sh start    # 启动服务
./server.sh stop     # 停止服务
./server.sh restart # 重启服务
./server.sh status   # 查看状态
```

### macOS 开机自启动（可选）

```bash
sudo cp com.coffee.erp.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.coffee.erp.plist
```

## 技术栈

- **后端**: Express.js + better-sqlite3
- **前端**: 原生 HTML/CSS/JS
- **PDF**: pdfkit + html-pdf
- **字体**: 思源黑体 + 阿里普惠体

## 项目结构

```
.
├── temp.js              # 主服务器入口
├── server.sh            # 服务管理脚本
├── com.coffee.erp.plist # macOS LaunchDaemon 配置
├── public/
│   ├── index.html       # 前端页面
│   ├── fonts/           # 中文字体
│   └── stamp.png        # PDF 浮水印图片
├── data/
│   ├── erp.db           # SQLite 数据库
│   └── *.pdf            # 导出的订单 PDF
└── package.json
```

## 数据库表

| 表名 | 说明 |
|------|------|
| orders | 订单记录 |
| order_items | 订单明细 |
| products | 产品目录 |
| product_aliases | 产品别名 |
| customers | 客户信息 |
| inventory | 库存 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/orders | 获取订单列表 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders/:id/pdf | 导出订单 PDF |
| GET | /api/products | 获取产品列表 |
| POST | /api/products | 创建产品 |
| GET | /api/customers | 获取客户列表 |
| POST | /api/customers | 创建客户 |
| GET | /api/inventory | 获取库存 |
| POST | /api/inventory | 更新库存 |
| GET | /api/stats | 销售统计 |

## 许可证

ISC
