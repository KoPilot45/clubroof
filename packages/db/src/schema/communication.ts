import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs } from './club';
import { persons, users } from './people';
import {
  announcementPriorityEnum,
  createdAt,
  id,
  notificationLevelEnum,
  pollResultVisibilityEnum,
  publicationStatusEnum,
  scopeTypeEnum,
  updatedAt,
} from './_shared';

/** News/Ankündigung für Verein, Bereich oder Mannschaft. */
export const announcements = pgTable(
  'announcements',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    scopeType: scopeTypeEnum().notNull(),
    scopeId: uuid(),
    title: text().notNull(),
    teaser: text(),
    body: text().notNull(),
    imageUrl: text(),
    priority: announcementPriorityEnum().notNull().default('info'),
    status: publicationStatusEnum().notNull().default('draft'),
    authorPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    /** Rückmeldung der Freigabe bei Ablehnung („Bitte Uhrzeit ergänzen“) */
    reviewNote: text(),
    reviewedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    publishedAt: timestamp({ withTimezone: true }),
    viewCount: integer().notNull().default(0),
    likeCount: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clubId, t.publishedAt)],
);

export const polls = pgTable(
  'polls',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    scopeType: scopeTypeEnum().notNull(),
    scopeId: uuid(),
    question: text().notNull(),
    description: text(),
    closesAt: timestamp({ withTimezone: true }),
    resultVisibility: pollResultVisibilityEnum().notNull().default('after_vote'),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

export const pollOptions = pgTable('poll_options', {
  id: id(),
  pollId: uuid()
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),
  label: text().notNull(),
  sortOrder: smallint().notNull().default(0),
});

export const pollVotes = pgTable(
  'poll_votes',
  {
    pollId: uuid()
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid()
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.personId] })],
);

/** Eintrag im Notification-Center eines Nutzers. Push-Zustellung folgt mit der API. */
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    level: notificationLevelEnum().notNull(),
    /** Filterbereich im Notification-Center: team, verein, verwaltung */
    category: text().notNull(),
    /** Thema für die persönlichen Einstellungen (`NOTIFICATION_TOPICS`) */
    topic: text().notNull().default('events'),
    /** Mannschaft, auf die sich die Meldung bezieht (zum Stummschalten je Mannschaft) */
    teamId: uuid(),
    /** Verhindert doppelte Erinnerungen und Sammelhinweise */
    dedupeKey: text(),
    title: text().notNull(),
    body: text(),
    /** Deep Link in die App, z. B. `/events/<id>` */
    link: text(),
    readAt: timestamp({ withTimezone: true }),
    /** Aktionen verschwinden nach Erledigung aus „Offene Aktionen“. */
    doneAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.userId, t.createdAt),
    uniqueIndex()
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
  ],
);

/** Persönliche Benachrichtigungseinstellungen (ohne Zeile gelten die Voreinstellungen). */
export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  clubId: uuid()
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  /** Abweichungen von der Voreinstellung je Thema: push | app | off */
  topics: jsonb().$type<Record<string, string>>().notNull().default({}),
  mutedTeamIds: uuid()
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  reminderHours: smallint().notNull().default(24),
  quietHoursEnabled: boolean().notNull().default(true),
  quietStart: text().notNull().default('22:00'),
  quietEnd: text().notNull().default('07:00'),
  updatedAt: updatedAt(),
});

/** Geräte für Push (Expo Push Token). */
export const pushDevices = pgTable(
  'push_devices',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    platform: text().notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

/** Warteschlange für Push-Nachrichten (Ruhezeiten verschieben `sendAfter`). */
export const pushOutbox = pgTable(
  'push_outbox',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    notificationId: uuid()
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sendAfter: timestamp({ withTimezone: true }).notNull(),
    /** pending | sent | failed | dropped (gelesen, bevor gesendet wurde) */
    status: text().notNull().default('pending'),
    attempts: smallint().notNull().default(0),
    error: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status, t.sendAfter)],
);

/** Gelesen-Markierung je Nutzer (Grundlage für Aufrufe und optionale Lesebestätigung). */
export const announcementReads = pgTable(
  'announcement_reads',
  {
    announcementId: uuid()
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);

/** „Gefällt mir“ je Nutzer. */
export const announcementLikes = pgTable(
  'announcement_likes',
  {
    announcementId: uuid()
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);
