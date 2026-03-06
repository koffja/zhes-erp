const express = require('express');
const router = express.Router();
const { db, schema } = require('../db/drizzle');
const { eq, desc } = require('drizzle-orm');

// 获取所有供应商
router.get('/', async (req, res) => {
    try {
        const suppliers = await db
            .select()
            .from(schema.suppliers)
            .orderBy(schema.suppliers.name);
        res.json(suppliers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取供应商详情
router.get('/:id', async (req, res) => {
    try {
        const [supplier] = await db
            .select()
            .from(schema.suppliers)
            .where(eq(schema.suppliers.id, parseInt(req.params.id)));

        if (!supplier) {
            return res.status(404).json({ error: '供应商不存在' });
        }
        res.json(supplier);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建供应商
router.post('/', async (req, res) => {
    const { name, category, contactPerson, phone, address, bank, account, note } = req.body;

    try {
        const result = await db
            .insert(schema.suppliers)
            .values({
                name,
                category,
                contactPerson,
                phone,
                address,
                bank,
                account,
                note
            })
            .run();

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新供应商
router.put('/:id', async (req, res) => {
    const { name, category, contactPerson, phone, address, bank, account, note } = req.body;
    const id = parseInt(req.params.id);

    try {
        const result = await db
            .update(schema.suppliers)
            .set({
                name,
                category,
                contactPerson,
                phone,
                address,
                bank,
                account,
                note
            })
            .where(eq(schema.suppliers.id, id))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除供应商
router.delete('/:id', async (req, res) => {
    try {
        const result = await db
            .delete(schema.suppliers)
            .where(eq(schema.suppliers.id, parseInt(req.params.id)))
            .run();

        res.json({ success: true, changes: result.changes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
