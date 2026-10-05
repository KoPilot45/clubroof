/**
 * Integrationstests der API gegen eine echte Datenbank mit Demoverein.
 * Die Uhr ist fest eingestellt, damit Fristen reproduzierbar geprüft werden können.
 * Werden übersprungen, wenn `DATABASE_URL` nicht gesetzt ist.
 */
import type {
  Absence,
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
import { createDb } from '@clubroof/db';
import { runMigrations } from '@clubroof/db/migrate';
import { seed } from '@clubroof/db/seed';
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
    app = await buildApp({ db, config: loadConfig({ LOGIN_RATE_LIMIT: '1000' }), now: () => NOW });
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
    method: 'POST' | 'PUT' | 'DELETE',
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
      expect(created.status).toBe(201);
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
      expect(created.status).toBe(201);
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
});
