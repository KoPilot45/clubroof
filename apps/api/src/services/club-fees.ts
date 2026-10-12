/**
 * Mitgliedsbeiträge der Vereinskasse (Paket K2): Beitragsarten, Zuordnung zu Mitgliedern,
 * Sollstellung (Forderungen je Zeitraum), Zahlungseingang mit Buchung im Kassenbuch, Rückstände,
 * Erinnerungen in drei Stufen (löst der Kassenwart selbst aus) und CSV-Import vom Kontoauszug.
 * Keine SEPA-Lastschrift, die App zieht kein Geld ein.
 */
import {
  CLUB_FEE_INTERVALS,
  CLUB_FEE_MAX_REMINDER,
  calendarDayOf,
  toIsoDate,
  type ClubFeeAssignment,
  type ClubFeeAssignmentInput,
  type ClubFeeDue,
  type ClubFeeDueStatus,
  type ClubFeeGenerateResult,
  type ClubFeeImportCommitInput,
  type ClubFeeImportPreview,
  type ClubFeeImportRow,
  type ClubFeeInterval,
  type ClubFeePaymentInput,
  type ClubFeeType,
  type ClubFeeTypeInput,
  type ClubFees,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, notFound } from '../errors';
import { deliver } from '../notify/deliver';
import { usersByPerson } from '../notify/persons';
import {
  audit,
  euro,
  requireClubFull as requireFull,
  requireClubLevel as requireLevel,
  requireClubManage as requireManage,
} from './club-cash';
import { ensureMainFund } from './club-funds';
import { assertPeriodOpen } from './club-periods';
import { parseCsv } from './csv';

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));
const deLong = (iso: string) => iso.split('-').reverse().join('.');

// ── Übersicht ───────────────────────────────────────────────────────────────

type DueRow = {
  due: typeof s.clubFeeDues.$inferSelect;
  typeName: string;
  typeFundId: string | null;
  first: string;
  last: string;
  memberNumber: string | null;
  paid: number;
};

async function loadDues(db: Db, clubId: string): Promise<DueRow[]> {
  const rows = await db
    .select({
      due: s.clubFeeDues,
      typeName: s.clubFeeTypes.name,
      typeFundId: s.clubFeeTypes.fundId,
      first: s.persons.firstName,
      last: s.persons.lastName,
      memberNumber: s.persons.memberNumber,
      paid: sql<number>`coalesce((select sum(p.amount_cents) from club_fee_payments p where p.due_id = ${s.clubFeeDues.id}), 0)::int`,
    })
    .from(s.clubFeeDues)
    .innerJoin(s.clubFeeTypes, eq(s.clubFeeTypes.id, s.clubFeeDues.feeTypeId))
    .innerJoin(s.persons, eq(s.persons.id, s.clubFeeDues.personId))
    .where(eq(s.clubFeeDues.clubId, clubId))
    .orderBy(asc(s.clubFeeDues.dueOn), asc(s.persons.lastName));
  return rows.map((r) => ({ ...r, paid: Number(r.paid) }));
}

function toDue(r: DueRow, day: string): ClubFeeDue {
  const open = Math.max(0, r.due.amountCents - r.paid);
  const status: ClubFeeDueStatus = r.due.cancelledAt
    ? 'cancelled'
    : open === 0
      ? 'paid'
      : r.due.dueOn < day
        ? 'overdue'
        : 'open';
  return {
    id: r.due.id,
    personId: r.due.personId,
    personName: `${r.first} ${r.last}`,
    memberNumber: r.memberNumber,
    feeTypeName: r.typeName,
    fundId: r.typeFundId,
    periodLabel: r.due.periodLabel,
    dueOn: r.due.dueOn,
    amountCents: r.due.amountCents,
    paidCents: r.paid,
    openCents: r.due.cancelledAt ? 0 : open,
    status,
    reminderLevel: r.due.reminderLevel,
    remindedAt: r.due.remindedAt?.toISOString() ?? null,
    cancelReason: r.due.cancelReason,
  };
}

export type FeeQuery = { status?: 'open' | 'overdue' | 'paid' | 'cancelled' | 'all'; q?: string };

