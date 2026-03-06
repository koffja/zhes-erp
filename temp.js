const express = require('express');
const path = require('path');

const app = express();
const PORT = 5126;

// 初始化数据库连接和迁移
require('./server/db');

// 导入PDF生成
const { generateOrderPDF } = require('./server/utils/pdf');

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 导入路由
const routes = require('./server/routes');

// API路由
app.use('/api', routes);

// PDF生成（特殊处理）
app.get('/api/order/:id/pdf', async (req, res) => {
    try {
        await generateOrderPDF(req.params.id, res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`折石ERP服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
