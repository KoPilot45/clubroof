/**
 * Vereinsbereich (Konzept §5): Dokumente, Mannschaften, Ansprechpartner und
 * „Heute auf der Anlage“.
 */
import {
  calendarDayOf,
  addDays,
  at,
  type ClubTeamGroup,
  type ContactGroup,
  type DocumentCategory,
  type DocumentItem,
  type EventSummary,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { Actor } from '../actor';
import { notFound } from '../errors';
import { fetchEventRows, summarizeEvents } from './events';
import { scopeLabels, scopeVisible } from './home';

// ── Dokumente ───────────────────────────────────────────────────────────────

export async function listDocuments(
  db: Db,
  actor: Actor,
  filter: { category?: DocumentCategory; q?: string; teamId?: string },
): Promise<DocumentItem[]> {
  const term = filter.q?.trim();
  const rows = await db
    .select()
    .from(s.documents)
    .where(
      and(
        eq(s.documents.clubId, actor.club.id),
        scopeVisible(actor, s.documents),
        filter.category ? eq(s.documents.category, filter.category) : undefined,
        filter.teamId
          ? and(eq(s.documents.scopeType, 'team'), eq(s.documents.scopeId, filter.teamId))
          : undefined,
        term
          ? or(ilike(s.documents.title, `%${term}%`), ilike(s.documents.fileName, `%${term}%`))
          : undefined,
      ),
    )
    .orderBy(desc(s.documents.createdAt));
  const labels = await scopeLabels(db, actor.club.id);
  return rows.map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    category: d.category,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt.toISOString(),
    source: { type: d.scopeType, label: labels.label(d.scopeType, d.scopeId) },
  }));
}

export async function loadVisibleDocument(db: Db, actor: Actor, id: string) {
  const [doc] = await db
    .select()
    .from(s.documents)
    .where(
      and(
        eq(s.documents.id, id),
        eq(s.documents.clubId, actor.club.id),
        scopeVisible(actor, s.documents),
      ),
    );
  if (!doc) throw notFound('Das Dokument');
  return doc;
}

// ── Mannschaften ────────────────────────────────────────────────────────────

