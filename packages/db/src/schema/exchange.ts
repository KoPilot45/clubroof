import { date, index, integer, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { clubs } from './club';
import { events } from './events';
import { persons } from './people';
import { teams } from './teams';
import { createdAt, demandStatusEnum, id, offerStatusEnum, updatedAt } from './_shared';

/**
 * Spielerbedarf einer Mannschaft für einen ihrer Termine (Konzept §6): „2–3 Spieler, bevorzugt Abwehr“.
 * Die konkreten Spieler wählt der Trainer der abgebenden Mannschaft aus; sie erscheinen als
 * Gastspieler (`event_participants.demand_id`).
 */
export const playerDemands = pgTable(
  'player_demands',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    eventId: uuid()
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    count: smallint().notNull(),
    positions: text().array().notNull().default([]),
    note: text(),
    status: demandStatusEnum().notNull().default('open'),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clubId, t.status), index().on(t.eventId)],
);

/** Angebot einer Mannschaft: „bis zu 2 Spieler an diesem Tag verfügbar“. */
export const playerOffers = pgTable(
  'player_offers',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    day: date().notNull(),
    count: integer().notNull(),
    note: text(),
    status: offerStatusEnum().notNull().default('open'),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.day)],
);
