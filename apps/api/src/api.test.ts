/**
 * Integrationstests der API gegen eine echte Datenbank mit Demoverein.
 * Die Uhr ist fest eingestellt, damit Fristen reproduzierbar geprüft werden können.
 * Werden übersprungen, wenn `DATABASE_URL` nicht gesetzt ist.
 */
import type {
  Absence,
  AdminOverview,
  AuditEntry,
  MemberDetail,
  MemberListItem,
  RoleCatalog,
  DemandDetail,
  TwoFactorChallenge,
  TwoFactorSetup,
  TwoFactorStatus,
  ClubSettings,
  NotificationSettings,
  NewsReadReceipt,
  TeamTaskList,
  MyTeamCard,
  CommentItem,
  EventPlanning,
  CalendarFeed,
  Exercise,
  TrainingPlan,
  ForumOverview,
  ForumTopicDetail,
  BoardOverview,
  WikiOverview,
  WikiPage,
  ChangingRoomPlan,
  EquipmentOverview,
  DamageOverview,
  RefereeOverview,
  MemberImportResult,
  InviteLink,
  InviteOverview,
  JoinInfo,
  JerseySettings,
  MatchSheet,
  TransferOverview,
  ModuleOverview,
  TeamAdminOverview,
  TeamDetailAdmin,
  TeamModule,
  UploadedImage,
  EditorialNews,
  EditorialOverview,
  FacilityOccupancy,
  ExchangeOverview,
  PersonProfile,
  ClubTeamGroup,
  ClubTeamPage,
  ContactGroup,
  DocumentItem,
  HelperEvent,
  HelperShift,
  NotificationItem,
  RosterEntry,
  TeamCash,
  TeamOverview,
  TeamStats,
  Carpool,
  CashStats,
  EventDetail,
  EventSummary,
  HomeResponse,
  LoginResponse,
  NewsItem,
  PollDetail,
  PollSummary,
} from '@clubroof/core';
import { createDb, schema as s } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import { runMigrations } from '@clubroof/db/migrate';
import { seed } from '@clubroof/db/seed';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { memoryMailer } from './security/mailer';
import { memoryPushSender } from './notify/push';
import { runJobs } from './jobs';
import { stepOf, totp } from './security/totp';

const url = process.env.DATABASE_URL;
const NOW = new Date('2026-10-05T08:00:00Z'); // Montag, 10:00 Uhr in Berlin
const PASSWORD = 'clubroof-demo';
const email = (who: string) => `${who}@sv-gruen-weiss.example`;

