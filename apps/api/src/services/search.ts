/**
 * Globale Suche (Kopfzeile): Termine, Mitglieder, News und Mannschaften. Jeder Bereich folgt den
 * Sichtbarkeitsregeln der jeweiligen Seite – es wird nie mehr gefunden, als die Person dort sehen dürfte.
 */
import { calendarDayOf, toIsoDate, type SearchResponse } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { fetchEventRows } from './events';
import { myEventsCondition, scopeLabels, scopeVisible } from './home';

const DAY = 24 * 60 * 60 * 1000;

/** % und _ im Suchbegriff sind gewöhnliche Zeichen. */
const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function search(
  db: Db,
  actor: Actor,
  raw: string,
  now: Date,
): Promise<SearchResponse> {
  const q = raw.trim();
  const term = likeTerm(q);
  const [events, members, news, teams] = await Promise.all([
    searchEvents(db, actor, term, now),
    searchMembers(db, actor, term, now),
    searchNews(db, actor, term, now),
    searchTeams(db, actor, term),
  ]);
  return { events, members, news, teams };
}

async function searchEvents(db: Db, actor: Actor, term: string, now: Date) {
  const rows = await fetchEventRows(
    db,
    and(
      myEventsCondition(
        actor,
        new Date(now.getTime() - 90 * DAY),
        new Date(now.getTime() + 365 * DAY),
      ),
      ilike(s.events.title, term),
    ),
    12,
  );
  return rows.map((r) => ({
    id: r.event.id,
    title: r.event.title,
    startsAt: r.event.startsAt.toISOString(),
    status: r.event.status,
    type: r.event.type,
    teamBadge: r.team?.badge ?? null,
  }));
}

/** Personen wie auf dem Profil: eigene und Kinder, gemeinsame Mannschaft, betreute Mannschaft, Vereinsebene. */
async function searchMembers(db: Db, actor: Actor, term: string, now: Date) {
  const candidates = await db
    .select({
      id: s.persons.id,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.persons)
    .where(
      and(
        eq(s.persons.clubId, actor.club.id),
        ne(s.persons.membershipStatus, 'left'),
        or(
          ilike(s.persons.firstName, term),
          ilike(s.persons.lastName, term),
          ilike(s.persons.memberNumber, term),
        ),
      ),
    )
    .limit(40);
  if (candidates.length === 0) return [];
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const memberships = await db
    .select({ personId: s.teamMemberships.personId, team: s.teams })
    .from(s.teamMemberships)
    .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(
      and(
        inArray(
          s.teamMemberships.personId,
          candidates.map((c) => c.id),
        ),
        eq(s.seasons.isCurrent, true),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    );
  const clubWide = actorCan(actor, 'members.read');
  return candidates
    .map((c) => {
      const teams = [
        ...new Map(
          memberships.filter((m) => m.personId === c.id).map((m) => [m.team.id, m.team]),
        ).values(),
      ];
      const visible =
        actor.managedIds.includes(c.id) ||
        clubWide ||
        teams.some((t) => actor.teamIds.includes(t.id) || actorCan(actor, 'attendance.read', t));
      return visible
        ? {
            personId: c.id,
            name: `${c.firstName} ${c.lastName}`,
            teamBadges: teams.map((t) => t.badge),
          }
        : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 10);
}

async function searchNews(db: Db, actor: Actor, term: string, now: Date) {
  const labels = await scopeLabels(db, actor.club.id);
  const rows = await db
    .select()
    .from(s.announcements)
    .where(
      and(
        eq(s.announcements.clubId, actor.club.id),
        eq(s.announcements.status, 'published'),
        lte(s.announcements.publishedAt, now),
        scopeVisible(actor, s.announcements),
        or(ilike(s.announcements.title, term), ilike(s.announcements.teaser, term)),
      ),
    )
    .orderBy(desc(s.announcements.publishedAt))
    .limit(6);
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    publishedAt: n.publishedAt!.toISOString(),
    source: labels.label(n.scopeType, n.scopeId),
  }));
}

/** Alle Mannschaften des Vereins sind für jede Person sichtbar (Seite „Mannschaften“). */
async function searchTeams(db: Db, actor: Actor, term: string) {
  const rows = await db
    .select({ id: s.teams.id, name: s.teams.name, badge: s.teams.badge, league: s.teams.league })
    .from(s.teams)
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(
      and(
        eq(s.teams.clubId, actor.club.id),
        eq(s.seasons.isCurrent, true),
        or(ilike(s.teams.name, term), ilike(s.teams.badge, term)),
      ),
    )
    .orderBy(s.teams.sortOrder)
    .limit(6);
  return rows;
}
