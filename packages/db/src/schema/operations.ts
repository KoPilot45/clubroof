import {
  type AnyPgColumn,
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
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { clubs, facilities } from './club';
import { absences, events } from './events';
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
    /** Bezahlinfos, Getränkepreis, Sichtbarkeit, Erinnerungen (Kassenverwaltung) */
    settings: jsonb()
      .$type<{
        iban?: string | null;
        accountHolder?: string | null;
        paypalLink?: string | null;
        drinkPriceCents?: number | null;
        showMemberBalances?: boolean;
        autoReminder?: boolean;
      }>()
      .notNull()
      .default({}),
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
    /** Strafe aus dem Strafenkatalog (für die Statistik je Strafenart) */
    fineTypeId: uuid().references((): AnyPgColumn => cashFineTypes.id, { onDelete: 'set null' }),
    /** Mannschaftsbeitrag, aus dem die Forderung stammt */
    feeId: uuid().references((): AnyPgColumn => cashFees.id, { onDelete: 'set null' }),
    /** bar | ueberweisung | paypal */
    paymentMethod: text(),
    /** Beleg (Bild) als Medienverweis */
    receiptRef: text(),
    bookedOn: date().notNull(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    /** Storniert: zählt nirgends mehr, bleibt aber sichtbar und im Protokoll */
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    cancelReason: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.accountId, t.bookedOn), index().on(t.personId)],
);

/** Strafenkatalog einer Mannschaft: Trainerteam bzw. Kassenwart legen Strafen und Beträge fest. */
export const cashFineTypes = pgTable(
  'cash_fine_types',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    amountCents: integer().notNull(),
    /** Entfernte Strafen bleiben für alte Buchungen erhalten */
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.teamId)],
);

/** Mannschaftsbeitrag: wird allen Spielern regelmäßig (oder einmalig) als Forderung gebucht. */
export const cashFees = pgTable(
  'cash_fees',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    amountCents: integer().notNull(),
    /** monthly | season | once */
    interval: text().notNull(),
    /** Nächste Fälligkeit; leer = beendet */
    nextDueOn: date(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.teamId)],
);

/** „Ich habe überwiesen“: Meldung eines Mitglieds, die der Kassenwart bestätigt. */
export const cashPaymentNotices = pgTable(
  'cash_payment_notices',
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
    amountCents: integer().notNull(),
    paymentMethod: text().notNull(),
    note: text(),
    /** pending | confirmed | rejected */
    status: text().notNull().default('pending'),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    decidedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    decidedAt: timestamp({ withTimezone: true }),
    transactionId: uuid().references(() => cashTransactions.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.teamId)],
);

/** Kassenprüfung bzw. Saisonabschluss: Stand zum Stichtag, geprüft von … */
export const cashClosings = pgTable(
  'cash_closings',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    closedOn: date().notNull(),
    balanceCents: integer().notNull(),
    openCents: integer().notNull(),
    auditor: text(),
    note: text(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.teamId)],
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

/**
 * Mannschaftsaufgaben (Konzept §4): Fahrdienst, Trikotwäsche, Kuchen … Ohne Zuständige ist die
 * Aufgabe offen für Freiwillige aus der Mannschaft (auch Eltern für ihr Kind).
 */
export const teamTasks = pgTable(
  'team_tasks',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    eventId: uuid().references(() => events.id, { onDelete: 'set null' }),
    title: text().notNull(),
    note: text(),
    dueOn: date(),
    assigneePersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    doneAt: timestamp({ withTimezone: true }),
    doneByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.teamId, t.doneAt), index().on(t.assigneePersonId)],
);

/** Übungsbibliothek des Vereins (Trainingsplanung). */
export const exercises = pgTable(
  'exercises',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    /** warmup | technique | tactics | fitness | finishing | game | cooldown */
    category: text().notNull(),
    durationMinutes: integer().notNull(),
    players: text(),
    material: text(),
    description: text(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.category)],
);

/** Plan für ein Training: Schwerpunkt und Ablauf aus Übungen. */
export const trainingPlans = pgTable('training_plans', {
  eventId: uuid()
    .primaryKey()
    .references(() => events.id, { onDelete: 'cascade' }),
  clubId: uuid()
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  focus: text(),
  notes: text(),
  items: jsonb()
    .$type<{ exerciseId: string | null; title: string; minutes: number; note: string | null }[]>()
    .notNull()
    .default([]),
  updatedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Material und Schlüssel mit Ausgabe an Personen (Modul „Anlage & Material“). */
export const equipmentItems = pgTable(
  'equipment_items',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    /** material | key */
    kind: text().notNull(),
    name: text().notNull(),
    quantity: integer().notNull().default(1),
    location: text(),
    note: text(),
    holderPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    handedOutAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.kind), index().on(t.holderPersonId)],
);

/** Schadensmeldungen zur Anlage (Konzept §6, §12). */
export const damageReports = pgTable(
  'damage_reports',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    facilityId: uuid().references(() => facilities.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text(),
    imageUrl: text(),
    /** open | in_progress | done */
    status: text().notNull().default('open'),
    resolution: text(),
    reportedByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    reportedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.clubId, t.status)],
);