describe.skipIf(!url)('API', () => {
  const { db, sql } = createDb(url);
  let app: Awaited<ReturnType<typeof buildApp>>;
  const mailer = memoryMailer();
  const push = memoryPushSender();

  beforeAll(async () => {
    await runMigrations(url);
    await seed(db, { now: NOW });
    app = await buildApp({
      db,
      config: loadConfig({
        LOGIN_RATE_LIMIT: '1000',
        UPLOADS_DIR: await mkdtemp(join(tmpdir(), 'clubroof-')),
      }),
      now: () => NOW,
      mailer,
      push,
    });
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await sql.end();
  });

  async function login(who: string): Promise<LoginResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: email(who), password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    return res.json();
  }

  async function get<T>(path: string, token: string): Promise<T> {
    const res = await app.inject({
      method: 'GET',
      url: path,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode, `${path}: ${res.body}`).toBe(200);
    return res.json();
  }

  async function send<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    token: string,
    payload?: unknown,
  ): Promise<{ status: number; body: T }> {
    const res = await app.inject({
      method,
      url: path,
      headers: { authorization: `Bearer ${token}` },
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: res.statusCode, body: res.body ? (res.json() as T) : (undefined as T) };
  }

  describe('Anmeldung', () => {
    it('lehnt falsches Passwort und unbekannte E-Mail gleich ab', async () => {
      for (const payload of [
        { email: email('trainer'), password: 'falsch' },
        { email: 'niemand@example.org', password: PASSWORD },
      ]) {
        const res = await app.inject({ method: 'POST', url: '/auth/login', payload });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('invalid_credentials');
      }
    });

    it('meldet ungültige Eingaben verständlich', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'x' } });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('validation');
    });

    it('erlaubt Browsern Änderungen per PUT (CORS)', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/events/x/responses/y',
        headers: {
          origin: 'http://localhost:8081',
          'access-control-request-method': 'PUT',
          'access-control-request-headers': 'authorization,content-type',
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-methods']).toContain('PUT');
    });

    it('verlangt für geschützte Bereiche eine Anmeldung', async () => {
      expect((await app.inject({ method: 'GET', url: '/home' })).statusCode).toBe(401);
      const res = await app.inject({
        method: 'GET',
        url: '/home',
        headers: { authorization: 'Bearer ungueltig' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('bremst wiederholte Anmeldeversuche (10 pro Minute)', async () => {
      const limited = await buildApp({ db, config: loadConfig({}), now: () => NOW });
      try {
        const codes: number[] = [];
        for (let i = 0; i < 11; i++) {
          const res = await limited.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { email: email('trainer'), password: 'falsch' },
          });
          codes.push(res.statusCode);
        }
        expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
        expect(codes[10]).toBe(429);
      } finally {
        await limited.close();
      }
    });

    it('Abmelden macht das Token ungültig', async () => {
      const { token } = await login('kasse');
      const headers = { authorization: `Bearer ${token}` };
      expect((await app.inject({ method: 'POST', url: '/auth/logout', headers })).statusCode).toBe(
        204,
      );
      expect((await app.inject({ method: 'GET', url: '/me', headers })).statusCode).toBe(401);
    });
  });

  describe('Perspektiven', () => {
    it('Trainer: zwei Trainerteams und Spieler in der 2. Mannschaft, kein Verwaltungsmodus', async () => {
      const { me } = await login('trainer');
      const byBadge = Object.fromEntries(me.teams.map((t) => [t.badge, t.functions]));
      expect(byBadge).toMatchObject({ B1: ['coach'], C1: ['coach'], '2.': ['player'] });
      expect(me.club.colorTheme).toBe('green');
      expect(me.canAdminister).toBe(false);
    });

    it('Eltern: verwalten zwei Kinder und sehen deren offene Zusagen', async () => {
      const { token, me } = await login('eltern');
      expect(me.managedPersons.map((p) => p.firstName)).toEqual(['Julia', 'Leon', 'Mia']);
      const home = await get<HomeResponse>('/home', token);
      const titles = home.actions.map((a) => a.title);
      expect(titles).toContain('Zusage offen für Leon');
      expect(titles).toContain('Zusage offen für Mia');
    });

    it('Vorstand: Vereinsübersicht und Freigabe als offene Aktion', async () => {
      const { token, me } = await login('vorstand');
      expect(me.canAdminister).toBe(true);
      const home = await get<HomeResponse>('/home', token);
      expect(home.clubOverview).toMatchObject({ teams: 11, pendingApprovals: 1 });
      expect(home.clubOverview!.members).toBeGreaterThan(300);
      expect(home.actions.some((a) => a.kind === 'approval')).toBe(true);
    });

    it('Kasse: Kassenstand sieht die ganze Mannschaft, Außenstehende nicht', async () => {
      const player = await login('spieler');
      const b1 = player.me.teams.find((t) => t.badge === 'B1')!.id;
      const own = await get<TeamCash>(`/teams/${b1}/cash`, player.token);
      expect(own.balanceCents).toBe(51235);
      expect(own.entries!.length).toBeGreaterThan(3);
      expect(own.members!.length).toBeGreaterThan(3);
      // Die Startseite zeigt keine Kasse mehr
      const home = await get<HomeResponse>('/home', player.token);
      expect('cash' in home).toBe(false);
      // Eltern aus der E-Jugend gehören nicht zur B-Jugend
      expect((await send('GET', `/teams/${b1}/cash`, (await login('eltern')).token)).status).toBe(
        404,
      );
    });

    it('Dringende News stehen oben', async () => {
      const home = await get<HomeResponse>('/home', (await login('spieler')).token);
      expect(home.news[0]!.priority).toBe('urgent');
    });
  });

  describe('Termine und Zusagen', () => {
    async function nextB1Training(token: string): Promise<EventSummary> {
      const events = await get<EventSummary[]>('/events', token);
      return events.find(
        (e) => e.team?.badge === 'B1' && e.type === 'training' && e.status === 'scheduled',
      )!;
    }

    it('Spieler sagt für das nächste Training zu', async () => {
      const { token, me } = await login('spieler');
      const training = await nextB1Training(token);
      expect(training.myResponses[0]).toMatchObject({ status: 'pending', canRespond: true });

      const res = await app.inject({
        method: 'PUT',
        url: `/events/${training.id}/responses/${me.person.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'yes' },
      });
      expect(res.statusCode).toBe(200);
      const updated: EventSummary = res.json();
      expect(updated.myResponses[0]!.status).toBe('yes');
      expect(updated.counts.yes).toBe(training.counts.yes + 1);
      expect(updated.counts.pending).toBe(training.counts.pending - 1);
    });

    it('niemand antwortet für fremde Personen', async () => {
      const player = await login('spieler');
      const training = await nextB1Training(player.token);
      const parent = await login('eltern');
      const res = await app.inject({
        method: 'PUT',
        url: `/events/${training.id}/responses/${player.me.person.id}`,
        headers: { authorization: `Bearer ${parent.token}` },
        payload: { status: 'no' },
      });
      // Termin der B-Jugend ist für die Mutter aus der E-Jugend nicht sichtbar
      expect(res.statusCode).toBe(404);
    });

    it('nach Fristablauf ist eine reguläre Absage gesperrt, Trainer können korrigieren', async () => {
      const player = await login('spieler');
      const training = await nextB1Training(player.token);
      const afterDeadline = new Date(new Date(training.deadline!).getTime() + 60_000);
      const lateApp = await buildApp({
        db,
        config: loadConfig({ LOGIN_RATE_LIMIT: '1000' }),
        now: () => afterDeadline,
      });
      try {
        const late = await lateApp.inject({
          method: 'PUT',
          url: `/events/${training.id}/responses/${player.me.person.id}`,
          headers: { authorization: `Bearer ${player.token}` },
          payload: { status: 'no', reason: 'Schule' },
        });
        expect(late.statusCode).toBe(409);
        expect(late.json().error).toBe('deadline_passed');

        const coach = await login('trainer');
        const corrected = await lateApp.inject({
          method: 'PUT',
          url: `/events/${training.id}/responses/${player.me.person.id}`,
          headers: { authorization: `Bearer ${coach.token}` },
          payload: { status: 'no', reason: 'Schule' },
        });
        expect(corrected.statusCode).toBe(200);
        const [audit] = await sql`
          select action from audit_log where action = 'attendance.overridden' limit 1`;
        expect(audit).toBeDefined();
      } finally {
        await lateApp.close();
      }
    });

    it('Trainerteam erfasst die Anwesenheit, sie zählt für die Trainingsquote', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const c1 = coach.me.teams.find((t) => t.badge === 'C1')!;
      const [past] = await sql<{ id: string }[]>`
        select id from events
        where team_id = ${c1.id} and type = 'training' and status = 'scheduled'
          and starts_at < ${NOW.toISOString()} and attendance_recorded_at is null
        order by starts_at desc limit 1`;
      const before = await get<EventDetail>(`/events/${past!.id}`, coach.token);
      expect(before.attendanceCheck).toEqual({ recordedAt: null, canRecord: true });
      const said = before.participants.filter((p) => p.role === 'player' && p.status === 'yes');
      expect(said.length).toBeGreaterThan(3);
      const missing = said[0]!;
      const statsBefore = await get<TeamStats>(`/teams/${c1.id}/stats`, coach.token);

      // Spieler dürfen nicht erfassen, künftige Termine noch nicht
      const asPlayer = await send('PUT', `/events/${past!.id}/attendance-check`, player.token, {
        present: [],
      });
      expect([403, 404]).toContain(asPlayer.status);
      const future = await nextB1Training(coach.token);
      const early = await send<{ error: string }>(
        'PUT',
        `/events/${future.id}/attendance-check`,
        coach.token,
        { present: [] },
      );
      expect(early.status).toBe(409);
      expect(early.body.error).toBe('not_started');

      const present = said.slice(1).map((p) => p.personId);
      const res = await send<EventDetail>(
        'PUT',
        `/events/${past!.id}/attendance-check`,
        coach.token,
        {
          present,
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.attendanceCheck!.recordedAt).not.toBeNull();
      const byId = new Map(res.body.participants.map((p) => [p.personId, p.attended]));
      expect(byId.get(missing.personId)).toBe(false);
      expect(byId.get(present[0]!)).toBe(true);

      const statsAfter = await get<TeamStats>(`/teams/${c1.id}/stats`, coach.token);
      const was = statsBefore.players.find((p) => p.personId === missing.personId)!;
      const now = statsAfter.players.find((p) => p.personId === missing.personId)!;
      expect(now.trainingsAttended).toBe(was.trainingsAttended - 1);
      expect(now.trainings).toBe(was.trainings);
    });

    it('Fahrgemeinschaften zum Auswärtsspiel', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const events = await get<EventSummary[]>('/events', player.token);
      const away = events.find(
        (e) => e.team?.badge === 'B1' && e.type === 'match' && !e.match!.isHome,
      )!;
      const detail = await get<EventDetail>(`/events/${away.id}`, player.token);
      const carpool = detail.carpool!;
      expect(carpool.open).toBe(true);
      expect(carpool.offers).toHaveLength(1);
      const offer = carpool.offers[0]!;
      expect(offer).toMatchObject({
        driverName: 'Max Mustermann',
        seats: 3,
        mine: false,
        canWithdraw: false,
      });
      expect(carpool.riders.map((r) => r.personId)).toEqual([player.me.person.id]);
      expect(carpool.requests.length).toBe(1);

      // Mitfahren: ein Platz weniger, Fahrer wird benachrichtigt
      const joined = await send<Carpool>(
        'PUT',
        `/carpool/offers/${offer.id}/passengers/${player.me.person.id}`,
        player.token,
      );
      expect(joined.status).toBe(200);
      expect(joined.body.offers[0]!.free).toBe(offer.free - 1);
      expect(joined.body.offers[0]!.passengers.some((p) => p.mine)).toBe(true);
      const [note] = await sql`
        select n.title from notifications n join persons p on p.user_id = n.user_id
        where p.id = ${coach.me.person.id} and n.title = 'Neuer Mitfahrer'`;
      expect(note).toBeDefined();

      // Fremde Personen lassen sich nicht eintragen, fremde Angebote nicht zurückziehen
      const other = detail.participants.find(
        (p) => p.role === 'player' && p.personId !== player.me.person.id,
      )!;
      expect(
        (
          await send(
            'PUT',
            `/carpool/offers/${offer.id}/passengers/${other.personId}`,
            player.token,
          )
        ).status,
      ).toBe(403);
      expect((await send('DELETE', `/carpool/offers/${offer.id}`, player.token)).status).toBe(403);

      // Eigenes Angebot (Spieler fährt selbst) und wieder zurückziehen
      const own = await send<Carpool>('PUT', `/events/${away.id}/carpool/offer`, player.token, {
        seats: 2,
        note: 'Ab Kleefeld',
      });
      expect(own.body.offers).toHaveLength(2);
      const mine = own.body.offers.find((o) => o.mine)!;
      const left = await send<Carpool>(
        'DELETE',
        `/carpool/offers/${offer.id}/passengers/${player.me.person.id}`,
        player.token,
      );
      expect(left.body.offers.find((o) => o.id === offer.id)!.free).toBe(offer.free);
      const gone = await send<Carpool>('DELETE', `/carpool/offers/${mine.id}`, player.token);
      expect(gone.body.offers).toHaveLength(1);

      // Mitfahrt suchen und zurücknehmen
      const looking = await send<Carpool>(
        'PUT',
        `/events/${away.id}/carpool/requests/${player.me.person.id}`,
        player.token,
        { looking: true },
      );
      expect(looking.body.requests.some((r) => r.mine)).toBe(true);
      const done = await send<Carpool>(
        'PUT',
        `/events/${away.id}/carpool/requests/${player.me.person.id}`,
        player.token,
        { looking: false },
      );
      expect(done.body.requests.some((r) => r.mine)).toBe(false);

      // Heimspiele und Trainings haben keine Fahrgemeinschaft
      const home = events.find(
        (e) => e.team?.badge === 'B1' && e.type === 'match' && e.match!.isHome,
      );
      if (home)
        expect((await get<EventDetail>(`/events/${home.id}`, player.token)).carpool).toBeNull();
      const training = await nextB1Training(player.token);
      expect((await get<EventDetail>(`/events/${training.id}`, player.token)).carpool).toBeNull();
    });

    it('abgesagte Termine nehmen keine Antworten an', async () => {
      const { token, me } = await login('spieler');
      const events = await get<EventSummary[]>('/events', token);
      const cancelled = events.find((e) => e.team?.badge === 'B1' && e.status === 'cancelled')!;
      expect(cancelled.cancelledReason).toContain('Kunstrasen');
      const res = await app.inject({
        method: 'PUT',
        url: `/events/${cancelled.id}/responses/${me.person.id}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'yes' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('Gründe für Absagen sehen nur Verantwortliche', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const events = await get<EventSummary[]>('/events', player.token);
      const match = events.find((e) => e.team?.badge === 'B1' && e.type === 'match')!;

      const asPlayer = await get<EventDetail>(`/events/${match.id}`, player.token);
      const asCoach = await get<EventDetail>(`/events/${match.id}`, coach.token);
      expect(asPlayer.participants.length).toBeGreaterThan(15);
      const othersWithReason = asPlayer.participants.filter(
        (p) => p.personId !== player.me.person.id && p.reason !== null,
      );
      expect(othersWithReason).toEqual([]);
      expect(asCoach.participants.some((p) => p.reason !== null)).toBe(true);
      expect(
        asCoach.participants.some((p) => p.role === 'guest_player' && p.guestFromTeam === 'C1'),
      ).toBe(true);
    });
  });
  describe('Module und Kacheln', () => {
    it('liefert aktivierte Module je Mannschaft und Verein', async () => {
      const { me } = await login('trainer');
      const b1 = me.teams.find((t) => t.badge === 'B1')!;
      expect(b1.modules).toEqual(
        expect.arrayContaining(['events', 'statistics', 'team_cash', 'polls']),
      );
      expect(me.clubModules).toContain('polls');
      expect(me.clubModules).not.toContain('forum');
    });
  });

  describe('Abwesenheiten', () => {
    it('sagt Termine im Zeitraum automatisch ab und nimmt das beim Löschen zurück', async () => {
      const { token, me } = await login('spieler');
      const events = await get<EventSummary[]>('/events', token);
      const match = events.find((e) => e.team?.badge === 'B1' && e.type === 'match')!;
      expect(match.myResponses[0]!.status).toBe('yes');
      const day = match.startsAt.slice(0, 10);

      const created = await send<Absence>('POST', '/absences', token, {
        personId: me.person.id,
        kind: 'vacation',
        startsOn: day,
        endsOn: day,
        note: 'Familienfeier',
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect(created.body.affectedEvents).toBeGreaterThanOrEqual(1);

      const during = await get<EventDetail>(`/events/${match.id}`, token);
      expect(during.myResponses[0]).toMatchObject({ status: 'no', reason: 'Abwesend: Urlaub' });
      const list = await get<Absence[]>('/absences', token);
      expect(list.some((a) => a.id === created.body.id)).toBe(true);

      const removed = await send('DELETE', `/absences/${created.body.id}`, token);
      expect(removed.status).toBe(204);
      const after = await get<EventDetail>(`/events/${match.id}`, token);
      // B-Jugend antwortet aktiv: nach dem Löschen ist die Rückmeldung wieder offen
      expect(after.myResponses[0]).toMatchObject({ status: 'pending', reason: null });
    });

    it('Eltern tragen Abwesenheiten für ihr Kind ein, aber nicht für Fremde', async () => {
      const parent = await login('eltern');
      const leon = parent.me.managedPersons.find((p) => p.firstName === 'Leon')!;
      const day = '2026-10-20';
      const ok = await send<Absence>('POST', '/absences', parent.token, {
        personId: leon.id,
        kind: 'illness',
        startsOn: day,
        endsOn: day,
      });
      expect(ok.status).toBe(201);
      expect(ok.body.personName).toBe('Leon Neumann');

      const player = await login('spieler');
      const denied = await send('POST', '/absences', parent.token, {
        personId: player.me.person.id,
        kind: 'illness',
        startsOn: day,
        endsOn: day,
      });
      expect(denied.status).toBe(403);
    });

    it('prüft den Zeitraum', async () => {
      const { token, me } = await login('spieler');
      const res = await send<{ error: string }>('POST', '/absences', token, {
        personId: me.person.id,
        kind: 'other',
        startsOn: '2026-10-20',
        endsOn: '2026-10-18',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Umfragen', () => {
    it('Ergebnisse erst nach eigener Stimme sichtbar (Regel „nach Abstimmung“)', async () => {
      const { token } = await login('spieler');
      const polls = await get<PollSummary[]>('/polls', token);
      const dj = polls.find((p) => p.question.includes('DJ'))!;
      // Schnellantwort: die Startseite liefert die Antwortmöglichkeiten mit
      const action = (await get<HomeResponse>('/home', token)).actions.find(
        (a) => a.kind === 'poll',
      )!;
      expect(action.options!.length).toBeGreaterThan(1);
      const before = await get<PollDetail>(`/polls/${dj.id}`, token);
      expect(before.resultsVisible).toBe(false);
      expect(before.options.every((o) => o.votes === null)).toBe(true);

      const voted = await send<PollDetail>('PUT', `/polls/${dj.id}/vote`, token, {
        optionId: before.options[0]!.id,
      });
      expect(voted.status).toBe(200);
      expect(voted.body.myOptionId).toBe(before.options[0]!.id);
      expect(voted.body.resultsVisible).toBe(true);
      expect(voted.body.votes).toBe(before.votes + 1);

      // Stimme ändern zählt nicht doppelt
      const changed = await send<PollDetail>('PUT', `/polls/${dj.id}/vote`, token, {
        optionId: before.options[1]!.id,
      });
      expect(changed.body.votes).toBe(before.votes + 1);
      expect(changed.body.myOptionId).toBe(before.options[1]!.id);
    });

    it('Ergebnisse bleiben bis Fristende verborgen (Regel „nach Fristende“)', async () => {
      const { token } = await login('spieler');
      const polls = await get<PollSummary[]>('/polls', token);
      const jersey = polls.find((p) => p.question.includes('Trikot'))!;
      const detail = await get<PollDetail>(`/polls/${jersey.id}`, token);
      const voted = await send<PollDetail>('PUT', `/polls/${jersey.id}/vote`, token, {
        optionId: detail.options[0]!.id,
      });
      expect(voted.body.resultsVisible).toBe(false);
    });

    it('Umfragen anderer Mannschaften sind nicht sichtbar', async () => {
      const [foreign] = await sql`select id from polls where question like '%Mannschaftsabend%'`;
      const player = await login('spieler');
      const mine = await get<PollSummary[]>('/polls', player.token);
      expect(mine.some((p) => p.id === foreign!.id)).toBe(false);
      const res = await app.inject({
        method: 'GET',
        url: `/polls/${foreign!.id}`,
        headers: { authorization: `Bearer ${player.token}` },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('News', () => {
    it('zählt Aufrufe einmal je Nutzer und verwaltet „Gefällt mir“', async () => {
      const { token } = await login('eltern');
      const home = await get<HomeResponse>('/home', token);
      const id = home.news[0]!.id;
      const first = await get<NewsItem>(`/news/${id}`, token);
      const second = await get<NewsItem>(`/news/${id}`, token);
      expect(second.viewCount).toBe(first.viewCount);

      const liked = await send<NewsItem>('PUT', `/news/${id}/like`, token);
      const again = await send<NewsItem>('PUT', `/news/${id}/like`, token);
      expect(liked.body.likedByMe).toBe(true);
      expect(again.body.likeCount).toBe(first.likeCount + 1);

      const unliked = await send<NewsItem>('DELETE', `/news/${id}/like`, token);
      expect(unliked.body.likedByMe).toBe(false);
      expect(unliked.body.likeCount).toBe(first.likeCount);
    });
  });
  describe('Team-Cockpit', () => {
    const teamId = async (badge: string) => {
      const [row] = await sql`select id from teams where badge = ${badge}`;
      return row!.id as string;
    };

    it('Übersicht mit Kaderstatus, Ergebnissen und Rechten je Rolle', async () => {
      const b1 = await teamId('B1');
      const coach = await get<TeamOverview>(`/teams/${b1}`, (await login('trainer')).token);
      expect(coach.permissions).toMatchObject({
        manageEvents: true,
        readCash: true,
        manageCash: false,
      });
      expect(coach.squad!.players).toBeGreaterThanOrEqual(18);
      expect(coach.lastResults.length).toBeGreaterThan(0);
      expect(coach.highlights.played).toBeGreaterThan(0);
      expect(coach.highlights.trainingRate).not.toBeNull();

      const player = await get<TeamOverview>(`/teams/${b1}`, (await login('spieler')).token);
      expect(player.permissions.manageEvents).toBe(false);
    });

    it('fremde Mannschaften sind nicht sichtbar', async () => {
      const h1 = await teamId('1.');
      const res = await app.inject({
        method: 'GET',
        url: `/teams/${h1}`,
        headers: { authorization: `Bearer ${(await login('spieler')).token}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Kader: Abwesenheitsgrund nur für das Trainerteam', async () => {
      const b1 = await teamId('B1');
      const coach = await get<RosterEntry[]>(`/teams/${b1}/roster`, (await login('trainer')).token);
      const player = await get<RosterEntry[]>(
        `/teams/${b1}/roster`,
        (await login('spieler')).token,
      );
      const absentForCoach = coach.filter((r) => r.unavailable);
      expect(absentForCoach.length).toBeGreaterThan(0);
      expect(absentForCoach.every((r) => r.unavailableReason !== null)).toBe(true);
      const absentForPlayer = player.filter(
        (r) => r.unavailable && !r.name.startsWith('Max Becker'),
      );
      expect(absentForPlayer.every((r) => r.unavailableReason === null)).toBe(true);
      expect(coach.find((r) => r.name === 'Max Becker')!.jerseyNumber).toBe(14);
    });

    it('Statistik: Quoten für die ganze Mannschaft, nicht für Außenstehende; Modul muss aktiv sein', async () => {
      const b1 = await teamId('B1');
      const coach = await get<TeamStats>(`/teams/${b1}/stats`, (await login('trainer')).token);
      const player = await login('spieler');
      const own = await get<TeamStats>(`/teams/${b1}/stats`, player.token);
      expect(coach.players.length).toBeGreaterThan(10);
      expect(own.players.length).toBe(coach.players.length);
      // Kassenwartin hat Zugriff auf die Mannschaft (Kasse), gehört aber nicht dazu
      const outsider = await send<TeamStats>(
        'GET',
        `/teams/${b1}/stats`,
        (await login('kasse')).token,
      );
      if (outsider.status === 200) {
        expect(outsider.body.showsTrainingRates).toBe(false);
        expect(outsider.body.players).toEqual([]);
      }

      const e1 = await teamId('E1');
      const res = await app.inject({
        method: 'GET',
        url: `/teams/${e1}/stats`,
        headers: { authorization: `Bearer ${(await login('eltern')).token}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Kassenbericht als CSV über einen kurzlebigen Link', async () => {
      const b1 = await teamId('B1');
      const treasurer = await login('kasse');
      const player = await login('spieler');
      // Den Bericht darf die ganze Mannschaft laden, Außenstehende nicht
      expect((await send('GET', `/teams/${b1}/cash/report-link`, player.token)).status).toBe(200);
      expect(
        (await send('GET', `/teams/${b1}/cash/report-link`, (await login('eltern')).token)).status,
      ).toBe(404);
      const cash = await get<TeamCash>(`/teams/${b1}/cash`, treasurer.token);
      const link = await get<{ url: string }>(`/teams/${b1}/cash/report-link`, treasurer.token);
      const res = await app.inject({ method: 'GET', url: new URL(link.url).pathname });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('Kassenbericht%20B1');
      const csv = res.body;
      expect(csv.startsWith('\uFEFFKassenbericht;')).toBe(true);
      expect(csv).toContain('Datum;Art;Beschreibung;Person;Einnahme;Ausgabe;Kassenstand');
      const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',');
      expect(csv).toContain(`;${euro(cash.balanceCents!)}\r\n`);
      // Manipulierter Link
      const bad = await app.inject({ method: 'GET', url: `${new URL(link.url).pathname}x` });
      expect(bad.statusCode).toBe(404);
    });

    it('Kasse: Buchungen nur mit Kassenrechten, persönliches Konto für alle', async () => {
      const h1 = await teamId('1.');
      const treasurer = await login('kasse');
      const before = await get<TeamCash>(`/teams/${h1}/cash`, treasurer.token);
      const someone = before.members![0]!;
      const booked = await send<TeamCash>('POST', `/teams/${h1}/cash/bookings`, treasurer.token, {
        kind: 'fine',
        amountCents: 500,
        description: 'Zu spät zum Training',
        personId: someone.personId,
      });
      expect(booked.status).toBe(201);
      const after = booked.body.members!.find((m) => m.personId === someone.personId)!;
      expect(after.balanceCents).toBe(someone.balanceCents - 500);
      // Strafen bewegen kein Geld
      expect(booked.body.balanceCents).toBe(before.balanceCents);

      const b1 = await teamId('B1');
      const player = await login('spieler');
      const own = await get<TeamCash>(`/teams/${b1}/cash`, player.token);
      expect(own.personal).toHaveLength(1);
      expect(own.permissions.manageCash).toBe(false);
      const denied = await send('POST', `/teams/${b1}/cash/bookings`, player.token, {
        kind: 'income',
        amountCents: 100,
        description: 'Test',
      });
      expect(denied.status).toBe(403);
      // A-Jugend hat keine Strafen
      const a1 = await teamId('A1');
      const admin = await login('admin');
      const finesOff = await send('POST', `/teams/${a1}/cash/fine-types`, admin.token, {
        name: 'Test',
        amountCents: 100,
      });
      expect(finesOff.status).toBe(400);
    });

    it('Strafenkatalog: Trainer pflegt ihn und vergibt Strafen an mehrere Spieler', async () => {
      const b1 = await teamId('B1');
      const coach = await login('trainer');
      const player = await login('spieler');
      const before = await get<TeamCash>(`/teams/${b1}/cash`, coach.token);
      expect(before.permissions.manageFines).toBe(true);
      expect(before.permissions.manageCash).toBe(false);
      expect(before.fineCatalog.map((f) => f.name)).toContain('Handy in der Kabine');

      // Spieler sehen den Katalog, dürfen ihn aber nicht ändern
      const seen = await get<TeamCash>(`/teams/${b1}/cash`, player.token);
      expect(seen.fineCatalog.length).toBe(before.fineCatalog.length);
      expect(
        (
          await send('POST', `/teams/${b1}/cash/fine-types`, player.token, {
            name: 'Neue Strafe',
            amountCents: 100,
          })
        ).status,
      ).toBe(403);

      const created = await send<TeamCash>('POST', `/teams/${b1}/cash/fine-types`, coach.token, {
        name: 'Ball über den Zaun',
        amountCents: 200,
      });
      const ball = created.body.fineCatalog.find((f) => f.name === 'Ball über den Zaun')!;
      expect(ball).toMatchObject({ amountCents: 200, timesGiven: 0 });

      const updated = await send<TeamCash>('PUT', `/cash/fine-types/${ball.id}`, coach.token, {
        name: 'Ball über den Zaun',
        amountCents: 150,
      });
      expect(updated.body.fineCatalog.find((f) => f.id === ball.id)!.amountCents).toBe(150);

      // Vergeben an zwei Spieler: je eine Forderung, Kassenstand bleibt gleich
      const players = (await get<RosterEntry[]>(`/teams/${b1}/roster`, coach.token)).filter(
        (r) => r.function === 'player',
      );
      const two = [
        player.me.person.id,
        players.find((p) => p.personId !== player.me.person.id)!.personId,
      ];
      const balanceOf = (c: TeamCash, id: string) =>
        c.members!.find((m) => m.personId === id)?.balanceCents ?? 0;
      const assigned = await send<TeamCash>('POST', `/teams/${b1}/cash/fines`, coach.token, {
        fineTypeId: ball.id,
        personIds: two,
      });
      expect(assigned.status).toBe(201);
      for (const id of two) {
        expect(balanceOf(assigned.body, id)).toBe(balanceOf(before, id) - 150);
      }
      expect(assigned.body.balanceCents).toBe(before.balanceCents);
      expect(assigned.body.fineCatalog.find((f) => f.id === ball.id)!.timesGiven).toBe(2);

      // Freie Strafen ohne Katalog nur mit vollen Kassenrechten; Spieler gar nicht
      const free = await send('POST', `/teams/${b1}/cash/fines`, coach.token, {
        amountCents: 300,
        description: 'Sonderstrafe',
        personIds: [two[0]],
      });
      expect(free.status).toBe(403);
      const treasurer = await login('kasse');
      const freeOk = await send('POST', `/teams/${b1}/cash/fines`, treasurer.token, {
        amountCents: 300,
        description: 'Sonderstrafe',
        personIds: [two[0]],
      });
      expect(freeOk.status).toBe(201);
      expect(
        (
          await send('POST', `/teams/${b1}/cash/fines`, player.token, {
            fineTypeId: ball.id,
            personIds: [two[1]],
          })
        ).status,
      ).toBe(403);
      // Fremde Personen lassen sich nicht bestrafen
      const stranger = await send('POST', `/teams/${b1}/cash/fines`, coach.token, {
        fineTypeId: ball.id,
        personIds: [(await login('eltern')).me.person.id],
      });
      expect(stranger.status).toBe(400);

      // Entfernen: verschwindet aus dem Katalog, Buchungen bleiben
      const removed = await send<TeamCash>('DELETE', `/cash/fine-types/${ball.id}`, coach.token);
      expect(removed.body.fineCatalog.some((f) => f.id === ball.id)).toBe(false);
      expect(
        removed.body.entries!.filter((e) => e.description === 'Ball über den Zaun'),
      ).toHaveLength(2);
    });

    it('Kassenstatistik für die ganze Mannschaft', async () => {
      const b1 = await teamId('B1');
      const player = await login('spieler');
      const stats = await get<CashStats>(`/teams/${b1}/cash/stats`, player.token);
      expect(stats.months.length).toBeGreaterThan(1);
      expect(stats.months.at(-1)!.balanceCents).toBe(51235);
      expect(
        stats.categories.some((c) => c.category === 'sponsoring' && c.incomeCents === 25000),
      ).toBe(true);
      expect(stats.fines.length).toBeGreaterThan(0);
      expect(stats.finesByPerson.some((p) => p.personId === player.me.person.id)).toBe(true);
      expect(stats.openCents).toBeGreaterThan(0);
      expect(
        (await send('GET', `/teams/${b1}/cash/stats`, (await login('eltern')).token)).status,
      ).toBe(404);
    });

    it('Trainer legt einen Termin an und sagt ihn ab; die Mannschaft wird benachrichtigt', async () => {
      const b1 = await teamId('B1');
      const coach = await login('trainer');
      const player = await login('spieler');
      const startsAt = new Date(NOW.getTime() + 26 * 60 * 60 * 1000).toISOString();

      const created = await send<EventDetail>('POST', `/teams/${b1}/events`, coach.token, {
        type: 'training',
        startsAt,
        meetingPoint: 'Kabine 2',
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const event = created.body;
      expect(event.title).toBe('Training');
      expect(event.counts.pending).toBeGreaterThan(10);
      // Die am Folgetag kranke Spielerin bzw. der Spieler ist automatisch abgesagt
      expect(
        event.participants.some((p) => p.status === 'no' && p.reason === 'Abwesend: Krankheit'),
      ).toBe(true);

      const denied = await send('POST', `/events/${event.id}/cancel`, player.token, {
        reason: 'Keine Lust',
      });
      expect(denied.status).toBe(403);

      const cancelled = await send<EventDetail>('POST', `/events/${event.id}/cancel`, coach.token, {
        reason: 'Platz gesperrt',
      });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('cancelled');

      const inbox = await get<NotificationItem[]>('/notifications', player.token);
      expect(inbox.some((n) => n.title === 'Neuer Termin: Training')).toBe(true);
      expect(inbox.some((n) => n.level === 'urgent' && n.title === 'Abgesagt: Training')).toBe(
        true,
      );
    });

    it('Spieler dürfen keine Termine anlegen', async () => {
      const b1 = await teamId('B1');
      const res = await send('POST', `/teams/${b1}/events`, (await login('spieler')).token, {
        type: 'training',
        startsAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(res.status).toBe(403);
    });
  });
  describe('Vereinsleben', () => {
    it('Helferschicht eintragen, Kapazität beachten, wieder austragen', async () => {
      const parent = await login('eltern');
      const events = await get<HelperEvent[]>('/helpers', parent.token);
      const tournament = events.find((e) => e.event.title === 'Jugend-Hallenturnier')!;
      expect(tournament.openSpots).toBeGreaterThan(0);
      const shift = tournament.shifts.find((x) => x.filled < x.capacity)!;
      expect(shift.helpers).toBeNull(); // Namen nur für Organisatoren

      const joined = await send<HelperShift>('PUT', `/shifts/${shift.id}/signup`, parent.token);
      expect(joined.body).toMatchObject({ mine: true, filled: shift.filled + 1 });
      const again = await send<HelperShift>('PUT', `/shifts/${shift.id}/signup`, parent.token);
      expect(again.body.filled).toBe(shift.filled + 1);

      const left = await send<HelperShift>('DELETE', `/shifts/${shift.id}/signup`, parent.token);
      expect(left.body).toMatchObject({ mine: false, filled: shift.filled });

      const board = await login('vorstand');
      const forBoard = await get<HelperEvent[]>('/helpers', board.token);
      expect(forBoard[0]!.shifts[0]!.helpers).not.toBeNull();
    });

    it('volle Schichten nehmen niemanden mehr auf', async () => {
      const [shift] = await sql`select id, capacity from helper_shifts where title = 'Bewirtung'`;
      const people =
        await sql`select id from persons where user_id is null limit ${shift!.capacity}`;
      await sql`delete from helper_signups where shift_id = ${shift!.id}`;
      for (const p of people) {
        await sql`insert into helper_signups (shift_id, person_id) values (${shift!.id}, ${p.id})`;
      }
      const res = await send<{ error: string }>(
        'PUT',
        `/shifts/${shift!.id}/signup`,
        (await login('spieler')).token,
      );
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('shift_full');
    });

    it('„Ich nehme teil“ für Vereinsveranstaltungen', async () => {
      const { token } = await login('spieler');
      const [event] = await sql`select id from events where title = 'Jahreshauptversammlung'`;
      const before = await get<EventDetail>(`/events/${event!.id}`, token);
      expect(before.attendance).toMatchObject({ attending: false });
      expect(before.program.length).toBeGreaterThan(0);
      const yes = await send<{ attending: boolean; count: number }>(
        'PUT',
        `/events/${event!.id}/attendance`,
        token,
      );
      expect(yes.body).toEqual({ attending: true, count: before.attendance!.count + 1 });
      const no = await send<{ attending: boolean; count: number }>(
        'DELETE',
        `/events/${event!.id}/attendance`,
        token,
      );
      expect(no.body).toEqual({ attending: false, count: before.attendance!.count });

      const [training] =
        await sql`select id from events where team_id is not null and starts_at > ${NOW.toISOString()} limit 1`;
      const wrong = await send('PUT', `/events/${training!.id}/attendance`, token);
      expect(wrong.status).toBe(400);
    });

    it('Dokumente: nur sichtbare, mit Suche, Öffnen über signierten Link', async () => {
      const player = await login('spieler');
      const docs = await get<DocumentItem[]>('/documents', player.token);
      expect(docs.some((d) => d.title === 'Trainingsplan U17 – Herbst')).toBe(true);
      expect(docs.some((d) => d.title === 'Trainingsplan U15 – Herbst')).toBe(false);
      const coachDocs = await get<DocumentItem[]>('/documents', (await login('trainer')).token);
      expect(coachDocs.some((d) => d.title === 'Trainingsplan U15 – Herbst')).toBe(true);

      const found = await get<DocumentItem[]>('/documents?q=satzung', player.token);
      expect(found.map((d) => d.title)).toEqual(['Vereinssatzung']);
      const forms = await get<DocumentItem[]>('/documents?category=forms', player.token);
      expect(forms.every((d) => d.category === 'forms')).toBe(true);

      const link = await get<{ url: string }>(`/documents/${found[0]!.id}/link`, player.token);
      const path = new URL(link.url).pathname;
      const file = await app.inject({ method: 'GET', url: path });
      expect(file.statusCode).toBe(200);
      expect(file.headers['content-type']).toBe('application/pdf');
      expect(file.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

      const tampered = await app.inject({ method: 'GET', url: path.slice(0, -2) + 'xx' });
      expect(tampered.statusCode).toBe(404);
    });

    it('Mannschaftsseite im Verein: Jugendkader nur für die eigene Mannschaft', async () => {
      const player = await login('spieler');
      const groups = await get<ClubTeamGroup[]>('/club/teams', player.token);
      const all = groups.flatMap((g) => g.teams);
      const b1 = all.find((t) => t.badge === 'B1')!;
      const c1 = all.find((t) => t.badge === 'C1')!;
      const first = all.find((t) => t.badge === '1.')!;

      const own = await get<ClubTeamPage>(`/club/teams/${b1.id}`, player.token);
      expect(own.isMine).toBe(true);
      expect(own.players!.length).toBe(own.playerCount);
      expect(own.coaches.some((c) => c.name === 'Max Mustermann')).toBe(true);
      expect(own.highlights.played).toBeGreaterThan(0);
      expect(own.lastResults.length).toBeLessThanOrEqual(5);

      // Fremde Jugendmannschaft: nur Anzahl, keine Namen; Senioren mit Namen
      const youth = await get<ClubTeamPage>(`/club/teams/${c1.id}`, player.token);
      expect(youth.players).toBeNull();
      expect(youth.playerCount).toBeGreaterThan(10);
      const seniors = await get<ClubTeamPage>(`/club/teams/${first.id}`, player.token);
      expect(seniors.players!.length).toBeGreaterThan(10);
      expect(JSON.stringify(seniors)).not.toMatch(/@|phone/);
    });

    it('Startseite: Geburtstage der Mannschaft und Anwesenheit als offene Aktion', async () => {
      const player = await login('spieler');
      const home = await get<HomeResponse>('/home', player.token);
      const soon = home.birthdays.find((b) => b.teamBadge === 'B1' && b.inDays === 2);
      expect(soon).toBeDefined();
      expect(soon!.day).toMatch(/^\d{2}\.\d{2}\.$/);
      expect(home.birthdays.every((b) => b.inDays >= 0 && b.inDays <= 7)).toBe(true);

      const coach = await login('trainer');
      const coachHome = await get<HomeResponse>('/home', coach.token);
      expect(coachHome.actions.some((a) => a.title === 'Anwesenheit erfassen')).toBe(true);
      expect(home.actions.some((a) => a.title === 'Anwesenheit erfassen')).toBe(false);
    });

    it('Mannschaften, Ansprechpartner und „Heute auf der Anlage“', async () => {
      const { token } = await login('spieler');
      const groups = await get<ClubTeamGroup[]>('/club/teams', token);
      expect(groups.map((g) => g.orgUnit.name)).toEqual([
        'Senioren',
        'Alte Herren',
        'Frauen & Mädchen',
        'Jugend',
      ]);
      const b1 = groups.flatMap((g) => g.teams).find((t) => t.badge === 'B1')!;
      expect(b1).toMatchObject({ isMine: true, players: 20 });
      expect(b1.coaches).toContain('Max Mustermann');

      const contacts = await get<ContactGroup[]>('/club/contacts', token);
      const board = contacts.find((g) => g.title.startsWith('Vorstand'))!;
      expect(
        board.contacts.some(
          (c) => c.name === 'Sandra Hoffmann' && c.functions.includes('Vorstand'),
        ),
      ).toBe(true);
      const coaches = contacts.find((g) => g.title.startsWith('Trainer'))!;
      const own = coaches.contacts.find((c) => c.name === 'Max Mustermann')!;
      expect(own.email).not.toBeNull(); // eigener Trainer
      const foreign = coaches.contacts.find((c) => c.functions.some((f) => f.endsWith(' 1.')))!;
      expect(foreign.email).toBeNull(); // fremder Trainer ohne vereinsweite Freigabe

      const today = await get<EventSummary[]>('/club/today', token);
      expect(today.length).toBeGreaterThan(0);
      expect(today.every((e) => e.location !== null)).toBe(true);
    });
  });
  describe('Profile', () => {
    const personId = async (first: string, last: string) => {
      const [row] =
        await sql`select id from persons where first_name = ${first} and last_name = ${last}`;
      return row!.id as string;
    };

    it('eigenes Profil mit Saisonwerten und Bearbeitungsrecht', async () => {
      const { token, me } = await login('spieler');
      const profile = await get<PersonProfile>(`/persons/${me.person.id}`, token);
      expect(profile).toMatchObject({
        relation: 'self',
        canEdit: true,
        position: 'Zentrales Mittelfeld',
      });
      expect(profile.teams[0]).toMatchObject({ badge: 'B1', jerseyNumber: 14 });
      expect(profile.stats!.trainings).toBeGreaterThan(5);
      expect(profile.contactVisibility).toBe('team_and_coaches');
    });

    it('Mitspieler sehen Position, aber weder Statistik noch Verfügbarkeitsgrund', async () => {
      const { token } = await login('spieler');
      const sick = await sql`
        select p.id from persons p join absences a on a.person_id = p.id
        join team_memberships tm on tm.person_id = p.id join teams t on t.id = tm.team_id
        where t.badge = 'B1' and a.kind = 'illness' limit 1`;
      const mate = await get<PersonProfile>(`/persons/${sick[0]!.id}`, token);
      expect(mate.relation).toBe('other');
      expect(mate.stats).toBeNull();
      expect(mate.canEdit).toBe(false);
      expect(mate.contactVisibility).toBeNull();
      expect(mate.availability.available).toBe(false);
      expect(mate.availability.reason).toBeNull();

      const asCoach = await get<PersonProfile>(
        `/persons/${sick[0]!.id}`,
        (await login('trainer')).token,
      );
      expect(asCoach.availability.reason).toBe('Krank');
      expect(asCoach.stats).not.toBeNull();
    });

    it('Personen ohne Bezug sind nicht sichtbar', async () => {
      const stranger = await personId('Thomas', 'Becker'); // Trainer der 1. Mannschaft
      const res = await app.inject({
        method: 'GET',
        url: `/persons/${stranger}`,
        headers: { authorization: `Bearer ${(await login('spieler')).token}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Kontaktdaten richten sich nach der Einstellung der Person', async () => {
      const player = await login('spieler');
      const parent = await login('eltern');
      const board = await login('vorstand');
      const target = player.me.person.id;
      await send('PATCH', `/persons/${target}`, player.token, {
        phone: '0151 1234567',
        contactVisibility: 'coaches_only',
      });

      // Julia ist Trainerin der E-Jugend, aber nicht der B-Jugend und kein Mitspieler
      const forParent = await app.inject({
        method: 'GET',
        url: `/persons/${target}`,
        headers: { authorization: `Bearer ${parent.token}` },
      });
      expect(forParent.statusCode).toBe(404);

      // Vorstand mit Mitgliederrechten sieht Kontaktdaten immer
      expect((await get<PersonProfile>(`/persons/${target}`, board.token)).contact?.phone).toBe(
        '0151 1234567',
      );
      // Das Trainerteam der B-Jugend sieht sie ebenfalls
      const asCoach = await get<PersonProfile>(
        `/persons/${target}`,
        (await login('trainer')).token,
      );
      expect(asCoach.contact?.phone).toBe('0151 1234567');

      await send('PATCH', `/persons/${target}`, player.token, { contactVisibility: 'club' });
      const open = await get<PersonProfile>(`/persons/${target}`, board.token);
      expect(open.contact?.phone).toBe('0151 1234567');
      const own = await get<PersonProfile>(`/persons/${target}`, player.token);
      expect(own.contactVisibility).toBe('club');
    });

    it('Eltern bearbeiten das Profil ihres Kindes, aber nicht das anderer', async () => {
      const parent = await login('eltern');
      const leon = parent.me.managedPersons.find((p) => p.firstName === 'Leon')!;
      const ok = await send<PersonProfile>('PATCH', `/persons/${leon.id}`, parent.token, {
        position: 'Torwart',
        preferredFoot: 'left',
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({
        relation: 'child',
        position: 'Torwart',
        preferredFoot: 'left',
      });

      const player = await login('spieler');
      const denied = await send('PATCH', `/persons/${player.me.person.id}`, parent.token, {
        position: 'Sturm',
      });
      expect(denied.status).toBe(404);
      const invalid = await send('PATCH', `/persons/${leon.id}`, parent.token, {
        position: 'Zauberer',
      });
      expect(invalid.status).toBe(400);
    });
  });
  describe('Gastspielerbörse', () => {
    const name = (o: ExchangeOverview, badge: string) =>
      o.demands.find((d) => d.team.badge === badge)!;

    it('ist nur für Trainerteams und sportliche Leitung offen', async () => {
      for (const who of ['spieler', 'vorstand']) {
        const res = await app.inject({
          method: 'GET',
          url: '/exchange',
          headers: { authorization: `Bearer ${(await login(who)).token}` },
        });
        expect(res.statusCode).toBe(403);
      }
      const coach = await login('trainer');
      const overview = await get<ExchangeOverview>('/exchange', coach.token);
      expect(overview.myTeams.map((t) => t.badge).sort()).toEqual(['B1', 'C1']);
      expect(name(overview, 'B1')).toMatchObject({ mine: true, canNominate: false });
      expect(name(overview, 'A1')).toMatchObject({
        mine: false,
        canNominate: true,
        status: 'open',
      });
      expect(overview.offers.some((o) => o.mine && o.team.badge === 'C1')).toBe(true);
    });

    it('zeigt Verfügbarkeit anderer Mannschaften nur aggregiert, ohne Gründe', async () => {
      const coach = await login('trainer');
      const overview = await get<ExchangeOverview>('/exchange', coach.token);
      const detail = await get<DemandDetail>(
        `/exchange/demands/${name(overview, 'A1').id}`,
        coach.token,
      );
      expect(detail.candidates.map((c) => c.team.badge).sort()).toEqual(['B1', 'C1']);
      for (const a of detail.availability) {
        expect(Object.keys(a).sort()).toEqual(['available', 'players', 'team']);
      }
      expect(JSON.stringify(detail.availability)).not.toMatch(/Urlaub|Krank|Verletzt/);
    });

    it('nominiert Spieler, achtet auf Kapazität und lässt sie zurückziehen', async () => {
      const coach = await login('trainer');
      const overview = await get<ExchangeOverview>('/exchange', coach.token);
      const demand = name(overview, 'A1');
      const detail = await get<DemandDetail>(`/exchange/demands/${demand.id}`, coach.token);
      const b1 = detail.candidates.find((c) => c.team.badge === 'B1')!;
      const free = b1.players.filter((p) => p.state === 'available');
      expect(free.length).toBeGreaterThanOrEqual(3);

      const first = await send<DemandDetail>(
        'POST',
        `/exchange/demands/${demand.id}/nominate`,
        coach.token,
        {
          personId: free[0]!.personId,
          fromTeamId: b1.team.id,
        },
      );
      expect(first.status).toBe(200);
      expect(first.body.filled).toBe(1);
      expect(first.body.guests.map((g) => g.personId)).toContain(free[0]!.personId);

      const dup = await send('POST', `/exchange/demands/${demand.id}/nominate`, coach.token, {
        personId: free[0]!.personId,
        fromTeamId: b1.team.id,
      });
      expect(dup.status).toBe(409);

      const second = await send<DemandDetail>(
        'POST',
        `/exchange/demands/${demand.id}/nominate`,
        coach.token,
        {
          personId: free[1]!.personId,
          fromTeamId: b1.team.id,
        },
      );
      expect(second.body.status).toBe('fulfilled');
      const third = await send('POST', `/exchange/demands/${demand.id}/nominate`, coach.token, {
        personId: free[2]!.personId,
        fromTeamId: b1.team.id,
      });
      expect(third.status).toBe(409);

      const back = await send<DemandDetail>(
        'DELETE',
        `/exchange/demands/${demand.id}/nominations/${free[1]!.personId}`,
        coach.token,
      );
      expect(back.status).toBe(200);
      expect(back.body.filled).toBe(1);
    });

    it('verbietet Spieler fremder Mannschaften und eigene Mannschaft als Quelle', async () => {
      const coach = await login('trainer');
      const overview = await get<ExchangeOverview>('/exchange', coach.token);
      const a1 = name(overview, 'A1');
      const res = await send('POST', `/exchange/demands/${a1.id}/nominate`, coach.token, {
        personId: coach.me.person.id,
        fromTeamId: a1.team.id,
      });
      expect(res.status).toBe(403);
    });

    it('meldet Bedarf nur für eigene Termine, einmal je Termin', async () => {
      const coach = await login('trainer');
      const overview = await get<ExchangeOverview>('/exchange', coach.token);
      const b1 = overview.myTeams.find((t) => t.badge === 'B1')!;
      const week = (await get<TeamOverview>(`/teams/${b1.id}`, coach.token)).trainingWeek.filter(
        (e) => e.status === 'scheduled' && new Date(e.startsAt) > NOW,
      );
      const training = week[0]!;
      const created = await send<DemandDetail>('POST', '/exchange/demands', coach.token, {
        teamId: b1.id,
        eventId: training.id,
        count: 1,
        positions: ['Torwart'],
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const again = await send('POST', '/exchange/demands', coach.token, {
        teamId: b1.id,
        eventId: training.id,
        count: 1,
      });
      expect(again.status).toBe(409);
      const other = name(overview, 'A1');
      const foreign = await send('POST', '/exchange/demands', coach.token, {
        teamId: other.team.id,
        eventId: other.event.id,
        count: 1,
      });
      expect(foreign.status).toBe(403);
      const cancelled = await send('DELETE', `/exchange/demands/${created.body.id}`, coach.token);
      expect(cancelled.status).toBe(204);
    });

    it('legt Angebote an und löscht sie', async () => {
      const coach = await login('trainer');
      const overview = await get<ExchangeOverview>('/exchange', coach.token);
      const c1 = overview.myTeams.find((t) => t.badge === 'C1')!;
      const made = await send<ExchangeOverview>('POST', '/exchange/offers', coach.token, {
        teamId: c1.id,
        day: '2026-10-12',
        count: 2,
      });
      expect(made.status).toBe(201);
      const mine = made.body.offers.find((o) => o.mine && o.day === '2026-10-12')!;
      const past = await send('POST', '/exchange/offers', coach.token, {
        teamId: c1.id,
        day: '2026-10-01',
        count: 1,
      });
      expect(past.status).toBe(400);
      const del = await send<ExchangeOverview>(
        'DELETE',
        `/exchange/offers/${mine.id}`,
        coach.token,
      );
      expect(del.body.offers.some((o) => o.id === mine.id)).toBe(false);
    });
  });
  describe('Platzbelegung', () => {
    const week = '/facilities/occupancy?from=2026-10-05&to=2026-10-11';

    it('ist nur für Trainerteams und Platzverantwortliche sichtbar', async () => {
      const denied = await app.inject({
        method: 'GET',
        url: week,
        headers: { authorization: `Bearer ${(await login('spieler')).token}` },
      });
      expect(denied.statusCode).toBe(403);
      const coach = await get<FacilityOccupancy>(week, (await login('trainer')).token);
      expect(coach.canManage).toBe(false);
      const admin = await get<FacilityOccupancy>(week, (await login('admin')).token);
      expect(admin.canManage).toBe(true);
    });

    it('zeigt Belegung und Sperrung ohne Konflikte im Demobestand', async () => {
      const occ = await get<FacilityOccupancy>(week, (await login('trainer')).token);
      expect(occ.conflicts).toBe(0);
      const kunstrasen = occ.facilities.find((f) => f.facility.name.includes('Kunstrasen'))!;
      expect(kunstrasen.bookings.some((b) => b.kind === 'block')).toBe(true);
      expect(kunstrasen.bookings.some((b) => b.kind === 'event' && b.cancelled)).toBe(true);
      const tooLong = await app.inject({
        method: 'GET',
        url: '/facilities/occupancy?from=2026-10-01&to=2026-12-31',
        headers: { authorization: `Bearer ${(await login('trainer')).token}` },
      });
      expect(tooLong.statusCode).toBe(400);
    });

    it('warnt beim Anlegen vor Sperrung und Doppelbelegung', async () => {
      const coach = await login('trainer');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const occ = await get<FacilityOccupancy>(week, coach.token);
      const kunstrasen = occ.facilities.find((f) => f.facility.name.includes('Kunstrasen'))!;
      const block = kunstrasen.bookings.find((b) => b.kind === 'block')!;
      const blocked = await send<{ error: string }>('POST', `/teams/${b1.id}/events`, coach.token, {
        type: 'training',
        startsAt: new Date(new Date(block.startsAt).getTime() + 10 * 3_600_000).toISOString(),
        facilityId: kunstrasen.facility.id,
        allowConflict: true,
      });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error).toBe('facility_blocked');

      const rasen = occ.facilities.find(
        (f) => f.facility.name.includes('Rasen') && !f.facility.name.includes('Kunst'),
      )!;
      const taken = rasen.bookings.find((b) => b.kind === 'event' && !b.cancelled)!;
      const payload = {
        type: 'team_event',
        title: 'Zusatzspiel',
        startsAt: taken.startsAt,
        facilityId: rasen.facility.id,
      };
      const clash = await send<{ error: string }>(
        'POST',
        `/teams/${b1.id}/events`,
        coach.token,
        payload,
      );
      expect(clash.status).toBe(409);
      expect(clash.body.error).toBe('facility_conflict');
      const forced = await send('POST', `/teams/${b1.id}/events`, coach.token, {
        ...payload,
        allowConflict: true,
      });
      expect(forced.status).toBe(201);
      const after = await get<FacilityOccupancy>(week, coach.token);
      expect(after.conflicts).toBeGreaterThanOrEqual(2);
    });

    it('Platzverantwortliche sperren und heben auf, auf Wunsch mit Absage der Termine', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const occ = await get<FacilityOccupancy>(week, admin.token);
      const facility = occ.facilities.find((f) =>
        f.bookings.some((b) => b.kind === 'event' && !b.cancelled),
      )!;
      const event = facility.bookings.find((b) => b.kind === 'event' && !b.cancelled)!;

      const forbiddenRes = await send('POST', '/facilities/blocks', coach.token, {
        facilityId: facility.facility.id,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        reason: 'Test',
      });
      expect(forbiddenRes.status).toBe(403);

      const created = await send<FacilityOccupancy>('POST', '/facilities/blocks', admin.token, {
        facilityId: facility.facility.id,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        reason: 'Wasserschaden',
        cancelEvents: true,
      });
      expect(created.status).toBe(201);
      const f = created.body.facilities.find((x) => x.facility.id === facility.facility.id)!;
      expect(f.bookings.find((b) => b.id === event.id)?.cancelled).toBe(true);
      const block = f.bookings.find((b) => b.kind === 'block' && b.title === 'Wasserschaden')!;

      const removed = await send('DELETE', `/facilities/blocks/${block.id}`, admin.token);
      expect(removed.status).toBe(204);
    });
  });
  describe('Termine ändern und Serien', () => {
    const range = `from=${encodeURIComponent('2026-10-06T00:00:00Z')}&to=${encodeURIComponent('2027-02-01T00:00:00Z')}`;

    it('legt Serientermine an, ändert einen oder alle folgenden und zeigt alt/neu', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;

      const created = await send<EventDetail>('POST', `/teams/${b1.id}/events`, coach.token, {
        type: 'team_event',
        title: 'Serien-Test',
        startsAt: '2026-10-14T18:30:00Z',
        meetingPoint: 'Parkplatz',
        locationText: 'Stadtpark',
        repeatWeeks: 4,
      });
      expect(created.status).toBe(201);
      expect(created.body.edit?.seriesFollowing).toBe(3);

      const list = (await get<EventSummary[]>(`/events?${range}`, coach.token))
        .filter((e) => e.title === 'Serien-Test')
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      expect(list).toHaveLength(4);

      // nur dieser Termin: Treffpunkt
      const single = await send<EventDetail>('PATCH', `/events/${list[0]!.id}`, coach.token, {
        meetingPoint: 'Haupteingang',
      });
      expect(single.status).toBe(200);
      expect(single.body.lastChange?.items).toEqual([
        { label: 'Treffpunkt', from: 'Parkplatz', to: 'Haupteingang' },
      ]);
      const second = await get<EventDetail>(`/events/${list[1]!.id}`, coach.token);
      expect(second.meetingPoint).toBe('Parkplatz');

      // alle folgenden: eine Stunde später (gleiche Ortszeit, auch nach der Zeitumstellung)
      const following = await send<EventDetail>('PATCH', `/events/${list[1]!.id}`, coach.token, {
        startsAt: '2026-10-21T19:30:00Z',
        scope: 'following',
      });
      expect(following.status).toBe(200);
      const after = (await get<EventSummary[]>(`/events?${range}`, coach.token))
        .filter((e) => e.title === 'Serien-Test')
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      expect(after[0]!.startsAt).toBe('2026-10-14T18:30:00.000Z');
      expect(after[1]!.startsAt).toBe('2026-10-21T19:30:00.000Z');
      expect(after[2]!.startsAt).toBe('2026-10-28T20:30:00.000Z');
      expect(after[3]!.startsAt).toBe('2026-11-04T20:30:00.000Z');

      // Spieler wurde benachrichtigt, mit alt → neu
      const notes = await get<NotificationItem[]>('/notifications', player.token);
      const hint = notes.find((n) => n.title === 'Geändert: Serien-Test');
      expect(hint?.body).toContain('→');
    });

    it('prüft Rechte, abgesagte Termine und Platzkonflikte', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const events = (await get<EventSummary[]>(`/events?${range}`, coach.token)).filter(
        (e) => e.title === 'Serien-Test',
      );
      const target = events[0]!;
      const denied = await send('PATCH', `/events/${target.id}`, player.token, { title: 'X' });
      expect(denied.status).toBe(403);

      const occ = await get<FacilityOccupancy>(
        '/facilities/occupancy?from=2026-10-06&to=2026-10-06',
        coach.token,
      );
      const taken = occ.facilities
        .flatMap((f) => f.bookings.map((b) => ({ f, b })))
        .find(({ b }) => b.kind === 'event' && !b.cancelled)!;
      const clash = await send<{ error: string }>('PATCH', `/events/${target.id}`, coach.token, {
        startsAt: taken.b.startsAt,
        facilityId: taken.f.facility.id,
      });
      expect(clash.status).toBe(409);
      expect(clash.body.error).toBe('facility_conflict');

      const noop = await send<EventDetail>('PATCH', `/events/${target.id}`, coach.token, {
        title: 'Serien-Test',
      });
      expect(noop.status).toBe(200);

      await send('POST', `/events/${target.id}/cancel`, coach.token, { reason: 'Test' });
      const closed = await send('PATCH', `/events/${target.id}`, coach.token, { title: 'Neu' });
      expect(closed.status).toBe(409);
      void b1;
    });
  });
  describe('Verwaltung', () => {
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });

    it('ist nur für Berechtigte offen, der Vorstand liest nur', async () => {
      for (const who of ['spieler', 'trainer']) {
        const token = (await login(who)).token;
        for (const url of ['/admin/overview', '/admin/members', '/admin/audit']) {
          const res = await app.inject({ method: 'GET', url, headers: auth(token) });
          expect(res.statusCode, `${who} ${url}`).toBe(403);
        }
      }
      const board = await login('vorstand');
      expect(board.me.admin).toEqual({
        readMembers: true,
        manageMembers: false,
        manageRoles: false,
        readAudit: true,
        manageModules: false,
        manageTeams: false,
        planSeason: false,
        manageTransfers: false,
        planEvents: true,
      });
      const overview = await get<AdminOverview>('/admin/overview', board.token);
      expect(overview.members.active).toBeGreaterThan(100);
      const members = await get<MemberListItem[]>('/admin/members?q=becker', board.token);
      expect(members.some((m) => m.firstName === 'Max' && m.lastName === 'Becker')).toBe(true);

      const target = members[0]!;
      const edit = await send('PATCH', `/admin/members/${target.id}`, board.token, { phone: '1' });
      expect(edit.status).toBe(403);
      const role = await send('POST', `/admin/members/${target.id}/roles`, board.token, {
        roleKey: 'treasurer',
        scopeType: 'club',
      });
      expect(role.status).toBe(403);
    });

    it('vergibt Kassenwart als Zusatzaufgabe für eine Mannschaft', async () => {
      const admin = await login('admin');
      const player = await login('spieler');
      const b1 = player.me.teams.find((t) => t.badge === 'B1')!;
      const before = await get<TeamOverview>(`/teams/${b1.id}`, player.token);
      expect(before.permissions.manageCash).toBe(false);

      const assigned = await send<MemberDetail>(
        'POST',
        `/admin/members/${player.me.person.id}/roles`,
        admin.token,
        { roleKey: 'treasurer', scopeType: 'team', scopeId: b1.id },
      );
      expect(assigned.status).toBe(200);
      const role = assigned.body.roles.find((r) => r.roleKey === 'treasurer')!;
      expect(role.scopeLabel).toContain('B1');
      const dup = await send('POST', `/admin/members/${player.me.person.id}/roles`, admin.token, {
        roleKey: 'treasurer',
        scopeType: 'team',
        scopeId: b1.id,
      });
      expect(dup.status).toBe(409);

      const after = await get<TeamOverview>(`/teams/${b1.id}`, player.token);
      expect(after.permissions.manageCash).toBe(true);
      // Gilt nur für B1, nicht für andere Mannschaften
      const c1 = (await login('trainer')).me.teams.find((t) => t.badge === 'C1')!;
      const foreignCash = await send('POST', `/teams/${c1.id}/cash/bookings`, player.token, {
        kind: 'income',
        amountCents: 100,
        description: 'Test',
      });
      expect([403, 404]).toContain(foreignCash.status);

      const revoked = await send<MemberDetail>(
        'DELETE',
        `/admin/members/${player.me.person.id}/roles/${role.id}`,
        admin.token,
      );
      expect(revoked.body.roles.some((r) => r.roleKey === 'treasurer')).toBe(false);
      expect(
        (await get<TeamOverview>(`/teams/${b1.id}`, player.token)).permissions.manageCash,
      ).toBe(false);

      const audit = await get<AuditEntry[]>('/admin/audit', (await login('vorstand')).token);
      expect(audit.some((a) => a.label.startsWith('Rolle vergeben: Kassenwart'))).toBe(true);
      expect(audit.some((a) => a.label.startsWith('Rolle entzogen: Kassenwart'))).toBe(true);
    });

    it('Jugendleitung sieht nur Mitglieder ihres Bereichs', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const catalog = await get<RoleCatalog>('/admin/roles', admin.token);
      const youth = catalog.scopes.find((sc) => sc.type === 'org_unit' && /Jugend/.test(sc.label))!;
      const assigned = await send<MemberDetail>(
        'POST',
        `/admin/members/${coach.me.person.id}/roles`,
        admin.token,
        { roleKey: 'youth_director', scopeType: 'org_unit', scopeId: youth.id },
      );
      expect(assigned.status).toBe(200);

      const all = await get<MemberListItem[]>('/admin/members', admin.token);
      const scoped = await get<MemberListItem[]>('/admin/members', coach.token);
      expect(scoped.length).toBeGreaterThan(20);
      expect(scoped.length).toBeLessThan(all.length);
      const firstTeamOnly = all.find(
        (m) => m.teams.length > 0 && m.teams.every((t) => t.badge === '1.'),
      )!;
      expect(scoped.some((m) => m.id === firstTeamOnly.id)).toBe(false);
      const hidden = await app.inject({
        method: 'GET',
        url: `/admin/members/${firstTeamOnly.id}`,
        headers: auth(coach.token),
      });
      expect(hidden.statusCode).toBe(404);
      // Lesen ja, ändern nein
      const edit = await send('PATCH', `/admin/members/${scoped[0]!.id}`, coach.token, {
        phone: '1',
      });
      expect(edit.status).toBe(403);

      const role = assigned.body.roles.find((r) => r.roleKey === 'youth_director')!;
      await send('DELETE', `/admin/members/${coach.me.person.id}/roles/${role.id}`, admin.token);
    });

    it('verhindert Rechteausweitung und das Aussperren', async () => {
      const admin = await login('admin');
      const board = await login('vorstand');
      // Vorstand erhält testweise nur das Recht, Rollen zu vergeben
      const [custom] = await db
        .insert(s.roles)
        .values({
          clubId: admin.me.club.id,
          key: 'role_manager_test',
          name: 'Rollenvergabe (Test)',
          permissions: ['club.roles.manage'],
        })
        .returning();
      await db.insert(s.roleAssignments).values({
        clubId: admin.me.club.id,
        personId: board.me.person.id,
        roleId: custom!.id,
        scopeType: 'club',
      });
      const player = await login('spieler');
      for (const roleKey of ['fulladmin', 'treasurer']) {
        const res = await send('POST', `/admin/members/${player.me.person.id}/roles`, board.token, {
          roleKey,
          scopeType: 'club',
        });
        expect(res.status, roleKey).toBe(403);
      }
      await db.delete(s.roles).where(eq(s.roles.id, custom!.id));

      // Der einzige Fulladmin kann sich nicht selbst entfernen
      const self = await get<MemberDetail>(`/admin/members/${admin.me.person.id}`, admin.token);
      const fulladmin = self.roles.find((r) => r.roleKey === 'fulladmin')!;
      const res = await send(
        'DELETE',
        `/admin/members/${admin.me.person.id}/roles/${fulladmin.id}`,
        admin.token,
      );
      expect(res.status).toBe(409);
      const scope = await send('POST', `/admin/members/${player.me.person.id}/roles`, admin.token, {
        roleKey: 'fulladmin',
        scopeType: 'team',
        scopeId: player.me.teams[0]!.id,
      });
      expect(scope.status).toBe(400);
    });

    it('legt Mitglieder an, ordnet sie Mannschaften zu und beendet die Zuordnung', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const created = await send<MemberDetail>('POST', '/admin/members', admin.token, {
        firstName: 'Neu',
        lastName: 'Zugang',
        birthDate: '2010-03-01',
        email: 'NEU@example.org',
      });
      expect(created.status).toBe(201);
      expect(created.body.email).toBe('neu@example.org');
      const id = created.body.id;

      const added = await send<MemberDetail>(
        'POST',
        `/admin/members/${id}/memberships`,
        admin.token,
        {
          teamId: b1.id,
          function: 'player',
          jerseyNumber: 33,
        },
      );
      expect(added.status).toBe(200);
      expect(added.body.memberships[0]).toMatchObject({ function: 'player', jerseyNumber: 33 });
      const again = await send('POST', `/admin/members/${id}/memberships`, admin.token, {
        teamId: b1.id,
        function: 'player',
      });
      expect(again.status).toBe(409);

      const roster = await get<RosterEntry[]>(`/teams/${b1.id}/roster`, coach.token);
      expect(roster.some((r) => r.personId === id)).toBe(true);
      const next = (await get<TeamOverview>(`/teams/${b1.id}`, coach.token)).nextEvent!;
      const detail = await get<EventDetail>(`/events/${next.id}`, coach.token);
      expect(detail.participants.some((p) => p.personId === id)).toBe(true);

      const ended = await send<MemberDetail>(
        'DELETE',
        `/admin/members/${id}/memberships/${added.body.memberships[0]!.id}`,
        admin.token,
      );
      expect(ended.body.memberships).toHaveLength(0);
      const afterDetail = await get<EventDetail>(`/events/${next.id}`, coach.token);
      expect(afterDetail.participants.some((p) => p.personId === id)).toBe(false);
      const withoutTeam = await get<MemberListItem[]>(
        '/admin/members?withoutTeam=true',
        admin.token,
      );
      expect(withoutTeam.some((m) => m.id === id)).toBe(true);
    });

    it('Austritt beendet Mannschaften, Aufgaben und Anmeldung', async () => {
      const admin = await login('admin');
      const treasurer = await login('kasse');
      const id = treasurer.me.person.id;
      const selfExit = await send('PATCH', `/admin/members/${admin.me.person.id}`, admin.token, {
        status: 'left',
      });
      expect(selfExit.status).toBe(409);

      const left = await send<MemberDetail>('PATCH', `/admin/members/${id}`, admin.token, {
        status: 'left',
      });
      expect(left.status).toBe(200);
      expect(left.body.roles).toHaveLength(0);
      expect(left.body.memberships).toHaveLength(0);
      const me = await app.inject({ method: 'GET', url: '/me', headers: auth(treasurer.token) });
      expect(me.statusCode).toBe(401);
      const relogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: email('kasse'), password: PASSWORD },
      });
      expect(relogin.statusCode).toBe(403);
      const [account] = await db.select().from(s.persons).where(eq(s.persons.id, id));
      const sessions = await db
        .select()
        .from(s.sessions)
        .where(eq(s.sessions.userId, account!.userId!));
      expect(sessions).toHaveLength(0);
      const audit = await get<AuditEntry[]>('/admin/audit', admin.token);
      expect(audit.some((a) => a.label.includes('ist jetzt ausgetreten'))).toBe(true);
    });
  });
  describe('News-Redaktion', () => {
    const draft = (teamId: string, action: string, title = 'B1 gewinnt Hallenturnier') => ({
      title,
      teaser: 'Starker Auftritt in Sonnenberg.',
      body: 'Unsere B-Jugend hat das Hallenturnier ohne Gegentor gewonnen.',
      priority: 'info',
      scopeType: 'team',
      scopeId: teamId,
      action,
    });

    it('Trainer veröffentlichen News für ihre Mannschaft ohne Freigabe', async () => {
      const spieler = await login('spieler');
      const denied = await app.inject({
        method: 'GET',
        url: '/editorial/news',
        headers: { authorization: `Bearer ${spieler.token}` },
      });
      expect(denied.statusCode).toBe(403);

      const coach = await login('trainer');
      expect(coach.me.news).toEqual({ write: true, publish: true });
      const overview = await get<EditorialOverview>('/editorial/news', coach.token);
      expect(overview.scopes.map((sc) => sc.label).sort()).toEqual([
        'B1 · B-Jugend',
        'C1 · C-Jugend',
      ]);
      expect(overview.scopes.every((sc) => sc.canPublish)).toBe(true);
      expect(overview.mine.map((n) => n.status)).toEqual(['draft']);

      const b1 = overview.scopes.find((sc) => sc.label.startsWith('B1'))!;
      const direct = await send<EditorialNews>(
        'POST',
        '/editorial/news',
        coach.token,
        draft(b1.id!, 'publish'),
      );
      expect(direct.status).toBe(201);
      expect(direct.body.status).toBe('published');
      // Lesebestätigung: zunächst niemand, nach dem Öffnen der Spieler
      const before = await get<NewsReadReceipt>(
        `/editorial/news/${direct.body.id}/reads`,
        coach.token,
      );
      expect(before.read).toBe(0);
      expect(before.unread).toContain('Max Becker');
      await get(`/news/${direct.body.id}`, spieler.token);
      const after = await get<NewsReadReceipt>(
        `/editorial/news/${direct.body.id}/reads`,
        coach.token,
      );
      expect(after.read).toBe(1);
      expect(after.unread).not.toContain('Max Becker');
      expect(after.audience).toBe(before.audience);
      // Sichtbar für die B-Jugend, nicht für andere Mannschaften
      expect(
        (await get<NewsItem[]>('/news', spieler.token)).some((n) => n.id === direct.body.id),
      ).toBe(true);
      const parentNews = await get<NewsItem[]>('/news', (await login('eltern')).token);
      expect(parentNews.some((n) => n.id === direct.body.id)).toBe(false);
      expect((await send('DELETE', `/editorial/news/${direct.body.id}`, coach.token)).status).toBe(
        204,
      );

      // Vereinsnews bleiben dem Vorstand vorbehalten
      const club = await send('POST', '/editorial/news', coach.token, {
        ...draft(b1.id!, 'submit'),
        scopeType: 'club',
        scopeId: null,
      });
      expect(club.status).toBe(403);
    });

    it('Freigabe mit Rückgabe, Überarbeitung und Veröffentlichung', async () => {
      // Platzverantwortliche schreiben Vereinsnews, brauchen aber eine Freigabe
      const admin = await login('admin');
      const board = await login('vorstand');
      const writer = await login('spieler');
      const assigned = await send<MemberDetail>(
        'POST',
        `/admin/members/${writer.me.person.id}/roles`,
        admin.token,
        { roleKey: 'facility_manager', scopeType: 'club' },
      );
      const role = assigned.body.roles.find((r) => r.roleKey === 'facility_manager')!;
      const clubDraft = (action: string) => ({
        ...draft('', action),
        title: 'Platzsperre Kunstrasen',
        scopeType: 'club',
        scopeId: null,
      });
      expect(
        (await send('POST', '/editorial/news', writer.token, clubDraft('publish'))).status,
      ).toBe(403);

      const submitted = await send<EditorialNews>(
        'POST',
        '/editorial/news',
        writer.token,
        clubDraft('submit'),
      );
      expect(submitted.status).toBe(201);
      expect(submitted.body.status).toBe('pending_approval');
      const id = submitted.body.id;

      // Vorstand wird benachrichtigt und sieht die Einreichung
      const boardNotes = await get<NotificationItem[]>('/notifications', board.token);
      expect(boardNotes.some((n) => n.link === `/admin/news/${id}`)).toBe(true);
      const queue = await get<EditorialOverview>('/editorial/news', board.token);
      expect(queue.toApprove.some((n) => n.id === id)).toBe(true);
      // Autor kann nicht selbst freigeben, Trainer auch nicht (nur Team-News)
      expect((await send('POST', `/editorial/news/${id}/approve`, writer.token)).status).toBe(403);
      expect(
        (await send('POST', `/editorial/news/${id}/approve`, (await login('trainer')).token))
          .status,
      ).not.toBe(200);

      const rejected = await send<EditorialNews>(
        'POST',
        `/editorial/news/${id}/reject`,
        board.token,
        { note: 'Bitte den Zeitraum ergänzen.' },
      );
      expect(rejected.body).toMatchObject({
        status: 'draft',
        reviewNote: 'Bitte den Zeitraum ergänzen.',
      });
      const writerNotes = await get<NotificationItem[]>('/notifications', writer.token);
      expect(writerNotes.some((n) => n.title === 'News zurückgegeben')).toBe(true);

      const resubmitted = await send<EditorialNews>('PUT', `/editorial/news/${id}`, writer.token, {
        ...clubDraft('submit'),
        body: 'Der Kunstrasen ist vom 12. bis 14.10. gesperrt.',
      });
      expect(resubmitted.body.status).toBe('pending_approval');
      expect(resubmitted.body.reviewNote).toBeNull();

      const approved = await send<EditorialNews>(
        'POST',
        `/editorial/news/${id}/approve`,
        board.token,
      );
      expect(approved.body.status).toBe('published');
      const parentNews = await get<NewsItem[]>('/news', (await login('eltern')).token);
      expect(parentNews.some((n) => n.id === id)).toBe(true);

      // Nach der Veröffentlichung darf der Autor nicht mehr ändern, der Vorstand zieht zurück
      const late = await send('PUT', `/editorial/news/${id}`, writer.token, clubDraft('draft'));
      expect(late.status).toBe(403);
      expect((await send('DELETE', `/editorial/news/${id}`, board.token)).status).toBe(204);
      await send('DELETE', `/admin/members/${writer.me.person.id}/roles/${role.id}`, admin.token);
    });

    it('dringende Vereinsnews benachrichtigt alle, fremde Entwürfe bleiben privat', async () => {
      const board = await login('vorstand');
      const coach = await login('trainer');
      const urgent = await send<EditorialNews>('POST', '/editorial/news', board.token, {
        title: 'Heimspiel verlegt',
        teaser: 'Wegen Unwetter auf Sonntag.',
        body: 'Das Heimspiel der 1. Mannschaft findet am Sonntag um 15 Uhr statt.',
        priority: 'urgent',
        scopeType: 'club',
        scopeId: null,
        action: 'publish',
      });
      expect(urgent.body.status).toBe('published');
      const parentNotes = await get<NotificationItem[]>(
        '/notifications',
        (await login('eltern')).token,
      );
      expect(parentNotes.some((n) => n.title === 'Heimspiel verlegt' && n.level === 'urgent')).toBe(
        true,
      );

      const privateDraft = await send<EditorialNews>('POST', '/editorial/news', board.token, {
        title: 'Entwurf Jahreshauptversammlung',
        body: 'Noch nicht fertig.',
        priority: 'info',
        scopeType: 'club',
        action: 'draft',
      });
      const peek = await app.inject({
        method: 'GET',
        url: `/editorial/news/${privateDraft.body.id}`,
        headers: { authorization: `Bearer ${coach.token}` },
      });
      expect(peek.statusCode).toBe(404);
      expect(
        (await send('DELETE', `/editorial/news/${privateDraft.body.id}`, coach.token)).status,
      ).toBe(404);
    });
  });
  describe('Dokumente, Bilder und Umfragen erstellen', () => {
    const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');
    const pdf = b64('%PDF-1.4\n% Beitragsordnung Test\n%%EOF\n');
    const png = b64(
      Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(64, 1),
      ]),
    );

    it('Profilfoto: nur für sich selbst oder eigene Kinder, sichtbar im Kader', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const image = await send<UploadedImage>('POST', '/media', player.token, {
        purpose: 'avatar',
        fileName: 'ich.png',
        dataBase64: png,
      });
      expect(image.status).toBe(201);
      const set = await send<PersonProfile>(
        'PATCH',
        `/persons/${player.me.person.id}`,
        player.token,
        {
          avatarImageId: image.body.id,
        },
      );
      expect(set.status).toBe(200);
      expect(set.body.avatarUrl).toMatch(/^\/files\//);
      expect((await get<LoginResponse['me']>('/me', player.token)).person.avatarUrl).toMatch(
        /^\/files\//,
      );
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const roster = await get<RosterEntry[]>(`/teams/${b1.id}/roster`, coach.token);
      expect(roster.find((r) => r.personId === player.me.person.id)!.avatarUrl).toMatch(
        /^\/files\//,
      );
      // Fremdes Profil und falscher Bildzweck
      expect(
        (
          await send('PATCH', `/persons/${coach.me.person.id}`, player.token, {
            avatarImageId: image.body.id,
          })
        ).status,
      ).toBe(404);
      const news = await send<UploadedImage>('POST', '/media', coach.token, {
        purpose: 'news',
        fileName: 'n.png',
        dataBase64: png,
      });
      expect(
        (
          await send('PATCH', `/persons/${coach.me.person.id}`, coach.token, {
            avatarImageId: news.body.id,
          })
        ).status,
      ).toBe(400);
      const removed = await send<PersonProfile>(
        'PATCH',
        `/persons/${player.me.person.id}`,
        player.token,
        {
          avatarImageId: null,
        },
      );
      expect(removed.body.avatarUrl).toBeNull();
    });

    it('Vorstand lädt Dokumente hoch und löscht sie; Typ wird am Inhalt geprüft', async () => {
      const board = await login('vorstand');
      const player = await login('spieler');
      const coach = await login('trainer');
      expect(board.me.create.documents.some((t) => t.type === 'club')).toBe(true);
      // Trainer laden Dokumente nur für ihre Mannschaften hoch
      expect(coach.me.create.documents.map((d) => d.label).sort()).toEqual([
        'B1 · B-Jugend',
        'C1 · C-Jugend',
      ]);

      const doc = {
        title: 'Hallenordnung 2026',
        category: 'regulations',
        scopeType: 'club',
        fileName: '../../etc/Hallenordnung.pdf',
        dataBase64: pdf,
      };
      expect((await send('POST', '/documents', coach.token, doc)).status).toBe(403);
      const b1 = coach.me.create.documents.find((d) => d.label.startsWith('B1'))!;
      const plan = await send<{ id: string }>('POST', '/documents', coach.token, {
        ...doc,
        title: 'Trainingsplan Hallenrunde',
        category: 'training_plans',
        scopeType: 'team',
        scopeId: b1.id,
      });
      expect(plan.status).toBe(201);
      const teamDocs = await get<DocumentItem[]>(`/documents?teamId=${b1.id}`, player.token);
      expect(teamDocs.some((d) => d.id === plan.body.id && !d.canDelete)).toBe(true);
      expect((await send('DELETE', `/documents/${plan.body.id}`, coach.token)).status).toBe(204);
      const fake = await send<{ error: string }>('POST', '/documents', board.token, {
        ...doc,
        dataBase64: b64('<html><script>alert(1)</script></html>'),
      });
      expect(fake.status).toBe(415);
      const svg = await send('POST', '/media', board.token, {
        purpose: 'news',
        fileName: 'x.svg',
        dataBase64: b64('<svg onload="alert(1)"/>'),
      });
      expect(svg.status).toBe(415);

      const created = await send<{ id: string }>('POST', '/documents', board.token, doc);
      expect(created.status).toBe(201);
      const list = await get<DocumentItem[]>('/documents?q=Hallenordnung', player.token);
      expect(list[0]).toMatchObject({
        fileName: 'Hallenordnung.pdf',
        mimeType: 'application/pdf',
        canDelete: false,
      });
      expect(
        (await get<DocumentItem[]>('/documents?q=Hallenordnung', board.token))[0]!.canDelete,
      ).toBe(true);

      const link = await get<{ url: string }>(`/documents/${created.body.id}/link`, player.token);
      const file = await app.inject({ method: 'GET', url: new URL(link.url).pathname });
      expect(file.statusCode).toBe(200);
      expect(file.body).toContain('Beitragsordnung Test');

      expect((await send('DELETE', `/documents/${created.body.id}`, player.token)).status).toBe(
        404,
      );
      expect((await send('DELETE', `/documents/${created.body.id}`, board.token)).status).toBe(204);
      const gone = await app.inject({ method: 'GET', url: new URL(link.url).pathname });
      expect(gone.statusCode).toBe(404);
    });

    it('News mit Bild und Vereinslogo', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const admin = await login('admin');
      expect(
        (
          await send('POST', '/media', player.token, {
            purpose: 'news',
            fileName: 'a.png',
            dataBase64: png,
          })
        ).status,
      ).toBe(403);

      const image = await send<UploadedImage>('POST', '/media', coach.token, {
        purpose: 'news',
        fileName: 'Pokal.png',
        dataBase64: png,
      });
      expect(image.status).toBe(201);
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const news = await send<EditorialNews>('POST', '/editorial/news', coach.token, {
        title: 'Pokalfoto B1',
        body: 'Das Siegerfoto vom Hallencup.',
        priority: 'info',
        scopeType: 'team',
        scopeId: b1.id,
        action: 'draft',
        imageId: image.body.id,
      });
      expect(news.status).toBe(201);
      expect(news.body.imageUrl).toMatch(/^\/files\//);
      const served = await app.inject({ method: 'GET', url: news.body.imageUrl! });
      expect(served.statusCode).toBe(200);
      expect(served.headers['content-type']).toBe('image/png');

      // Logo nur durch die Vereinsadministration, Bilder nur für ihren Zweck
      expect(
        (await send('PUT', '/club/logo', coach.token, { imageId: image.body.id })).status,
      ).toBe(403);
      const wrongPurpose = await send('PUT', '/club/logo', admin.token, { imageId: image.body.id });
      expect(wrongPurpose.status).toBe(400);
      const logo = await send<UploadedImage>('POST', '/media', admin.token, {
        purpose: 'logo',
        fileName: 'wappen.png',
        dataBase64: png,
      });
      expect((await send('PUT', '/club/logo', admin.token, { imageId: logo.body.id })).status).toBe(
        200,
      );
      const me = await get<LoginResponse['me']>('/me', player.token);
      expect(me.club.logoUrl).toMatch(/^\/files\//);
      await send('PUT', '/club/logo', admin.token, { imageId: null });
    });

    it('Trainer erstellt eine Umfrage für seine Mannschaft und beendet sie', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const parent = await login('eltern');
      const b1 = coach.me.create.polls.find((t) => t.label.startsWith('B1'))!;
      expect(coach.me.create.polls.some((t) => t.type === 'club')).toBe(false);

      const club = await send('POST', '/polls', coach.token, {
        question: 'Vereinsfest?',
        options: ['Ja', 'Nein'],
        resultVisibility: 'always',
        scopeType: 'club',
      });
      expect(club.status).toBe(403);
      const dup = await send('POST', '/polls', coach.token, {
        question: 'Trikotfarbe?',
        options: ['Grün', ' Grün '],
        resultVisibility: 'always',
        scopeType: 'team',
        scopeId: b1.id,
      });
      expect(dup.status).toBe(400);

      const created = await send<PollDetail>('POST', '/polls', coach.token, {
        question: 'Wann soll die Weihnachtsfeier stattfinden?',
        options: ['Fr, 18.12.', 'Sa, 19.12.', 'So, 20.12.'],
        closesAt: '2026-11-30T23:00:00Z',
        resultVisibility: 'after_vote',
        scopeType: 'team',
        scopeId: b1.id,
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ isOpen: true, canClose: true });
      const id = created.body.id;

      expect((await get<PollSummary[]>('/polls', player.token)).some((p) => p.id === id)).toBe(
        true,
      );
      const notes = await get<NotificationItem[]>('/notifications', player.token);
      expect(notes.some((n) => n.link === `/polls/${id}`)).toBe(true);
      const hidden = await app.inject({
        method: 'GET',
        url: `/polls/${id}`,
        headers: { authorization: `Bearer ${parent.token}` },
      });
      expect(hidden.statusCode).toBe(404);

      const forPlayer = await get<PollDetail>(`/polls/${id}`, player.token);
      expect(forPlayer.canClose).toBe(false);
      expect((await send('POST', `/polls/${id}/close`, player.token)).status).toBe(403);
      const closed = await send<PollDetail>('POST', `/polls/${id}/close`, coach.token);
      expect(closed.body.isOpen).toBe(false);
    });
  });
  describe('Module und Mannschaften verwalten', () => {
    it('Trainer stellen die Funktionen ihrer Mannschaft selbst ein', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const second = coach.me.teams.find((t) => t.badge === '2.')!;
      expect(
        (await get<TeamOverview>(`/teams/${b1.id}`, coach.token)).permissions.manageModules,
      ).toBe(true);
      expect(
        (await get<TeamOverview>(`/teams/${b1.id}`, player.token)).permissions.manageModules,
      ).toBe(false);
      const list = await get<TeamModule[]>(`/teams/${b1.id}/modules`, coach.token);
      expect(list.find((m) => m.key === 'team_tasks')).toMatchObject({
        enabled: true,
        lockedBy: null,
      });
      expect((await send('GET', `/teams/${b1.id}/modules`, player.token)).status).toBe(403);
      // In der 2. Mannschaft spielt der Trainer nur – dort darf er nichts einstellen
      expect(
        (
          await send('PUT', `/teams/${second.id}/modules/team_tasks`, coach.token, {
            enabled: false,
          })
        ).status,
      ).toBe(403);
      const off = await send<TeamModule[]>(
        'PUT',
        `/teams/${b1.id}/modules/team_tasks`,
        coach.token,
        {
          enabled: false,
        },
      );
      expect(off.body.find((m) => m.key === 'team_tasks')!.enabled).toBe(false);
      expect((await login('trainer')).me.teams.find((t) => t.id === b1.id)!.modules).not.toContain(
        'team_tasks',
      );
      await send('PUT', `/teams/${b1.id}/modules/team_tasks`, coach.token, { enabled: true });
    });

    it('Module je Bereich: Vorgabe für alle Mannschaften, zurück auf Vereinswert', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const youth = (await get<ClubSettings>('/admin/club', admin.token)).orgUnits.find(
        (u) => u.kind === 'youth',
      )!;
      expect((await send('GET', `/admin/org-units/${youth.id}/modules`, coach.token)).status).toBe(
        403,
      );
      const before = await get<TeamModule[]>(`/admin/org-units/${youth.id}/modules`, admin.token);
      expect(before.find((m) => m.key === 'team_tasks')).toMatchObject({
        enabled: true,
        inherited: true,
      });

      const off = await send<TeamModule[]>(
        'PUT',
        `/admin/org-units/${youth.id}/modules/team_tasks`,
        admin.token,
        { enabled: false },
      );
      expect(off.body.find((m) => m.key === 'team_tasks')).toMatchObject({
        enabled: false,
        inherited: false,
      });
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      expect((await login('spieler')).me.teams.find((t) => t.id === b1.id)!.modules).not.toContain(
        'team_tasks',
      );
      const blocked = await send<{ error: string }>(
        'PUT',
        `/admin/teams/${b1.id}/modules/team_tasks`,
        admin.token,
        { enabled: true },
      );
      expect(blocked.body.error).toBe('unit_disabled');

      const reset = await send<TeamModule[]>(
        'PUT',
        `/admin/org-units/${youth.id}/modules/team_tasks`,
        admin.token,
        { enabled: null },
      );
      expect(reset.body.find((m) => m.key === 'team_tasks')).toMatchObject({
        enabled: true,
        inherited: true,
      });
    });

    it('Update-Center: einrichten, später, nicht verwenden; Kernmodule bleiben an', async () => {
      const admin = await login('admin');
      expect(admin.me.admin.manageModules).toBe(true);
      const denied = await app.inject({
        method: 'GET',
        url: '/admin/modules',
        headers: { authorization: `Bearer ${(await login('vorstand')).token}` },
      });
      expect(denied.statusCode).toBe(403);

      const overview = await get<ModuleOverview>('/admin/modules', admin.token);
      // Im Demoverein wartet nur das Forum auf die Einrichtung
      expect(overview.updates.map((m) => m.key)).toEqual(['forum']);
      expect(overview.modules.find((m) => m.key === 'team_cash')!.enabledTeams).toBeGreaterThan(0);

      expect(
        (await send('POST', '/admin/modules/events', admin.token, { decision: 'disable' })).status,
      ).toBe(409);
      const later = await send<ModuleOverview>('POST', '/admin/modules/forum', admin.token, {
        decision: 'later',
      });
      expect(later.body.updates).toHaveLength(0);
      expect(later.body.modules.find((m) => m.key === 'forum')!.snoozedUntil).not.toBeNull();
      const declined = await send<ModuleOverview>('POST', '/admin/modules/forum', admin.token, {
        decision: 'decline',
      });
      expect(declined.body.modules.find((m) => m.key === 'forum')!.declined).toBe(true);
      // Eingeschaltet wird das Forum im Test „Mini-Forum“ über das Update-Center
      const me = await get<LoginResponse['me']>('/me', admin.token);
      expect(me.clubModules).not.toContain('forum');
      expect(me.clubModules).toContain('training_planning');
    });

    it('Mannschaftsmodule: Verein schaltet ab, Mannschaft folgt; Einstellung je Mannschaft', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;

      // Statistik nur für B1 ausschalten
      const off = await send<TeamModule[]>(
        'PUT',
        `/admin/teams/${b1.id}/modules/statistics`,
        admin.token,
        {
          enabled: false,
        },
      );
      expect(off.body.find((m) => m.key === 'statistics')).toMatchObject({
        enabled: false,
        inherited: false,
      });
      const stats = await app.inject({
        method: 'GET',
        url: `/teams/${b1.id}/stats`,
        headers: { authorization: `Bearer ${coach.token}` },
      });
      expect([403, 404]).toContain(stats.statusCode);
      // Das Trainerteam darf die Module der eigenen Mannschaft wieder einschalten
      expect(
        (await send('PUT', `/teams/${b1.id}/modules/statistics`, coach.token, { enabled: true }))
          .status,
      ).toBe(200);
      expect((await get<TeamStats>(`/teams/${b1.id}/stats`, coach.token)).level).toBeDefined();

      // Kasse vereinsweit aus → in keiner Mannschaft nutzbar, auch nicht einzeln einschaltbar
      await send('POST', '/admin/modules/team_cash', admin.token, { decision: 'disable' });
      const cash = await app.inject({
        method: 'GET',
        url: `/teams/${b1.id}/cash`,
        headers: { authorization: `Bearer ${coach.token}` },
      });
      expect([403, 404]).toContain(cash.statusCode);
      const blocked = await send('PUT', `/admin/teams/${b1.id}/modules/team_cash`, admin.token, {
        enabled: true,
      });
      expect(blocked.status).toBe(409);
      await send('POST', '/admin/modules/team_cash', admin.token, { decision: 'enable' });
      expect((await get<TeamCash>(`/teams/${b1.id}/cash`, coach.token)).team.badge).toBe('B1');
    });

    it('Mannschaften anlegen, bearbeiten und löschen', async () => {
      const admin = await login('admin');
      const coachRes = await app.inject({
        method: 'GET',
        url: '/admin/teams',
        headers: { authorization: `Bearer ${(await login('trainer')).token}` },
      });
      expect(coachRes.statusCode).toBe(403);

      const overview = await get<TeamAdminOverview>('/admin/teams', admin.token);
      expect(overview.teams).toHaveLength(11);
      expect(overview.next).toBeNull();
      const b1 = overview.teams.find((t) => t.badge === 'B1')!;
      expect(b1.players).toBeGreaterThan(10);
      const unit = overview.orgUnits.find((u) => u.id === b1.orgUnit.id)!;

      const dup = await send('POST', '/admin/teams', admin.token, {
        name: 'B-Jugend II',
        badge: 'b1',
        orgUnitId: unit.id,
        template: 'youth',
        participationMode: 'auto_accept',
      });
      expect(dup.status).toBe(409);
      const created = await send<TeamDetailAdmin>('POST', '/admin/teams', admin.token, {
        name: 'B-Jugend II',
        badge: 'B2',
        ageGroup: 'U17',
        orgUnitId: unit.id,
        template: 'youth',
        participationMode: 'auto_accept',
      });
      expect(created.status).toBe(201);
      expect(created.body.modules.find((m) => m.key === 'parent_access')!.enabled).toBe(true);
      const renamed = await send<TeamDetailAdmin>(
        'PATCH',
        `/admin/teams/${created.body.id}`,
        admin.token,
        {
          league: 'Kreisliga',
        },
      );
      expect(renamed.body.league).toBe('Kreisliga');

      expect((await send('DELETE', `/admin/teams/${b1.id}`, admin.token)).status).toBe(409);
      expect((await send('DELETE', `/admin/teams/${created.body.id}`, admin.token)).status).toBe(
        204,
      );
    });
  });

  describe('Spielbetrieb', () => {
    it('Kader-Statistik und Trainingsquoten für die ganze Mannschaft', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const b1 = player.me.teams.find((t) => t.badge === 'B1')!;
      const forPlayer = await get<TeamStats>(`/teams/${b1.id}/stats`, player.token);
      expect(forPlayer.showsTrainingRates).toBe(true);
      expect(forPlayer.squad.length).toBeGreaterThan(15);
      const goals = forPlayer.squad.reduce((a, r) => a + r.goals, 0);
      expect(goals).toBeGreaterThan(0);
      expect(goals).toBeLessThanOrEqual(forPlayer.highlights.goalsFor);
      expect(forPlayer.squad.some((r) => r.appearances > 0)).toBe(true);
      // Trainingsbeteiligung ist innerhalb der Mannschaft für alle sichtbar
      const others = forPlayer.squad.filter((r) => r.personId !== player.me.person.id);
      expect(others.filter((r) => r.trainingRate !== null).length).toBeGreaterThan(10);
      expect(forPlayer.players.length).toBeGreaterThan(10);
      expect(
        forPlayer.squad.find((r) => r.personId === player.me.person.id)!.trainingRate,
      ).not.toBeNull();

      const forCoach = await get<TeamStats>(`/teams/${b1.id}/stats`, coach.token);
      expect(forCoach.showsTrainingRates).toBe(true);
      expect(forCoach.squad.filter((r) => r.trainingRate !== null).length).toBeGreaterThan(10);

      const profile = await get<PersonProfile>(`/persons/${player.me.person.id}`, player.token);
      expect(profile.stats!.appearances).toBeGreaterThanOrEqual(0);
      expect(profile.stats!.goals).toBe(
        forPlayer.squad.find((r) => r.personId === player.me.person.id)!.goals,
      );
    });

    it('Aufstellung: Entwurf nur fürs Trainerteam, Veröffentlichen benachrichtigt', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const next = (await get<EventSummary[]>('/events', coach.token)).find(
        (e) =>
          e.team?.id === b1.id &&
          e.type === 'match' &&
          e.status === 'scheduled' &&
          new Date(e.startsAt) > NOW,
      )!;

      const sheet = await get<MatchSheet>(`/events/${next.id}/match`, coach.token);
      expect(sheet.can.editLineup).toBe(true);
      const ok = sheet.candidates!.filter((c) => c.status !== 'no');
      const declined = sheet.candidates!.find((c) => c.status === 'no');
      const me = ok.find((c) => c.personId === player.me.person.id)!;
      expect(me).toBeDefined();
      const starters = [me, ...ok.filter((c) => c !== me).slice(0, 10)];
      const bench = ok.filter((c) => !starters.includes(c)).slice(0, 3);
      const entries = [
        ...starters.map((c) => ({ personId: c.personId, role: 'starter' })),
        ...bench.map((c) => ({ personId: c.personId, role: 'substitute' })),
      ];

      expect(
        (await send('PUT', `/events/${next.id}/lineup`, player.token, { entries, publish: true }))
          .status,
      ).toBe(403);
      if (declined) {
        const bad = await send('PUT', `/events/${next.id}/lineup`, coach.token, {
          entries: [...entries, { personId: declined.personId, role: 'substitute' }],
          publish: false,
        });
        expect(bad.status).toBe(409);
      }
      const twelve = await send('PUT', `/events/${next.id}/lineup`, coach.token, {
        entries: ok.slice(0, 12).map((c) => ({ personId: c.personId, role: 'starter' })),
        publish: false,
      });
      expect(twelve.status).toBe(400);

      const draft = await send<MatchSheet>('PUT', `/events/${next.id}/lineup`, coach.token, {
        entries,
        publish: false,
      });
      expect(draft.body.lineup).toMatchObject({ published: false });
      expect((await get<MatchSheet>(`/events/${next.id}/match`, player.token)).lineup).toBeNull();

      const published = await send<MatchSheet>('PUT', `/events/${next.id}/lineup`, coach.token, {
        entries,
        publish: true,
      });
      expect(published.body.lineup!.entries.filter((e) => e.role === 'starter')).toHaveLength(11);
      const forPlayer = await get<MatchSheet>(`/events/${next.id}/match`, player.token);
      expect(forPlayer.lineup!.published).toBe(true);
      expect(forPlayer.candidates).toBeNull();
      const notes = await get<NotificationItem[]>('/notifications', player.token);
      expect(
        notes.some(
          (n) => n.title.startsWith('Nominiert:') && n.body === 'Du stehst in der Startelf.',
        ),
      ).toBe(true);
      // Bericht vor Anpfiff nicht möglich
      const early = await send('PUT', `/events/${next.id}/report`, coach.token, {
        goalsFor: 0,
        goalsAgainst: 0,
        incidents: [],
        complete: false,
      });
      expect(early.status).toBe(409);
    });

    it('Spielbericht: Tore passen zum Ergebnis, nur Kaderspieler', async () => {
      const coach = await login('trainer');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const last = (await get<TeamStats>(`/teams/${b1.id}/stats`, coach.token)).results[0]!;
      const sheet = await get<MatchSheet>(`/events/${last.eventId}/match`, coach.token);
      expect(sheet.report!.completed).toBe(true);
      const [a, b] = sheet.lineup!.entries;
      const outsider = sheet.candidates!.find(
        (c) => !sheet.lineup!.entries.some((e) => e.personId === c.personId),
      );

      const mismatch = await send<{ error: string }>(
        'PUT',
        `/events/${last.eventId}/report`,
        coach.token,
        {
          goalsFor: 2,
          goalsAgainst: 1,
          incidents: [{ kind: 'goal', personId: a!.personId, minute: 12 }],
          complete: true,
        },
      );
      expect(mismatch.body.error).toBe('goals_mismatch');
      const self = await send('PUT', `/events/${last.eventId}/report`, coach.token, {
        goalsFor: 1,
        goalsAgainst: 1,
        incidents: [{ kind: 'goal', personId: a!.personId, assistPersonId: a!.personId }],
        complete: true,
      });
      expect(self.status).toBe(400);
      if (outsider) {
        const notInSquad = await send('PUT', `/events/${last.eventId}/report`, coach.token, {
          goalsFor: 1,
          goalsAgainst: 0,
          incidents: [{ kind: 'goal', personId: outsider.personId }],
          complete: true,
        });
        expect(notInSquad.status).toBe(400);
      }
      const saved = await send<MatchSheet>('PUT', `/events/${last.eventId}/report`, coach.token, {
        goalsFor: 2,
        goalsAgainst: 1,
        incidents: [
          { kind: 'goal', personId: a!.personId, assistPersonId: b!.personId, minute: 12 },
          { kind: 'own_goal', minute: 80 },
          { kind: 'yellow', personId: b!.personId, minute: 55 },
        ],
        complete: true,
      });
      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject({ goalsFor: 2, goalsAgainst: 1 });
      expect(saved.body.report!.incidents.map((i) => i.kind)).toEqual([
        'goal',
        'yellow',
        'own_goal',
      ]);
      expect(saved.body.report!.incidents[0]!.assist!.id).toBe(b!.personId);
    });

    it('Rückennummern: Modus und Nummern nur durchs Trainerteam, keine Doppelten', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const settings = await get<JerseySettings>(`/teams/${b1.id}/jerseys`, coach.token);
      expect(settings.canEdit).toBe(true);
      const [x, y] = settings.numbers;
      expect(
        (await send('PUT', `/teams/${b1.id}/jerseys`, player.token, { mode: 'off' })).status,
      ).toBe(403);
      const dup = await send('PUT', `/teams/${b1.id}/jerseys`, coach.token, {
        mode: 'season',
        numbers: [
          { personId: x!.personId, jerseyNumber: 7 },
          { personId: y!.personId, jerseyNumber: 7 },
        ],
      });
      expect(dup.status).toBe(400);
      const saved = await send<JerseySettings>('PUT', `/teams/${b1.id}/jerseys`, coach.token, {
        mode: 'match',
        numbers: [{ personId: x!.personId, jerseyNumber: 98 }],
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      expect(saved.body.mode).toBe('match');
      expect(saved.body.numbers.find((n) => n.personId === x!.personId)!.jerseyNumber).toBe(98);
      const roster = await get<RosterEntry[]>(`/teams/${b1.id}/roster`, coach.token);
      expect(roster.find((r) => r.personId === x!.personId)!.jerseyNumber).toBe(98);
      await send('PUT', `/teams/${b1.id}/jerseys`, coach.token, { mode: 'season' });
    });

    it('Spielerbewegungen: Wechsel, Leihe, Abgang', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const denied = await app.inject({
        method: 'GET',
        url: '/admin/transfers',
        headers: { authorization: `Bearer ${coach.token}` },
      });
      expect(denied.statusCode).toBe(403);
      const overview = await get<TransferOverview>('/admin/transfers', admin.token);
      expect(overview.items.length).toBeGreaterThanOrEqual(3);
      const team = (badge: string) => overview.teams.find((t) => t.badge === badge)!;
      const players = async (badge: string) =>
        (await get<RosterEntry[]>(`/teams/${team(badge).id}/roster`, admin.token)).filter(
          (r) => r.function === 'player',
        );

      // Wechsel C1 → B1
      const mover = (await players('C1'))[0]!;
      const moved = await send<TransferOverview>('POST', '/admin/transfers', admin.token, {
        personId: mover.personId,
        kind: 'internal',
        fromTeamId: team('C1').id,
        toTeamId: team('B1').id,
        note: 'Leistungsstark, früher hochgezogen',
      });
      expect(moved.status).toBe(201);
      expect((await players('C1')).some((r) => r.personId === mover.personId)).toBe(false);
      expect((await players('B1')).some((r) => r.personId === mover.personId)).toBe(true);
      const again = await send('POST', '/admin/transfers', admin.token, {
        personId: mover.personId,
        kind: 'internal',
        fromTeamId: team('C1').id,
        toTeamId: team('B1').id,
      });
      expect(again.status).toBe(409);

      // Leihe 2. → 1. Mannschaft, Stammteam bleibt
      const loaned = (await players('2.'))[0]!;
      expect(
        (
          await send('POST', '/admin/transfers', admin.token, {
            personId: loaned.personId,
            kind: 'loan',
            toTeamId: team('1.').id,
          })
        ).status,
      ).toBe(400);
      const loan = await send<TransferOverview>('POST', '/admin/transfers', admin.token, {
        personId: loaned.personId,
        kind: 'loan',
        toTeamId: team('1.').id,
        endsOn: '2026-12-31',
      });
      expect(
        loan.body.items.find((i) => i.person.id === loaned.personId && i.kind === 'loan'),
      ).toMatchObject({
        kind: 'loan',
        endsOn: '2026-12-31',
        fromTeam: { badge: '2.' },
      });
      expect((await players('1.')).some((r) => r.personId === loaned.personId)).toBe(true);
      expect((await players('2.')).some((r) => r.personId === loaned.personId)).toBe(true);

      // Abgang aus den Alten Herren
      const leaver = (await players('AH')).at(-1)!;
      await send('POST', '/admin/transfers', admin.token, {
        personId: leaver.personId,
        kind: 'leave',
        fromTeamId: team('AH').id,
        externalClub: 'SG Reinstetten',
      });
      expect((await players('AH')).some((r) => r.personId === leaver.personId)).toBe(false);
    });
  });

  describe('Konto: Passwort vergessen und ändern', () => {
    const NEW = 'Sommerfest-2026-Grillstand';

    it('setzt das Passwort per Link zurück und beendet alle Sitzungen', async () => {
      const before = mailer.outbox.length;
      const unknown = await send('POST', '/auth/password/forgot', '', {
        email: 'niemand@example.org',
      });
      expect(unknown.status).toBe(202);
      expect(mailer.outbox.length).toBe(before);

      const parent = await login('eltern');
      const known = await send('POST', '/auth/password/forgot', '', { email: email('eltern') });
      expect(known.status).toBe(202);
      const mail = mailer.outbox.at(-1)!;
      expect(mail.to).toBe(email('eltern'));
      const token = /\/reset\/([A-Za-z0-9_-]+)/.exec(mail.text)![1]!;

      const weak = await send<{ error: string }>('POST', '/auth/password/reset', '', {
        token,
        password: 'kurz',
      });
      expect(weak.body.error).toBe('password_weak');
      // Ein zu schwaches Passwort verbraucht den Link nicht
      const token2 = token;
      expect(
        (await send('POST', '/auth/password/reset', '', { token: token2, password: NEW })).status,
      ).toBe(204);
      expect(
        (await send('POST', '/auth/password/reset', '', { token: token2, password: NEW })).status,
      ).toBe(400);

      const old = await app.inject({
        method: 'GET',
        url: '/me',
        headers: { authorization: `Bearer ${parent.token}` },
      });
      expect(old.statusCode).toBe(401);
      const relogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: email('eltern'), password: NEW },
      });
      expect(relogin.statusCode).toBe(200);

      // Zurück zum Demo-Passwort über „Passwort ändern“
      const tokenNew = relogin.json<LoginResponse>().token;
      const wrong = await send('POST', '/auth/password/change', tokenNew, {
        currentPassword: 'falsch',
        newPassword: PASSWORD,
      });
      expect(wrong.status).toBe(400);
      const changed = await send('POST', '/auth/password/change', tokenNew, {
        currentPassword: NEW,
        newPassword: PASSWORD,
      });
      expect(changed.status).toBe(204);
      expect((await get<LoginResponse['me']>('/me', tokenNew)).user.email).toBe(email('eltern'));
      await login('eltern');
    });
  });

  describe('Einladungen und Beitrittsanfragen', () => {
    const tokenOf = (url: string) => url.split('/join/')[1]!;
    const PW = 'Flutlicht-Abend-2026';
    const pub = (method: 'GET' | 'POST', url: string, payload?: object) =>
      app.inject({ method, url, ...(payload ? { payload } : {}) });

    it('persönliche Einladung: Link per E-Mail, Konto anlegen, sofort angemeldet', async () => {
      const coach = await login('trainer');
      const denied = await app.inject({
        method: 'GET',
        url: '/invitations',
        headers: { authorization: `Bearer ${(await login('spieler')).token}` },
      });
      expect(denied.statusCode).toBe(403);
      expect(coach.me.canInvite).toBe(true);

      const overview = await get<InviteOverview>('/invitations', coach.token);
      expect(overview.teams.map((t) => t.badge).sort()).toEqual(['B1', 'C1']);
      const parent = overview.people.find((p) => p.context.startsWith('Elternteil'))!;
      expect(parent).toBeDefined();

      const created = await send<InviteLink>('POST', '/invitations/person', coach.token, {
        personId: parent.personId,
        email: 'eltern.neu@example.org',
        send: true,
      });
      expect(created.status).toBe(201);
      expect(mailer.outbox.at(-1)!.text).toContain(created.body.url);
      const token = tokenOf(created.body.url);

      const info = await pub('GET', `/join/${token}`);
      expect(info.json<JoinInfo>()).toMatchObject({
        kind: 'person',
        person: { email: 'eltern.neu@example.org' },
      });
      expect(
        (
          await pub('POST', `/join/${token}/accept`, {
            email: 'eltern.neu@example.org',
            password: 'kurz',
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await pub('POST', `/join/${token}/accept`, { email: email('trainer'), password: PW }))
          .statusCode,
      ).toBe(409);
      const accepted = await pub('POST', `/join/${token}/accept`, {
        email: 'eltern.neu@example.org',
        password: PW,
      });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json<LoginResponse>().me.person.id).toBe(parent.personId);
      expect(accepted.json<LoginResponse>().me.managedPersons.length).toBeGreaterThan(1);
      expect((await pub('GET', `/join/${token}`)).statusCode).toBe(410);
      expect(
        (await pub('POST', `/join/${token}/accept`, { email: 'x@example.org', password: PW }))
          .statusCode,
      ).toBe(410);

      // Personen außerhalb der eigenen Mannschaften nicht einladbar
      const admin = await login('admin');
      const outsider = (await get<MemberListItem[]>('/admin/members', admin.token)).find(
        (m) => !m.hasAccount && m.teams.length > 0 && m.teams.every((t) => t.badge === '1.'),
      )!;
      const foreign = await send('POST', '/invitations/person', coach.token, {
        personId: outsider.id,
        send: false,
      });
      expect(foreign.status).toBe(404);
    });

    it('Mannschafts-Link mit QR-Code: Anfrage, Freigabe, Ablehnung', async () => {
      const coach = await login('trainer');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const created = await send<InviteLink>('POST', `/teams/${b1.id}/invite-link`, coach.token);
      expect(created.body.qrSvg).toContain('<svg');
      const overview = await get<InviteOverview>('/invitations', coach.token);
      expect(overview.teams.find((t) => t.id === b1.id)!.link!.url).toBe(created.body.url);
      const token = tokenOf(created.body.url);
      expect((await pub('GET', `/join/${token}`)).json<JoinInfo>()).toMatchObject({
        kind: 'team',
        team: { badge: 'B1' },
      });

      // Neuer Spieler fragt an → wartet auf Freigabe
      const asked = await pub('POST', `/join/${token}/request`, {
        email: 'neu.spieler@example.org',
        password: PW,
        relation: 'player',
        firstName: 'Noah',
        lastName: 'Neuling',
        birthDate: '2010-05-01',
      });
      expect(asked.statusCode).toBe(202);
      const early = await pub('POST', '/auth/login', {
        email: 'neu.spieler@example.org',
        password: PW,
      });
      expect(early.statusCode).toBe(403);
      expect(early.json().error).toBe('request_pending');
      const notes = await get<NotificationItem[]>('/notifications', coach.token);
      expect(notes.some((n) => n.title === 'Beitrittsanfrage B1')).toBe(true);

      // Elternteil meldet ein Kind an
      await pub('POST', `/join/${token}/request`, {
        email: 'mama.neu@example.org',
        password: PW,
        relation: 'parent',
        firstName: 'Nina',
        lastName: 'Neumann',
        childFirstName: 'Nils',
        childLastName: 'Neumann',
        childBirthDate: '2010-09-09',
      });
      // Und eine Anfrage, die abgelehnt wird
      await pub('POST', `/join/${token}/request`, {
        email: 'fremd@example.org',
        password: PW,
        relation: 'player',
        firstName: 'Fritz',
        lastName: 'Fremd',
      });

      const pending = (await get<InviteOverview>('/invitations', coach.token)).requests;
      expect(pending).toHaveLength(3);
      const player = pending.find((r) => r.name === 'Noah Neuling')!;
      const parentReq = pending.find((r) => r.relation === 'parent')!;
      const other = pending.find((r) => r.name === 'Fritz Fremd')!;

      await send('POST', `/join-requests/${player.id}/approve`, coach.token, {});
      const noah = await pub('POST', '/auth/login', {
        email: 'neu.spieler@example.org',
        password: PW,
      });
      expect(noah.statusCode).toBe(200);
      expect(noah.json<LoginResponse>().me.teams.map((t) => t.badge)).toEqual(['B1']);

      await send('POST', `/join-requests/${parentReq.id}/approve`, coach.token, {});
      const mama = (
        await pub('POST', '/auth/login', { email: 'mama.neu@example.org', password: PW })
      ).json<LoginResponse>();
      expect(mama.me.managedPersons.map((p) => p.firstName)).toContain('Nils');
      expect(mama.me.teams.some((t) => t.badge === 'B1')).toBe(true);

      await send('POST', `/join-requests/${other.id}/reject`, coach.token, {
        note: 'Bitte zuerst zum Probetraining kommen.',
      });
      const rejected = await pub('POST', '/auth/login', {
        email: 'fremd@example.org',
        password: PW,
      });
      expect(rejected.json().error).toBe('request_rejected');
      expect(
        (await send('POST', `/join-requests/${other.id}/approve`, coach.token, {})).status,
      ).toBe(409);

      // Link zurückziehen
      await send('DELETE', `/teams/${b1.id}/invite-link`, coach.token);
      expect((await pub('GET', `/join/${token}`)).statusCode).toBe(410);
    });
  });

  describe('2-Faktor-Anmeldung', () => {
    it('Einrichten, Vereinsvorgabe, Anmeldung mit Code und Wiederherstellungscode', async () => {
      const board = await login('vorstand');
      const clubId = board.me.club.id;
      expect(await get<TwoFactorStatus>('/auth/2fa', board.token)).toEqual({
        enabled: false,
        required: false,
        recoveryCodesLeft: 0,
      });

      // Verein verlangt 2-Faktor → Verwaltung gesperrt, App wird informiert
      await db.update(s.clubs).set({ requireTwoFactor: true }).where(eq(s.clubs.id, clubId));
      const blocked = await send<{ error: string }>('GET', '/admin/overview', board.token);
      expect(blocked.status).toBe(403);
      expect(blocked.body.error).toBe('two_factor_required');
      expect((await get<LoginResponse['me']>('/me', board.token)).security.twoFactorRequired).toBe(
        true,
      );

      const setup = await send<TwoFactorSetup>('POST', '/auth/2fa/setup', board.token);
      expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      expect(setup.body.qrSvg).toContain('<svg');
      const secret = setup.body.secret.replace(/ /g, '');
      expect((await send('POST', '/auth/2fa/enable', board.token, { code: '000000' })).status).toBe(
        400,
      );
      const step = stepOf(NOW);
      const enabled = await send<{ recoveryCodes: string[] }>(
        'POST',
        '/auth/2fa/enable',
        board.token,
        {
          code: totp(secret, step),
        },
      );
      expect(enabled.body.recoveryCodes).toHaveLength(10);
      expect((await send('GET', '/admin/overview', board.token)).status).toBe(200);

      // Anmeldung braucht jetzt den zweiten Schritt
      const first = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: email('vorstand'), password: PASSWORD },
      });
      const challenge = first.json<TwoFactorChallenge>();
      expect(challenge.twoFactorRequired).toBe(true);
      expect(first.json()).not.toHaveProperty('token');
      // Bereits verwendeter Code wird nicht noch einmal angenommen
      const replay = await app.inject({
        method: 'POST',
        url: '/auth/2fa/verify',
        payload: { challenge: challenge.challenge, code: totp(secret, step) },
      });
      expect(replay.statusCode).toBe(401);
      const recovery = enabled.body.recoveryCodes[0]!;
      const ok = await app.inject({
        method: 'POST',
        url: '/auth/2fa/verify',
        payload: { challenge: challenge.challenge, code: recovery },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json<LoginResponse>().me.security.twoFactorEnabled).toBe(true);
      // Challenge und Wiederherstellungscode sind verbraucht
      const again = await app.inject({
        method: 'POST',
        url: '/auth/2fa/verify',
        payload: { challenge: challenge.challenge, code: recovery },
      });
      expect(again.statusCode).toBe(401);
      expect((await get<TwoFactorStatus>('/auth/2fa', board.token)).recoveryCodesLeft).toBe(9);

      // Ausschalten nur ohne Vereinsvorgabe und mit Passwort + Code
      const forbidden = await send('POST', '/auth/2fa/disable', board.token, {
        password: PASSWORD,
        code: totp(secret, step + 1),
      });
      expect(forbidden.status).toBe(409);
      await db.update(s.clubs).set({ requireTwoFactor: false }).where(eq(s.clubs.id, clubId));
      const wrongPw = await send('POST', '/auth/2fa/disable', board.token, {
        password: 'falsch',
        code: totp(secret, step + 1),
      });
      expect(wrongPw.status).toBe(400);
      const off = await send('POST', '/auth/2fa/disable', board.token, {
        password: PASSWORD,
        code: totp(secret, step + 1),
      });
      expect(off.status).toBe(204);
      expect((await login('vorstand')).me.security.twoFactorEnabled).toBe(false);
    });
  });

  describe('Vereinseinstellungen', () => {
    it('ändert Name und Design, verwaltet Bereiche und schützt die 2-Faktor-Vorgabe', async () => {
      const admin = await login('admin');
      const board = await login('vorstand');
      expect((await send('GET', '/admin/club', board.token)).status).toBe(403);

      const before = await get<ClubSettings>('/admin/club', admin.token);
      expect(before.orgUnits.length).toBeGreaterThan(0);
      expect(before.canRequireTwoFactor).toBe(false);

      const changed = await send<ClubSettings>('PATCH', '/admin/club', admin.token, {
        shortName: 'SV GW Test',
        colorTheme: 'blue',
        colorMode: 'dark',
      });
      expect(changed.status).toBe(200);
      expect(changed.body).toMatchObject({ shortName: 'SV GW Test', colorTheme: 'blue' });
      expect((await get<LoginResponse['me']>('/me', admin.token)).club.colorTheme).toBe('blue');
      expect((await send('PATCH', '/admin/club', admin.token, { colorTheme: 'lila' })).status).toBe(
        400,
      );

      // Ohne eigene 2-Faktor-Anmeldung keine Vereinsvorgabe (sonst sperrt man sich aus)
      const twoFa = await send<{ error: string }>('PATCH', '/admin/club', admin.token, {
        requireTwoFactor: true,
      });
      expect(twoFa.status).toBe(409);
      expect(twoFa.body.error).toBe('own_two_factor');

      // Bereiche: anlegen, umbenennen, löschen; belegte Bereiche bleiben
      const added = await send<ClubSettings>('POST', '/admin/org-units', admin.token, {
        name: 'Walking Football',
        kind: 'veterans',
      });
      expect(added.status).toBe(201);
      const unit = added.body.orgUnits.find((u) => u.name === 'Walking Football')!;
      expect(unit.teams).toBe(0);
      const renamed = await send<ClubSettings>(
        'PATCH',
        `/admin/org-units/${unit.id}`,
        admin.token,
        { name: 'Walking-Fußball' },
      );
      expect(renamed.body.orgUnits.some((u) => u.name === 'Walking-Fußball')).toBe(true);
      const used = before.orgUnits.find((u) => u.teams > 0)!;
      expect((await send('DELETE', `/admin/org-units/${used.id}`, admin.token)).status).toBe(409);
      const removed = await send<ClubSettings>(
        'DELETE',
        `/admin/org-units/${unit.id}`,
        admin.token,
      );
      expect(removed.body.orgUnits.some((u) => u.id === unit.id)).toBe(false);

      await send('PATCH', '/admin/club', admin.token, {
        shortName: before.shortName,
        colorTheme: before.colorTheme,
        colorMode: before.colorMode,
      });
      // Ersteinrichtung ist auf einem eingerichteten Server gesperrt
      expect((await get<{ needsSetup: boolean }>('/setup/status', admin.token)).needsSetup).toBe(
        false,
      );
    });
  });

  describe('Mitglieder-Import', () => {
    it('prüft die Datei in der Vorschau und übernimmt nur neue Mitglieder', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const csv = [
        'Vorname;Nachname;Geburtsdatum;E-Mail;Mannschaft;Funktion;Rückennummer;Lieblingsessen',
        'Lena;Import;03.04.2010;lena.import@example.org;B1;Spielerin;23;Pizza',
        'Jonas;Import;2011-01-15;;;;;',
        'Daniel;Schäfer;14.03.1986;;;;;',
        'Lena;Import;03.04.2010;;;;;',
        'Kai;Fehler;31.02.2010;kein-mail;Z9;Torwart;100;',
        ';;;;;;;',
      ].join('\n');
      expect(
        (await send('POST', '/admin/import/members', coach.token, { csv, commit: false })).status,
      ).toBe(403);

      const preview = await send<MemberImportResult>('POST', '/admin/import/members', admin.token, {
        csv,
        commit: false,
      });
      expect(preview.status).toBe(200);
      expect(preview.body.summary).toEqual({ new: 2, duplicate: 2, error: 1 });
      expect(preview.body.ignoredColumns).toEqual(['Lieblingsessen']);
      const [lena, , daniel, , kai] = preview.body.rows;
      expect(lena).toMatchObject({
        line: 2,
        birthDate: '2010-04-03',
        function: 'player',
        jerseyNumber: 23,
        team: { badge: 'B1' },
      });
      expect(daniel!.status).toBe('duplicate');
      expect(kai!.messages).toHaveLength(5);
      // Vorschau legt nichts an
      const before = await get<MemberListItem[]>('/admin/members?q=Import', admin.token);
      expect(before).toHaveLength(0);

      const done = await send<MemberImportResult>('POST', '/admin/import/members', admin.token, {
        csv,
        commit: true,
      });
      expect(done.body.imported).toBe(2);
      const after = await get<MemberListItem[]>('/admin/members?q=Import', admin.token);
      expect(after.map((m) => `${m.firstName} ${m.lastName}`).sort()).toEqual([
        'Jonas Import',
        'Lena Import',
      ]);
      // Zweiter Import erkennt alles als Dublette
      const again = await send<{ error: string }>('POST', '/admin/import/members', admin.token, {
        csv: csv.split('\n').slice(0, 3).join('\n'),
        commit: true,
      });
      expect(again.status).toBe(400);
      expect(again.body.error).toBe('import_nothing');
      expect(
        (
          await send('POST', '/admin/import/members', admin.token, {
            csv: 'a;b\n1;2',
            commit: false,
          })
        ).status,
      ).toBe(400);
    });
  });

  describe('Benachrichtigungen', () => {
    const HOUR = 3_600_000;
    const later = (hours: number) => new Date(NOW.getTime() + hours * HOUR).toISOString();
    const b1Of = async () => (await login('trainer')).me.teams.find((t) => t.badge === 'B1')!;
    const newEvent = async (token: string, teamId: string, hours: number, type = 'training') => {
      const res = await send<EventDetail>('POST', `/teams/${teamId}/events`, token, {
        type,
        startsAt: later(hours),
        ...(type === 'training' ? {} : { title: 'Teamabend' }),
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      return res.body;
    };
    const inboxFor = async (token: string, link: string) =>
      (await get<NotificationItem[]>('/notifications', token)).filter((n) => n.link === link);

    it('Einstellungen: Themen, stumme Mannschaft – Dringendes kommt immer an', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const b1 = await b1Of();
      const mine = await get<NotificationSettings>('/me/notification-settings', player.token);
      const keys = mine.topics.map((t) => t.key);
      expect(keys).toContain('events');
      expect(keys).not.toContain('responses');
      expect(keys).not.toContain('admin');
      expect(mine).toMatchObject({ reminderHours: 24, quietHours: { enabled: true } });
      expect(mine.teams.map((t) => t.badge)).toContain('B1');
      const coachSettings = await get<NotificationSettings>(
        '/me/notification-settings',
        coach.token,
      );
      expect(coachSettings.topics.map((t) => t.key)).toContain('responses');

      const foreign = coachSettings.teams.find((t) => !mine.teams.some((m) => m.id === t.id))!;
      expect(
        (
          await send('PUT', '/me/notification-settings', player.token, {
            mutedTeamIds: [foreign.id],
          })
        ).status,
      ).toBe(400);
      const muted = await send<NotificationSettings>(
        'PUT',
        '/me/notification-settings',
        player.token,
        { mutedTeamIds: [b1.id] },
      );
      expect(muted.body.teams.find((t) => t.id === b1.id)!.muted).toBe(true);

      const event = await newEvent(coach.token, b1.id, 30);
      expect(await inboxFor(player.token, `/events/${event.id}`)).toHaveLength(0);
      await send('POST', `/events/${event.id}/cancel`, coach.token, { reason: 'Platz gesperrt' });
      const urgent = await inboxFor(player.token, `/events/${event.id}`);
      expect(urgent.map((n) => n.level)).toEqual(['urgent']);

      // Thema aus: keine Terminmeldungen mehr
      await send('PUT', '/me/notification-settings', player.token, {
        mutedTeamIds: [],
        topics: { events: 'off' },
      });
      const silent = await newEvent(coach.token, b1.id, 31);
      expect(await inboxFor(player.token, `/events/${silent.id}`)).toHaveLength(0);
      await send('PUT', '/me/notification-settings', player.token, { topics: { events: 'push' } });
      await send('POST', `/events/${silent.id}/cancel`, coach.token, { reason: 'Test' });

      const read = await send('POST', '/notifications/read-all', player.token);
      expect(read.status).toBe(204);
      const all = await get<NotificationItem[]>('/notifications', player.token);
      expect(all.every((n) => n.readAt)).toBe(true);
    });

    it('Push: Gerät anmelden, Ruhezeit verschiebt, Dringendes sofort', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const b1 = await b1Of();
      const token = 'ExponentPushToken[spieler-test-1]';
      expect(
        (await send('POST', '/me/devices', player.token, { token: 'falsch', platform: 'ios' }))
          .status,
      ).toBe(400);
      expect(
        (await send('POST', '/me/devices', player.token, { token, platform: 'ios' })).status,
      ).toBe(204);
      // 09:00–12:00 Uhr Ruhezeit; jetzt ist es 10:00 Uhr in Berlin
      await send('PUT', '/me/notification-settings', player.token, {
        quietHours: { enabled: true, start: '09:00', end: '12:00' },
      });

      const event = await newEvent(coach.token, b1.id, 32);
      await runJobs(db, push, NOW);
      const toPlayer = () => push.sent.filter((m) => m.to === token);
      expect(toPlayer()).toHaveLength(0);
      await runJobs(db, push, new Date(NOW.getTime() + 2 * HOUR + 60_000));
      expect(toPlayer().map((m) => m.title)).toEqual(['Neuer Termin: Training']);
      expect(toPlayer()[0]!.data.link).toBe(`/events/${event.id}`);

      // Dringendes ignoriert die Ruhezeit
      await send('POST', `/events/${event.id}/cancel`, coach.token, { reason: 'Gewitter' });
      await runJobs(db, push, NOW);
      expect(toPlayer().at(-1)).toMatchObject({ title: 'Abgesagt: Training', priority: 'high' });

      // Abgemeldetes Gerät wird entfernt
      push.gone.add(token);
      const second = await newEvent(coach.token, b1.id, 33);
      await send('POST', `/events/${second.id}/cancel`, coach.token, { reason: 'Test' });
      await runJobs(db, push, NOW);
      expect(
        (await get<NotificationSettings>('/me/notification-settings', player.token)).devices,
      ).toBe(0);
      await send('PUT', '/me/notification-settings', player.token, {
        quietHours: { enabled: true, start: '22:00', end: '07:00' },
      });
    });

    it('Erinnerung an fehlende Zusage, Sammelhinweis und kurzfristige Absage', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const b1 = await b1Of();

      // Frist 3 Stunden vor Beginn → in 17 Stunden; Erinnerung 24 Stunden vorher ist fällig
      const soon = await newEvent(coach.token, b1.id, 20);
      await runJobs(db, push, NOW);
      await runJobs(db, push, NOW);
      const reminders = (await inboxFor(player.token, `/events/${soon.id}`)).filter((n) =>
        n.title.startsWith('Zusage offen'),
      );
      expect(reminders).toHaveLength(1);
      expect(reminders[0]!.level).toBe('action');

      // Ohne Erinnerung
      await send('PUT', '/me/notification-settings', player.token, { reminderHours: 0 });
      const quiet = await newEvent(coach.token, b1.id, 21);
      await runJobs(db, push, NOW);
      expect(
        (await inboxFor(player.token, `/events/${quiet.id}`)).some((n) =>
          n.title.startsWith('Zusage offen'),
        ),
      ).toBe(false);
      await send('PUT', '/me/notification-settings', player.token, { reminderHours: 24 });

      // Frist ist gerade abgelaufen → ein Sammelhinweis fürs Trainerteam
      const due = await newEvent(coach.token, b1.id, 2);
      await runJobs(db, push, NOW);
      await runJobs(db, push, NOW);
      const digest = await inboxFor(coach.token, `/events/${due.id}`);
      expect(digest.filter((n) => n.title === 'Rückmeldungen B1: Training')).toHaveLength(1);
      expect(digest.find((n) => n.title.startsWith('Rückmeldungen'))!.body).toMatch(
        /\d+ Zusagen · \d+ Absagen/,
      );

      // Termin ohne Frist: nach dem Sammelhinweis kommen Absagen einzeln
      const evening = await newEvent(coach.token, b1.id, 2, 'team_event');
      const late = await send(
        'PUT',
        `/events/${evening.id}/responses/${player.me.person.id}`,
        player.token,
        { status: 'no', reason: 'Krank' },
      );
      expect(late.status, JSON.stringify(late.body)).toBe(200);
      const notice = (await inboxFor(coach.token, `/events/${evening.id}`)).find((n) =>
        n.title.startsWith('Kurzfristige Absage'),
      );
      expect(notice).toMatchObject({
        level: 'important',
        title: 'Kurzfristige Absage: Max Becker',
      });
      expect(notice!.body).toContain('Krank');
    });
  });

  describe('Mannschaftsaufgaben', () => {
    it('Meine Teams: Kennzahlen je verantworteter Mannschaft', async () => {
      const coach = await login('trainer');
      const cards = await get<MyTeamCard[]>('/my-teams', coach.token);
      expect(cards.map((c) => c.team.badge)).toEqual(['B1', 'C1']);
      const b1 = cards.find((c) => c.team.badge === 'B1')!;
      expect(b1.openTasks).toBeGreaterThanOrEqual(2);
      expect(b1.nextEvent!.counts.yes + b1.nextEvent!.counts.pending).toBeGreaterThan(0);
      expect(await get<MyTeamCard[]>('/my-teams', (await login('spieler')).token)).toEqual([]);
    });

    it('Trainer legt an und teilt zu, Mitglieder übernehmen und haken ab', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const parent = await login('eltern');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;

      const seeded = await get<TeamTaskList>(`/teams/${b1.id}/tasks`, player.token);
      expect(seeded.canManage).toBe(false);
      expect(seeded.members).toHaveLength(0);
      const wash = seeded.open.find((t) => t.title === 'Trikots waschen')!;
      expect(wash.can).toMatchObject({ take: false, complete: true });
      // Startseite zeigt die eigene Aufgabe
      const home = await get<HomeResponse>('/home', player.token);
      expect(
        home.actions.some((a) => a.kind === 'task' && a.title === 'Aufgabe: Trikots waschen'),
      ).toBe(true);
      // Fremde Mannschaft: nicht sichtbar
      expect((await send('GET', `/teams/${b1.id}/tasks`, parent.token)).status).toBe(404);
      expect(
        (await send('POST', `/teams/${b1.id}/tasks`, player.token, { title: 'Test' })).status,
      ).toBe(403);

      const created = await send<TeamTaskList>('POST', `/teams/${b1.id}/tasks`, coach.token, {
        title: 'Bälle aufpumpen',
        dueOn: '2026-10-07',
      });
      expect(created.status).toBe(201);
      const balls = created.body.open.find((t) => t.title === 'Bälle aufpumpen')!;
      expect(balls.assignee).toBeNull();

      const taken = await send<TeamTaskList>('POST', `/tasks/${balls.id}/take`, player.token, {
        personId: player.me.person.id,
      });
      expect(taken.body.open.find((t) => t.id === balls.id)!.assignee!.name).toBe('Max Becker');
      // Schon vergeben
      const again = await send<{ error: string }>('POST', `/tasks/${balls.id}/take`, coach.token, {
        personId: coach.me.person.id,
      });
      expect(again.status).toBe(409);
      const done = await send<TeamTaskList>('POST', `/tasks/${balls.id}/done`, player.token);
      expect(done.body.done.some((t) => t.id === balls.id)).toBe(true);

      // Zuteilen benachrichtigt die Person
      const assigned = await send<TeamTaskList>('POST', `/teams/${b1.id}/tasks`, coach.token, {
        title: 'Getränke mitbringen',
        assigneePersonId: player.me.person.id,
      });
      const drinks = assigned.body.open.find((t) => t.title === 'Getränke mitbringen')!;
      const notes = await get<NotificationItem[]>('/notifications', player.token);
      expect(notes.some((n) => n.title === 'Aufgabe: Getränke mitbringen')).toBe(true);
      expect(
        (
          await send('POST', `/teams/${b1.id}/tasks`, coach.token, {
            title: 'Falsch',
            assigneePersonId: parent.me.person.id,
          })
        ).status,
      ).toBe(400);
      expect((await send('DELETE', `/tasks/${drinks.id}`, player.token)).status).toBe(403);
      const removed = await send<TeamTaskList>('DELETE', `/tasks/${drinks.id}`, coach.token);
      expect(removed.body.open.some((t) => t.id === drinks.id)).toBe(false);
    });
  });

  describe('Kommentare zu Freigaben und Anfragen', () => {
    it('News in der Freigabe und Spielerbedarf: nur Beteiligte, mit Benachrichtigung', async () => {
      const board = await login('vorstand');
      const admin = await login('admin');
      const coach = await login('trainer');
      const queue = await get<EditorialOverview>('/editorial/news', board.token);
      const pending = queue.toApprove[0]!;
      const posted = await send<CommentItem[]>(
        'POST',
        `/comments/news/${pending.id}`,
        board.token,
        {
          body: 'Bitte noch ein Foto ergänzen.',
        },
      );
      expect(posted.status).toBe(201);
      expect(posted.body.at(-1)).toMatchObject({ mine: true, author: 'Sandra Hoffmann' });
      const adminNotes = await get<NotificationItem[]>('/notifications', admin.token);
      expect(adminNotes.some((n) => n.title === `Kommentar: ${pending.title}`)).toBe(true);
      expect((await get<CommentItem[]>(`/comments/news/${pending.id}`, admin.token))[0]!.mine).toBe(
        false,
      );
      // Nicht beteiligt: unsichtbar
      expect((await send('GET', `/comments/news/${pending.id}`, coach.token)).status).toBe(404);

      const demand = (await get<ExchangeOverview>('/exchange', coach.token)).demands[0]!;
      const reply = await send<CommentItem[]>(
        'POST',
        `/comments/demand/${demand.id}`,
        coach.token,
        {
          body: 'Wir könnten zwei Spieler abstellen, Abfahrt wann?',
        },
      );
      expect(reply.status).toBe(201);
      const player = await login('spieler');
      expect((await send('GET', `/comments/demand/${demand.id}`, player.token)).status).toBe(403);
      expect(
        (await send('POST', `/comments/news/${pending.id}`, board.token, { body: '' })).status,
      ).toBe(400);
    });
  });

  describe('Veranstaltungen planen', () => {
    it('Vorstand plant ein Fest mit Ablauf und Helferschichten, alle werden informiert', async () => {
      const board = await login('vorstand');
      const coach = await login('trainer');
      const player = await login('spieler');
      expect((await send('GET', '/admin/club-events', coach.token)).status).toBe(403);
      const planning = await get<EventPlanning>('/admin/club-events', board.token);
      expect(planning.scopes[0]).toEqual({ orgUnitId: null, label: 'Ganzer Verein' });
      const day = '2026-11-14';
      const at = (time: string) => new Date(`${day}T${time}:00+01:00`).toISOString();
      const created = await send<EventPlanning>('POST', '/admin/club-events', board.token, {
        type: 'club_event',
        title: 'Herbstfest',
        description: 'Mit Tombola und Kinderbetreuung.',
        startsAt: at('14:00'),
        endsAt: at('20:00'),
        locationText: 'Vereinsheim',
        program: [
          { time: '14:00', title: 'Eröffnung' },
          { time: '16:00', title: 'Tombola' },
        ],
        shifts: [
          { title: 'Grill', startsAt: at('14:00'), endsAt: at('17:00'), capacity: 3 },
          { title: 'Kuchenstand', startsAt: at('14:00'), endsAt: at('18:00'), capacity: 2 },
        ],
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const fest = created.body.upcoming.find((e) => e.title === 'Herbstfest')!;
      expect(fest.shifts.map((x) => `${x.title} ${x.filled}/${x.capacity}`)).toEqual([
        'Grill 0/3',
        'Kuchenstand 0/2',
      ]);
      const notes = await get<NotificationItem[]>('/notifications', player.token);
      expect(
        notes.some(
          (n) => n.title === 'Veranstaltung: Herbstfest' && n.link === `/events/${fest.id}`,
        ),
      ).toBe(true);
      const helpers = await get<HelperEvent[]>('/helpers', player.token);
      expect(helpers.some((h) => h.event.id === fest.id && h.openSpots === 5)).toBe(true);

      const badShift = await send('POST', '/admin/club-events', board.token, {
        type: 'work_assignment',
        title: 'Platzpflege',
        startsAt: at('09:00'),
        endsAt: at('12:00'),
        shifts: [{ title: 'Laub', startsAt: at('12:00'), endsAt: at('10:00'), capacity: 4 }],
      });
      expect(badShift.status).toBe(400);
      const cancelled = await send('POST', `/events/${fest.id}/cancel`, board.token, {
        reason: 'Test beendet',
      });
      expect(cancelled.status).toBe(200);
    });
  });

  describe('Kalenderexport', () => {
    it('persönlicher Abo-Link mit eigenen und Vereinsterminen, erneuerbar', async () => {
      const player = await login('spieler');
      expect((await get<CalendarFeed>('/me/calendar', player.token)).url).toBeNull();
      const feed = await send<CalendarFeed>('POST', '/me/calendar', player.token);
      const path = new URL(feed.body.url!).pathname;
      expect(path).toMatch(/^\/calendar\/[\w-]+\.ics$/);
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      const ics = res.body;
      expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(ics).toContain('SUMMARY:B1 Training');
      expect(ics).toMatch(/SUMMARY:B1: (SV Grün-Weiß|.+ – SV Grün-Weiß)/);
      expect(ics).toContain('Jahreshauptversammlung');
      expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
      // Keine Termine anderer Mannschaften
      expect(ics).not.toContain('SUMMARY:C1 ');
      expect((await get<CalendarFeed>('/me/calendar', player.token)).url).toBe(feed.body.url);

      const renewed = await send<CalendarFeed>('POST', '/me/calendar', player.token);
      expect(renewed.body.url).not.toBe(feed.body.url);
      expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(404);
      await send('DELETE', '/me/calendar', player.token);
      expect(
        (await app.inject({ method: 'GET', url: new URL(renewed.body.url!).pathname })).statusCode,
      ).toBe(404);
    });
  });

  describe('Trainingsplanung', () => {
    it('Übungsbibliothek, Plan fürs Trainerteam, Schwerpunkt und Material für Spieler', async () => {
      const coach = await login('trainer');
      const player = await login('spieler');
      const library = await get<Exercise[]>('/exercises', coach.token);
      expect(library.length).toBeGreaterThanOrEqual(8);
      expect((await send('GET', '/exercises', player.token)).status).toBe(403);
      const added = await send<Exercise[]>('POST', '/exercises', coach.token, {
        title: 'Kopfballpendel',
        category: 'technique',
        durationMinutes: 10,
        material: 'Kopfballpendel, Bälle',
      });
      expect(added.status).toBe(201);
      const pendel = added.body.find((e) => e.title === 'Kopfballpendel')!;
      expect(pendel.canDelete).toBe(true);

      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const week = (await get<TeamOverview>(`/teams/${b1.id}`, coach.token)).trainingWeek;
      const plans = await Promise.all(
        week.map((e) => get<TrainingPlan>(`/events/${e.id}/training-plan`, coach.token)),
      );
      const seeded = plans.find((p) => p.focus === 'Gegenpressing nach Ballverlust')!;
      expect(seeded.items).toHaveLength(5);
      expect(seeded.material).toContain('Hütchen');
      expect(seeded.canEdit).toBe(true);

      const forPlayer = await get<TrainingPlan>(
        `/events/${seeded.eventId}/training-plan`,
        player.token,
      );
      expect(forPlayer).toMatchObject({
        focus: 'Gegenpressing nach Ballverlust',
        items: null,
        notes: null,
        canEdit: false,
      });
      expect(
        (await send('PUT', `/events/${seeded.eventId}/training-plan`, player.token, { items: [] }))
          .status,
      ).toBe(403);

      // Ein späteres Training ohne Plan: der eben gezeigte Plan dient als Vorlage
      // (andere Tests legen zusätzliche Trainings an – nur echt spätere zählen)
      const seededAt = week[plans.indexOf(seeded)]!.startsAt;
      const other = plans.find((p, i) => !p.focus && week[i]!.startsAt > seededAt)!;
      const saved = await send<TrainingPlan>(
        'PUT',
        `/events/${other.eventId}/training-plan`,
        coach.token,
        {
          focus: 'Kopfball',
          items: [
            { exerciseId: pendel.id, title: pendel.title, minutes: 10 },
            { title: 'Abschlussspiel', minutes: 30 },
          ],
        },
      );
      expect(saved.body).toMatchObject({ focus: 'Kopfball', totalMinutes: 40 });
      expect(saved.body.material).toEqual(['Kopfballpendel', 'Bälle']);
      expect(saved.body.previous).not.toBeNull();

      const match = (await get<TeamOverview>(`/teams/${b1.id}`, coach.token)).nextEvent!;
      if (match.type !== 'training')
        expect((await send('GET', `/events/${match.id}/training-plan`, coach.token)).status).toBe(
          400,
        );
      expect((await send('DELETE', `/exercises/${pendel.id}`, coach.token)).status).toBe(200);
    });
  });

  describe('Forum, Fundbüro/Marktplatz und Vereinswissen', () => {
    it('Mini-Forum: Einrichten über das Update-Center, antworten, melden, moderieren', async () => {
      const admin = await login('admin');
      const board = await login('vorstand');
      const player = await login('spieler');
      expect((await send('GET', '/forum', player.token)).status).toBe(403);
      expect(
        (await send('POST', '/admin/modules/forum', admin.token, { decision: 'enable' })).status,
      ).toBe(200);
      const forum = await get<ForumOverview>('/forum', player.token);
      expect(forum.canCreate).toBe(false);
      const topic = forum.topics.find((t) => t.title === 'Ideen für die Weihnachtsfeier')!;
      expect(topic).toMatchObject({ open: true, pinned: true, postCount: 2 });
      expect(
        (await send('POST', '/forum', player.token, { title: 'Neues', body: 'x', days: 7 })).status,
      ).toBe(403);
      const replied = await send<ForumTopicDetail>(
        'POST',
        `/forum/${topic.id}/posts`,
        player.token,
        {
          body: 'Ein Quiz mit Fragen zur Vereinsgeschichte!',
        },
      );
      expect(replied.status).toBe(201);
      expect(replied.body.posts.at(-1)).toMatchObject({ mine: true, author: 'Max Becker' });

      const first = replied.body.posts[0]!;
      await send('POST', `/forum/posts/${first.id}/report`, player.token);
      const boardNotes = await get<NotificationItem[]>('/notifications', board.token);
      expect(boardNotes.some((n) => n.title === 'Forum: Beitrag gemeldet')).toBe(true);
      const modView = await get<ForumTopicDetail>(`/forum/${topic.id}`, board.token);
      expect(modView.posts[0]!.reported).toBe(true);
      expect(
        (await send('POST', `/forum/posts/${first.id}/moderate`, player.token, { hidden: true }))
          .status,
      ).toBe(403);
      await send('POST', `/forum/posts/${first.id}/moderate`, board.token, { hidden: true });
      const hidden = await get<ForumTopicDetail>(`/forum/${topic.id}`, player.token);
      expect(hidden.posts[0]).toMatchObject({ hidden: true, body: null });

      await send('PATCH', `/forum/${topic.id}`, board.token, { closed: true });
      const closed = await send('POST', `/forum/${topic.id}/posts`, player.token, {
        body: 'Noch was',
      });
      expect(closed.status).toBe(409);
      const created = await send<ForumTopicDetail>('POST', '/forum', board.token, {
        title: 'Neue Trainingszeiten im Winter',
        body: 'Passt euch Montag 17:30 Uhr?',
        days: 14,
      });
      expect(created.status).toBe(201);
      expect(created.body.open).toBe(true);
    });

    it('Fundbüro und Marktplatz: Aushang, Rückfrage per Kommentar, erledigt', async () => {
      const player = await login('spieler');
      const parent = await login('eltern');
      const overview = await get<BoardOverview>('/board', player.token);
      expect(overview.kinds).toEqual(['found', 'lost', 'offer', 'search']);
      const shoes = overview.items.find((i) => i.title.startsWith('Fußballschuhe'))!;
      expect(shoes).toMatchObject({ kind: 'offer', detail: '15 €', mine: false, canClose: false });
      await send('POST', `/comments/board/${shoes.id}`, player.token, { body: 'Noch zu haben?' });
      const notes = await get<NotificationItem[]>('/notifications', parent.token);
      expect(notes.some((n) => n.title === `Kommentar: Biete: ${shoes.title}`)).toBe(true);
      expect((await send('POST', `/board/${shoes.id}/done`, player.token)).status).toBe(403);
      const done = await send<BoardOverview>('POST', `/board/${shoes.id}/done`, parent.token);
      expect(done.body.items.find((i) => i.id === shoes.id)!.done).toBe(true);

      const lost = await send<BoardOverview>('POST', '/board', player.token, {
        kind: 'lost',
        title: 'Blaue Trinkflasche',
        detail: 'Kunstrasen, Dienstag',
      });
      expect(lost.status).toBe(201);
      expect(lost.body.items[0]).toMatchObject({
        title: 'Blaue Trinkflasche',
        mine: true,
        canClose: true,
      });
    });

    it('Vereinswissen: alle lesen, die Verwaltung schreibt', async () => {
      const player = await login('spieler');
      const admin = await login('admin');
      const wiki = await get<WikiOverview>('/wiki', player.token);
      expect(wiki.canEdit).toBe(false);
      expect(wiki.categories).toEqual(['Anlage', 'Organisation', 'Sport']);
      const page = await get<WikiPage>(`/wiki/${wiki.pages[0]!.id}`, player.token);
      expect(page.body).toContain('Schlüssel');
      expect(
        (await send('POST', '/wiki', player.token, { title: 'Test', category: 'Test', body: 'x' }))
          .status,
      ).toBe(403);
      const created = await send<WikiPage>('POST', '/wiki', admin.token, {
        title: 'Trikotwäsche',
        category: 'Organisation',
        body: 'Trikots bei 30 Grad waschen, nicht in den Trockner.',
      });
      expect(created.status).toBe(201);
      const edited = await send<WikiPage>('PUT', `/wiki/${created.body.id}`, admin.token, {
        title: 'Trikotwäsche',
        category: 'Organisation',
        body: 'Trikots bei 30 Grad auf links waschen.',
      });
      expect(edited.body.updatedBy).toBe('Daniel Schäfer');
      expect((await send('DELETE', `/wiki/${created.body.id}`, admin.token)).status).toBe(204);
    });
  });

  describe('Anlage & Material und Schiedsrichter', () => {
    const today = '2026-10-05';

    it('Kabinenplan: Zuteilung, Doppelbelegung erkennen, Rechte', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const player = await login('spieler');
      const plan = await get<ChangingRoomPlan>(
        `/equipment/changing-rooms?date=${today}`,
        admin.token,
      );
      expect(plan.rooms.map((r) => r.name)).toEqual([
        'Kabine 1',
        'Kabine 2',
        'Kabine 3',
        'Kabine 4',
      ]);
      expect(plan.canAssign).toBe(true);
      // Kabinen tauchen nicht in der Platzbelegung auf
      const facilities = await get<{ name: string }[]>('/facilities', coach.token);
      expect(facilities.some((f) => f.name.startsWith('Kabine'))).toBe(false);

      const [a, b] = plan.events;
      expect(a && b).toBeTruthy();
      const room = plan.rooms[0]!.id;
      const one = await send<ChangingRoomPlan>(
        'PUT',
        `/events/${a!.id}/changing-room`,
        admin.token,
        { roomId: room, date: today },
      );
      expect(one.body.events.find((e) => e.id === a!.id)!.changingRoomId).toBe(room);
      expect(
        (
          await send('PUT', `/events/${a!.id}/changing-room`, player.token, {
            roomId: null,
            date: today,
          })
        ).status,
      ).toBe(403);
      // Zwei zeitgleiche Termine in derselben Kabine werden markiert
      const same = one.body.events.find(
        (e) => e.id !== a!.id && e.startsAt < a!.endsAt && a!.startsAt < e.endsAt,
      );
      if (same) {
        const both = await send<ChangingRoomPlan>(
          'PUT',
          `/events/${same.id}/changing-room`,
          admin.token,
          { roomId: room, date: today },
        );
        expect(both.body.events.find((e) => e.id === same.id)!.conflict).toBe(true);
      }
    });

    it('Schlüssel und Material: Ausgabe, eigene Gegenstände, Rücknahme', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const mine = await get<EquipmentOverview>('/equipment', coach.token);
      expect(mine.canManage).toBe(false);
      expect(mine.items).toHaveLength(0);
      expect(mine.mine.map((i) => i.name)).toEqual(['Schlüssel Vereinsheim']);

      const all = await get<EquipmentOverview>('/equipment', admin.token);
      const key = all.items.find((i) => i.name === 'Schlüssel Materialraum')!;
      expect(key.holder).toBeNull();
      const people = await get<{ personId: string; name: string }[]>(
        '/equipment/people?q=Muster',
        admin.token,
      );
      const max = people.find((p) => p.name === 'Max Mustermann')!;
      const handed = await send<EquipmentOverview>(
        'PUT',
        `/equipment/${key.id}/holder`,
        admin.token,
        { personId: max.personId },
      );
      expect(handed.body.items.find((i) => i.id === key.id)!.holder!.name).toBe('Max Mustermann');
      expect((await get<EquipmentOverview>('/equipment', coach.token)).mine).toHaveLength(2);
      expect(
        (await send('PUT', `/equipment/${key.id}/holder`, coach.token, { personId: null })).status,
      ).toBe(403);
      await send('PUT', `/equipment/${key.id}/holder`, admin.token, { personId: null });
      const added = await send<EquipmentOverview>('POST', '/equipment', admin.token, {
        kind: 'material',
        name: 'Stangen',
        quantity: 12,
        location: 'Materialraum',
      });
      expect(added.status).toBe(201);
    });

    it('Schadensmeldung: jeder meldet, Platzverantwortliche bearbeiten, Meldende erfahren es', async () => {
      const admin = await login('admin');
      const player = await login('spieler');
      const reported = await send<DamageOverview>('POST', '/damages', player.token, {
        title: 'Flutlicht Platz 2 flackert',
        description: 'Mast hinten links.',
      });
      expect(reported.status).toBe(201);
      const mine = reported.body.reports.find((r) => r.title === 'Flutlicht Platz 2 flackert')!;
      expect(mine).toMatchObject({ mine: true, status: 'open', reportedBy: null });
      expect(
        (await get<NotificationItem[]>('/notifications', admin.token)).some(
          (n) => n.title === 'Schaden gemeldet: Flutlicht Platz 2 flackert',
        ),
      ).toBe(true);
      expect(
        (await send('PATCH', `/damages/${mine.id}`, player.token, { status: 'done' })).status,
      ).toBe(403);
      const done = await send<DamageOverview>('PATCH', `/damages/${mine.id}`, admin.token, {
        status: 'done',
        resolution: 'Leuchtmittel getauscht.',
      });
      expect(done.body.reports.find((r) => r.id === mine.id)).toMatchObject({
        status: 'done',
        reportedBy: 'Max Becker',
      });
      expect(
        (await get<NotificationItem[]>('/notifications', player.token)).some(
          (n) => n.title === 'Deine Schadensmeldung ist erledigt',
        ),
      ).toBe(true);
    });

    it('Schiedsrichter: einteilen, bestätigen, absagen meldet dem Obmann', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const player = await login('spieler');
      expect((await send('GET', '/referees', player.token)).status).toBe(403);
      const own = await get<RefereeOverview>('/referees', coach.token);
      expect(own.canManage).toBe(false);
      expect(own.mine).toHaveLength(1);
      expect(own.mine[0]!.status).toBe('requested');
      const confirmed = await send<RefereeOverview>(
        'POST',
        `/referees/assignments/${own.mine[0]!.assignmentId}/respond`,
        coach.token,
        { status: 'confirmed' },
      );
      expect(confirmed.body.mine[0]!.status).toBe('confirmed');

      const lead = await get<RefereeOverview>('/referees', admin.token);
      expect(lead.referees.length).toBe(3);
      const open = lead.matches.find((m) => m.assignments.length === 0)!;
      const ref = lead.referees.find((r) => r.name !== 'Max Mustermann')!;
      const assigned = await send<RefereeOverview>('POST', '/referees/assignments', admin.token, {
        eventId: open.eventId,
        personId: ref.personId,
      });
      expect(
        assigned.body.matches.find((m) => m.eventId === open.eventId)!.assignments,
      ).toHaveLength(1);
      expect(
        (
          await send('POST', '/referees/assignments', admin.token, {
            eventId: open.eventId,
            personId: player.me.person.id,
          })
        ).status,
      ).toBe(400);
      const declined = await send<RefereeOverview>(
        'POST',
        `/referees/assignments/${own.mine[0]!.assignmentId}/respond`,
        coach.token,
        { status: 'declined' },
      );
      expect(declined.status).toBe(200);
      expect(
        (await get<NotificationItem[]>('/notifications', admin.token)).some(
          (n) => n.title === 'Schiedsrichter hat abgesagt',
        ),
      ).toBe(true);
    });
  });

  describe('Statistik-Zeitraum', () => {
    it('ganze Saison (Standard), letzter Monat und freier Zeitraum', async () => {
      const coach = await login('trainer');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;
      const season = await get<TeamStats>(`/teams/${b1.id}/stats`, coach.token);
      expect(season.period).toMatchObject({ kind: 'season', to: '2026-10-05' });
      expect(season.period.from).toBe(season.period.seasonStart);

      const month = await get<TeamStats>(`/teams/${b1.id}/stats?period=month`, coach.token);
      expect(month.period).toMatchObject({ kind: 'month', from: '2026-09-05', to: '2026-10-05' });
      expect(month.results.every((r) => r.startsAt >= '2026-09-04')).toBe(true);
      expect(month.highlights.played).toBeLessThanOrEqual(season.highlights.played);

      // Einzelner Spieltag: nur dieses Spiel zählt
      const last = season.results[0]!;
      const day = last.startsAt.slice(0, 10);
      const one = await get<TeamStats>(
        `/teams/${b1.id}/stats?period=custom&from=${day}&to=${day}`,
        coach.token,
      );
      expect(one.results.map((r) => r.eventId)).toEqual([last.eventId]);
      const goals = one.squad.reduce((a, r) => a + r.goals, 0);
      expect(goals).toBeLessThanOrEqual(last.goalsFor);

      // Ende in der Zukunft wird auf heute begrenzt, falsche Reihenfolge abgelehnt
      const future = await get<TeamStats>(
        `/teams/${b1.id}/stats?period=custom&from=2026-09-01&to=2026-12-31`,
        coach.token,
      );
      expect(future.period.to).toBe('2026-10-05');
      expect(
        (
          await send(
            'GET',
            `/teams/${b1.id}/stats?period=custom&from=2026-10-01&to=2026-09-01`,
            coach.token,
          )
        ).status,
      ).toBe(400);
      expect((await send('GET', `/teams/${b1.id}/stats?period=custom`, coach.token)).status).toBe(
        400,
      );
    });
  });

  describe('Darstellung', () => {
    it('hell ist Standard, dunkel wählt jede Person selbst', async () => {
      const player = await login('spieler');
      expect(player.me.user.colorMode).toBe('light');
      const dark = await send<LoginResponse['me']>('PUT', '/me/preferences', player.token, {
        colorMode: 'dark',
      });
      expect(dark.body.user.colorMode).toBe('dark');
      // Gilt für das Konto, nicht für andere
      expect((await login('trainer')).me.user.colorMode).toBe('light');
      expect((await login('spieler')).me.user.colorMode).toBe('dark');
      expect(
        (await send('PUT', '/me/preferences', player.token, { colorMode: 'lila' })).status,
      ).toBe(400);
      await send('PUT', '/me/preferences', player.token, { colorMode: 'light' });
    });
  });

  // Muss als Letztes laufen: der Saisonwechsel verändert Mannschaften und Zuordnungen
  describe('Saisonwechsel', () => {
    it('bereitet die nächste Saison vor, plant den Kader und startet sie', async () => {
      const admin = await login('admin');
      const coach = await login('trainer');
      const player = await login('spieler');
      const before = await get<TeamAdminOverview>('/admin/teams', admin.token);
      const oldB1 = before.teams.find((t) => t.badge === 'B1')!;
      const oldCash = await get<TeamCash>(`/teams/${oldB1.id}/cash`, coach.token);

      const prepared = await send<TeamAdminOverview>('POST', '/admin/seasons/next', admin.token, {
        copyPlayers: false,
      });
      expect(prepared.status).toBe(201);
      expect(prepared.body.next!.name).toBe('2027/28');
      expect(prepared.body.nextTeams).toHaveLength(before.teams.length);
      const nextB1 = prepared.body.nextTeams.find((t) => t.badge === 'B1')!;
      expect(nextB1).toMatchObject({ players: 0 });
      expect(nextB1.staff).toBeGreaterThan(0);
      expect(
        (await send('POST', '/admin/seasons/next', admin.token, { copyPlayers: true })).status,
      ).toBe(409);
      // Laufende Saison bleibt unverändert
      expect((await get<TeamAdminOverview>('/admin/teams', admin.token)).teams[0]!.id).toBe(
        before.teams[0]!.id,
      );

      // Kaderplanung: der B-Jugend-Spieler rückt in die A-Jugend auf
      const nextA1 = prepared.body.nextTeams.find((t) => t.badge === 'A1')!;
      const planned = await send<MemberDetail>(
        'POST',
        `/admin/members/${player.me.person.id}/memberships`,
        admin.token,
        { teamId: nextA1.id, function: 'player', jerseyNumber: 9 },
      );
      expect(planned.status).toBe(200);
      expect(planned.body.memberships.find((m) => m.upcoming)).toMatchObject({
        team: { badge: 'A1' },
      });

      expect(
        (await send('POST', `/admin/seasons/${prepared.body.next!.id}/start`, coach.token)).status,
      ).toBe(403);
      const started = await send<TeamAdminOverview>(
        'POST',
        `/admin/seasons/${prepared.body.next!.id}/start`,
        admin.token,
      );
      expect(started.status).toBe(200);
      expect(started.body.current.name).toBe('2027/28');
      expect(started.body.next).toBeNull();

      // Trainer behält seine Mannschaften samt Rechten, Kasse geht mit
      const coachMe = await get<LoginResponse['me']>('/me', coach.token);
      const newB1 = coachMe.teams.find((t) => t.badge === 'B1')!;
      expect(newB1.id).toBe(nextB1.id);
      const overviewB1 = await get<TeamOverview>(`/teams/${newB1.id}`, coach.token);
      expect(overviewB1.permissions.manageEvents).toBe(true);
      // Künftige Termine sind mitgewandert; der aufgerückte Spieler steht nicht mehr auf der B1-Liste
      expect(overviewB1.nextEvent).not.toBeNull();
      const nextEvent = await get<EventDetail>(`/events/${overviewB1.nextEvent!.id}`, coach.token);
      expect(nextEvent.participants.some((p) => p.personId === player.me.person.id)).toBe(false);
      expect(nextEvent.participants.some((p) => p.personId === coach.me.person.id)).toBe(true);
      const newCash = await get<TeamCash>(`/teams/${newB1.id}/cash`, coach.token);
      expect(newCash.balanceCents).toBe(oldCash.balanceCents);

      // Spieler ist jetzt in der A-Jugend, nicht mehr in der B-Jugend
      const playerMe = await get<LoginResponse['me']>('/me', player.token);
      expect(playerMe.teams.map((t) => t.badge)).toEqual(['A1']);
    });
  });
});
