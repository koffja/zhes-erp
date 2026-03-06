import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schemas/drizzle/schema.js',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/erp.db'
  }
});