export async function getClubFees(
  db: Db,
  actor: Actor,
  query: FeeQuery,
  now: Date,
): Promise<ClubFees> {
  const level = requireLevel(actor);
  const clubId = actor.club.id;
  const day = today(actor, now);
  const year = day.slice(0, 4);

  const typeRows = await db
    .select({ type: s.clubFeeTypes, categoryName: s.clubCashCategories.name })
    .from(s.clubFeeTypes)
    .leftJoin(s.clubCashCategories, eq(s.clubCashCategories.id, s.clubFeeTypes.categoryId))
    .where(eq(s.clubFeeTypes.clubId, clubId))
    .orderBy(asc(s.clubFeeTypes.name));
  const counts = await db
    .select({
      feeTypeId: s.clubFeeAssignments.feeTypeId,
      n: sql<number>`count(*)::int`,
    })
    .from(s.clubFeeAssignments)
    .where(
      and(
        eq(s.clubFeeAssignments.clubId, clubId),
        lte(s.clubFeeAssignments.validFrom, day),
        or(isNull(s.clubFeeAssignments.validTo), gt(s.clubFeeAssignments.validTo, day)),
      ),
    )
    .groupBy(s.clubFeeAssignments.feeTypeId);
  const fundRows = await db
    .select({ id: s.clubCashFunds.id, name: s.clubCashFunds.name, isMain: s.clubCashFunds.isMain })
    .from(s.clubCashFunds)
    .where(eq(s.clubCashFunds.clubId, clubId));
  const mainFund = fundRows.find((f) => f.isMain);
  const types: ClubFeeType[] = typeRows.map((r) => ({
    id: r.type.id,
    fundId: r.type.fundId,
    fundName: fundRows.find((f) => f.id === (r.type.fundId ?? mainFund?.id))?.name ?? 'Hauptkasse',
    name: r.type.name,
    amountCents: r.type.amountCents,
    interval: r.type.interval as ClubFeeInterval,
    categoryId: r.type.categoryId,
    categoryName: r.categoryName,
    archived: !!r.type.archivedAt,
    members: Number(counts.find((c) => c.feeTypeId === r.type.id)?.n ?? 0),
  }));

  const all = (await loadDues(db, clubId)).map((r) => toDue(r, day));
  const live = all.filter((d) => d.status === 'open' || d.status === 'overdue');
  const overdue = live.filter((d) => d.status === 'overdue');
  const paidThisYear = await db
    .select({ cents: sql<number>`coalesce(sum(${s.clubFeePayments.amountCents}), 0)::int` })
    .from(s.clubFeePayments)
    .where(
      and(
        eq(s.clubFeePayments.clubId, clubId),
        sql`${s.clubFeePayments.paidOn} >= ${`${year}-01-01`}`,
        sql`${s.clubFeePayments.paidOn} <= ${`${year}-12-31`}`,
      ),
    );

  const status = query.status ?? 'open';
  const term = query.q?.trim().toLowerCase();
  const dues =
    level === 'full'
      ? all
          .filter((d) =>
            status === 'all'
              ? true
              : status === 'open'
                ? d.status === 'open' || d.status === 'overdue'
                : d.status === status,
          )
          .filter(
            (d) =>
              !term ||
              d.personName.toLowerCase().includes(term) ||
              (d.memberNumber ?? '').toLowerCase().includes(term),
          )
          .slice(0, 300)
      : [];

  return {
    level,
    canManage: actorCan(actor, 'clubcash.manage'),
    today: day,
    types,
    summary: {
      openCents: live.reduce((sum, d) => sum + d.openCents, 0),
      openCount: live.length,
      overdueCents: overdue.reduce((sum, d) => sum + d.openCents, 0),
      overdueCount: overdue.length,
      paidThisYearCents: Number(paidThisYear[0]?.cents ?? 0),
      overduePersons: new Set(overdue.map((d) => d.personId)).size,
    },
    dues,
  };
}

export async function listAssignments(
  db: Db,
  actor: Actor,
  q: string | undefined,
  now: Date,
): Promise<ClubFeeAssignment[]> {
  requireFull(actor);
  const day = today(actor, now);
  const rows = await db
    .select({
      a: s.clubFeeAssignments,
      typeName: s.clubFeeTypes.name,
      typeAmount: s.clubFeeTypes.amountCents,
      first: s.persons.firstName,
      last: s.persons.lastName,
      memberNumber: s.persons.memberNumber,
    })
    .from(s.clubFeeAssignments)
    .innerJoin(s.clubFeeTypes, eq(s.clubFeeTypes.id, s.clubFeeAssignments.feeTypeId))
    .innerJoin(s.persons, eq(s.persons.id, s.clubFeeAssignments.personId))
    .where(eq(s.clubFeeAssignments.clubId, actor.club.id))
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));
  const term = q?.trim().toLowerCase();
  return rows
    .filter((r) => !r.a.validTo || r.a.validTo > day)
    .filter(
      (r) =>
        !term ||
        `${r.first} ${r.last}`.toLowerCase().includes(term) ||
        (r.memberNumber ?? '').toLowerCase().includes(term),
    )
    .slice(0, 300)
    .map((r) => ({
      id: r.a.id,
      personId: r.a.personId,
      personName: `${r.first} ${r.last}`,
      memberNumber: r.memberNumber,
      feeTypeId: r.a.feeTypeId,
      feeTypeName: r.typeName,
      amountCents: r.a.amountOverrideCents ?? r.typeAmount,
      overridden: r.a.amountOverrideCents !== null,
      validFrom: r.a.validFrom,
      validTo: r.a.validTo,
    }));
}

