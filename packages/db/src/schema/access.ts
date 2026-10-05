import { boolean, index, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { clubs } from './club';
import { persons } from './people';
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
