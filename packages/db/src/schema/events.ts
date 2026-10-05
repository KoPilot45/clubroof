import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs, facilities, orgUnits } from './club';
import { persons } from './people';
import { teams } from './teams';
import {
  absenceKindEnum,
  attendanceStatusEnum,
  createdAt,
  eventStatusEnum,
  eventTypeEnum,
  id,
  participantRoleEnum,
  updatedAt,
} from './_shared';

/** Termin: Training, Spiel, Turnier, Vereinsveranstaltung, Sitzung, Arbeitseinsatz. */
export const events = pgTable(
  'events',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    /** Mannschaftstermin; leer bei Vereins- oder Bereichsterminen. */
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    orgUnitId: uuid().references(() => orgUnits.id, { onDelete: 'set null' }),
    type: eventTypeEnum().notNull(),
    status: eventStatusEnum().notNull().default('scheduled'),
    title: text().notNull(),
    description: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }),
    meetingAt: timestamp({ withTimezone: true }),
    meetingPoint: text(),
    facilityId: uuid().references(() => facilities.id, { onDelete: 'set null' }),
    locationText: text(),
    /** Gruppiert Serientermine (z. B. wöchentliches Training). */
    seriesId: uuid(),
    imageUrl: text(),
    /** Ablaufplan einer Veranstaltung, z. B. [{ time: '16:00', title: 'Eröffnung' }] */
    program: jsonb().$type<{ time: string; title: string }[]>(),
    contactPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    cancelledReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clubId, t.startsAt), index().on(t.teamId, t.startsAt)],
);

/** Spieldaten zu einem Termin vom Typ `match`. */
export const matchDetails = pgTable('match_details', {
  eventId: uuid()
    .primaryKey()
    .references(() => events.id, { onDelete: 'cascade' }),
  clubId: uuid()
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  opponentName: text().notNull(),
  opponentLogoUrl: text(),
  isHome: boolean().notNull(),
  competition: text(),
  goalsFor: smallint(),
  goalsAgainst: smallint(),
});

/** Teilnahme einer Person an einem Termin, inkl. Gastspieler aus anderen Mannschaften. */
export const eventParticipants = pgTable(
  'event_participants',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    role: participantRoleEnum().notNull(),
    status: attendanceStatusEnum().notNull(),
    reason: text(),
    /** Bei Gastspielern: Stammteam, aus dem der Spieler abgestellt wurde. */
    guestFromTeamId: uuid().references(() => teams.id, { onDelete: 'set null' }),
    /** Abwesenheit, die diese Absage automatisch ausgelöst hat (wird beim Löschen zurückgenommen). */
    absenceId: uuid().references((): AnyPgColumn => absences.id, { onDelete: 'set null' }),
    respondedAt: timestamp({ withTimezone: true }),
    /** Person, die geantwortet hat (Spieler selbst, Elternteil oder Trainer stellvertretend). */
    respondedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clubId), index().on(t.personId), unique().on(t.eventId, t.personId)],
);

/** Globale Abwesenheit, gilt für alle (oder ausgewählte) Mannschaften der Person. */
export const absences = pgTable(
  'absences',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    kind: absenceKindEnum().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    /** Leer = gilt für alle Mannschaften der Person. */
    teamIds: uuid().array(),
    note: text(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), index().on(t.personId, t.startsOn)],
);