// ── Beitragsarten und Zuordnung ─────────────────────────────────────────────

/** Mitgliedersuche für die Zuordnung – der Kassenwart braucht dafür keine Mitgliederverwaltung. */
export async function searchFeeMembers(
  db: Db,
  actor: Actor,
  q: string,
): Promise<{ personId: string; name: string; memberNumber: string | null }[]> {
  requireManage(actor);
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const rows = await db
    .select({
      id: s.persons.id,
      first: s.persons.firstName,
      last: s.persons.lastName,
      memberNumber: s.persons.memberNumber,
    })
    .from(s.persons)
    .where(and(eq(s.persons.clubId, actor.club.id), eq(s.persons.membershipStatus, 'active')))
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));
  return rows
    .filter(
      (r) =>
        `${r.first} ${r.last}`.toLowerCase().includes(term) ||
        (r.memberNumber ?? '').toLowerCase().includes(term),
    )
    .slice(0, 10)
    .map((r) => ({
      personId: r.id,
      name: `${r.first} ${r.last}`,
      memberNumber: r.memberNumber,
    }));
}

/** Zielkasse einer Beitragsart prüfen (leer = Hauptkasse). */
async function targetFund(db: Db, actor: Actor, id: string | null | undefined) {
  if (!id) return null;
  const [fund] = await db
    .select()
    .from(s.clubCashFunds)
    .where(and(eq(s.clubCashFunds.id, id), eq(s.clubCashFunds.clubId, actor.club.id)));
  if (!fund) throw notFound('Die Kasse');
  if (fund.archivedAt) throw new HttpError(409, 'archived', 'Die Kasse ist stillgelegt.');
  return fund;
}

async function incomeCategory(db: Db, actor: Actor, id: string | null | undefined) {
  if (!id) return null;
  const [category] = await db
    .select()
    .from(s.clubCashCategories)
    .where(and(eq(s.clubCashCategories.id, id), eq(s.clubCashCategories.clubId, actor.club.id)));
  if (!category || category.direction !== 'income')
    throw new HttpError(400, 'category_direction', 'Beiträge brauchen eine Einnahmekategorie.');
  return category;
}

export async function createFeeType(
  db: Db,
  actor: Actor,
  input: ClubFeeTypeInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  if (!CLUB_FEE_INTERVALS.includes(input.interval))
    throw new HttpError(400, 'invalid_interval', 'Unbekannter Rhythmus.');
  const category = await incomeCategory(db, actor, input.categoryId);
  const fund = await targetFund(db, actor, input.fundId);
  const [row] = await db
    .insert(s.clubFeeTypes)
    .values({
      clubId: actor.club.id,
      name: input.name.trim(),
      amountCents: input.amountCents,
      interval: input.interval,
      categoryId: category?.id ?? null,
      fundId: fund?.id ?? null,
      createdAt: now,
    })
    .returning({ id: s.clubFeeTypes.id });
  await audit(
    db,
    actor,
    'clubfees.type',
    'club_fee_type',
    row!.id,
    `Beiträge: Beitragsart angelegt: ${input.name.trim()} (${euro(input.amountCents)})`,
    now,
  );
}

