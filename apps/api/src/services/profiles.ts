/**
 * Profile (Mappe S. 11): Spielerprofil mit Verfügbarkeit und Saisonwerten. Wer was sieht:
 *  - Name, Position, Fuß, Mannschaften: Person selbst, Eltern, Mitspieler, Trainerteam, Mitgliederverwaltung
 *  - Verfügbarkeitsgrund und Statistik: nur Person selbst, Eltern und das Trainerteam der Mannschaft
 *  - Kontaktdaten: nach Einstellung der Person (Verein / Team und Trainer / nur Trainer)
 */
import {
  calendarDayOf,
  toIsoDate,
  type PersonProfile,
  type PersonStats,
  type UpdateProfileInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { notFound } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { mediaReference } from './uploads';
import { presentSql } from './attendance';

const ABSENCE_LABELS = {
  vacation: 'Urlaub',
  injury: 'Verletzt',
  illness: 'Krank',
  school_work: 'Schule/Beruf',
  suspended: 'Gesperrt',
  other: 'Sonstiges',
} as const;

type Team = typeof s.teams.$inferSelect;

async function statsFor(db: Db, personId: string, teams: Team[], now: Date): Promise<PersonStats> {
  const rows = teams.length
    ? await db
        .select({
          teamId: s.events.teamId,
          type: s.events.type,
          present: presentSql,
          n: sql<number>`count(*)::int`,
        })
        .from(s.eventParticipants)
        .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
        .where(
          and(
            eq(s.eventParticipants.personId, personId),
            eq(s.eventParticipants.role, 'player'),
            inArray(
              s.events.teamId,
              teams.map((t) => t.id),
            ),
            eq(s.events.status, 'scheduled'),
            lt(s.events.startsAt, now),
            inArray(s.events.type, ['training', 'match', 'tournament']),
          ),
        )
        .groupBy(s.events.teamId, s.events.type, presentSql)
    : [];

  const teamIds = teams.map((t) => t.id);
  const [lineups, incidents] = teamIds.length
    ? await Promise.all([
        db
          .select({ teamId: s.events.teamId })
          .from(s.matchLineups)
          .innerJoin(s.events, eq(s.events.id, s.matchLineups.eventId))
          .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
          .where(
            and(
              eq(s.matchLineups.personId, personId),
              inArray(s.events.teamId, teamIds),
              lt(s.events.startsAt, now),
              isNotNull(s.matchDetails.lineupPublishedAt),
            ),
          ),
        db
          .select({
            teamId: s.events.teamId,
            kind: s.matchIncidents.kind,
            personId: s.matchIncidents.personId,
            assistPersonId: s.matchIncidents.assistPersonId,
          })
          .from(s.matchIncidents)
          .innerJoin(s.events, eq(s.events.id, s.matchIncidents.eventId))
          .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
          .where(
            and(
              inArray(s.events.teamId, teamIds),
              isNotNull(s.matchDetails.reportCompletedAt),
              or(
                eq(s.matchIncidents.personId, personId),
                eq(s.matchIncidents.assistPersonId, personId),
              ),
            ),
          ),
      ])
    : [[], []];

  const byTeam = teams.map((t) => {
    const own = rows.filter((r) => r.teamId === t.id);
    const trainings = own.filter((r) => r.type === 'training');
    const teamIncidents = incidents.filter((i) => i.teamId === t.id);
    return {
      teamId: t.id,
      badge: t.badge,
      trainings: trainings.reduce((a, r) => a + r.n, 0),
      trainingsAttended: trainings.filter((r) => r.present).reduce((a, r) => a + r.n, 0),
      matches: own.filter((r) => r.type !== 'training' && r.present).reduce((a, r) => a + r.n, 0),
      appearances: lineups.filter((l) => l.teamId === t.id).length,
      goals: teamIncidents.filter(
        (i) => i.personId === personId && (i.kind === 'goal' || i.kind === 'penalty_goal'),
      ).length,
      assists: teamIncidents.filter((i) => i.assistPersonId === personId).length,
    };
  });
  const trainings = byTeam.reduce((a, t) => a + t.trainings, 0);
  const attended = byTeam.reduce((a, t) => a + t.trainingsAttended, 0);
  return {
    trainings,
    trainingsAttended: attended,
    trainingRate: trainings ? Math.round((attended / trainings) * 100) : null,
    matches: byTeam.reduce((a, t) => a + t.matches, 0),
    appearances: byTeam.reduce((a, t) => a + t.appearances, 0),
    goals: byTeam.reduce((a, t) => a + t.goals, 0),
    assists: byTeam.reduce((a, t) => a + t.assists, 0),
    byTeam,
  };
}

export async function getProfile(
  db: Db,
  actor: Actor,
  personId: string,
  now: Date,
): Promise<PersonProfile> {
  const [person] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Das Profil');

  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const memberships = await db
    .select({ membership: s.teamMemberships, team: s.teams })
    .from(s.teamMemberships)
    .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(
      and(
        eq(s.teamMemberships.personId, personId),
        eq(s.seasons.isCurrent, true),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    )
    .orderBy(s.teams.sortOrder);

  const own = actor.managedIds.includes(personId);
  const relation = personId === actor.person.id ? 'self' : own ? 'child' : 'other';
  const teams = [...new Map(memberships.map((m) => [m.team.id, m.team])).values()];
  const sharedTeam = teams.some((t) => actor.teamIds.includes(t.id));
  const coachedTeams = teams.filter((t) => actorCan(actor, 'attendance.read', t));
  const clubWide = actorCan(actor, 'members.read');

  // Profile von Personen ohne Bezug zu mir sind nicht sichtbar
  if (!own && !sharedTeam && coachedTeams.length === 0 && !clubWide) throw notFound('Das Profil');

  const mayReadPrivate = own || coachedTeams.length > 0;
  const contactVisible =
    own ||
    clubWide ||
    coachedTeams.length > 0 ||
    person.contactVisibility === 'club' ||
    (person.contactVisibility === 'team_and_coaches' && sharedTeam);

  const [absence] = await db
    .select()
    .from(s.absences)
    .where(
      and(
        eq(s.absences.personId, personId),
        lte(s.absences.startsOn, today),
        gte(s.absences.endsOn, today),
      ),
    )
    .limit(1);

  const statTeams = own
    ? teams.filter((t) =>
        memberships.some((m) => m.team.id === t.id && m.membership.function === 'player'),
      )
    : coachedTeams.filter((t) =>
        memberships.some((m) => m.team.id === t.id && m.membership.function === 'player'),
      );

  return {
    personId: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    relation,
    avatarUrl: resolveMediaUrl(actor.links, person.avatarUrl, now),
    position: person.position,
    preferredFoot: person.preferredFoot,
    teams: memberships.map(({ membership, team }) => ({
      id: team.id,
      name: team.name,
      badge: team.badge,
      function: membership.function,
      jerseyNumber: membership.jerseyNumber,
      isPrimary: membership.isPrimaryTeam,
    })),
    availability: {
      available: !absence,
      reason: absence && mayReadPrivate ? ABSENCE_LABELS[absence.kind] : null,
      until: absence && mayReadPrivate ? absence.endsOn : null,
    },
    stats: mayReadPrivate && statTeams.length ? await statsFor(db, personId, statTeams, now) : null,
    contact: contactVisible ? { email: person.email, phone: person.phone } : null,
    contactVisibility: own ? person.contactVisibility : null,
    canEdit: own,
  };
}

export async function updateProfile(
  db: Db,
  actor: Actor,
  personId: string,
  input: UpdateProfileInput,
  now: Date,
): Promise<PersonProfile> {
  // Bearbeiten dürfen nur die Person selbst und ihre Eltern
  if (!actor.managedIds.includes(personId)) throw notFound('Das Profil');
  const patch: Partial<typeof s.persons.$inferInsert> = {};
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim().toLowerCase() || null;
  if (input.position !== undefined) patch.position = input.position;
  if (input.preferredFoot !== undefined) patch.preferredFoot = input.preferredFoot;
  if (input.contactVisibility !== undefined) patch.contactVisibility = input.contactVisibility;
  if (input.avatarImageId !== undefined)
    patch.avatarUrl = input.avatarImageId
      ? await mediaReference(db, actor, input.avatarImageId, 'avatar')
      : null;
  if (Object.keys(patch).length > 0) {
    await db.update(s.persons).set(patch).where(eq(s.persons.id, personId));
  }
  return getProfile(db, actor, personId, now);
}
