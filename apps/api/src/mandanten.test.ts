/**
 * Mandantenbetrieb: Betreiber-Konsole, Vereinsanlage per Einrichtungscode, getrennte Vereine,
 * Konten in zwei Vereinen. Läuft gegen eine eigene Datenbank mit Demoverein als „fremdem“ Verein.
 */
import type {
  LoginResponse,
  MeResponse,
  OperatorInviteResult,
  OperatorOverview,
} from '@clubroof/core';
import { createDb, schema as s } from '@clubroof/db';
import { runMigrations } from '@clubroof/db/migrate';
import { seed } from '@clubroof/db/seed';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { createSession } from './auth/session';
import { loadConfig } from './config';
import { memoryMailer } from './security/mailer';
import { hashPassword } from './services/account';

const url = process.env.DATABASE_URL;
const NOW = new Date('2026-10-05T08:00:00Z');
const DB_NAME = 'clubroof_mandanten_test';
const PASSWORD = 'clubroof-demo';
const demo = (who: string) => `${who}@sv-gruen-weiss.example`;

describe.skipIf(!url)('Mandantenbetrieb', () => {
  const dbUrl = url ? url.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`) : '';
  let admin: ReturnType<typeof createDb>;
  let conn: ReturnType<typeof createDb>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  const mailer = memoryMailer();
  let operatorToken = '';

  beforeAll(async () => {
    admin = createDb(url);
    await admin.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.sql.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await runMigrations(dbUrl);
    conn = createDb(dbUrl);
    await seed(conn.db, { now: NOW, extended: false });
    app = await buildApp({
      db: conn.db,
      config: loadConfig({ LOGIN_RATE_LIMIT: '1000' }),
      now: () => NOW,
      mailer,
    });
    // Betreiber: eigenes Konto ohne Verein, mit E-Mail-Zwei-Faktor
    const [op] = await conn.db
      .insert(s.users)
      .values({
        email: 'betreiber@clubroof.example',
        displayName: 'Betreiber',
        passwordHash: await hashPassword(PASSWORD),
        twoFactorEmail: true,
      })
      .returning({ id: s.users.id });
    await conn.db.insert(s.operators).values({ userId: op!.id });
    operatorToken = (await createSession(conn.db, op!.id, { now: NOW, ttlDays: 1 })).token;
  }, 90_000);

  afterAll(async () => {
    await app?.close();
    await conn?.sql.end();
    await admin?.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin?.sql.end();
  });

  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    token?: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: path,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload ? { payload } : {}),
    });
  const login = async (email: string, password = PASSWORD): Promise<LoginResponse> => {
    const res = await call('POST', '/auth/login', undefined, { email, password });
    expect(res.statusCode, res.body).toBe(200);
    return res.json();
  };

  let inviteCode = '';
  let inviteId = '';

  it('schützt die Betreiber-Konsole: nur Betreiber, nur mit 2-Faktor', async () => {
    expect((await call('GET', '/operator/overview')).statusCode).toBe(401);
    const member = await login(demo('admin'));
    // Vereinsadmin ist kein Betreiber – die Konsole „existiert“ für ihn nicht
    expect((await call('GET', '/operator/overview', member.token)).statusCode).toBe(404);
    // Betreiber ohne 2-Faktor
    const [plain] = await conn.db
      .insert(s.users)
      .values({ email: 'op2@clubroof.example', displayName: 'Op2', passwordHash: 'x' })
      .returning({ id: s.users.id });
    await conn.db.insert(s.operators).values({ userId: plain!.id });
    const t = (await createSession(conn.db, plain!.id, { now: NOW, ttlDays: 1 })).token;
    expect((await call('GET', '/operator/overview', t)).statusCode).toBe(403);
    await conn.db
      .update(s.operators)
      .set({ active: false })
      .where(eq(s.operators.userId, plain!.id));
    expect((await call('GET', '/operator/overview', t)).statusCode).toBe(404);
  });

  it('zeigt dem Betreiber nur Kennzahlen', async () => {
    const res = await call('GET', '/operator/overview', operatorToken);
    expect(res.statusCode).toBe(200);
    const overview = res.json<OperatorOverview>();
    expect(overview.clubs).toHaveLength(1);
    expect(overview.clubs[0]!.members).toBeGreaterThan(10);
    expect(Object.keys(overview.clubs[0]!).sort()).toEqual(
      ['createdAt', 'id', 'lastLoginAt', 'members', 'name', 'shortName', 'status', 'teams'].sort(),
    );
  });

  it('legt einen Einrichtungscode an und schickt ihn per E-Mail', async () => {
    const res = await call('POST', '/operator/setup-invites', operatorToken, {
      clubName: 'FC Neustadt 1920',
      adminEmail: 'Erika@FC-Neustadt.example',
    });
    expect(res.statusCode, res.body).toBe(201);
    const out = res.json<OperatorInviteResult>();
    inviteCode = out.code;
    inviteId = out.invite.id;
    expect(out.invite.status).toBe('open');
    expect(inviteCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const mail = mailer.outbox.at(-1)!;
    expect(mail.to).toBe('erika@fc-neustadt.example');
    expect(mail.text).toContain(inviteCode);
    // Der Code liegt nur als Hash in der Datenbank
    const [row] = await conn.db.select().from(s.clubSetupInvites);
    expect(JSON.stringify(row)).not.toContain(inviteCode);
    const audit = await conn.db.select().from(s.operatorAudit);
    expect(audit.map((a) => a.action)).toContain('setup_invite.created');
  });

  it('richtet den neuen Verein mit dem Code ein – einmalig und nur für die genannte E-Mail', async () => {
    const typed = inviteCode.toLowerCase().replace(/-/g, ' ');
    expect((await call('POST', '/setup/token', undefined, { setupToken: typed })).statusCode).toBe(
      204,
    );
    expect(
      (await call('POST', '/setup/token', undefined, { setupToken: 'FALSCH-FALSCH' })).statusCode,
    ).toBe(403);
    // andere E-Mail-Adresse: kein E-Mail-Code
    expect(
      (
        await call('POST', '/setup/email-code', undefined, {
          setupToken: typed,
          email: 'fremd@example.org',
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call('POST', '/setup/email-code', undefined, {
          setupToken: typed,
          email: 'erika@fc-neustadt.example',
        })
      ).statusCode,
    ).toBe(204);
    const mailCode = /\b(\d{6})\b/.exec(mailer.outbox.at(-1)!.text)![1]!;
    const ok = await call('POST', '/setup/email-code/verify', undefined, {
      email: 'erika@fc-neustadt.example',
      code: mailCode,
    });
    const proof = ok.json<{ proof: string }>().proof;
    const body = {
      setupToken: typed,
      emailProof: proof,
      club: { name: 'FC Neustadt 1920', shortName: 'FC Neustadt', colorTheme: 'red' },
      orgUnits: [{ name: 'Senioren', kind: 'seniors' }],
      admin: {
        firstName: 'Erika',
        lastName: 'Muster',
        email: 'erika@fc-neustadt.example',
        password: 'sicheres-passwort-1',
      },
    };
    const created = await call('POST', '/setup', undefined, body);
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json<LoginResponse>().me.club.name).toBe('FC Neustadt 1920');
    // Zweites Mal: Code verbraucht
    expect((await call('POST', '/setup', undefined, body)).statusCode).toBe(403);
    expect((await call('POST', '/setup/token', undefined, { setupToken: typed })).statusCode).toBe(
      403,
    );
    const overview = (
      await call('GET', '/operator/overview', operatorToken)
    ).json<OperatorOverview>();
    expect(overview.clubs.map((c) => c.name).sort()).toEqual(
      ['FC Neustadt 1920', 'SV Grün-Weiß Musterstadt 1920 e.V.'].sort(),
    );
    expect(overview.invites[0]!.status).toBe('used');
  });

  it('widerruft einen offenen Einrichtungscode', async () => {
    const res = await call('POST', '/operator/setup-invites', operatorToken, {
      clubName: 'TSV Beispiel',
      adminEmail: 'x@tsv.example',
    });
    const out = res.json<OperatorInviteResult>();
    expect(
      (await call('DELETE', `/operator/setup-invites/${out.invite.id}`, operatorToken)).statusCode,
    ).toBe(204);
    expect(
      (await call('POST', '/setup/token', undefined, { setupToken: out.code })).statusCode,
    ).toBe(403);
    expect(
      (await call('DELETE', `/operator/setup-invites/${out.invite.id}`, operatorToken)).statusCode,
    ).toBe(404);
    void inviteId;
  });

  it('trennt die Vereine: der neue Admin sieht nichts vom Demoverein', async () => {
    const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
    expect(erika.me.clubs).toEqual([]); // nur ein Verein: kein Wechsler
    const members = await call('GET', '/admin/members', erika.token);
    expect(members.statusCode, members.body).toBe(200);
    const text = members.body;
    expect(text).toContain('Muster');
    expect(text).not.toContain('Grün-Weiß');
    // IDs aus dem anderen Verein sind unsichtbar
    const [foreignEvent] = await conn.db.select({ id: s.events.id }).from(s.events).limit(1);
    expect((await call('GET', `/events/${foreignEvent!.id}`, erika.token)).statusCode).toBe(404);
    const [foreignPerson] = await conn.db.select({ id: s.persons.id }).from(s.persons).limit(1);
    expect((await call('GET', `/admin/members/${foreignPerson!.id}`, erika.token)).statusCode).toBe(
      404,
    );
  });

  it('ein Konto in zwei Vereinen wechselt den aktiven Verein', async () => {
    const [club2] = await conn.db
      .select()
      .from(s.clubs)
      .where(eq(s.clubs.shortName, 'FC Neustadt'));
    const [user] = await conn.db
      .select()
      .from(s.users)
      .where(eq(s.users.email, demo('spieler')));
    await conn.db.insert(s.persons).values({
      clubId: club2!.id,
      userId: user!.id,
      firstName: 'Zweit',
      lastName: 'Verein',
    });
    const first = await login(demo('spieler'));
    expect(first.me.clubs).toHaveLength(2);
    const startClub = first.me.club.id;
    expect(first.me.clubs.find((c) => c.active)!.id).toBe(startClub);
    const other = first.me.clubs.find((c) => !c.active)!;
    const switched = await call('POST', '/me/club', first.token, { clubId: other.id });
    expect(switched.statusCode, switched.body).toBe(200);
    expect(switched.json<MeResponse>().club.id).toBe(other.id);
    expect((await call('GET', '/me', first.token)).json<MeResponse>().person.firstName).toBe(
      other.id === club2!.id ? 'Zweit' : first.me.person.firstName,
    );
    // Nächste Anmeldung beginnt im zuletzt aktiven Verein
    expect((await login(demo('spieler'))).me.club.id).toBe(other.id);
    // Ein Verein ohne eigene Person ist verboten
    const trainerSession = await login(demo('trainer'));
    const denied = await call('POST', '/me/club', trainerSession.token, { clubId: club2!.id });
    expect(denied.statusCode).toBe(403);
  });

  it('sperrt und entsperrt einen Verein', async () => {
    const [club2] = await conn.db
      .select()
      .from(s.clubs)
      .where(eq(s.clubs.shortName, 'FC Neustadt'));
    const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
    expect(
      (
        await call('PUT', `/operator/clubs/${club2!.id}/status`, operatorToken, {
          status: 'suspended',
        })
      ).statusCode,
    ).toBe(204);
    // laufende Sitzung beendet, neue Anmeldung gesperrt
    expect((await call('GET', '/me', erika.token)).statusCode).toBe(401);
    const blocked = await call('POST', '/auth/login', undefined, {
      email: 'erika@fc-neustadt.example',
      password: 'sicheres-passwort-1',
    });
    expect(blocked.statusCode).toBe(403);
    // Der Mehr-Vereine-Spieler landet im anderen Verein
    const spieler = await login(demo('spieler'));
    expect(spieler.me.club.id).not.toBe(club2!.id);
    expect(spieler.me.clubs).toEqual([]);
    expect(
      (
        await call('PUT', `/operator/clubs/${club2!.id}/status`, operatorToken, {
          status: 'active',
        })
      ).statusCode,
    ).toBe(204);
    expect((await login('erika@fc-neustadt.example', 'sicheres-passwort-1')).me.club.id).toBe(
      club2!.id,
    );
  });
});