export async function listClubTeams(db: Db, actor: Actor, now: Date): Promise<ClubTeamGroup[]> {
  const today = now.toISOString().slice(0, 10);
  const [units, teams, members] = await Promise.all([
    db
      .select()
      .from(s.orgUnits)
      .where(eq(s.orgUnits.clubId, actor.club.id))
      .orderBy(asc(s.orgUnits.sortOrder)),
    db
      .select({ team: s.teams })
      .from(s.teams)
      .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
      .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
      .orderBy(asc(s.teams.sortOrder)),
    db
      .select({
        teamId: s.teamMemberships.teamId,
        fn: s.teamMemberships.function,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.teamMemberships)
      .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
      .where(
        and(
          eq(s.teamMemberships.clubId, actor.club.id),
          or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
        ),
      ),
  ]);
  return units
    .map((unit) => ({
      orgUnit: { id: unit.id, name: unit.name },
      teams: teams
        .filter(({ team }) => team.orgUnitId === unit.id)
        .map(({ team }) => {
          const own = members.filter((m) => m.teamId === team.id);
          return {
            id: team.id,
            name: team.name,
            badge: team.badge,
            ageGroup: team.ageGroup,
            league: team.league,
            players: own.filter((m) => m.fn === 'player').length,
            coaches: own
              .filter((m) => m.fn === 'coach' || m.fn === 'assistant_coach')
              .map((m) => `${m.firstName} ${m.lastName}`),
            isMine: actor.teamIds.includes(team.id),
          };
        }),
    }))
    .filter((g) => g.teams.length > 0);
}

// ── Ansprechpartner ─────────────────────────────────────────────────────────

const FUNCTION_LABELS: Record<string, string> = {
  board: 'Vorstand',
  sports_director: 'Sportliche Leitung',
  youth_director: 'Jugendleitung',
  treasurer: 'Kasse',
  member_admin: 'Mitgliederverwaltung',
  facility_manager: 'Platz- und Materialwart',
  referee_lead: 'Schiedsrichterobmann',
};

export async function listContacts(db: Db, actor: Actor, now: Date): Promise<ContactGroup[]> {
  const today = now.toISOString().slice(0, 10);
  const [officials, coaches] = await Promise.all([
    db
      .select({
        person: s.persons,
        roleKey: s.roles.key,
        scopeType: s.roleAssignments.scopeType,
        unit: s.orgUnits.name,
      })
      .from(s.roleAssignments)
      .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
      .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
      .leftJoin(s.orgUnits, eq(s.orgUnits.id, s.roleAssignments.scopeId))
      .where(
        and(
          eq(s.roleAssignments.clubId, actor.club.id),
          inArray(s.roleAssignments.scopeType, ['club', 'org_unit']),
          inArray(s.roles.key, Object.keys(FUNCTION_LABELS)),
        ),
      ),
    db
      .select({
        person: s.persons,
        fn: s.teamMemberships.function,
        teamId: s.teams.id,
        badge: s.teams.badge,
        sort: s.teams.sortOrder,
      })
      .from(s.teamMemberships)
      .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
      .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
      .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
      .where(
        and(
          eq(s.teamMemberships.clubId, actor.club.id),
          eq(s.seasons.isCurrent, true),
          inArray(s.teamMemberships.function, ['coach', 'assistant_coach']),
          or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
        ),
      )
      .orderBy(asc(s.teams.sortOrder)),
  ]);

  // Funktionsträger sind Ansprechpartner für alle – außer sie haben ihre Kontaktdaten ganz eingeschränkt.
  const board = new Map<string, ContactGroup['contacts'][number]>();
  for (const o of officials) {
    const base = FUNCTION_LABELS[o.roleKey]!;
    // Bereich nur ergänzen, wenn er nicht schon im Namen steckt („Jugendleitung (Jugend)“ vermeiden)
    const label =
      o.scopeType === 'org_unit' && o.unit && !base.toLowerCase().includes(o.unit.toLowerCase())
        ? `${base} (${o.unit})`
        : base;
    const entry = board.get(o.person.id) ?? {
      personId: o.person.id,
      name: `${o.person.firstName} ${o.person.lastName}`,
      functions: [],
      email: o.person.contactVisibility !== 'coaches_only' ? o.person.email : null,
      phone: o.person.contactVisibility !== 'coaches_only' ? o.person.phone : null,
    };
    if (!entry.functions.includes(label)) entry.functions.push(label);
    board.set(o.person.id, entry);
  }

  // Trainer: Kontaktdaten für die eigenen Mannschaften, sonst nur bei vereinsweiter Freigabe.
  const coachMap = new Map<string, ContactGroup['contacts'][number]>();
  for (const c of coaches) {
    const ownTeam = actor.teamIds.includes(c.teamId);
    const visible =
      c.person.contactVisibility === 'club' ||
      (ownTeam && c.person.contactVisibility !== 'coaches_only');
    const label = `${c.fn === 'coach' ? 'Trainer' : 'Co-Trainer'} ${c.badge}`;
    const entry = coachMap.get(c.person.id) ?? {
      personId: c.person.id,
      name: `${c.person.firstName} ${c.person.lastName}`,
      functions: [],
      email: null,
      phone: null,
    };
    if (visible) {
      entry.email = c.person.email;
      entry.phone = c.person.phone;
    }
    entry.functions.push(label);
    coachMap.set(c.person.id, entry);
  }

  return [
    { title: 'Vorstand & Vereinsleitung', contacts: [...board.values()] },
    { title: 'Trainerinnen und Trainer', contacts: [...coachMap.values()] },
  ].filter((g) => g.contacts.length > 0);
}

// ── Heute auf der Anlage ────────────────────────────────────────────────────

export async function listToday(db: Db, actor: Actor, now: Date): Promise<EventSummary[]> {
  const day = calendarDayOf(now, actor.club.timezone);
  const start = at(day, '00:00', actor.club.timezone);
  const end = at(addDays(day, 1), '00:00', actor.club.timezone);
  const rows = await fetchEventRows(
    db,
    and(
      eq(s.events.clubId, actor.club.id),
      isNotNull(s.events.facilityId),
      gte(s.events.startsAt, start),
      lt(s.events.startsAt, end),
    ),
  );
  return summarizeEvents(db, actor, rows, now);
}