export async function updateFeeType(
  db: Db,
  actor: Actor,
  id: string,
  input: {
    name?: string;
    amountCents?: number;
    categoryId?: string | null;
    fundId?: string | null;
    archived?: boolean;
  },
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [type] = await db
    .select()
    .from(s.clubFeeTypes)
    .where(and(eq(s.clubFeeTypes.id, id), eq(s.clubFeeTypes.clubId, actor.club.id)));
  if (!type) throw notFound('Die Beitragsart');
  const patch: Partial<typeof s.clubFeeTypes.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.amountCents !== undefined) patch.amountCents = input.amountCents;
  if (input.categoryId !== undefined)
    patch.categoryId = (await incomeCategory(db, actor, input.categoryId))?.id ?? null;
  if (input.fundId !== undefined)
    patch.fundId = (await targetFund(db, actor, input.fundId))?.id ?? null;
  if (input.archived !== undefined) patch.archivedAt = input.archived ? now : null;
  if (Object.keys(patch).length === 0) return;
  await db.update(s.clubFeeTypes).set(patch).where(eq(s.clubFeeTypes.id, id));
  await audit(
    db,
    actor,
    'clubfees.type',
    'club_fee_type',
    id,
    input.amountCents !== undefined && input.amountCents !== type.amountCents
      ? `Beiträge: Betrag der Beitragsart ${type.name} geändert auf ${euro(input.amountCents)} (gilt für neue Forderungen)`
      : `Beiträge: Beitragsart geändert: ${type.name}`,
    now,
  );
}

export async function createAssignment(
  db: Db,
  actor: Actor,
  input: ClubFeeAssignmentInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [person] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Das Mitglied');
  if (person.membershipStatus === 'left')
    throw new HttpError(409, 'member_left', 'Das Mitglied ist ausgetreten.');
  const [type] = await db
    .select()
    .from(s.clubFeeTypes)
    .where(and(eq(s.clubFeeTypes.id, input.feeTypeId), eq(s.clubFeeTypes.clubId, actor.club.id)));
  if (!type || type.archivedAt) throw notFound('Die Beitragsart');
  const running = await db
    .select({ id: s.clubFeeAssignments.id })
    .from(s.clubFeeAssignments)
    .where(
      and(
        eq(s.clubFeeAssignments.personId, person.id),
        eq(s.clubFeeAssignments.feeTypeId, type.id),
        isNull(s.clubFeeAssignments.validTo),
      ),
    )
    .limit(1);
  if (running.length > 0)
    throw new HttpError(
      409,
      'already_assigned',
      'Diese Beitragsart läuft für das Mitglied bereits.',
    );
  const [row] = await db
    .insert(s.clubFeeAssignments)
    .values({
      clubId: actor.club.id,
      personId: person.id,
      feeTypeId: type.id,
      amountOverrideCents: input.amountOverrideCents ?? null,
      validFrom: input.validFrom,
      createdAt: now,
    })
    .returning({ id: s.clubFeeAssignments.id });
  await audit(
    db,
    actor,
    'clubfees.assignment',
    'club_fee_assignment',
    row!.id,
    `Beiträge: ${type.name} zugeordnet: ${person.firstName} ${person.lastName}`,
    now,
  );
}

export async function endAssignment(
  db: Db,
  actor: Actor,
  id: string,
  validTo: string,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [row] = await db
    .select({
      a: s.clubFeeAssignments,
      first: s.persons.firstName,
      last: s.persons.lastName,
      typeName: s.clubFeeTypes.name,
    })
    .from(s.clubFeeAssignments)
    .innerJoin(s.persons, eq(s.persons.id, s.clubFeeAssignments.personId))
    .innerJoin(s.clubFeeTypes, eq(s.clubFeeTypes.id, s.clubFeeAssignments.feeTypeId))
    .where(and(eq(s.clubFeeAssignments.id, id), eq(s.clubFeeAssignments.clubId, actor.club.id)));
  if (!row) throw notFound('Die Zuordnung');
  if (validTo < row.a.validFrom)
    throw new HttpError(400, 'invalid_date', 'Das Ende liegt vor dem Beginn.');
  await db.update(s.clubFeeAssignments).set({ validTo }).where(eq(s.clubFeeAssignments.id, id));
  await audit(
    db,
    actor,
    'clubfees.assignment',
    'club_fee_assignment',
    id,
    `Beiträge: ${row.typeName} beendet: ${row.first} ${row.last}`,
    now,
  );
}

// ── Sollstellung ────────────────────────────────────────────────────────────

