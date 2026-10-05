/**
 * Setzt die lokale Entwicklungsdatenbank komplett zurück: Schema löschen, Migrationen
 * ausführen, Demodaten einspielen. Nur für Entwicklung und Tests gedacht.
 */
import { databaseUrl } from './env';
import { createDb } from './client';
import { runMigrations } from './migrate';
import { seed } from './seed';

function assertSafeTarget(url: string): void {
  const host = new URL(url).hostname;
  const isLocal = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host);
  if (process.env.NODE_ENV === 'production' || (!isLocal && process.env.ALLOW_DB_RESET !== '1')) {
    throw new Error(
      `Abbruch: Reset nur für lokale Datenbanken erlaubt (Host „${host}“). ` +
        'Für andere Ziele ALLOW_DB_RESET=1 setzen.',
    );
  }
}

const url = databaseUrl();
assertSafeTarget(url);

const { sql } = createDb(url);
await sql.unsafe(
  'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
);
await sql.end();

await runMigrations(url);

const { db, sql: seedSql } = createDb(url);
try {
  const summary = await seed(db);
  console.log('Datenbank zurückgesetzt und Demoverein angelegt:');
  console.table(summary);
} finally {
  await seedSql.end();
}
