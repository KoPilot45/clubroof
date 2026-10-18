import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clubs } from './club';
import { users } from './people';
import { teams } from './teams';
import { createdAt, id } from './_shared';

/**
 * Archiv (Paket AR): gelöschte Einträge liegen hier als Abbild (`payload`) und lassen sich wiederherstellen.
 * `retain_until` sperrt das endgültige Löschen (gesetzliche Aufbewahrung von Büchern und Belegen).
 */
export const archiveEntries = pgTable(
  'archive_entries',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    /** wiki | exercise | … (siehe ARCHIVE_KINDS) */
    kind: text().notNull(),
    /** Ursprüngliche ID des Eintrags (wird beim Wiederherstellen wieder verwendet) */
    /** Mannschaft (Team-Archiv); leer = Vereinsarchiv */
    teamId: uuid().references(() => teams.id, { onDelete: 'cascade' }),
    originalId: uuid().notNull(),
    label: text().notNull(),
    detail: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    archivedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    archivedAt: createdAt(),
    retainUntil: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.clubId, t.kind, t.archivedAt)],
);
