const Database = require('better-sqlite3');
const path = require('path');

// 数据库连接
const db = new Database(path.join(__dirname, '../../data/erp.db'));

// 数据库迁移 - 添加发货字段
function runMigrations() {
    try {
        db.exec(`
            ALTER TABLE order_items ADD COLUMN shipped_quantity INTEGER DEFAULT 0;
            ALTER TABLE order_items ADD COLUMN shipping_status TEXT DEFAULT 'pending';
            ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'pending';
        `);
        console.log('Database migration: shipping fields added');
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            console.log('Database migration note:', e.message);
        }
    }

    // 数据库迁移 - 添加订单日期字段
    try {
        db.exec(`ALTER TABLE orders ADD COLUMN order_date DATE;`);
    } catch (e) {
        // 字段可能已存在
    }

    // 修复订单日期（从订单号正确提取）
    db.exec(`
        UPDATE orders SET order_date =
            '20' || substr(order_no, 6, 2) || '-' ||
            substr(order_no, 8, 2) || '-' ||
            substr(order_no, 10, 2)
        WHERE order_no LIKE 'XSD%' AND LENGTH(order_no) >= 12 AND order_date IS NULL
    `);
    db.exec(`
        UPDATE orders SET order_date = date(created_at)
        WHERE order_no LIKE 'ORD%' AND order_date IS NULL
    `);
    console.log('Database migration: order_date field updated');

    // 数据库迁移 - 产品新数据表
    try {
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
        `);

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
        `);

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
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS product_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                category_type TEXT NOT NULL,
                category_name TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products_new(id)
            )
        `);

        console.log('Database migration: product tables created');
    } catch (e) {
        if (!e.message.includes('already exists')) {
            console.log('Database migration note:', e.message);
        }
    }
}

// 运行迁移
runMigrations();

module.exports = { db };