/** Vereinsschiedsrichter (Modul „Schiedsrichter“): vom Verband bei fremden Spielen eingesetzt. */
export const referees = pgTable('referees', {
  personId: uuid()
    .primaryKey()
    .references(() => persons.id, { onDelete: 'cascade' }),
  clubId: uuid()
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  /** z. B. „Jungschiedsrichter“, „Kreisliga“ */
  level: text(),
  /** Ablauf der Lizenz (Verband); leer = nicht erfasst */
  licenseValidUntil: date(),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

/** Einsatz, den ein Schiedsrichter selbst einträgt (Verbandsspiel mit Datum, Zeit, Ort). */
export const refereeDuties = pgTable(
  'referee_duties',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    /** z. B. „SV A – SV B, U13“ */
    title: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    location: text(),
    /** Automatisch eingetragene Abwesenheit (wird mit dem Einsatz entfernt) */
    absenceId: uuid().references(() => absences.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.personId, t.startsAt), index().on(t.clubId)],
);

/** Soll des Verbands je Verein: aktive Schiedsrichter und Pflichteinsätze je Schiedsrichter und Saison. */
export const refereeSettings = pgTable('referee_settings', {
  clubId: uuid()
    .primaryKey()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  requiredReferees: integer().notNull().default(0),
  requiredMatches: integer().notNull().default(0),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// ── Vereinskasse (Paket K1) ─────────────────────────────────────────────────

/** Konto der Vereinskasse (Girokonto, Barkasse, Sparkonto, PayPal …) mit Anfangsbestand. */
export const clubCashAccounts = pgTable(
  'club_cash_accounts',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** bank | cash | savings | paypal | other */
    kind: text().notNull(),
    openingBalanceCents: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/** Kategorie (Kontenrahmen) mit Zuordnung zu einem der vier steuerlichen Bereiche. */
export const clubCashCategories = pgTable(
  'club_cash_categories',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** income | expense */
    direction: text().notNull(),
    /** ideal | asset | purpose | business */
    area: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/** Kostenstelle: Abteilung, Mannschaft oder Veranstaltung, der Buchungen zugeordnet werden. */
export const clubCostCenters = pgTable(
  'club_cost_centers',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** department | team | event | other */
    kind: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/**
 * Buchung der Vereinskasse. Beträge in Cent, immer positiv; die Richtung steht in `kind`.
 * Eine Umbuchung besteht aus zwei Seiten (`transfer_out`/`transfer_in`) mit gleicher `transferId`.
 * Keine Löschung: Storno mit Begründung, die Buchung bleibt sichtbar und zählt nicht mehr.
 */
export const clubCashEntries = pgTable(
  'club_cash_entries',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => clubCashAccounts.id),
    /** income | expense | transfer_out | transfer_in */
    kind: text().notNull(),
    amountCents: integer().notNull(),
    bookedOn: date().notNull(),
    categoryId: uuid().references(() => clubCashCategories.id),
    costCenterId: uuid().references(() => clubCostCenters.id),
    counterparty: text(),
    purpose: text().notNull(),
    receiptNo: text(),
    /** Beleg (Foto) als Medienverweis */
    receiptRef: text(),
    transferId: uuid(),
    createdByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledByPersonId: uuid().references(() => persons.id, { onDelete: 'set null' }),
    cancelReason: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.bookedOn), index().on(t.accountId)],
);

// ── Mitgliedsbeiträge (Paket K2) ────────────────────────────────────────────

/** Beitragsart (z. B. Erwachsene, Jugend, Familie, passiv) mit Betrag und Rhythmus. */
export const clubFeeTypes = pgTable(
  'club_fee_types',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    amountCents: integer().notNull(),
    /** monthly | quarterly | yearly | once */
    interval: text().notNull(),
    /** Einnahmekategorie der Vereinskasse, in die Zahlungen gebucht werden */
    categoryId: uuid().references(() => clubCashCategories.id),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId)],
);

/** Zuordnung einer Beitragsart zu einem Mitglied (optional mit abweichendem Betrag). */
export const clubFeeAssignments = pgTable(
  'club_fee_assignments',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    feeTypeId: uuid()
      .notNull()
      .references(() => clubFeeTypes.id),
    amountOverrideCents: integer(),
    validFrom: date().notNull(),
    validTo: date(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId), index().on(t.personId)],
);

/** Sollstellung: eine fällige Beitragsforderung je Mitglied und Zeitraum. */
export const clubFeeDues = pgTable(
  'club_fee_dues',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    feeTypeId: uuid()
      .notNull()
      .references(() => clubFeeTypes.id),
    assignmentId: uuid()
      .notNull()
      .references(() => clubFeeAssignments.id),
    /** z. B. „Oktober 2026“, „3. Quartal 2026“, „2026“ */
    periodLabel: text().notNull(),
    dueOn: date().notNull(),
    amountCents: integer().notNull(),
    /** Stufe der letzten Erinnerung (0 = keine) */
    reminderLevel: integer().notNull().default(0),
    remindedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.clubId, t.dueOn),
    index().on(t.personId),
    unique().on(t.assignmentId, t.dueOn),
  ],
);

/** Zahlungseingang zu einer Sollstellung; verweist auf die Buchung im Kassenbuch. */
export const clubFeePayments = pgTable(
  'club_fee_payments',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    dueId: uuid()
      .notNull()
      .references(() => clubFeeDues.id, { onDelete: 'cascade' }),
    entryId: uuid()
      .notNull()
      .references(() => clubCashEntries.id),
    amountCents: integer().notNull(),
    paidOn: date().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.dueId)],
);

// ── Sponsoren (Paket SPO) ───────────────────────────────────────────────────

/** Sponsor des Vereins (Modul „Sponsoren“): Logo und Banner, Link, Stufe, Laufzeit, Zuordnung. */
export const sponsors = pgTable(
  'sponsors',
  {
    id: id(),
    clubId: uuid()
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** main | partner | supporter */
    tier: text().notNull(),
    /** nur https */
    linkUrl: text(),
    /** Medienverweise (Bilder) */
    logoRef: text(),
    bannerRef: text(),
    /** club | youth | seniors */
    scope: text().notNull().default('club'),
    startsOn: date(),
    endsOn: date(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clubId, t.sortOrder)],
);
