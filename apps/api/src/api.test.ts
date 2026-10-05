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
  ContactGroup,
  DocumentItem,
  HelperEvent,
  HelperShift,
  NotificationItem,
  RosterEntry,
  TeamCash,
  TeamOverview,
  TeamStats,
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

const url = process.env.DATABASE_URL;
const NOW = new Date('2026-10-05T08:00:00Z'); // Montag, 10:00 Uhr in Berlin
const PASSWORD = 'clubroof-demo';
const email = (who: string) => `${who}@sv-gruen-weiss.example`;

describe.skipIf(!url)('API', () => {
  const { db, sql } = createDb(url);
  let app: Awaited<ReturnType<typeof buildApp>>;

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
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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
      expect(home.clubOverview).toMatchObject({ teams: 11, pendingApprovals: 2 });
      expect(home.clubOverview!.members).toBeGreaterThan(300);
      expect(home.actions.some((a) => a.kind === 'approval')).toBe(true);
    });

    it('Kasse: Kassenstände sieht nur, wer dafür berechtigt ist', async () => {
      const treasurer = await get<HomeResponse>('/home', (await login('kasse')).token);
      expect(treasurer.cash.map((c) => c.badge)).toEqual(['1.', '2.', 'B1']);
      expect(treasurer.cash.find((c) => c.badge === 'B1')!.balanceCents).toBe(51235);

      const player = await get<HomeResponse>('/home', (await login('spieler')).token);
      const b1 = player.cash.find((c) => c.badge === 'B1')!;
      expect(b1.balanceCents).toBeNull();
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

    it('Statistik: Quoten anderer nur für Verantwortliche; Modul muss aktiv sein', async () => {
      const b1 = await teamId('B1');
      const coach = await get<TeamStats>(`/teams/${b1}/stats`, (await login('trainer')).token);
      const player = await login('spieler');
      const own = await get<TeamStats>(`/teams/${b1}/stats`, player.token);
      expect(coach.players.length).toBeGreaterThan(10);
      expect(own.players.map((p) => p.personId)).toEqual([player.me.person.id]);

      const e1 = await teamId('E1');
      const res = await app.inject({
        method: 'GET',
        url: `/teams/${e1}/stats`,
        headers: { authorization: `Bearer ${(await login('eltern')).token}` },
      });
      expect(res.statusCode).toBe(403);
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
      expect(own.balanceCents).toBeNull();
      expect(own.entries).toBeNull();
      expect(own.personal).toHaveLength(1);
      const denied = await send('POST', `/teams/${b1}/cash/bookings`, player.token, {
        kind: 'income',
        amountCents: 100,
        description: 'Test',
      });
      expect(denied.status).toBe(403);
      const finesOff = await send('POST', `/teams/${b1}/cash/bookings`, treasurer.token, {
        kind: 'fine',
        amountCents: 100,
        description: 'Test',
        personId: player.me.person.id,
      });
      expect(finesOff.status).toBe(400);
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

    it('Trainer schreiben für ihre Mannschaft und reichen zur Freigabe ein', async () => {
      const spieler = await login('spieler');
      const denied = await app.inject({
        method: 'GET',
        url: '/editorial/news',
        headers: { authorization: `Bearer ${spieler.token}` },
      });
      expect(denied.statusCode).toBe(403);

      const coach = await login('trainer');
      expect(coach.me.news).toEqual({ write: true, publish: false });
      const overview = await get<EditorialOverview>('/editorial/news', coach.token);
      expect(overview.scopes.map((sc) => sc.label).sort()).toEqual([
        'B1 · B-Jugend',
        'C1 · C-Jugend',
      ]);
      expect(overview.scopes.every((sc) => !sc.canPublish)).toBe(true);
      expect(overview.mine.map((n) => n.status).sort()).toEqual(['draft', 'pending_approval']);
      expect(overview.toApprove).toHaveLength(0);

      const b1 = overview.scopes.find((sc) => sc.label.startsWith('B1'))!;
      const direct = await send('POST', '/editorial/news', coach.token, draft(b1.id!, 'publish'));
      expect(direct.status).toBe(403);
      const club = await send('POST', '/editorial/news', coach.token, {
        ...draft(b1.id!, 'submit'),
        scopeType: 'club',
        scopeId: null,
      });
      expect(club.status).toBe(403);
    });

    it('Freigabe mit Rückgabe, Überarbeitung und Veröffentlichung', async () => {
      const coach = await login('trainer');
      const board = await login('vorstand');
      const b1 = coach.me.teams.find((t) => t.badge === 'B1')!;

      const submitted = await send<EditorialNews>(
        'POST',
        '/editorial/news',
        coach.token,
        draft(b1.id, 'submit'),
      );
      expect(submitted.status).toBe(201);
      expect(submitted.body.status).toBe('pending_approval');
      const id = submitted.body.id;

      // Vorstand wird benachrichtigt und sieht die Einreichung
      const boardNotes = await get<NotificationItem[]>('/notifications', board.token);
      expect(boardNotes.some((n) => n.link === `/admin/news/${id}`)).toBe(true);
      const queue = await get<EditorialOverview>('/editorial/news', board.token);
      expect(queue.toApprove.some((n) => n.id === id)).toBe(true);
      // Trainer kann nicht selbst freigeben
      expect((await send('POST', `/editorial/news/${id}/approve`, coach.token)).status).toBe(403);

      const rejected = await send<EditorialNews>(
        'POST',
        `/editorial/news/${id}/reject`,
        board.token,
        {
          note: 'Bitte das Ergebnis des Finales ergänzen.',
        },
      );
      expect(rejected.body).toMatchObject({
        status: 'draft',
        reviewNote: 'Bitte das Ergebnis des Finales ergänzen.',
      });
      const coachNotes = await get<NotificationItem[]>('/notifications', coach.token);
      expect(coachNotes.some((n) => n.title === 'News zurückgegeben')).toBe(true);

      const resubmitted = await send<EditorialNews>('PUT', `/editorial/news/${id}`, coach.token, {
        ...draft(b1.id, 'submit'),
        body: 'Unsere B-Jugend hat das Hallenturnier gewonnen – Finale 3:0.',
      });
      expect(resubmitted.body.status).toBe('pending_approval');
      expect(resubmitted.body.reviewNote).toBeNull();

      const approved = await send<EditorialNews>(
        'POST',
        `/editorial/news/${id}/approve`,
        board.token,
      );
      expect(approved.body.status).toBe('published');

      // Sichtbar für die B-Jugend, nicht für andere Mannschaften
      const playerNews = await get<NewsItem[]>('/news', (await login('spieler')).token);
      expect(playerNews.some((n) => n.id === id)).toBe(true);
      const parentNews = await get<NewsItem[]>('/news', (await login('eltern')).token);
      expect(parentNews.some((n) => n.id === id)).toBe(false);

      // Nach der Veröffentlichung darf der Trainer nicht mehr ändern, der Vorstand zieht zurück
      const late = await send('PUT', `/editorial/news/${id}`, coach.token, draft(b1.id, 'draft'));
      expect(late.status).toBe(403);
      expect((await send('DELETE', `/editorial/news/${id}`, board.token)).status).toBe(204);
      const after = await get<NewsItem[]>('/news', (await login('spieler')).token);
      expect(after.some((n) => n.id === id)).toBe(false);
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
      expect(overview.updates.map((m) => m.key).sort()).toEqual([
        'forum',
        'lost_and_found',
        'training_planning',
      ]);
      expect(overview.modules.find((m) => m.key === 'team_cash')!.enabledTeams).toBeGreaterThan(0);

      expect(
        (await send('POST', '/admin/modules/events', admin.token, { decision: 'disable' })).status,
      ).toBe(409);
      const later = await send<ModuleOverview>('POST', '/admin/modules/forum', admin.token, {
        decision: 'later',
      });
      expect(later.body.updates.some((m) => m.key === 'forum')).toBe(false);
      expect(later.body.modules.find((m) => m.key === 'forum')!.snoozedUntil).not.toBeNull();
      const declined = await send<ModuleOverview>(
        'POST',
        '/admin/modules/lost_and_found',
        admin.token,
        {
          decision: 'decline',
        },
      );
      expect(declined.body.updates.map((m) => m.key)).toEqual(['training_planning']);
      const enabled = await send<ModuleOverview>(
        'POST',
        '/admin/modules/training_planning',
        admin.token,
        {
          decision: 'enable',
        },
      );
      expect(enabled.body.updates).toHaveLength(0);
      expect(enabled.body.modules.find((m) => m.key === 'training_planning')!.state).toBe(
        'enabled',
      );
      const me = await get<LoginResponse['me']>('/me', admin.token);
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
      // Trainer selbst dürfen Module nicht umstellen
      expect(
        (
          await send('PUT', `/admin/teams/${b1.id}/modules/statistics`, coach.token, {
            enabled: true,
          })
        ).status,
      ).toBe(403);
      await send('PUT', `/admin/teams/${b1.id}/modules/statistics`, admin.token, { enabled: true });
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
    it('Kader-Statistik für alle, Trainingsquoten nur fürs Trainerteam', async () => {
      const player = await login('spieler');
      const coach = await login('trainer');
      const b1 = player.me.teams.find((t) => t.badge === 'B1')!;
      const forPlayer = await get<TeamStats>(`/teams/${b1.id}/stats`, player.token);
      expect(forPlayer.showsTrainingRates).toBe(false);
      expect(forPlayer.squad.length).toBeGreaterThan(15);
      const goals = forPlayer.squad.reduce((a, r) => a + r.goals, 0);
      expect(goals).toBeGreaterThan(0);
      expect(goals).toBeLessThanOrEqual(forPlayer.highlights.goalsFor);
      expect(forPlayer.squad.some((r) => r.appearances > 0)).toBe(true);
      // Fremde Trainingsquoten bleiben verborgen, die eigene ist sichtbar
      const others = forPlayer.squad.filter((r) => r.personId !== player.me.person.id);
      expect(others.every((r) => r.trainingRate === null)).toBe(true);
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
