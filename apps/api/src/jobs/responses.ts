/**
 * Erinnerungen an fehlende Rückmeldungen und Sammelhinweise für Trainer (Konzept §10).
 * Läuft regelmäßig im Hintergrund; `dedupeKey` sorgt dafür, dass nichts doppelt ankommt.
 */
import { DEFAULT_REMINDER_HOURS, calendarDayOf, responseDeadline, toIsoDate } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
import { and, eq, gt, inArray, lt, ne } from 'drizzle-orm';
import { coachUsers, digestAt } from '../notify/coaches';
import { deliver } from '../notify/deliver';
import { toDeadlineRule } from '../services/events';

const HOUR = 3_600_000;
/** Ältere Fristen werden nicht nachträglich zusammengefasst (z. B. nach Serverpause) */
const DIGEST_GRACE_MS = 6 * HOUR;

type Club = typeof s.clubs.$inferSelect;

async function upcoming(db: Db | Tx, club: Club, now: Date, days: number) {
  const rows = await db
    .select({ event: s.events, team: s.teams })
    .from(s.events)
    .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(
      and(
        eq(s.events.clubId, club.id),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
        lt(s.events.startsAt, new Date(now.getTime() + days * 24 * HOUR)),
        ne(s.teams.participationMode, 'absences_only'),
      ),
    );
  if (rows.length === 0) return [];
  const rules = await db
    .select()
    .from(s.teamDeadlineRules)
    .where(inArray(s.teamDeadlineRules.teamId, [...new Set(rows.map((r) => r.team.id))]));
  return rows.map((r) => {
    const rule = rules.find((x) => x.teamId === r.team.id && x.eventType === r.event.type);
    const deadline = responseDeadline(r.event.startsAt, toDeadlineRule(rule), club.timezone);
    return { ...r, deadline, responseEnd: deadline ?? r.event.startsAt };
  });
}

const when = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);

/** Erinnert Spieler bzw. Eltern, deren Zu- oder Absage noch fehlt. */
export async function sendReminders(db: Db | Tx, club: Club, now: Date): Promise<number> {
  const events = (await upcoming(db, club, now, 10)).filter(
    (e) => e.team.participationMode === 'active_response' && e.responseEnd > now,
  );
  if (events.length === 0) return 0;
  const open = await db
    .select({ eventId: s.eventParticipants.eventId, person: s.persons })
    .from(s.eventParticipants)
    .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
    .where(
      and(
        inArray(
          s.eventParticipants.eventId,
          events.map((e) => e.event.id),
        ),
        eq(s.eventParticipants.status, 'pending'),
        eq(s.eventParticipants.role, 'player'),
      ),
    );
  if (open.length === 0) return 0;
  const personIds = [...new Set(open.map((o) => o.person.id))];
  const guardians = await db
    .select({ childId: s.guardianships.childPersonId, userId: s.persons.userId })
    .from(s.guardianships)
    .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
    .where(inArray(s.guardianships.childPersonId, personIds));
  const userIds = [
    ...new Set(
      [...open.map((o) => o.person.userId), ...guardians.map((g) => g.userId)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const prefs = userIds.length
    ? await db
        .select({
          userId: s.notificationPreferences.userId,
          hours: s.notificationPreferences.reminderHours,
        })
        .from(s.notificationPreferences)
        .where(inArray(s.notificationPreferences.userId, userIds))
    : [];
  const hoursOf = (userId: string) =>
    prefs.find((p) => p.userId === userId)?.hours ?? DEFAULT_REMINDER_HOURS;

  let sent = 0;
  for (const { eventId, person } of open) {
    const e = events.find((x) => x.event.id === eventId)!;
    const targets = [
      ...(person.userId ? [{ userId: person.userId, own: true }] : []),
      ...guardians
        .filter((g) => g.childId === person.id && g.userId)
        .map((g) => ({ userId: g.userId!, own: false })),
    ];
    for (const { userId, own } of targets) {
      const hours = hoursOf(userId);
      if (hours <= 0 || now.getTime() < e.responseEnd.getTime() - hours * HOUR) continue;
      sent += await deliver(
        db,
        club,
        [userId],
        {
          level: 'action',
          topic: 'reminders',
          teamId: e.team.id,
          title: own ? `Zusage offen: ${e.event.title}` : `Zusage offen für ${person.firstName}`,
          body: `${e.team.badge} · ${when(e.event.startsAt, club.timezone)} Uhr${
            e.deadline ? ` · Frist ${when(e.deadline, club.timezone)} Uhr` : ''
          }`,
          link: `/events/${eventId}`,
          dedupeKey: `reminder:${eventId}:${person.id}`,
        },
        now,
      );
    }
  }
  return sent;
}

/** Ein Sammelhinweis je Termin für das Trainerteam statt Einzelmeldungen. */
export async function sendCoachDigests(db: Db | Tx, club: Club, now: Date): Promise<number> {
  const events = (await upcoming(db, club, now, 3)).filter((e) => {
    const at = digestAt(e.event.startsAt, e.deadline).getTime();
    return at <= now.getTime() && at > now.getTime() - DIGEST_GRACE_MS;
  });
  let sent = 0;
  const today = toIsoDate(calendarDayOf(now, club.timezone));
  for (const e of events) {
    const coaches = await coachUsers(db, e.team.id, today);
    if (coaches.length === 0) continue;
    const rows = await db
      .select({
        status: s.eventParticipants.status,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.eventParticipants)
      .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
      .where(
        and(eq(s.eventParticipants.eventId, e.event.id), eq(s.eventParticipants.role, 'player')),
      );
    const n = (status: string) => rows.filter((r) => r.status === status).length;
    const pending = rows.filter((r) => r.status === 'pending');
    const parts = [
      `${n('yes')} Zusagen`,
      `${n('no')} Absagen`,
      n('maybe') ? `${n('maybe')} vielleicht` : null,
      pending.length ? `${pending.length} ohne Rückmeldung` : null,
    ].filter(Boolean);
    const missing = pending.length
      ? ` – offen: ${pending
          .slice(0, 5)
          .map((p) => `${p.firstName} ${p.lastName.slice(0, 1)}.`)
          .join(', ')}${pending.length > 5 ? ' …' : ''}`
      : '';
    sent += await deliver(
      db,
      club,
      coaches,
      {
        level: 'info',
        topic: 'responses',
        teamId: e.team.id,
        title: `Rückmeldungen ${e.team.badge}: ${e.event.title}`,
        body: `${when(e.event.startsAt, club.timezone)} Uhr · ${parts.join(' · ')}${missing}`,
        link: `/events/${e.event.id}`,
        dedupeKey: `digest:${e.event.id}`,
      },
      now,
    );
  }
  return sent;
}
