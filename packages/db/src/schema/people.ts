import {
  boolean,
  date,
  integer,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs } from './club';
import {
  contactVisibilityEnum,
  createdAt,
  id,
  membershipStatusEnum,
  preferredFootEnum,
  updatedAt,
} from './_shared';

/** Login-Konto. Bewusst vereinsübergreifend, damit die Plattform später mehrere Vereine bedienen kann. */
export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(),
  displayName: text().notNull(),
  passwordHash: text(),
  /** Persönliche Darstellung: light (Standard) | dark | system */
  colorMode: text().notNull().default('light'),
  /** Persönliche Sprache (de | en). Leer = Sprache des Geräts */
  language: text(),
  /** Schnellzugriff auf Home: gewählte Einträge in Reihenfolge. Leer (null) = Standard der Rolle */
  quickLinks: text().array(),
  lastLoginAt: timestamp({ withTimezone: true }),
  passwordChangedAt: timestamp({ withTimezone: true }),
  /** TOTP-Geheimnis (verschlüsselt). Gesetzt = 2-Faktor-Anmeldung aktiv */
  totpSecret: text(),
  /** Noch nicht bestätigtes TOTP-Geheimnis während der Einrichtung (verschlüsselt) */
  totpPendingSecret: text(),
  /** Gehashte Wiederherstellungscodes, je Code einmal verwendbar */
  recoveryCodes: text().array(),
  /** Zuletzt angenommener TOTP-Zeitschritt (verhindert die Wiederverwendung eines Codes) */
  totpLastStep: integer(),
  /** 2-Faktor per Code aus einer E-Mail aktiv (Alternative oder Ergänzung zur Authenticator-App) */
  twoFactorEmail: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Zuletzt angesehen (je Person und Bereich, z. B. „forum“ oder „documents:<teamId>“): daraus entsteht „neu seit
 * dem letzten Besuch“ in den Kachel-Infos. Reiner Darstellungszustand, daher ohne `club_id` (hängt am Konto).
 */
export const userSeen = pgTable(
  'user_seen',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    seenAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/**
 * Reale Person im Verein. Bleibt über Mannschaftswechsel und Saisons hinweg bestehen.
 * Kinder haben in der Regel kein eigenes Login (`userId` leer) und werden über Eltern verwaltet.
 */
export const persons = pgTable(
  'persons',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    firstName: text().notNull(),
    lastName: text().notNull(),
    birthDate: date(),
    email: text(),
    phone: text(),
    avatarUrl: text(),
    memberNumber: text(),
    memberSince: date(),
    membershipStatus: membershipStatusEnum().notNull().default('active'),
    contactVisibility: contactVisibilityEnum().notNull().default('team_and_coaches'),
    preferredFoot: preferredFootEnum(),
    position: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clubId), index().on(t.userId), unique().on(t.clubId, t.userId)],
);

/** Eltern-Kind-Verknüpfung (Elternzugang). */
export const guardianships = pgTable(
  'guardianships',
  {
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    guardianPersonId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    childPersonId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.guardianPersonId, t.childPersonId] }), index().on(t.clubId)],
);

/**
 * Login-Sitzung. Das Token selbst wird nie gespeichert, nur sein SHA-256-Hash.
 * Sitzungen sind serverseitig widerrufbar (Abmelden, Konto sperren).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique(),
    userAgent: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastUsedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

/**
 * Einmal-Token für Konten: Passwort zurücksetzen, zweiter Anmeldeschritt (2-Faktor).
 * Gespeichert wird nur der Hash; der Token selbst steht im Link bzw. geht an die App.
 */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    /** Fehlversuche (E-Mail-Codes werden nach fünf Fehlversuchen ungültig) */
    attempts: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.purpose)],
);
