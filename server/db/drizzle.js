const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const schema = require('../../schemas/drizzle/schema');

const sqlite = new Database('./data/erp.db');
const db = drizzle(sqlite, { schema });

module.exports = { db, schema };
