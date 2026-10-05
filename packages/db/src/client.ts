import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseUrl } from './env';
import * as schema from './schema';

export function createDb(url: string = databaseUrl()) {
  const sql = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql };
}

export type Db = ReturnType<typeof createDb>['db'];
