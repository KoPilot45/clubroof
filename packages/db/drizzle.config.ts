import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './src/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl() },
  casing: 'snake_case',
  strict: true,
});
