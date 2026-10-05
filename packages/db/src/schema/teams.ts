import {
  foreignKey,
  boolean,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs, orgUnits, seasons } from './club';
import { persons } from './people';
import {
  createdAt,
  deadlineKindEnum,
  eventTypeEnum,
  id,
  participationModeEnum,
  teamFunctionEnum,
  teamTemplateEnum,
  updatedAt,
} from './_shared';

export const teams = pgTable(
  'teams',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    orgUnitId: uuid()
      .notNull()
      .references(() => orgUnits.id, { onDelete: 'restrict' }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    /** Kompaktes Badge, z. B. „B1“, „1.“, „AH“. */
    badge: text().notNull(),
    ageGroup: text(),
    league: text(),
    template: teamTemplateEnum().notNull(),
    participationMode: participationModeEnum().notNull(),
    sortOrder: integer().notNull().default(0),
    /** Mannschaft der Vorsaison (Saisonwechsel: Kasse, Dokumente und Verlauf gehen mit) */
    previousTeamId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.clubId),
    index().on(t.seasonId),
    foreignKey({ columns: [t.previousTeamId], foreignColumns: [t.id] }).onDelete('set null'),
  ],
);

/** Zeitlich definierte Zuordnung einer Person zu einer Mannschaft. */
export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    function: teamFunctionEnum().notNull(),
    jerseyNumber: smallint(),
    /** Stammteam des Spielers (für Gastspieler-Logik und persönliche Sicht). */
    isPrimaryTeam: boolean().notNull().default(true),
    validFrom: date().notNull(),
    validTo: date(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.clubId),
    index().on(t.teamId),
    index().on(t.personId),
    unique().on(t.teamId, t.personId, t.function, t.validFrom),
  ],
);

/**
 * Absagefristen je Mannschaft und Terminart (Konzept §9), z. B. Training 2 h vorher (`relative`)
 * oder Spiel am Freitag 18:00 Uhr (`weekday_time`).
 */
export const teamDeadlineRules = pgTable(
  'team_deadline_rules',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    eventType: eventTypeEnum().notNull(),
    kind: deadlineKindEnum().notNull(),
    minutesBefore: integer(),
    /** ISO-Wochentag 1 = Montag … 7 = Sonntag */
    weekday: smallint(),
    timeOfDay: time(),
  },
  (t) => [index().on(t.clubId), unique().on(t.teamId, t.eventType)],
);
