/**
 * Hinweis an das Trainerteam, wenn ein Spieler aus der Aufstellung absagt oder auf „Unsicher“ stellt.
 *
 * Die Aufstellung ist ein Werkzeug des Trainerteams: Spieler und Eltern erhalten **keine** Benachrichtigung zur
 * Aufstellung (ob sie für die Mannschaft sichtbar ist, entscheidet allein der Trainer). Umgekehrt erfährt das
 * Trainerteam sofort, wenn jemand aus Startelf oder Bank wegfällt – egal ob die Aufstellung ein Entwurf oder
 * veröffentlicht ist.
 */
import { calendarDayOf, toIsoDate } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, inArray } from 'drizzle-orm';
import type { Actor } from '../actor';
import { coachUsers } from '../notify/coaches';
import { deliver } from '../notify/deliver';

export type LineupChange = {
  eventId: string;
  personId: string;
  status: 'no' | 'maybe';
  reason?: string | null;
};

export async function notifyLineupChanges(
  db: Db,
  actor: Actor,
  changes: LineupChange[],
  now: Date,
): Promise<void> {
  if (changes.length === 0) return;
  const lineups = await db
    .select({
      eventId: s.matchLineups.eventId,
      personId: s.matchLineups.personId,
      role: s.matchLineups.role,
    })
    .from(s.matchLineups)
    .where(
      and(
        eq(s.matchLineups.clubId, actor.club.id),
        inArray(s.matchLineups.eventId, [...new Set(changes.map((c) => c.eventId))]),
      ),
    );
  const inLineup = changes.filter((c) =>
    lineups.some((l) => l.eventId === c.eventId && l.personId === c.personId),
  );
  if (inLineup.length === 0) return;

  const events = await db
    .select({
      id: s.events.id,
      title: s.events.title,
      teamId: s.events.teamId,
      startsAt: s.events.startsAt,
      status: s.events.status,
    })
    .from(s.events)
    .where(inArray(s.events.id, [...new Set(inLineup.map((c) => c.eventId))]));
  const people = await db
    .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.persons)
    .where(inArray(s.persons.id, [...new Set(inLineup.map((c) => c.personId))]));
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));

  for (const change of inLineup) {
    const event = events.find((e) => e.id === change.eventId);
    // nur für kommende, nicht abgesagte Spiele und Termine mit Mannschaft
    if (!event?.teamId || event.status !== 'scheduled' || event.startsAt <= now) continue;
    const person = people.find((p) => p.id === change.personId);
    if (!person) continue;
    const role = lineups.find(
      (l) => l.eventId === change.eventId && l.personId === change.personId,
    )!.role;
    const coaches = (await coachUsers(db, event.teamId, today)).filter(
      (id) => id !== actor.user.id,
    );
    const reason = change.reason?.trim();
    await deliver(
      db,
      actor.club,
      coaches,
      {
        level: 'important',
        topic: 'responses',
        teamId: event.teamId,
        title:
          change.status === 'no'
            ? `Aufstellung: ${person.firstName} ${person.lastName} hat abgesagt`
            : `Aufstellung: ${person.firstName} ${person.lastName} ist unsicher`,
        body: [event.title, role === 'starter' ? 'Startelf' : 'Bank', reason]
          .filter(Boolean)
          .join(' · '),
        link: `/match/${event.id}/lineup`,
      },
      now,
    );
  }
}
