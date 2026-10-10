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
import { playerDemands } from './exchange';
import { teams } from './teams';
import {
  absenceKindEnum,
  attendanceStatusEnum,
  createdAt,
  eventStatusEnum,
  eventTypeEnum,
  id,
  lineupRoleEnum,
  matchIncidentKindEnum,
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
    /** Zugeteilte Kabine (Modul „Anlage & Material“) */
    changingRoomId: uuid().references(() => facilities.id, { onDelete: 'set null' }),
    locationText: text(),
    /** Maps-Link oder Koordinaten des Spielorts (für den Button „Route“) */
    locationUrl: text(),
    /** Gruppiert Serientermine (z. B. wöchentliches Training). */
    seriesId: uuid(),
    imageUrl: text(),
    /** Ablaufplan einer Veranstaltung, z. B. [{ time: '16:00', title: 'Eröffnung' }] */
    program: jsonb().$type<{ time: string; title: string }[]>(),
    contactPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    cancelledReason: text(),
    /** Trainerteam hat nach dem Termin die tatsächliche Anwesenheit erfasst */
    attendanceRecordedAt: timestamp({ withTimezone: true }),
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
  /** Aufstellung für die Mannschaft sichtbar und Nominierte benachrichtigt */
  lineupPublishedAt: timestamp({ withTimezone: true }),
  /** Spielbericht abgeschlossen – erst dann zählen Tore, Vorlagen und Karten in der Statistik */
  reportCompletedAt: timestamp({ withTimezone: true }),
});

/** Aufstellung bzw. Nominierung für ein Spiel (Startelf und Bank). */
export const matchLineups = pgTable(
  'match_lineups',
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
    role: lineupRoleEnum().notNull(),
    position: text(),
    /** Rückennummer für dieses Spiel (bei „je Spiel“ oder abweichend von der festen Nummer) */
    jerseyNumber: smallint(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), unique().on(t.eventId, t.personId)],
);

/** Ereignisse im Spielbericht: Tore (mit Vorlage), Karten. */
export const matchIncidents = pgTable(
  'match_incidents',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    kind: matchIncidentKindEnum().notNull(),
    /** Torschütze bzw. Spieler mit Karte; leer bei Eigentor des Gegners */
    personId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    assistPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    minute: smallint(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.eventId), index().on(t.personId)],
);

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
    /** Gastspieler: Bedarf, auf den hin der Spieler nominiert wurde */
    demandId: uuid().references((): AnyPgColumn => playerDemands.id, { onDelete: 'set null' }),
    respondedAt: timestamp({ withTimezone: true }),
    /** Person, die geantwortet hat (Spieler selbst, Elternteil oder Trainer stellvertretend). */
    respondedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    /** Tatsächlich anwesend (erfasst nach dem Termin); leer = nicht erfasst */
    attended: boolean(),
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

/** Fahrgemeinschaft: Jemand fährt zu einem Auswärtstermin und bietet Plätze an. */
export const carpoolOffers = pgTable(
  'carpool_offers',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    driverPersonId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    seats: smallint().notNull(),
    /** z. B. „Abfahrt 12:30 am Vereinsheim“ */
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), unique().on(t.eventId, t.driverPersonId)],
);

/** Mitfahrer in einer Fahrgemeinschaft (Spieler, auch Kinder über ihre Eltern). */
export const carpoolPassengers = pgTable(
  'carpool_passengers',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    offerId: uuid()
      .notNull()
      .references(() => carpoolOffers.id, { onDelete: 'cascade' }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  // Je Termin fährt eine Person nur in einem Auto mit
  (t) => [index().on(t.offerId), unique().on(t.eventId, t.personId)],
);

/** „Mitfahrt gesucht“ für einen Termin. */
export const carpoolRequests = pgTable(
  'carpool_requests',
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
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), unique().on(t.eventId, t.personId)],
);
