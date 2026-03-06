const express = require('express');
const router = express.Router();

const ordersRouter = require('./orders');
const customersRouter = require('./customers');
const productsRouter = require('./products');
const statsRouter = require('./stats');
const stockRouter = require('./stock');
const suppliersRouter = require('./suppliers');
const purchasesRouter = require('./purchases');
const orderItemsRouter = require('./orderItems');

// 路由汇总
router.use('/orders', ordersRouter);
router.use('/customers', customersRouter);
router.use('/products', productsRouter);
router.use('/stats', statsRouter);
router.use('/stock', stockRouter);
router.use('/suppliers', suppliersRouter);
router.use('/purchases', purchasesRouter);
router.use('/order-items', orderItemsRouter);

module.exports = router;
