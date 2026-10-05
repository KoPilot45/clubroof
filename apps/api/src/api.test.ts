/**
 * Integrationstests der API gegen eine echte Datenbank mit Demoverein.
 * Die Uhr ist fest eingestellt, damit Fristen reproduzierbar geprüft werden können.
 * Werden übersprungen, wenn `DATABASE_URL` nicht gesetzt ist.
 */
import type { EventDetail, EventSummary, HomeResponse, LoginResponse } from '@clubroof/core';
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
});
