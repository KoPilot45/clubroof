/**
 * Ersteinrichtung auf einem leeren Server. Läuft gegen eine eigene, frisch angelegte Datenbank,
 * damit der Demoverein der übrigen Tests unberührt bleibt.
 */
import type { LoginResponse, ModuleOverview } from '@clubroof/core';
import { createDb } from '@clubroof/db';
import { runMigrations } from '@clubroof/db/migrate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { memoryMailer } from './security/mailer';

const url = process.env.DATABASE_URL;
const NOW = new Date('2026-10-05T08:00:00Z');
const DB_NAME = 'clubroof_setup_test';

describe.skipIf(!url)('Ersteinrichtung', () => {
  const setupUrl = url ? url.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`) : '';
  let admin: ReturnType<typeof createDb>;
  let conn: ReturnType<typeof createDb>;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    admin = createDb(url);
    await admin.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.sql.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await runMigrations(setupUrl);
    conn = createDb(setupUrl);
    app = await buildApp({
      db: conn.db,
      config: loadConfig({ LOGIN_RATE_LIMIT: '1000', SETUP_TOKEN: 'geheimer-code-123' }),
      now: () => NOW,
      mailer: memoryMailer(),
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await conn?.sql.end();
    await admin?.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin?.sql.end();
  });

  const input = (setupToken: string) => ({
    setupToken,
    club: { name: 'FC Neustadt 1920', shortName: 'FC Neustadt', colorTheme: 'red' },
    orgUnits: [
      { name: 'Senioren', kind: 'seniors' },
      { name: 'Jugend', kind: 'youth' },
    ],
    admin: {
      firstName: 'Erika',
      lastName: 'Muster',
      email: 'Erika@FC-Neustadt.example',
      password: 'sicheres-passwort-1',
    },
  });

  it('richtet den Verein mit Code einmalig ein', async () => {
    expect((await app.inject({ url: '/setup/status' })).json()).toEqual({ needsSetup: true });

    const wrong = await app.inject({ method: 'POST', url: '/setup', payload: input('falsch') });
    expect(wrong.statusCode).toBe(403);

    const weak = await app.inject({
      method: 'POST',
      url: '/setup',
      payload: { ...input('geheimer-code-123'), admin: { ...input('').admin, password: 'kurz' } },
    });
    expect(weak.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/setup',
      payload: input('geheimer-code-123'),
    });
    expect(ok.statusCode, ok.body).toBe(201);
    const login = ok.json<LoginResponse>();
    expect(login.me.club).toMatchObject({ name: 'FC Neustadt 1920', colorTheme: 'red' });
    expect(login.me.user.email).toBe('erika@fc-neustadt.example');

    // Fulladmin darf verwalten; optionale Module warten im Update-Center
    const modules = await app.inject({
      url: '/admin/modules',
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(modules.statusCode).toBe(200);
    const overview = modules.json<ModuleOverview>();
    expect(JSON.stringify(overview)).toContain('player_exchange');

    // Anmeldung mit dem neuen Konto
    const relogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'erika@fc-neustadt.example', password: 'sicheres-passwort-1' },
    });
    expect(relogin.statusCode).toBe(200);

    // Ein zweites Mal geht nicht
    expect((await app.inject({ url: '/setup/status' })).json()).toEqual({ needsSetup: false });
    const again = await app.inject({
      method: 'POST',
      url: '/setup',
      payload: input('geheimer-code-123'),
    });
    expect(again.statusCode).toBe(409);
  });
});
