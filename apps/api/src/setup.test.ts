/**
 * Ersteinrichtung auf einem leeren Server. Läuft gegen eine eigene, frisch angelegte Datenbank,
 * damit der Demoverein der übrigen Tests unberührt bleibt.
 */
import type { LoginResponse, ModuleOverview, RoleCatalog } from '@clubroof/core';
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
  const mailer = memoryMailer();

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
      mailer,
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await conn?.sql.end();
    await admin?.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin?.sql.end();
  });

  /** E-Mail bestätigen: Code anfordern (aus der Mail lesen), bestätigen, Nachweis zurückgeben */
  async function verifiedProof(email: string) {
    const sent = await app.inject({
      method: 'POST',
      url: '/setup/email-code',
      payload: { setupToken: 'geheimer-code-123', email },
    });
    expect(sent.statusCode).toBe(204);
    const mail = mailer.outbox.at(-1)!;
    const code = /\b(\d{6})\b/.exec(mail.text)![1]!;
    const ok = await app.inject({
      method: 'POST',
      url: '/setup/email-code/verify',
      payload: { email, code },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    return ok.json<{ proof: string }>().proof;
  }

  let proof = '';
  const input = (setupToken: string) => ({
    setupToken,
    emailProof: proof || 'ungueltig',
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

    // Falscher Einrichtungscode beim Anfordern des E-Mail-Codes
    const badToken = await app.inject({
      method: 'POST',
      url: '/setup/email-code',
      payload: { setupToken: 'falsch', email: 'erika@fc-neustadt.example' },
    });
    expect(badToken.statusCode).toBe(403);

    // Ohne bestätigte E-Mail geht es nicht
    const noProof = await app.inject({
      method: 'POST',
      url: '/setup',
      payload: input('geheimer-code-123'),
    });
    expect(noProof.statusCode).toBe(400);
    expect(noProof.json().error).toBe('email_not_verified');

    // Falscher Code wird abgelehnt, richtiger Code ergibt den Nachweis
    await app.inject({
      method: 'POST',
      url: '/setup/email-code',
      payload: { setupToken: 'geheimer-code-123', email: 'Erika@FC-Neustadt.example' },
    });
    const wrongCode = await app.inject({
      method: 'POST',
      url: '/setup/email-code/verify',
      payload: { email: 'erika@fc-neustadt.example', code: '000000' },
    });
    expect(wrongCode.statusCode).toBe(400);
    proof = await verifiedProof('Erika@FC-Neustadt.example');

    const weak = await app.inject({
      method: 'POST',
      url: '/setup',
      payload: { ...input('geheimer-code-123'), admin: { ...input('').admin, password: 'kurz' } },
    });
    expect(weak.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/setup',
      payload: {
        ...input('geheimer-code-123'),
        venues: [
          {
            name: 'Sportplatz am Wald',
            address: 'Waldweg 1, 12345 Neustadt',
            pitches: [
              { name: 'Platz 1', surface: 'grass' },
              { name: 'Platz 2', surface: 'artificial' },
              { name: 'Platz 3', surface: 'hard' },
            ],
            changingRooms: ['Kabine 1', 'Kabine 2'],
          },
        ],
        modules: ['polls', 'forum'],
      },
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

    // Spielstätte mit Plätzen (Untergrund) und Kabinen, gewählte Module aktiv, übrige verfügbar
    const venues =
      await conn.sql`select v.name, count(f.id)::int as n from venues v left join facilities f on f.venue_id = v.id group by v.name`;
    expect(venues).toEqual([{ name: 'Sportplatz am Wald', n: 5 }]);
    const kinds = await conn.sql`select kind from facilities order by sort_order`;
    expect(kinds.map((k) => k.kind)).toEqual([
      'grass_pitch',
      'artificial_pitch',
      'hard_pitch',
      'changing_room',
      'changing_room',
    ]);
    const states =
      await conn.sql`select module_key, state from module_settings where scope_type = 'club'`;
    const state = (k: string) => states.find((r) => r.module_key === k)?.state;
    expect(state('polls')).toBe('enabled');
    expect(state('forum')).toBe('enabled');
    expect(state('wiki')).toBe('available');
    expect(state('events')).toBe('enabled'); // Kernmodul
    expect(state('club_cash')).toBe('available'); // nicht gewählt
    const cats = await conn.sql`select count(*)::int as n from club_cash_categories`;
    expect(cats[0]!.n).toBeGreaterThan(10); // Kategorien-Vorlage der Vereinskasse

    // Treffpunkt-Vorschläge: Spielstätte und Kabinen (mit Anlage), keine Plätze
    const places = await app.inject({
      url: '/meeting-places',
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(places.json()).toEqual([
      { label: 'Sportplatz am Wald' },
      { label: 'Kabine 1 · Sportplatz am Wald' },
      { label: 'Kabine 2 · Sportplatz am Wald' },
    ]);

    // „Jugend und Senioren getrennt“: zwei Bereiche, Leitungsrollen lassen sich je Bereich vergeben
    const catalog = (
      await app.inject({ url: '/admin/roles', headers: { authorization: `Bearer ${login.token}` } })
    ).json<RoleCatalog>();
    const units = catalog.scopes.filter((sc) => sc.type === 'org_unit').map((sc) => sc.label);
    expect(units.sort()).toEqual(['Jugend', 'Senioren']);

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
