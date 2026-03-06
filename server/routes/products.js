const express = require('express');
const router = express.Router();
const { db: drizzleDb, schema } = require('../db/drizzle');
const { db } = require('../db');
const { eq, like, desc, or, and, sql } = require('drizzle-orm');

// 获取所有产品（支持搜索、分类和标签筛选）
router.get('/', async (req, res) => {
    const { search, category, tag } = req.query;

    try {
        // 使用原生SQL查询，确保返回所有字段
        let sql = `
            SELECT p.id, p.name, p.category, p.specs, p.price, p.cost, p.stock, p.note,
                   p.created_at, p.sku_code, p.full_name, p.tags, p.roast, p.flavor,
                   p.region, p.tasting_notes
            FROM products p
            WHERE 1=1
        `;
        const params = [];

        // 搜索条件
        if (search) {
            sql += ` AND (p.name LIKE ? OR p.specs LIKE ? OR p.category LIKE ? OR p.full_name LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // 分类筛选
        if (category && category !== 'all') {
            sql += ` AND p.category = ?`;
            params.push(category);
        }

        // 标签筛选
        if (tag && tag !== 'all') {
            sql += ` AND p.tags LIKE ?`;
            params.push(`%${tag}%`);
        }

        // 排序：优先显示"当期"标签，再按产区，最后按名称
        sql += ` ORDER BY
            CASE WHEN p.tags LIKE '%当期%' THEN 0 ELSE 1 END,
            p.region, p.name`;

        const products = db.prepare(sql).all(...params);

        // 从product_prices表读取价格数据
        const prices = db.prepare(`
            SELECT ps.product_id, pp.price_type, pp.price
            FROM product_specs ps
            JOIN product_prices pp ON ps.id = pp.spec_id
            WHERE ps.is_active = 1
        `).all();

        // 按产品ID分组价格
        const priceMap = {};
        for (const p of prices) {
            if (!priceMap[p.product_id]) {
                priceMap[p.product_id] = {};
            }
            if (p.price_type === 'retail') {
                priceMap[p.product_id].price = p.price;
            } else if (p.price_type === 'wholesale') {
                priceMap[p.product_id].merchant_price = p.price;
            } else if (p.price_type === 'bulk') {
                priceMap[p.product_id].bulk_price = p.price;
            } else if (p.price_type === 'super_bulk') {
                priceMap[p.product_id].super_bulk_price = p.price;
            }
        }

        // 合并价格到产品数据
        const productsWithPrices = products.map(p => ({
            ...p,
            ...(priceMap[p.id] || {})
        }));

        res.json(productsWithPrices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取产品分类列表
router.get('/categories', async (req, res) => {
    try {
        const categories = await drizzleDb
            .selectDistinct({ category: schema.products.category })
            .from(schema.products)
            .where(sql`${schema.products.category} IS NOT NULL AND ${schema.products.category} != ''`)
            .orderBy(schema.products.category);

        res.json(categories.map(c => c.category));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取产品标签列表
router.get('/tags', async (req, res) => {
    try {
        const tags = await drizzleDb
            .selectDistinct({ tags: schema.products.tags })
            .from(schema.products)
            .where(sql`${schema.products.tags} IS NOT NULL AND ${schema.products.tags} != ''`)
            .orderBy(schema.products.tags);

        // 合并所有标签（因为可能用逗号分隔）
        const allTags = new Set();
        for (const t of tags) {
            if (t.tags) {
                t.tags.split(',').forEach(tag => {
                    allTags.add(tag.trim());
                });
            }
        }

        res.json(Array.from(allTags).sort());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 搜索产品
router.get('/search', async (req, res) => {
    const { q } = req.query;

    if (!q) {
        return res.json([]);
    }

    try {
        // 精确匹配
        let products = await db
            .select()
            .from(schema.products)
            .where(eq(schema.products.name, q));

        if (products.length === 0) {
            // 模糊匹配
            products = await db
                .select()
                .from(schema.products)
                .where(
                    or(
                        like(schema.products.name, `%${q}%`),
                        like(schema.products.specs, `%${q}%`)
                    )
                );
        }

        if (products.length === 0) {
            // 别名匹配
            const aliases = await db
                .select()
                .from(schema.productAliases)
                .where(like(schema.productAliases.alias, `%${q}%`));

            if (aliases.length > 0) {
                const productIds = [...new Set(aliases.map(a => a.productId))];
                products = await db
                    .select()
                    .from(schema.products)
                    .where(sql`${schema.products.id} IN (${productIds.join(',')})`);
            }
        }

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取产品详情
router.get('/:id', async (req, res) => {
    try {
        const [product] = await db
            .select()
            .from(schema.products)
            .where(eq(schema.products.id, parseInt(req.params.id)));

        if (!product) {
            return res.status(404).json({ error: '产品不存在' });
        }

        // 获取别名
        const aliases = await db
            .select()
            .from(schema.productAliases)
            .where(eq(schema.productAliases.productId, product.id));

        product.aliases = aliases.map(a => a.alias);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取包含某产品的订单
router.get('/:id/orders', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);

        // 直接通过product_id查找订单
        const orders = await drizzleDb
            .select({
                id: schema.orders.id,
                orderNo: schema.orders.orderNo,
                orderDate: schema.orders.orderDate,
                customerId: schema.orders.customerId,
                totalAmount: schema.orders.totalAmount,
                paidAmount: schema.orders.paidAmount,
                status: schema.orders.status,
                shippingName: schema.orders.shippingName,
                shippingPhone: schema.orders.shippingPhone,
                shippingAddress: schema.orders.shippingAddress,
                note: schema.orders.note,
                paymentStatus: schema.orders.paymentStatus,
                shippingStatus: schema.orders.shippingStatus
            })
            .from(schema.orders)
            .innerJoin(schema.orderItems, eq(schema.orders.id, schema.orderItems.orderId))
            .where(eq(schema.orderItems.productId, productId))
            .orderBy(desc(schema.orders.orderDate));

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建产品（带自动SKU生成）
router.post('/', async (req, res) => {
    const { name, category, specs, price, cost, stock, note } = req.body;

    try {
        // 分类代码映射
        const categoryCodes = {
            '单品熟豆': 'DS',
            '意式豆': 'ES',
            '生豆': 'GB',
            '挂耳': 'DP',
            '周边': 'AC',
            '材料': 'MT',
            '熟豆': 'DS',
            '粉': 'PW',
            '周边上集': 'AC'
        };

        // 解析规格
        let specCode = '';
        if (specs) {
            const match = specs.match(/(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num >= 1000) specCode = '1K';
                else specCode = String(num);
            }
        }

        // 获取该分类的最大序号
        const categoryCode = categoryCodes[category] || 'XX';
        const maxResult = db.prepare(`
            SELECT MAX(CAST(SUBSTR(sku_code, 4, 3) AS INTEGER)) as maxNum
            FROM products
            WHERE sku_code LIKE ?
        `).get(`${categoryCode}%`);

        const nextNum = (maxResult?.maxNum || 0) + 1;
        const skuCode = `${categoryCode}${String(nextNum).padStart(4, '0')}${specCode ? '-' + specCode : ''}`;

        const result = await drizzleDb
            .insert(schema.products)
            .values({
                name,
                category,
                specs,
                price,
                cost,
                stock: stock || 0,
                note,
                skuCode: skuCode
            })
            .run();

        res.json({ success: true, id: result.lastInsertRowid, sku_code: skuCode });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新产品
router.put('/:id', async (req, res) => {
    const {
        name, category, specs, price, cost, stock, note,
        sku_code, full_name, tags, roast, flavor, region, tasting_notes,
        merchant_price, bulk_price, super_bulk_price
    } = req.body;
    const id = parseInt(req.params.id);

    try {
        // 构建动态更新语句，只更新传入的字段
        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (category !== undefined) { updates.push('category = ?'); params.push(category); }
        if (specs !== undefined) { updates.push('specs = ?'); params.push(specs); }
        if (price !== undefined) { updates.push('price = ?'); params.push(price); }
        if (cost !== undefined) { updates.push('cost = ?'); params.push(cost); }
        if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
        if (note !== undefined) { updates.push('note = ?'); params.push(note); }
        if (sku_code !== undefined) { updates.push('sku_code = ?'); params.push(sku_code); }
        if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags); }
        if (roast !== undefined) { updates.push('roast = ?'); params.push(roast); }
        if (flavor !== undefined) { updates.push('flavor = ?'); params.push(flavor); }
        if (region !== undefined) { updates.push('region = ?'); params.push(region); }
        if (tasting_notes !== undefined) { updates.push('tasting_notes = ?'); params.push(tasting_notes); }
        if (merchant_price !== undefined) { updates.push('merchant_price = ?'); params.push(merchant_price); }
        if (bulk_price !== undefined) { updates.push('bulk_price = ?'); params.push(bulk_price); }
        if (super_bulk_price !== undefined) { updates.push('super_bulk_price = ?'); params.push(super_bulk_price); }

        if (updates.length === 0) {
            return res.json({ success: true, changes: 0 });
        }

        params.push(id);
        const result = db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        console.error('更新产品失败:', error);
        // 处理唯一性约束错误
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '产品名称已存在，请使用其他名称' });
        }
        res.status(500).json({ error: error.message });
    }
});

// 删除产品
router.delete('/:id', async (req, res) => {
    try {
        const result = await db
            .delete(schema.products)
            .where(eq(schema.products.id, parseInt(req.params.id)))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 添加产品别名
router.post('/:id/aliases', async (req, res) => {
    const { alias } = req.body;
    const productId = parseInt(req.params.id);

    try {
        const result = await db
            .insert(schema.productAliases)
            .values({
                productId,
                alias
            })
            .run();

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 产品新品API - 新产品数据表
router.get('/new/list', async (req, res) => {
    const { page = 1, pageSize = 50, category, search } = req.query;

    try {
        let conditions = [eq(schema.productsNew.isActive, 1)];

        const offset = (parseInt(page) - 1) * parseInt(pageSize);

        // 获取总数
        const countResult = await db
            .select({ count: sql`count(*)`.mapWith(Number) })
            .from(schema.productsNew)
            .where(and(...conditions));

        const total = countResult[0]?.count || 0;

        const products = await db
            .select()
            .from(schema.productsNew)
            .where(and(...conditions))
            .orderBy(desc(schema.productsNew.createdAt))
            .limit(parseInt(pageSize))
            .offset(offset);

        res.json({
            data: products,
            total,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            totalPages: Math.ceil(total / parseInt(pageSize))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取新产品详情
router.get('/new/:id', async (req, res) => {
    try {
        const [product] = await db
            .select()
            .from(schema.productsNew)
            .where(eq(schema.productsNew.id, parseInt(req.params.id)));

        if (!product) {
            return res.status(404).json({ error: '产品不存在' });
        }

        // 获取规格
        const specs = await db
            .select()
            .from(schema.productSpecs)
            .where(and(
                eq(schema.productSpecs.productId, product.id),
                eq(schema.productSpecs.isActive, 1)
            ));

        // 获取价格
        const prices = await db
            .select({
                id: schema.productPrices.id,
                specId: schema.productPrices.specId,
                priceType: schema.productPrices.priceType,
                price: schema.productPrices.price,
                minQuantity: schema.productPrices.minQuantity,
                validFrom: schema.productPrices.validFrom,
                specName: schema.productSpecs.specName,
                weightGrams: schema.productSpecs.weightGrams
            })
            .from(schema.productPrices)
            .innerJoin(schema.productSpecs, eq(schema.productPrices.specId, schema.productSpecs.id))
            .where(eq(schema.productSpecs.productId, product.id));

        // 获取分类
        const categories = await db
            .select()
            .from(schema.productCategories)
            .where(eq(schema.productCategories.productId, product.id));

        res.json({ ...product, specs, prices, categories });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
