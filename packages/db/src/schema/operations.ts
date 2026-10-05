import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs } from './club';
import { events } from './events';
import { persons, users } from './people';
import { teams } from './teams';
import { cashDirectionEnum, createdAt, documentCategoryEnum, id, scopeTypeEnum } from './_shared';

/** Helferschicht zu einer Veranstaltung (z. B. Grillstand 17–21 Uhr, 6 Helfer). */
export const helperShifts = pgTable(
  'helper_shifts',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    capacity: integer().notNull(),
  },
  (t) => [index().on(t.clubId), index().on(t.eventId)],
);

export const helperSignups = pgTable(
  'helper_signups',
  {
    shiftId: uuid()
      .notNull()
      .references(() => helperShifts.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.shiftId, t.personId] })],
);

/** Kasse einer Mannschaft (oder des Vereins, wenn `teamId` leer). */
export const cashAccounts = pgTable(
  'cash_accounts',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/**
 * Buchung. Beträge in Cent, immer positiv; die Richtung steht in `direction`.
 *
 * - Echte Geldbewegungen (`isCharge = false`) bestimmen den Kassenstand.
 * - Forderungen an eine Person (`isCharge = true`, z. B. Strafe oder Getränke) bewegen noch kein
 *   Geld, sondern belasten das persönliche Konto. Bezahlt die Person, folgt eine Einnahme mit
 *   Kategorie `einzahlung` und derselben `personId`.
 * - Persönlicher Saldo = Einzahlungen − Forderungen.
 */
export const cashTransactions = pgTable(
  'cash_transactions',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => cashAccounts.id, { onDelete: 'cascade' }),
    direction: cashDirectionEnum().notNull(),
    amountCents: integer().notNull(),
    /** z. B. beitrag, strafe, getraenke, sponsoring, material, fahrtkosten, einnahmen_spieltag */
    category: text().notNull(),
    description: text().notNull(),
    counterparty: text(),
    isCharge: boolean().notNull().default(false),
    personId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    bookedOn: date().notNull(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.accountId, t.bookedOn), index().on(t.personId)],
);

/** Dokument-Metadaten. Die Datei selbst liegt im S3-kompatiblen Storage unter `storageKey`. */
export const documents = pgTable(
  'documents',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    scopeType: scopeTypeEnum().notNull(),
    scopeId: uuid(),
    category: documentCategoryEnum().notNull(),
    title: text().notNull(),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    storageKey: text().notNull(),
    uploadedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/** Audit-Log für administrative Änderungen (Rollen, Spielerbewegungen, Konfiguration …). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: uuid(),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.createdAt)],
);

/**
 * Hochgeladene Bilder (News-Bilder, Vereinslogo). Ausgeliefert nur über signierte Links;
 * Inhalte und Typ werden beim Hochladen anhand der Datei selbst geprüft.
 */
export const media = pgTable(
  'media',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    storageKey: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    uploadedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);
