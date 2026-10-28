import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs } from './club';
import { persons, users } from './people';
import { teams } from './teams';
import {
  createdAt,
  id,
  moduleLevelEnum,
  moduleStateEnum,
  scopeTypeEnum,
  updatedAt,
} from './_shared';

/** Rolle = Sammlung von Berechtigungen (Schlüssel aus `@clubroof/core` PERMISSIONS). */
export const roles = pgTable(
  'roles',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    name: text().notNull(),
    description: text(),
    isSystem: boolean().notNull().default(false),
    permissions: text().array().notNull(),
    /** Standard-Geltungsbereich beim Vergeben (eigene Rollen; Standardrollen aus dem Kern) */
    scopeDefault: scopeTypeEnum().notNull().default('club'),
    /** Archivierte Rollen (Löschen mit Wiederherstellen, Paket ROLLEN-VERWALTUNG) */
    archivedAt: timestamp({ withTimezone: true }),
    /** Rechte-Stand der Rolle: neue Rechte aus Updates erkennt man daran, dass sie hier fehlen */
    knownPermissions: text().array(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.clubId, t.key)],
);

/** Vergabe einer Rolle an eine Person in einem Geltungsbereich. `scopeId` ist bei `club` leer. */
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    scopeType: scopeTypeEnum().notNull(),
    scopeId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), index().on(t.personId)],
);

/**
 * Individuelle Rechte: zusätzlich zu den Rollen vergibt die Administration einer Person einzelne
 * Rechte (vereinsweit). Eine Zeile je Person.
 */
export const personPermissions = pgTable(
  'person_permissions',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' })
      .unique(),
    permissions: text().array().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clubId)],
);

/**
 * Modulkonfiguration je Ebene (Verein → Bereich → Mannschaft). Fehlt ein Eintrag auf einer
 * Ebene, gilt die übergeordnete. `version` ermöglicht kontrollierte Migration bei Modul-Updates.
 */
export const moduleSettings = pgTable(
  'module_settings',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    scopeType: scopeTypeEnum().notNull(),
    scopeId: uuid(),
    moduleKey: text().notNull(),
    state: moduleStateEnum().notNull(),
    level: moduleLevelEnum().notNull().default('basic'),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    version: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.clubId),
    unique().on(t.clubId, t.scopeType, t.scopeId, t.moduleKey).nullsNotDistinct(),
  ],
);

/**
 * Einladung (Konzept §8): persönlich für eine bestehende Person (direkte Kontoeinrichtung) oder als
 * Mannschafts-Link/QR-Code, über den Interessierte eine Beitrittsanfrage stellen (mit Freigabe).
 */
export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    tokenHash: text().notNull().unique(),
    /** Kurzcode zum Eintippen (Hash, global eindeutig); leer = nur Link/QR */
    codeHash: text().unique(),
    /** Kurzcode verschlüsselt, damit er in der Einladungsübersicht erneut angezeigt werden kann */
    codeEncrypted: text(),
    /** Verschlüsselter Token, damit Mannschafts-Links/QR-Codes erneut angezeigt werden können */
    tokenEncrypted: text(),
    personId: uuid().references(() => persons.id, { onDelete: 'cascade' }),
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    email: text(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    /** Eigener Zugang für ein Kind: Stufe des Elternzugangs, die nach der Annahme gilt */
    guardianAccess: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    maxUses: integer(),
    useCount: integer().notNull().default(0),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), index().on(t.personId), index().on(t.teamId)],
);

/** Beitrittsanfrage über einen Mannschafts-Link; wird vom Trainerteam/der Verwaltung freigegeben. */
export const joinRequests = pgTable(
  'join_requests',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    invitationId: uuid()
      .notNull()
      .references(() => invitations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** player = tritt selbst bei, parent = Elternteil meldet ein Kind an */
    relation: text().notNull(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    birthDate: date(),
    childFirstName: text(),
    childLastName: text(),
    childBirthDate: date(),
    message: text(),
    status: text().notNull().default('pending'),
    decidedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    decidedAt: timestamp({ withTimezone: true }),
    decisionNote: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.status)],
);

/**
 * Betreiber der Plattform (Mandantenbetrieb). Bewusst außerhalb aller Vereine: keine Person, keine Rolle,
 * keine Vereinsrechte. Angelegt nur per Skript/Konfiguration, nie über die App.
 */
export const operators = pgTable('operators', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

/** Protokoll aller Betreiberaktionen (wer, was, welcher Verein). Bleibt auch nach dem Löschen eines Vereins. */
export const operatorAudit = pgTable(
  'operator_audit',
  {
    id: id(),
    operatorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    clubId: uuid().references(() => clubs.id, { onDelete: 'set null' }),
    action: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.createdAt)],
);

/** Freigabe des Vereins für den Support-Zugriff des Betreibers: zeitlich begrenzt und widerrufbar. */
export const supportGrants = pgTable(
  'support_grants',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    grantedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/**
 * Einrichtungseinladung für einen neuen Verein (Betreiber-Konsole). Der Admin löst den Code im
 * Einrichtungsassistenten ein und legt Verein und Zugang selbst an. Gespeichert wird nur der Hash.
 */
export const clubSetupInvites = pgTable(
  'club_setup_invites',
  {
    id: id(),
    codeHash: text().notNull().unique(),
    /** Der Code gilt nur für diese E-Mail-Adresse (Admin des neuen Vereins) */
    adminEmail: text().notNull(),
    /** Vorgeschlagener Vereinsname, nur zur Anzeige in der Konsole */
    clubNameHint: text().notNull(),
    createdByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    usedAt: timestamp({ withTimezone: true }),
    /** Verein, der mit dem Code eingerichtet wurde */
    clubId: uuid().references(() => clubs.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.adminEmail)],
);

/**
 * Admin-Wiederherstellung: Ist kein Admin mehr erreichbar, kündigt der Betreiber nach Prüfung außerhalb der App
 * einen neuen Admin an. Der Verein hat bis `notBefore` Zeit zu widersprechen; erst danach geht die Einladung raus.
 */
export const adminRecoveries = pgTable(
  'admin_recoveries',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text().notNull(),
    /** Hinweis des Betreibers, wie die Berechtigung geprüft wurde */
    note: text(),
    createdByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    notBefore: timestamp({ withTimezone: true }).notNull(),
    objectedAt: timestamp({ withTimezone: true }),
    objectedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);
