import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { createDb } from './client';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

export async function runMigrations(url?: string): Promise<void> {
  const { db, sql } = createDb(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  console.log('Migrationen ausgeführt.');
}