/** Fälligkeiten einer Zuordnung: Zeitraumbeginn am 1. (Monat, Quartal, Jahr), „einmalig“ am Beginn. */
export function dueDates(
  interval: ClubFeeInterval,
  validFrom: string,
  validTo: string | null,
  upTo: string,
  notBefore: string,
): { dueOn: string; label: string }[] {
  const last = validTo && validTo < upTo ? validTo : upTo;
  const result: { dueOn: string; label: string }[] = [];
  if (interval === 'once') {
    if (validFrom <= last && validFrom >= notBefore) result.push({ dueOn: validFrom, label: '' });
    return result;
  }
  const [fy, fm] = validFrom.split('-').map(Number) as [number, number];
  let year = fy;
  let month = fm;
  for (let guard = 0; guard < 600; guard++) {
    const dueOn = `${year}-${String(month).padStart(2, '0')}-01`;
    if (dueOn > last) break;
    const quarterStart = (month - 1) % 3 === 0;
    const include =
      interval === 'monthly' ||
      (interval === 'quarterly' && quarterStart) ||
      (interval === 'yearly' && month === 1);
    if (include && dueOn >= validFrom && dueOn >= notBefore) {
      const label =
        interval === 'monthly'
          ? `${MONTHS[month - 1]} ${year}`
          : interval === 'quarterly'
            ? `${Math.floor((month - 1) / 3) + 1}. Quartal ${year}`
            : `${year}`;
      result.push({ dueOn, label });
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

/** Erzeugt fehlende Forderungen bis zum Stichtag (höchstens drei Jahre zurück); doppelt geht nicht. */
export async function generateDues(
  db: Db,
  actor: Actor,
  upToInput: string | undefined,
  now: Date,
): Promise<ClubFeeGenerateResult> {
  requireManage(actor);
  const upTo = upToInput ?? today(actor, now);
  const [y, m, d] = upTo.split('-').map(Number) as [number, number, number];
  const notBefore = `${y - 3}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const rows = await db
    .select({
      a: s.clubFeeAssignments,
      type: s.clubFeeTypes,
      status: s.persons.membershipStatus,
    })
    .from(s.clubFeeAssignments)
    .innerJoin(s.clubFeeTypes, eq(s.clubFeeTypes.id, s.clubFeeAssignments.feeTypeId))
    .innerJoin(s.persons, eq(s.persons.id, s.clubFeeAssignments.personId))
    .where(eq(s.clubFeeAssignments.clubId, actor.club.id));
  let created = 0;
  for (const r of rows) {
    if (r.status === 'left') continue;
    const dates = dueDates(
      r.type.interval as ClubFeeInterval,
      r.a.validFrom,
      r.a.validTo,
      upTo,
      notBefore,
    );
    if (dates.length === 0) continue;
    const inserted = await db
      .insert(s.clubFeeDues)
      .values(
        dates.map((x) => ({
          clubId: actor.club.id,
          personId: r.a.personId,
          feeTypeId: r.type.id,
          assignmentId: r.a.id,
          periodLabel: x.label || r.type.name,
          dueOn: x.dueOn,
          amountCents: r.a.amountOverrideCents ?? r.type.amountCents,
          createdAt: now,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: s.clubFeeDues.id });
    created += inserted.length;
  }
  await audit(
    db,
    actor,
    'clubfees.generate',
    'club',
    actor.club.id,
    `Beiträge: Sollstellung bis ${deLong(upTo)}: ${created} neue Forderungen`,
    now,
  );
  return { created, upTo };
}

// ── Zahlungseingang ─────────────────────────────────────────────────────────

async function feeCategoryFor(db: Db, clubId: string, categoryId: string | null) {
  if (categoryId) return categoryId;
  const income = await db
    .select()
    .from(s.clubCashCategories)
    .where(
      and(eq(s.clubCashCategories.clubId, clubId), eq(s.clubCashCategories.direction, 'income')),
    )
    .orderBy(asc(s.clubCashCategories.sortOrder));
  const fallback = income.find((c) => c.name === 'Mitgliedsbeiträge') ?? income[0];
  if (!fallback)
    throw new HttpError(
      409,
      'no_category',
      'Es gibt keine Einnahmekategorie für Beiträge. Lege sie in der Vereinskasse an.',
    );
  return fallback.id;
}

async function bookPayment(
  db: Db,
  actor: Actor,
  dueId: string,
  input: ClubFeePaymentInput,
  now: Date,
): Promise<void> {
  const rows = (await loadDues(db, actor.club.id)).filter((r) => r.due.id === dueId);
  const r = rows[0];
  if (!r) throw notFound('Die Forderung');
  if (r.due.cancelledAt) throw new HttpError(409, 'cancelled', 'Die Forderung ist storniert.');
  const open = r.due.amountCents - r.paid;
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new HttpError(400, 'invalid_amount', 'Der Betrag muss größer als 0 sein.');
  if (input.amountCents > open)
    throw new HttpError(
      400,
      'overpayment',
      `Es sind nur noch ${euro(open)} offen. Zu viel Gezahltes bitte als eigene Einnahme buchen.`,
    );
  await assertPeriodOpen(db, actor.club.id, input.paidOn);
  const [account] = await db
    .select()
    .from(s.clubCashAccounts)
    .where(
      and(eq(s.clubCashAccounts.id, input.accountId), eq(s.clubCashAccounts.clubId, actor.club.id)),
    );
  if (!account) throw notFound('Das Konto');
  if (account.archivedAt) throw new HttpError(409, 'archived', 'Das Konto ist archiviert.');
  const [type] = await db
    .select()
    .from(s.clubFeeTypes)
    .where(eq(s.clubFeeTypes.id, r.due.feeTypeId));
  // Beiträge fließen in die Zielkasse der Beitragsart (leer = Hauptkasse)
  const targetFundId = type!.fundId ?? (await ensureMainFund(db, actor.club.id, now));
  if (account.fundId !== targetFundId) {
    const [target] = await db
      .select({ name: s.clubCashFunds.name })
      .from(s.clubCashFunds)
      .where(eq(s.clubCashFunds.id, targetFundId));
    throw new HttpError(
      400,
      'wrong_fund',
      `Beiträge der Art ${r.typeName} gehören in die Kasse ${target?.name ?? 'Hauptkasse'}. Bitte ein Konto dieser Kasse wählen.`,
    );
  }
  const categoryId = await feeCategoryFor(db, actor.club.id, type!.categoryId);
  const name = `${r.first} ${r.last}`;
  await db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(s.clubCashEntries)
      .values({
        clubId: actor.club.id,
        accountId: account.id,
        kind: 'income',
        amountCents: input.amountCents,
        bookedOn: input.paidOn,
        categoryId,
        counterparty: name,
        purpose: `Beitrag ${r.typeName} ${r.due.periodLabel}`,
        createdByPersonId: actor.person.id,
        createdAt: now,
      })
      .returning({ id: s.clubCashEntries.id });
    await tx.insert(s.clubFeePayments).values({
      clubId: actor.club.id,
      dueId,
      entryId: entry!.id,
      amountCents: input.amountCents,
      paidOn: input.paidOn,
      createdAt: now,
    });
  });
  await audit(
    db,
    actor,
    'clubfees.payment',
    'club_fee_due',
    dueId,
    `Beiträge: Zahlung ${euro(input.amountCents)} von ${name} (${r.due.periodLabel})`,
    now,
  );
}

export async function recordPayment(
  db: Db,
  actor: Actor,
  dueId: string,
  input: ClubFeePaymentInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  await bookPayment(db, actor, dueId, input, now);
}

export async function cancelDue(
  db: Db,
  actor: Actor,
  dueId: string,
  reason: string,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const why = reason.trim();
  if (why.length < 3) throw new HttpError(400, 'reason_required', 'Bitte eine Begründung angeben.');
  const r = (await loadDues(db, actor.club.id)).find((x) => x.due.id === dueId);
  if (!r) throw notFound('Die Forderung');
  if (r.due.cancelledAt)
    throw new HttpError(409, 'already_cancelled', 'Die Forderung ist bereits storniert.');
  if (r.paid > 0)
    throw new HttpError(
      409,
      'has_payments',
      'Auf die Forderung wurde schon gezahlt. Storniere zuerst die Buchung im Kassenbuch.',
    );
  await db
    .update(s.clubFeeDues)
    .set({ cancelledAt: now, cancelReason: why })
    .where(eq(s.clubFeeDues.id, dueId));
  await audit(
    db,
    actor,
    'clubfees.cancel',
    'club_fee_due',
    dueId,
    `Beiträge: Forderung storniert (${r.first} ${r.last}, ${r.due.periodLabel}): ${why}`,
    now,
  );
}

// ── Erinnerungen ────────────────────────────────────────────────────────────

const REMINDER_TEXT: Record<number, { title: string; verb: string }> = {
  1: { title: 'Zahlungserinnerung Mitgliedsbeitrag', verb: 'Erinnerung' },
  2: { title: 'Mahnung Mitgliedsbeitrag', verb: 'Mahnung' },
  3: { title: 'Letzte Mahnung Mitgliedsbeitrag', verb: 'Letzte Mahnung' },
};

/** Erinnert zu einer überfälligen Forderung; jede Stufe löst der Kassenwart selbst aus. */
export async function remindDue(
  db: Db,
  actor: Actor,
  dueId: string,
  now: Date,
): Promise<{ level: number; notified: boolean }> {
  requireManage(actor);
  const day = today(actor, now);
  const r = (await loadDues(db, actor.club.id)).find((x) => x.due.id === dueId);
  if (!r) throw notFound('Die Forderung');
  const due = toDue(r, day);
  if (due.status !== 'overdue')
    throw new HttpError(409, 'not_overdue', 'Erinnert wird nur zu überfälligen Forderungen.');
  if (r.due.reminderLevel >= CLUB_FEE_MAX_REMINDER)
    throw new HttpError(409, 'max_level', 'Die letzte Mahnung wurde schon verschickt.');
  if (r.due.remindedAt && toIsoDate(calendarDayOf(r.due.remindedAt, actor.club.timezone)) === day)
    throw new HttpError(409, 'reminded_today', 'Heute wurde schon erinnert.');
  const level = r.due.reminderLevel + 1;
  const text = REMINDER_TEXT[level]!;
  const users = (await usersByPerson(db, [r.due.personId])).get(r.due.personId) ?? [];
  const sent = await deliver(
    db,
    actor.club,
    users,
    {
      level: level === 3 ? 'important' : 'info',
      topic: 'cash',
      title: text.title,
      body: `${r.first} ${r.last}: ${r.due.periodLabel}, ${euro(due.openCents)} offen, fällig seit ${deLong(r.due.dueOn)}.`,
      dedupeKey: `club-fee-reminder:${dueId}:${level}`,
    },
    now,
  );
  await db
    .update(s.clubFeeDues)
    .set({ reminderLevel: level, remindedAt: now })
    .where(eq(s.clubFeeDues.id, dueId));
  await audit(
    db,
    actor,
    'clubfees.remind',
    'club_fee_due',
    dueId,
    `Beiträge: ${text.verb} an ${r.first} ${r.last} (${r.due.periodLabel})`,
    now,
  );
  return { level, notified: sent > 0 };
}

/** Stufe 1 an alle, die zu einer überfälligen Forderung noch nicht erinnert wurden. */
export async function remindAllOverdue(
  db: Db,
  actor: Actor,
  now: Date,
): Promise<{ reminded: number; withoutLogin: number }> {
  requireManage(actor);
  const day = today(actor, now);
  const rows = (await loadDues(db, actor.club.id))
    .map((r) => ({ r, due: toDue(r, day) }))
    .filter((x) => x.due.status === 'overdue' && x.r.due.reminderLevel === 0);
  let reminded = 0;
  let withoutLogin = 0;
  for (const x of rows) {
    const res = await remindDue(db, actor, x.r.due.id, now);
    reminded += 1;
    if (!res.notified) withoutLogin += 1;
  }
  return { reminded, withoutLogin };
}

// ── CSV-Import vom Kontoauszug ──────────────────────────────────────────────

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.\-+]/g, '');
  if (!cleaned) return null;
  const negative = cleaned.startsWith('-');
  const body = cleaned.replace(/^[-+]/, '');
  const normalized = body.includes(',') ? body.replace(/\./g, '').replace(',', '.') : body;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

export function parseDate(raw: string): string | null {
  const t = raw.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(t);
  if (m) return `20${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const COLUMNS = {
  date: /buchungstag|buchungsdatum|datum|valuta|wertstellung|date/i,
  amount: /betrag|umsatz|amount/i,
  purpose: /verwendungszweck|zweck|buchungstext|purpose|details/i,
  name: /beguenstigter|begünstigter|zahlungspflichtiger|auftraggeber|name|empf/i,
};

function findColumns(header: string[]) {
  const pick = (re: RegExp) => header.findIndex((h) => re.test(h));
  return {
    date: pick(COLUMNS.date),
    amount: pick(COLUMNS.amount),
    purpose: pick(COLUMNS.purpose),
    name: pick(COLUMNS.name),
  };
}

/** Liest einen Kontoauszug und ordnet Eingänge offenen Beitragsforderungen zu (Betrag muss genau passen). */
export async function previewImport(
  db: Db,
  actor: Actor,
  csv: string,
  now: Date,
  accountId: string | null = null,
): Promise<ClubFeeImportPreview> {
  requireManage(actor);
  const table = parseCsv(csv).filter((row) => row.some((c) => c !== ''));
  const headerAt = table.findIndex((row) => {
    const c = findColumns(row);
    return c.amount >= 0 && c.date >= 0;
  });
  if (headerAt < 0)
    throw new HttpError(
      400,
      'csv_header',
      'Die Datei braucht eine Kopfzeile mit Buchungstag und Betrag (Verwendungszweck und Name helfen bei der Zuordnung).',
    );
  const cols = findColumns(table[headerAt]!);
  const day = today(actor, now);
  const allDues = (await loadDues(db, actor.club.id))
    .map((r) => ({ r, due: toDue(r, day) }))
    .filter((x) => x.due.openCents > 0);
  // Beiträge gehören in die Zielkasse ihrer Beitragsart: nur Forderungen der Kasse des gewählten Kontos
  let dues = allDues;
  if (accountId) {
    const [account] = await db
      .select({ fundId: s.clubCashAccounts.fundId })
      .from(s.clubCashAccounts)
      .where(
        and(eq(s.clubCashAccounts.id, accountId), eq(s.clubCashAccounts.clubId, actor.club.id)),
      );
    if (!account) throw notFound('Das Konto');
    const main = await ensureMainFund(db, actor.club.id, now);
    dues = allDues.filter((x) => (x.r.typeFundId ?? main) === account.fundId);
  }
  const people = await db
    .select({
      id: s.persons.id,
      first: s.persons.firstName,
      last: s.persons.lastName,
      memberNumber: s.persons.memberNumber,
    })
    .from(s.persons)
    .where(
      and(
        eq(s.persons.clubId, actor.club.id),
        inArray(
          s.persons.id,
          [...new Set(dues.map((x) => x.r.due.personId))].length
            ? [...new Set(dues.map((x) => x.r.due.personId))]
            : ['00000000-0000-0000-0000-000000000000'],
        ),
      ),
    );

  const used = new Set<string>();
  const rows: ClubFeeImportRow[] = [];
  for (let i = headerAt + 1; i < table.length; i++) {
    const line = table[i]!;
    const amount = parseAmount(line[cols.amount] ?? '');
    const paidOn = parseDate(line[cols.date] ?? '');
    const name = cols.name >= 0 ? (line[cols.name] ?? '') : '';
    const purpose = cols.purpose >= 0 ? (line[cols.purpose] ?? '') : '';
    const base = { row: i + 1, paidOn, amountCents: amount, name, purpose, match: null };
    if (amount === null || !paidOn) {
      rows.push({ ...base, note: 'Betrag oder Datum nicht lesbar' });
      continue;
    }
    if (amount <= 0) {
      rows.push({ ...base, note: 'Ausgang – wird nicht gebucht' });
      continue;
    }
    const hay = fold(`${name} ${purpose}`);
    const byNumber = people.filter(
      (p) =>
        p.memberNumber &&
        p.memberNumber.length >= 3 &&
        new RegExp(`(^| )${fold(p.memberNumber)}( |$)`).test(hay),
    );
    const byName = people.filter(
      (p) =>
        hay.includes(fold(`${p.first} ${p.last}`)) || hay.includes(fold(`${p.last} ${p.first}`)),
    );
    const candidates = byNumber.length ? byNumber : byName;
    const reason = byNumber.length ? ('member_number' as const) : ('name' as const);
    if (candidates.length === 0) {
      rows.push({ ...base, note: 'Kein Mitglied mit offenem Beitrag erkannt' });
      continue;
    }
    const pick = dues.find(
      (x) =>
        !used.has(x.r.due.id) &&
        candidates.some((p) => p.id === x.r.due.personId) &&
        x.due.openCents === amount,
    );
    if (!pick) {
      const otherFund =
        dues !== allDues &&
        allDues.some(
          (x) =>
            !used.has(x.r.due.id) &&
            candidates.some((p) => p.id === x.r.due.personId) &&
            x.due.openCents === amount,
        );
      rows.push({
        ...base,
        note: otherFund
          ? 'Der Beitrag gehört in eine andere Kasse – bitte ein Konto dieser Kasse wählen'
          : 'Betrag passt zu keiner offenen Forderung',
      });
      continue;
    }
    used.add(pick.r.due.id);
    rows.push({
      ...base,
      note: null,
      match: {
        dueId: pick.r.due.id,
        personName: pick.due.personName,
        periodLabel: pick.due.periodLabel,
        openCents: pick.due.openCents,
        reason,
      },
    });
  }
  return {
    rows,
    matched: rows.filter((r) => r.match).length,
    skipped: rows.filter((r) => !r.match).length,
  };
}

export async function commitImport(
  db: Db,
  actor: Actor,
  input: ClubFeeImportCommitInput,
  now: Date,
): Promise<{ booked: number }> {
  requireManage(actor);
  for (const item of input.items)
    await bookPayment(db, actor, item.dueId, { accountId: input.accountId, ...item }, now);
  await audit(
    db,
    actor,
    'clubfees.import',
    'club',
    actor.club.id,
    `Beiträge: Kontoauszug importiert: ${input.items.length} Zahlungen gebucht`,
    now,
  );
  return { booked: input.items.length };
}
