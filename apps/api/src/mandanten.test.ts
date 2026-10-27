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
    expect(inviteCode).toMatch(/^CR-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
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

  it('Kurzcode der Mannschaft und Beitritt mit bestehendem Konto in einen zweiten Verein', async () => {
    const [club2] = await conn.db
      .select()
      .from(s.clubs)
      .where(eq(s.clubs.shortName, 'FC Neustadt'));
    const [unit] = await conn.db.select().from(s.orgUnits).where(eq(s.orgUnits.clubId, club2!.id));
    const [season] = await conn.db.select().from(s.seasons).where(eq(s.seasons.clubId, club2!.id));
    const [team] = await conn.db
      .insert(s.teams)
      .values({
        clubId: club2!.id,
        orgUnitId: unit!.id,
        seasonId: season!.id,
        name: 'Erste Mannschaft',
        badge: '1.',
        template: 'classic',
        participationMode: 'auto_accept',
      })
      .returning({ id: s.teams.id });
    const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
    const created = await call('POST', `/teams/${team!.id}/invite-link`, erika.token);
    expect(created.statusCode, created.body).toBeLessThan(300);
    const code = created.json<{ code: string }>().code;
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    // Der Code führt zur selben Einladung wie der Link (Schreibweise egal)
    const info = await call('GET', `/join/${code.toLowerCase()}`);
    expect(info.statusCode, info.body).toBe(200);
    expect(info.json<{ club: { name: string } }>().club.name).toBe('FC Neustadt 1920');
    expect((await call('GET', '/join/ABCD-EFGH')).statusCode).toBe(410);

    const eltern = await login(demo('eltern'));
    const body = {
      relation: 'parent',
      firstName: 'Eva',
      lastName: 'Eltern',
      childFirstName: 'Kai',
      childLastName: 'Eltern',
    };
    expect(
      (await call('POST', `/join/${code}/request-signed-in`, undefined, body)).statusCode,
    ).toBe(401);
    expect(
      (await call('POST', `/join/${code}/request-signed-in`, eltern.token, body)).statusCode,
    ).toBe(202);
    expect(
      (await call('POST', `/join/${code}/request-signed-in`, eltern.token, body)).statusCode,
    ).toBe(409);
    // Wer schon Mitglied ist, kann nicht erneut anfragen
    const spieler = await login(demo('spieler'));
    expect(
      (
        await call('POST', `/join/${code}/request-signed-in`, spieler.token, {
          ...body,
          relation: 'player',
        })
      ).statusCode,
    ).toBe(409);

    const overview = await call('GET', '/invitations', erika.token);
    const request = overview.json<{ requests: { id: string }[] }>().requests[0]!;
    const ok = await call('POST', `/join-requests/${request.id}/approve`, erika.token, {});
    expect(ok.statusCode, ok.body).toBe(200);
    // Nach der Freigabe hat das Konto zwei Vereine
    const again = await login(demo('eltern'));
    expect(again.me.clubs).toHaveLength(2);
    // Die Vereinsdaten bleiben getrennt: Eltern sehen im zweiten Verein nur dessen Kinder
    const switched = await call('POST', '/me/club', again.token, { clubId: club2!.id });
    expect(switched.json<MeResponse>().managedPersons.map((m) => m.firstName)).toEqual([
      'Eva',
      'Kai',
    ]);
  });

  it('Konto ohne Verein: Anmeldung gelingt, Aufnahme per Code durch den Verein', async () => {
    const [user] = await conn.db
      .insert(s.users)
      .values({
        email: 'lena@example.org',
        displayName: 'Lena Lose',
        passwordHash: await hashPassword('sicheres-passwort-1'),
      })
      .returning({ id: s.users.id });
    void user;
    const res = await call('POST', '/auth/login', undefined, {
      email: 'lena@example.org',
      password: 'sicheres-passwort-1',
    });
    expect(res.statusCode, res.body).toBe(200);
    const session = res.json<{ token: string; me: null; account: { requests: unknown[] } }>();
    expect(session.me).toBeNull();
    expect((await call('GET', '/me', session.token)).json().error).toBe('no_club');
    expect((await call('GET', '/account', session.token)).statusCode).toBe(200);
    // Vereinsdaten bleiben ohne Verein unerreichbar
    expect((await call('GET', '/events', session.token)).statusCode).toBe(403);

    const link = await call('POST', '/account/link-code', session.token);
    expect(link.statusCode, link.body).toBe(201);
    const { code } = link.json<{ code: string; qrSvg: string }>();
    expect(link.json().qrSvg).toContain('<svg');

    const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
    const preview = await call('GET', `/account-links/${code}`, erika.token);
    expect(preview.json()).toEqual({ displayName: 'Lena Lose', email: 'lena@example.org' });
    // Trainer des Demovereins kann das Konto nicht in einen fremden Verein aufnehmen – und umgekehrt sieht er den Code nicht als gültig an
    const body = { code, firstName: 'Lena', lastName: 'Lose' };
    const attached = await call('POST', '/members/attach-account', erika.token, body);
    expect(attached.statusCode, attached.body).toBe(201);
    // Code ist einmalig
    expect((await call('POST', '/members/attach-account', erika.token, body)).statusCode).toBe(410);
    // Neu anmelden: jetzt Mitglied im Verein
    const again = await call('POST', '/auth/login', undefined, {
      email: 'lena@example.org',
      password: 'sicheres-passwort-1',
    });
    expect(again.json<LoginResponse>().me.club.name).toBe('FC Neustadt 1920');
    // Ein Mitglied ohne Einladungsrecht darf nicht aufnehmen
    const spieler = await login(demo('spieler'));
    expect((await call('POST', '/members/attach-account', spieler.token, body)).statusCode).toBe(
      403,
    );
  });

  it('Support-Zugriff nur mit Freigabe des Vereins, schreibgeschützt und protokolliert', async () => {
    const [club2] = await conn.db
      .select()
      .from(s.clubs)
      .where(eq(s.clubs.shortName, 'FC Neustadt'));
    const view = `/operator/clubs/${club2!.id}/support`;
    // ohne Freigabe: kein Zugriff, auch nicht für Betreiber
    const denied = await call('GET', view, operatorToken);
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error).toBe('support_not_granted');

    const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
    // Nur Administration/Vorstand darf freigeben
    const spieler = await login(demo('spieler'));
    expect((await call('PUT', '/admin/support', spieler.token, { hours: 1 })).statusCode).toBe(403);
    expect((await call('PUT', '/admin/support', erika.token, { hours: 5 })).statusCode).toBe(400);
    const granted = await call('PUT', '/admin/support', erika.token, { hours: 1 });
    expect(granted.statusCode, granted.body).toBe(200);
    expect(granted.json<{ active: boolean }>().active).toBe(true);

    const ok = await call('GET', view, operatorToken);
    expect(ok.statusCode, ok.body).toBe(200);
    const body = ok.json<{
      club: { name: string };
      counts: { members: number };
      admins: { name: string }[];
    }>();
    expect(body.club.name).toBe('FC Neustadt 1920');
    expect(body.admins.map((a) => a.name)).toContain('Erika Muster');
    // keine Personen-, Kassen- oder Termindaten
    expect(Object.keys(ok.json()).sort()).toEqual(
      ['admins', 'audit', 'club', 'counts', 'modules', 'recoveries'].sort(),
    );
    // der Abruf steht in beiden Protokollen
    const mine = await conn.db
      .select()
      .from(s.operatorAudit)
      .where(eq(s.operatorAudit.action, 'support.viewed'));
    expect(mine.length).toBeGreaterThan(0);
    const audit = await call('GET', '/admin/audit', erika.token);
    expect(audit.body).toContain('Support-Ansicht');
    // Der Demoverein ist nicht freigegeben
    const [club1] = await conn.db
      .select()
      .from(s.clubs)
      .where(eq(s.clubs.shortName, 'SV Grün-Weiß'));
    expect(
      (await call('GET', `/operator/clubs/${club1!.id}/support`, operatorToken)).statusCode,
    ).toBe(403);

    expect((await call('DELETE', '/admin/support', erika.token)).statusCode).toBe(200);
    expect((await call('GET', view, operatorToken)).statusCode).toBe(403);
  });

  it('Admin-Wiederherstellung: Wartefrist, Widerspruch und Einladung des neuen Admins', async () => {
    const [club2] = await conn.db
      .select()
      .from(s.clubs)
      .where(eq(s.clubs.shortName, 'FC Neustadt'));
    const start = () =>
      call('POST', `/operator/clubs/${club2!.id}/admin-recovery`, operatorToken, {
        firstName: 'Ralf',
        lastName: 'Retter',
        email: 'Ralf@FC-Neustadt.example',
        note: 'Rückruf unter der Nummer im Vereinsregister',
      });
    const first = await start();
    expect(first.statusCode, first.body).toBe(201);
    const id = first.json<{ id: string; status: string }>().id;
    expect(first.json().status).toBe('waiting');
    // Hinweis an alle Admins
    expect(
      mailer.outbox.some(
        (m) =>
          m.to === 'erika@fc-neustadt.example' && m.subject.includes('Admin-Wiederherstellung'),
      ),
    ).toBe(true);
    expect((await start()).statusCode).toBe(409);
    const early = await call('POST', `/operator/admin-recoveries/${id}/complete`, operatorToken);
    expect(early.json().error).toBe('recovery_waiting');

    // Widerspruch stoppt den Vorgang
    const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
    const objected = await call('POST', `/admin/support/recoveries/${id}/object`, erika.token);
    expect(objected.statusCode, objected.body).toBe(200);
    await conn.db.update(s.adminRecoveries).set({ notBefore: new Date(NOW.getTime() - 1000) });
    expect(
      (await call('POST', `/operator/admin-recoveries/${id}/complete`, operatorToken)).json().error,
    ).toBe('recovery_objected');

    // Zweiter Versuch ohne Widerspruch nach Ablauf der Frist
    const second = await start();
    expect(second.statusCode).toBe(201);
    const id2 = second.json<{ id: string }>().id;
    await conn.db
      .update(s.adminRecoveries)
      .set({ notBefore: new Date(NOW.getTime() - 1000) })
      .where(eq(s.adminRecoveries.id, id2));
    const done = await call('POST', `/operator/admin-recoveries/${id2}/complete`, operatorToken);
    expect(done.statusCode, done.body).toBe(200);
    const invite = mailer.outbox.at(-1)!;
    expect(invite.to).toBe('ralf@fc-neustadt.example');
    const token = /\/join\/([\w-]+)/.exec(invite.text)![1]!;
    const accepted = await call('POST', `/join/${token}/accept`, undefined, {
      email: 'ralf@fc-neustadt.example',
      password: 'sicheres-passwort-2',
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    const me = accepted.json<LoginResponse>().me;
    expect(me.club.name).toBe('FC Neustadt 1920');
    expect(me.roles.map((r) => r.key)).toContain('fulladmin');
    // Bis dahin Betreiberzugang ohne Vereinsdaten: der Betreiber selbst ist nirgends Mitglied
    const [op] = await conn.db
      .select()
      .from(s.persons)
      .where(eq(s.persons.email, 'betreiber@clubroof.example'));
    expect(op).toBeUndefined();
  });

  describe('Mandantentrennung über alle Routen', () => {
    type RouteDef = { method: string; path: string };
    /** Alle Routen aus dem Routenbaum (ohne HEAD/OPTIONS). */
    const routes = (): RouteDef[] => {
      const out: RouteDef[] = [];
      const stack: string[] = [];
      for (const line of app.printRoutes({ commonPrefix: false }).split('\n')) {
        // Baumdarstellung: je Ebene 4 Zeichen Einrückung, der Pfad steht relativ zum übergeordneten Knoten
        const m = /^((?:│ {3}| {4})*)[├└]── (\S+)(?: \(([^)]*)\))?/.exec(line);
        if (!m) continue;
        const depth = m[1]!.length / 4;
        stack.length = depth;
        const full = (stack[depth - 1] ?? '') + m[2]!;
        stack[depth] = full;
        for (const method of (m[3] ?? '').split(',').map((x) => x.trim())) {
          if (!method || ['HEAD', 'OPTIONS'].includes(method)) continue;
          out.push({ method, path: full.replace(/\/$/, '') || '/' });
        }
      }
      return out;
    };
    // Öffentliche, tokenbasierte oder verbrauchende Routen sind kein Thema der Vereinsdaten-Trennung
    const SKIP = [
      '/operator',
      '/public',
      '/join',
      '/setup',
      '/auth',
      '/files',
      '/brand',
      '/account',
      '/calendar',
    ];
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

    /** Alle Primärschlüssel-IDs eines Vereins aus allen Tabellen mit `club_id`. */
    async function idsOfClub(clubId: string): Promise<Set<string>> {
      const tables = await conn.sql<{ table_name: string; has_id: boolean }[]>`
        select c.table_name,
               exists (select 1 from information_schema.columns i
                       where i.table_schema = 'public' and i.table_name = c.table_name and i.column_name = 'id') as has_id
        from information_schema.columns c
        where c.table_schema = 'public' and c.column_name = 'club_id'`;
      const ids = new Set<string>([clubId]);
      for (const tbl of tables) {
        if (!tbl.has_id) continue;
        const rows = await conn.sql.unsafe(
          `select id::text as id from "${tbl.table_name}" where club_id = '${clubId}'`,
        );
        for (const r of rows) ids.add(String(r.id));
      }
      return ids;
    }
    /** Inhalts-Fingerabdruck aller Zeilen eines Vereins je Tabelle: zeigt jede Veränderung (auch Updates). */
    async function fingerprint(clubId: string): Promise<Record<string, string>> {
      const tables = await conn.sql<{ table_name: string }[]>`
        select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'club_id' order by table_name`;
      const out: Record<string, string> = {};
      for (const tbl of tables) {
        const rows = await conn.sql.unsafe(
          `select coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as h from "${tbl.table_name}" x where club_id = '${clubId}'`,
        );
        out[tbl.table_name] = String(rows[0]!.h);
      }
      return out;
    }
    /** Je Tabelle ein paar Beispiel-IDs des fremden Vereins, um sie in Pfade und Abfragen einzusetzen. */
    async function sampleIds(clubId: string): Promise<string[]> {
      const tables = await conn.sql<{ table_name: string }[]>`
        select c.table_name from information_schema.columns c
        where c.table_schema = 'public' and c.column_name = 'club_id'
          and exists (select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = c.table_name and i.column_name = 'id')`;
      const out: string[] = [clubId];
      for (const tbl of tables) {
        const rows = await conn.sql.unsafe(
          `select id::text as id from "${tbl.table_name}" where club_id = '${clubId}' limit 2`,
        );
        for (const r of rows) out.push(String(r.id));
      }
      return out;
    }

    async function sweep(token: string, foreignClub: string) {
      const foreign = await idsOfClub(foreignClub);
      const samples = await sampleIds(foreignClub);
      const leaks: string[] = [];
      const inspect = (label: string, status: number, body: string, expectDenied: boolean) => {
        if (expectDenied && status >= 200 && status < 300) leaks.push(`${label} → ${status}`);
        for (const id of body.match(UUID) ?? [])
          if (foreign.has(id)) leaks.push(`${label} enthält ${id}`);
      };
      const list = routes().filter(
        (r) => !SKIP.some((p) => r.path === p || r.path.startsWith(`${p}/`)),
      );
      for (const r of list) {
        const params = [...r.path.matchAll(/:(\w+)/g)].map((m) => m[1]!);
        const idParams = params.filter((p) => /id$/i.test(p));
        const fill = (id: string) =>
          r.path.replace(/:(\w+)/g, (_m, name: string) => (/id$/i.test(name) ? id : 'x'));
        const candidates = idParams.length ? samples : [''];
        for (const id of candidates) {
          const path = id ? fill(id) : fill('');
          if (r.method === 'GET') {
            const res = await call('GET', path, token);
            inspect(`GET ${path}`, res.statusCode, res.body, idParams.length > 0);
          } else if (idParams.length) {
            // Schreibende Routen mit fremder ID: nie erfolgreich (leerer Inhalt genügt als Versuch)
            const res = await call(r.method as 'POST', path, token, {});
            inspect(`${r.method} ${path}`, res.statusCode, res.body, false);
          }
        }
        if (r.method === 'GET' && !idParams.length) {
          // Fremde IDs als Abfrageparameter (teamId, personId, eventId …)
          for (const id of samples.slice(0, 12)) {
            const q = [
              'teamId',
              'personId',
              'eventId',
              'clubId',
              'id',
              'fundId',
              'orgUnitId',
              'seasonId',
            ]
              .map((k) => `${k}=${id}`)
              .join('&');
            const res = await call('GET', `${fill('')}?${q}`, token);
            inspect(`GET ${fill('')}?…${id}`, res.statusCode, res.body, false);
          }
        }
      }
      return leaks;
    }

    it('zweiter Verein erreicht nichts vom Demoverein (Pfade, IDs, Abfragen, schreibende Routen)', async () => {
      const [club1] = await conn.db
        .select()
        .from(s.clubs)
        .where(eq(s.clubs.shortName, 'SV Grün-Weiß'));
      const before = await fingerprint(club1!.id);
      const erika = await login('erika@fc-neustadt.example', 'sicheres-passwort-1');
      const leaks = await sweep(erika.token, club1!.id);
      expect(leaks.slice(0, 20)).toEqual([]);
      // nichts wurde im Demoverein verändert
      expect(await fingerprint(club1!.id)).toEqual(before);
    }, 300_000);

    it('der Demoverein erreicht nichts vom zweiten Verein', async () => {
      const [club2] = await conn.db
        .select()
        .from(s.clubs)
        .where(eq(s.clubs.shortName, 'FC Neustadt'));
      const before = await fingerprint(club2!.id);
      const admin = await login(demo('admin'));
      const leaks = await sweep(admin.token, club2!.id);
      expect(leaks.slice(0, 20)).toEqual([]);
      expect(await fingerprint(club2!.id)).toEqual(before);
    }, 300_000);
  });
});
