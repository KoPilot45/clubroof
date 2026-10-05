import {
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
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
    /** Filterkategorie: termine, team, verein, verwaltung, aktion */
    category: text().notNull(),
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
  (t) => [index().on(t.userId, t.createdAt)],
);
