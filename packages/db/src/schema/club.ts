import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  clubColorEnum,
  colorModeEnum,
  createdAt,
  facilityKindEnum,
  id,
  orgUnitKindEnum,
  updatedAt,
} from './_shared';

/** Verein (Mandant). Alle fachlichen Tabellen verweisen über `club_id` hierauf. */
export const clubs = pgTable('clubs', {
  id: id(),
  name: text().notNull(),
  shortName: text().notNull(),
  slug: text().notNull().unique(),
  foundedYear: integer(),
  logoUrl: text(),
  colorTheme: clubColorEnum().notNull().default('green'),
  colorMode: colorModeEnum().notNull().default('system'),
  timezone: text().notNull().default('Europe/Berlin'),
  /** Vorstand, Verwaltung und Admins müssen die 2-Faktor-Anmeldung nutzen */
  requireTwoFactor: boolean().notNull().default(false),
  street: text(),
  postalCode: text(),
  city: text(),
  email: text(),
  phone: text(),
  website: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Bereiche wie Senioren, Jugend, Frauen/Mädchen, Alte Herren (als Baum). */
export const orgUnits = pgTable(
  'org_units',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    parentId: uuid(),
    name: text().notNull(),
    kind: orgUnitKindEnum().notNull(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.clubId),
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete('cascade'),
  ],
);

export const seasons = pgTable(
  'seasons',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    isCurrent: boolean().notNull().default(false),
  },
  (t) => [index().on(t.clubId)],
);

/** Plätze, Halle, Vereinsheim. */
export const facilities = pgTable(
  'facilities',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    shortName: text(),
    kind: facilityKindEnum().notNull(),
    address: text(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index().on(t.clubId)],
);

/** Sperrung eines Platzes (Platzpflege, Wetter, Veranstaltung) – gilt für den Zeitraum, nicht für einen Termin. */
export const facilityBlocks = pgTable(
  'facility_blocks',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: 'cascade' }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.startsAt), index().on(t.facilityId)],
);
