/**
 * Vereinskasse: Planung und Abschluss (Paket K3, docs/VEREINSKASSE.md): Haushaltsplan je Kasse mit
 * Soll-Ist, Rücklagen-Töpfe, Einnahmen-Ausgaben-Rechnung und Jahresabschluss (CSV/PDF) mit
 * Periodensperre. Einfache Einnahmen-Ausgaben-Rechnung ohne doppelte Buchführung; keine
 * Steuerberatung.
 */
import {
  CLUB_BUDGET_WARN_RATIO,
  CLUB_CASH_AREAS,
  CLUB_CASH_AREA_LABEL,
  calendarDayOf,
  toIsoDate,
  type ClubBudget,
  type ClubBudgetInput,
  type ClubBudgetLine,
  type ClubBudgetStatus,
  type ClubCashArea,
  type ClubCashDirection,
  type ClubClosing,
  type ClubClosingArea,
  type ClubClosingLine,
  type ClubReserve,
  type ClubReserveInput,
  type ClubReserveMove,
  type ClubReserveMoveInput,
  type ClubReserves,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { SimplePdf } from '../storage/pdf';
import {
  audit,
  euro,
  requireClubFull,
  requireClubLevel,
  requireClubManage,
  requireLevel,
  requireManage,
  seesAllFunds,
} from './club-cash';
import { assertFund, ensureMainFund, fundScope, listFunds } from './club-funds';
import { activeLock, assertPeriodOpen } from './club-periods';

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));
const yearOf = (day: string) => Number(day.slice(0, 4));
const german = (iso: string) => iso.split('-').reverse().join('.');

// ── Gebuchte Summen ─────────────────────────────────────────────────────────

type Actuals = {
  categoryId: string;
  costCenterId: string | null;
  direction: ClubCashDirection;
  cents: number;
};

/** Summe der nicht stornierten Einnahmen/Ausgaben je Kategorie und Kostenstelle in einem Jahr. */
async function actualsFor(
  db: Db,
  clubId: string,
  year: number,
  fundIds: string[],
): Promise<Actuals[]> {
  if (fundIds.length === 0) return [];
  const e = s.clubCashEntries;
  const rows = await db
    .select({
      categoryId: e.categoryId,
      costCenterId: e.costCenterId,
      kind: e.kind,
      cents: sql<number>`coalesce(sum(${e.amountCents}), 0)::int`,
    })
    .from(e)
    .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, e.accountId))
    .where(
      and(
        eq(e.clubId, clubId),
        isNull(e.cancelledAt),
        inArray(e.kind, ['income', 'expense']),
        inArray(s.clubCashAccounts.fundId, fundIds),
        gte(e.bookedOn, `${year}-01-01`),
        lte(e.bookedOn, `${year}-12-31`),
      ),
    )
    .groupBy(e.categoryId, e.costCenterId, e.kind);
  return rows
    .filter((r) => r.categoryId)
    .map((r) => ({
      categoryId: r.categoryId!,
      costCenterId: r.costCenterId,
      direction: r.kind as ClubCashDirection,
      cents: Number(r.cents),
    }));
}

function statusOf(direction: ClubCashDirection, planned: number, actual: number): ClubBudgetStatus {
  if (direction !== 'expense') return 'ok';
  if (actual > planned) return 'over';
  if (planned > 0 && actual >= planned * CLUB_BUDGET_WARN_RATIO) return 'warn';
  return 'ok';
}

// ── Haushaltsplan und Soll-Ist ──────────────────────────────────────────────

export async function getBudget(
  db: Db,
  actor: Actor,
  year: number,
  fundIdQuery: string | null,
  now: Date,
): Promise<ClubBudget> {
  const level = requireLevel(actor);
  const clubId = actor.club.id;
  await ensureMainFund(db, clubId, now);
  const funds = await listFunds(
    db,
    clubId,
    await fundScope(db, actor, 'clubcash.read', seesAllFunds(actor)),
  );
  if (fundIdQuery && !funds.some((f) => f.id === fundIdQuery))
    throw forbidden('Diese Kasse siehst du nicht.');
  const shown = fundIdQuery ? funds.filter((f) => f.id === fundIdQuery) : funds;
  const fundIds = shown.map((f) => f.id);

  const b = s.clubBudgetLines;
  const rows = fundIds.length
    ? await db
        .select({
          line: b,
          categoryName: s.clubCashCategories.name,
          direction: s.clubCashCategories.direction,
          area: s.clubCashCategories.area,
          costCenterName: s.clubCostCenters.name,
        })
        .from(b)
        .innerJoin(s.clubCashCategories, eq(s.clubCashCategories.id, b.categoryId))
        .leftJoin(s.clubCostCenters, eq(s.clubCostCenters.id, b.costCenterId))
        .where(and(eq(b.clubId, clubId), eq(b.year, year), inArray(b.fundId, fundIds)))
        .orderBy(asc(s.clubCashCategories.direction), asc(s.clubCashCategories.name))
    : [];

  // Ist je Kasse, damit eine Planzeile nur die Buchungen ihrer Kasse zählt
  const actualByFund = new Map<string, Actuals[]>();
  for (const id of fundIds) actualByFund.set(id, await actualsFor(db, clubId, year, [id]));

  const lines: ClubBudgetLine[] = rows.map((r) => {
    const actual = (actualByFund.get(r.line.fundId) ?? [])
      .filter(
        (a) =>
          a.categoryId === r.line.categoryId &&
          (r.line.costCenterId === null || a.costCenterId === r.line.costCenterId),
      )
      .reduce((sum, a) => sum + a.cents, 0);
    const direction = r.direction as ClubCashDirection;
    return {
      id: r.line.id,
      fundId: r.line.fundId,
      fundName: funds.find((f) => f.id === r.line.fundId)?.name ?? '',
      categoryId: r.line.categoryId,
      categoryName: r.categoryName,
      direction,
      area: r.area as ClubCashArea,
      costCenterId: r.line.costCenterId,
      costCenterName: r.costCenterName,
      plannedCents: r.line.plannedCents,
      actualCents: actual,
      status: statusOf(direction, r.line.plannedCents, actual),
      note: r.line.note,
    };
  });
  const sum = (dir: ClubCashDirection, key: 'plannedCents' | 'actualCents') =>
    lines.filter((l) => l.direction === dir).reduce((acc, l) => acc + l[key], 0);
  const manage = canPlan(actor);
  return {
    year,
    fundId: fundIdQuery,
    level,
    canManage: manage,
    locked: !!(await activeLock(db, clubId, year)),
    lines,
    totals: {
      plannedIncomeCents: sum('income', 'plannedCents'),
      actualIncomeCents: sum('income', 'actualCents'),
      plannedExpenseCents: sum('expense', 'plannedCents'),
      actualExpenseCents: sum('expense', 'actualCents'),
      overCount: lines.filter((l) => l.status === 'over').length,
      warnCount: lines.filter((l) => l.status === 'warn').length,
    },
  };
}

/** Plan pflegen darf, wer buchen darf (für den ganzen Verein oder die eigene Abteilung). */
function canPlan(actor: Actor): boolean {
  try {
    requireManage(actor);
    return true;
  } catch {
    return false;
  }
}

export async function saveBudgetLine(
  db: Db,
  actor: Actor,
  input: ClubBudgetInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const clubId = actor.club.id;
  if (!Number.isInteger(input.plannedCents) || input.plannedCents < 0)
    throw new HttpError(400, 'invalid_amount', 'Der Planbetrag darf nicht negativ sein.');
  if (input.year < 2000 || input.year > 2100)
    throw new HttpError(400, 'invalid_year', 'Das Jahr ist ungültig.');
  await assertFund(db, actor, input.fundId, 'clubcash.manage');
  const [fund] = await db
    .select()
    .from(s.clubCashFunds)
    .where(and(eq(s.clubCashFunds.id, input.fundId), eq(s.clubCashFunds.clubId, clubId)));
  if (!fund) throw notFound('Die Kasse');
  if (fund.archivedAt) throw new HttpError(409, 'archived', 'Die Kasse ist stillgelegt.');
  const [category] = await db
    .select()
    .from(s.clubCashCategories)
    .where(
      and(eq(s.clubCashCategories.id, input.categoryId), eq(s.clubCashCategories.clubId, clubId)),
    );
  if (!category || category.archivedAt) throw notFound('Die Kategorie');
  if (input.costCenterId) {
    const [center] = await db
      .select()
      .from(s.clubCostCenters)
      .where(
        and(eq(s.clubCostCenters.id, input.costCenterId), eq(s.clubCostCenters.clubId, clubId)),
      );
    if (!center || center.archivedAt) throw notFound('Die Kostenstelle');
  }
  if (await activeLock(db, clubId, input.year))
    throw new HttpError(409, 'period_locked', `Das Jahr ${input.year} ist abgeschlossen.`);

  const b = s.clubBudgetLines;
  const [existing] = await db
    .select()
    .from(b)
    .where(
      and(
        eq(b.fundId, input.fundId),
        eq(b.year, input.year),
        eq(b.categoryId, input.categoryId),
        input.costCenterId ? eq(b.costCenterId, input.costCenterId) : isNull(b.costCenterId),
      ),
    );
  const label = `${category.name}${input.costCenterId ? ' (Kostenstelle)' : ''} ${input.year} (${fund.name})`;
  if (existing) {
    await db
      .update(b)
      .set({ plannedCents: input.plannedCents, note: input.note?.trim() || null })
      .where(eq(b.id, existing.id));
    await audit(
      db,
      actor,
      'clubcash.budget',
      'club_budget_line',
      existing.id,
      `Haushaltsplan: ${label} geändert auf ${euro(input.plannedCents)}`,
      now,
    );
    return;
  }
  const [row] = await db
    .insert(b)
    .values({
      clubId,
      fundId: input.fundId,
      year: input.year,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId ?? null,
      plannedCents: input.plannedCents,
      note: input.note?.trim() || null,
      createdAt: now,
    })
    .returning({ id: b.id });
  await audit(
    db,
    actor,
    'clubcash.budget',
    'club_budget_line',
    row!.id,
    `Haushaltsplan: ${label} geplant mit ${euro(input.plannedCents)}`,
    now,
  );
}

export async function deleteBudgetLine(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  requireManage(actor);
  const b = s.clubBudgetLines;
  const [line] = await db
    .select()
    .from(b)
    .where(and(eq(b.id, id), eq(b.clubId, actor.club.id)));
  if (!line) throw notFound('Die Planzeile');
  await assertFund(db, actor, line.fundId, 'clubcash.manage');
  if (await activeLock(db, actor.club.id, line.year))
    throw new HttpError(409, 'period_locked', `Das Jahr ${line.year} ist abgeschlossen.`);
  await db.delete(b).where(eq(b.id, id));
  await audit(
    db,
    actor,
    'clubcash.budget',
    'club_budget_line',
    id,
    `Haushaltsplan: Planzeile entfernt (${line.year})`,
    now,
  );
}

/** Plan eines Jahres als Ausgangsbasis für ein anderes Jahr übernehmen (nur fehlende Zeilen). */
export async function copyBudget(
  db: Db,
  actor: Actor,
  fromYear: number,
  toYear: number,
  fundId: string,
  now: Date,
): Promise<{ copied: number }> {
  requireManage(actor);
  await assertFund(db, actor, fundId, 'clubcash.manage');
  if (fromYear === toYear)
    throw new HttpError(400, 'same_year', 'Quell- und Zieljahr müssen verschieden sein.');
  if (await activeLock(db, actor.club.id, toYear))
    throw new HttpError(409, 'period_locked', `Das Jahr ${toYear} ist abgeschlossen.`);
  const b = s.clubBudgetLines;
  const source = await db
    .select()
    .from(b)
    .where(and(eq(b.clubId, actor.club.id), eq(b.fundId, fundId), eq(b.year, fromYear)));
  const target = await db
    .select()
    .from(b)
    .where(and(eq(b.clubId, actor.club.id), eq(b.fundId, fundId), eq(b.year, toYear)));
  const has = new Set(target.map((l) => `${l.categoryId}|${l.costCenterId ?? ''}`));
  const fresh = source.filter((l) => !has.has(`${l.categoryId}|${l.costCenterId ?? ''}`));
  if (fresh.length)
    await db.insert(b).values(
      fresh.map((l) => ({
        clubId: actor.club.id,
        fundId,
        year: toYear,
        categoryId: l.categoryId,
        costCenterId: l.costCenterId,
        plannedCents: l.plannedCents,
        note: l.note,
        createdAt: now,
      })),
    );
  await audit(
    db,
    actor,
    'clubcash.budget',
    'club',
    actor.club.id,
    `Haushaltsplan: ${fresh.length} Zeilen von ${fromYear} nach ${toYear} übernommen`,
    now,
  );
  return { copied: fresh.length };
}

// ── Rücklagen ───────────────────────────────────────────────────────────────

export async function getReserves(db: Db, actor: Actor, now: Date): Promise<ClubReserves> {
  requireLevel(actor);
  const clubId = actor.club.id;
  await ensureMainFund(db, clubId, now);
  const allowed = await fundScope(db, actor, 'clubcash.read', seesAllFunds(actor));
  const funds = await listFunds(db, clubId, allowed);
  const fundIds = funds.map((f) => f.id);
  const rows = fundIds.length
    ? await db
        .select()
        .from(s.clubReserves)
        .where(and(eq(s.clubReserves.clubId, clubId), inArray(s.clubReserves.fundId, fundIds)))
        .orderBy(asc(s.clubReserves.name))
    : [];
  const moves = rows.length
    ? await db
        .select({
          reserveId: s.clubReserveMoves.reserveId,
          cents: sql<number>`coalesce(sum(case when ${s.clubReserveMoves.kind} = 'allocate' then ${s.clubReserveMoves.amountCents} else -${s.clubReserveMoves.amountCents} end), 0)::int`,
        })
        .from(s.clubReserveMoves)
        .where(
          inArray(
            s.clubReserveMoves.reserveId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(s.clubReserveMoves.reserveId)
    : [];
  const balanceOf = new Map(moves.map((m) => [m.reserveId, Number(m.cents)]));
  const reserves: ClubReserve[] = rows.map((r) => ({
    id: r.id,
    fundId: r.fundId,
    fundName: funds.find((f) => f.id === r.fundId)?.name ?? '',
    name: r.name,
    targetCents: r.targetCents,
    balanceCents: balanceOf.get(r.id) ?? 0,
    note: r.note,
    archived: !!r.archivedAt,
  }));
  return {
    canManage: canPlan(actor),
    reserves,
    funds: funds
      .filter((f) => !f.archived)
      .map((f) => ({
        fundId: f.id,
        fundName: f.name,
        balanceCents: f.balanceCents,
        reservedCents: reserves
          .filter((r) => r.fundId === f.id && !r.archived)
          .reduce((sum, r) => sum + r.balanceCents, 0),
      })),
  };
}

export async function createReserve(
  db: Db,
  actor: Actor,
  input: ClubReserveInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  await assertFund(db, actor, input.fundId, 'clubcash.manage');
  const name = input.name.trim();
  if (name.length < 2) throw new HttpError(400, 'invalid_name', 'Bitte einen Namen angeben.');
  if (input.targetCents != null && (!Number.isInteger(input.targetCents) || input.targetCents < 1))
    throw new HttpError(400, 'invalid_amount', 'Der Zielbetrag muss größer als 0 sein.');
  const [fund] = await db
    .select()
    .from(s.clubCashFunds)
    .where(and(eq(s.clubCashFunds.id, input.fundId), eq(s.clubCashFunds.clubId, actor.club.id)));
  if (!fund || fund.archivedAt) throw notFound('Die Kasse');
  const [row] = await db
    .insert(s.clubReserves)
    .values({
      clubId: actor.club.id,
      fundId: fund.id,
      name,
      targetCents: input.targetCents ?? null,
      note: input.note?.trim() || null,
      createdAt: now,
    })
    .returning({ id: s.clubReserves.id });
  await audit(
    db,
    actor,
    'clubcash.reserve',
    'club_reserve',
    row!.id,
    `Rücklage angelegt: ${name} (${fund.name})`,
    now,
  );
}

async function loadReserve(db: Db, actor: Actor, id: string) {
  const [reserve] = await db
    .select()
    .from(s.clubReserves)
    .where(and(eq(s.clubReserves.id, id), eq(s.clubReserves.clubId, actor.club.id)));
  if (!reserve) throw notFound('Die Rücklage');
  await assertFund(db, actor, reserve.fundId, 'clubcash.manage');
  return reserve;
}

async function reserveBalance(db: Db, reserveId: string): Promise<number> {
  const [row] = await db
    .select({
      cents: sql<number>`coalesce(sum(case when ${s.clubReserveMoves.kind} = 'allocate' then ${s.clubReserveMoves.amountCents} else -${s.clubReserveMoves.amountCents} end), 0)::int`,
    })
    .from(s.clubReserveMoves)
    .where(eq(s.clubReserveMoves.reserveId, reserveId));
  return Number(row?.cents ?? 0);
}

export async function updateReserve(
  db: Db,
  actor: Actor,
  id: string,
  input: { name?: string; targetCents?: number | null; note?: string | null; archived?: boolean },
  now: Date,
): Promise<void> {
  requireManage(actor);
  const reserve = await loadReserve(db, actor, id);
  const patch: Partial<typeof s.clubReserves.$inferInsert> = {};
  if (input.name !== undefined) {
    if (input.name.trim().length < 2)
      throw new HttpError(400, 'invalid_name', 'Bitte einen Namen angeben.');
    patch.name = input.name.trim();
  }
  if (input.targetCents !== undefined) patch.targetCents = input.targetCents;
  if (input.note !== undefined) patch.note = input.note?.trim() || null;
  if (input.archived === true) {
    if ((await reserveBalance(db, id)) !== 0)
      throw new HttpError(
        409,
        'reserve_not_empty',
        'Die Rücklage ist noch nicht leer. Entnimm zuerst den Rest.',
      );
    patch.archivedAt = now;
  } else if (input.archived === false) patch.archivedAt = null;
  if (Object.keys(patch).length === 0) return;
  await db.update(s.clubReserves).set(patch).where(eq(s.clubReserves.id, id));
  await audit(
    db,
    actor,
    'clubcash.reserve',
    'club_reserve',
    id,
    input.archived === true
      ? `Rücklage aufgelöst: ${reserve.name}`
      : `Rücklage geändert: ${reserve.name}`,
    now,
  );
}

export async function moveReserve(
  db: Db,
  actor: Actor,
  id: string,
  input: ClubReserveMoveInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const reserve = await loadReserve(db, actor, id);
  if (reserve.archivedAt) throw new HttpError(409, 'archived', 'Die Rücklage ist aufgelöst.');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new HttpError(400, 'invalid_amount', 'Der Betrag muss größer als 0 sein.');
  await assertPeriodOpen(db, actor.club.id, input.bookedOn);
  if (input.kind === 'release') {
    const balance = await reserveBalance(db, id);
    if (input.amountCents > balance)
      throw new HttpError(
        400,
        'reserve_insufficient',
        `In der Rücklage sind nur ${euro(balance)}.`,
      );
  } else {
    // Gebunden werden kann nur, was in der Kasse frei ist
    const [fund] = await listFunds(db, actor.club.id, [reserve.fundId]);
    const others = await db
      .select({ id: s.clubReserves.id })
      .from(s.clubReserves)
      .where(and(eq(s.clubReserves.fundId, reserve.fundId), isNull(s.clubReserves.archivedAt)));
    let reserved = 0;
    for (const o of others) reserved += await reserveBalance(db, o.id);
    const free = (fund?.balanceCents ?? 0) - reserved;
    if (input.amountCents > free)
      throw new HttpError(
        400,
        'reserve_exceeds_balance',
        `Frei verfügbar sind nur ${euro(Math.max(0, free))} (Kassenbestand minus bereits gebundene Rücklagen).`,
      );
  }
  await db.insert(s.clubReserveMoves).values({
    clubId: actor.club.id,
    reserveId: id,
    kind: input.kind,
    amountCents: input.amountCents,
    bookedOn: input.bookedOn,
    note: input.note?.trim() || null,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  await audit(
    db,
    actor,
    'clubcash.reserve',
    'club_reserve',
    id,
    `Rücklage ${reserve.name}: ${input.kind === 'allocate' ? 'Zuführung' : 'Entnahme'} ${euro(input.amountCents)}`,
    now,
  );
}

export async function listReserveMoves(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ClubReserveMove[]> {
  requireClubFull(actor);
  const [reserve] = await db
    .select()
    .from(s.clubReserves)
    .where(and(eq(s.clubReserves.id, id), eq(s.clubReserves.clubId, actor.club.id)));
  if (!reserve) throw notFound('Die Rücklage');
  await assertFund(db, actor, reserve.fundId, 'clubcash.read', seesAllFunds(actor));
  const rows = await db
    .select({
      move: s.clubReserveMoves,
      first: s.persons.firstName,
      last: s.persons.lastName,
    })
    .from(s.clubReserveMoves)
    .leftJoin(s.persons, eq(s.persons.id, s.clubReserveMoves.createdByPersonId))
    .where(eq(s.clubReserveMoves.reserveId, id))
    .orderBy(desc(s.clubReserveMoves.bookedOn), desc(s.clubReserveMoves.createdAt));
  return rows.map((r) => ({
    id: r.move.id,
    kind: r.move.kind as 'allocate' | 'release',
    amountCents: r.move.amountCents,
    bookedOn: r.move.bookedOn,
    note: r.move.note,
    createdByName: r.first ? `${r.first} ${r.last}` : null,
  }));
}

// ── Einnahmen-Ausgaben-Rechnung und Jahresabschluss ─────────────────────────

/** Jahressummen je Kategorie über alle Kassen (der Abschluss gilt für den ganzen Verein). */
async function yearTotals(db: Db, clubId: string, year: number) {
  const e = s.clubCashEntries;
  const rows = await db
    .select({
      categoryName: s.clubCashCategories.name,
      area: s.clubCashCategories.area,
      kind: e.kind,
      cents: sql<number>`coalesce(sum(${e.amountCents}), 0)::int`,
    })
    .from(e)
    .innerJoin(s.clubCashCategories, eq(s.clubCashCategories.id, e.categoryId))
    .where(
      and(
        eq(e.clubId, clubId),
        isNull(e.cancelledAt),
        inArray(e.kind, ['income', 'expense']),
        gte(e.bookedOn, `${year}-01-01`),
        lte(e.bookedOn, `${year}-12-31`),
      ),
    )
    .groupBy(s.clubCashCategories.name, s.clubCashCategories.area, e.kind);
  return rows.map((r) => ({
    categoryName: r.categoryName,
    area: r.area as ClubCashArea,
    kind: r.kind as ClubCashDirection,
    cents: Number(r.cents),
  }));
}

/** Kontostand je Konto zum Stichtag (Anfangsbestand plus Buchungen bis einschließlich Stichtag). */
async function balancesAt(db: Db, clubId: string, upTo: string) {
  const accounts = await db
    .select({
      id: s.clubCashAccounts.id,
      name: s.clubCashAccounts.name,
      fundName: s.clubCashFunds.name,
      opening: s.clubCashAccounts.openingBalanceCents,
    })
    .from(s.clubCashAccounts)
    .innerJoin(s.clubCashFunds, eq(s.clubCashFunds.id, s.clubCashAccounts.fundId))
    .where(and(eq(s.clubCashAccounts.clubId, clubId), isNull(s.clubCashAccounts.archivedAt)))
    .orderBy(asc(s.clubCashAccounts.sortOrder), asc(s.clubCashAccounts.createdAt));
  const e = s.clubCashEntries;
  const moved = await db
    .select({
      accountId: e.accountId,
      cents: sql<number>`coalesce(sum(case when ${e.kind} in ('income','transfer_in') then ${e.amountCents} else -${e.amountCents} end), 0)::int`,
    })
    .from(e)
    .where(and(eq(e.clubId, clubId), isNull(e.cancelledAt), lte(e.bookedOn, upTo)))
    .groupBy(e.accountId);
  const movedOf = new Map(moved.map((m) => [m.accountId, Number(m.cents)]));
  return accounts.map((a) => ({
    name: a.name,
    fundName: a.fundName,
    cents: a.opening + (movedOf.get(a.id) ?? 0),
  }));
}

export async function getClosing(
  db: Db,
  actor: Actor,
  year: number,
  now: Date,
): Promise<ClubClosing> {
  const level = requireClubLevel(actor);
  const clubId = actor.club.id;
  const day = today(actor, now);
  const [current, previous] = await Promise.all([
    yearTotals(db, clubId, year),
    yearTotals(db, clubId, year - 1),
  ]);
  const areas: ClubClosingArea[] = CLUB_CASH_AREAS.map((area) => {
    const lines = (kind: ClubCashDirection): ClubClosingLine[] => {
      const names = new Set(
        [...current, ...previous]
          .filter((r) => r.area === area && r.kind === kind)
          .map((r) => r.categoryName),
      );
      return [...names]
        .sort((a, b) => a.localeCompare(b, 'de'))
        .map((categoryName) => ({
          categoryName,
          cents:
            current.find(
              (r) => r.area === area && r.kind === kind && r.categoryName === categoryName,
            )?.cents ?? 0,
          previousCents:
            previous.find(
              (r) => r.area === area && r.kind === kind && r.categoryName === categoryName,
            )?.cents ?? 0,
        }));
    };
    const incomeLines = lines('income');
    const expenseLines = lines('expense');
    const total = (xs: ClubClosingLine[], key: 'cents' | 'previousCents') =>
      xs.reduce((sum, x) => sum + x[key], 0);
    return {
      area,
      incomeLines,
      expenseLines,
      incomeCents: total(incomeLines, 'cents'),
      expenseCents: total(expenseLines, 'cents'),
      previousIncomeCents: total(incomeLines, 'previousCents'),
      previousExpenseCents: total(expenseLines, 'previousCents'),
    };
  });
  const closing = await balancesAt(db, clubId, `${year}-12-31`);
  const opening = await balancesAt(db, clubId, `${year - 1}-12-31`);
  const reserves = await getReserves(db, actor, now);
  const sumOf = (
    key: 'incomeCents' | 'expenseCents' | 'previousIncomeCents' | 'previousExpenseCents',
  ) => areas.reduce((acc, a) => acc + a[key], 0);
  return {
    year,
    clubName: actor.club.name,
    level,
    canManage: actorCan(actor, 'clubcash.manage'),
    canUnlock: actorCan(actor, 'club.settings.manage'),
    lock: await activeLock(db, clubId, year),
    canClose: year < yearOf(day),
    openingCents: opening.reduce((sum, a) => sum + a.cents, 0),
    closingCents: closing.reduce((sum, a) => sum + a.cents, 0),
    incomeCents: sumOf('incomeCents'),
    expenseCents: sumOf('expenseCents'),
    previousIncomeCents: sumOf('previousIncomeCents'),
    previousExpenseCents: sumOf('previousExpenseCents'),
    areas,
    accounts: closing.map((a, i) => ({
      name: a.name,
      fundName: a.fundName,
      openingCents: opening[i]?.cents ?? 0,
      closingCents: a.cents,
    })),
    reserves: reserves.reserves
      .filter((r) => !r.archived && r.balanceCents !== 0)
      .map((r) => ({ name: r.name, fundName: r.fundName, balanceCents: r.balanceCents })),
  };
}

export async function closeYear(db: Db, actor: Actor, year: number, now: Date): Promise<void> {
  requireClubManage(actor);
  const clubId = actor.club.id;
  if (year >= yearOf(today(actor, now)))
    throw new HttpError(
      409,
      'year_not_over',
      'Ein Jahr kann erst nach seinem Ende abgeschlossen werden.',
    );
  if (await activeLock(db, clubId, year))
    throw new HttpError(409, 'already_locked', `Das Jahr ${year} ist bereits abgeschlossen.`);
  // Die Jahre davor sollen zuerst abgeschlossen sein, sonst ändert ein offenes Vorjahr den Anfangsbestand
  const [firstEntry] = await db
    .select({ day: sql<string>`min(${s.clubCashEntries.bookedOn})` })
    .from(s.clubCashEntries)
    .where(eq(s.clubCashEntries.clubId, clubId));
  const firstYear = firstEntry?.day ? yearOf(firstEntry.day) : year;
  for (let y = firstYear; y < year; y++) {
    if (!(await activeLock(db, clubId, y)))
      throw new HttpError(409, 'previous_open', `Bitte schließe zuerst das Jahr ${y} ab.`);
  }
  await db.insert(s.clubPeriodLocks).values({
    clubId,
    year,
    lockedAt: now,
    lockedByPersonId: actor.person.id,
  });
  await audit(
    db,
    actor,
    'clubcash.close',
    'club',
    clubId,
    `Vereinskasse: Jahr ${year} abgeschlossen`,
    now,
  );
}

export async function reopenYear(
  db: Db,
  actor: Actor,
  year: number,
  reason: string,
  now: Date,
): Promise<void> {
  requireLevel(actor);
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Ein abgeschlossenes Jahr öffnet nur die Administration.');
  const why = reason.trim();
  if (why.length < 3) throw new HttpError(400, 'reason_required', 'Bitte eine Begründung angeben.');
  const clubId = actor.club.id;
  if (!(await activeLock(db, clubId, year)))
    throw new HttpError(409, 'not_locked', `Das Jahr ${year} ist nicht abgeschlossen.`);
  // Spätere Jahre bauen auf dem Abschluss auf
  const [later] = await db
    .select({ year: s.clubPeriodLocks.year })
    .from(s.clubPeriodLocks)
    .where(
      and(
        eq(s.clubPeriodLocks.clubId, clubId),
        isNull(s.clubPeriodLocks.unlockedAt),
        sql`${s.clubPeriodLocks.year} > ${year}`,
      ),
    )
    .limit(1);
  if (later)
    throw new HttpError(
      409,
      'later_locked',
      `Das Jahr ${later.year} ist noch abgeschlossen. Öffne zuerst die späteren Jahre.`,
    );
  await db
    .update(s.clubPeriodLocks)
    .set({ unlockedAt: now, unlockedByPersonId: actor.person.id, unlockReason: why })
    .where(
      and(
        eq(s.clubPeriodLocks.clubId, clubId),
        eq(s.clubPeriodLocks.year, year),
        isNull(s.clubPeriodLocks.unlockedAt),
      ),
    );
  await audit(
    db,
    actor,
    'clubcash.reopen',
    'club',
    clubId,
    `Vereinskasse: Jahr ${year} wieder geöffnet: ${why}`,
    now,
  );
}

// ── Export: CSV und PDF über kurzlebigen Link ───────────────────────────────

const LINK_MS = 10 * 60 * 1000;

export async function closingLink(
  db: Db,
  actor: Actor,
  year: number,
  format: 'csv' | 'pdf',
  now: Date,
): Promise<{ token: string; expiresAt: string }> {
  requireClubFull(actor);
  const expiresAt = new Date(now.getTime() + LINK_MS);
  const id = `${format === 'pdf' ? 'kp' : 'k'}:${actor.club.id}|${year}`;
  return { token: actor.links.create(id, expiresAt), expiresAt: expiresAt.toISOString() };
}

const cell = (value: string | null | undefined): string => {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const num = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Der Link trägt Verein und Jahr; der Bericht wird mit Vereinsrechten gebaut (nur Auswertung, keine Personen). */
async function closingFor(db: Db, payload: string, now: Date) {
  const [clubId, yearText] = payload.split('|');
  const year = Number(yearText);
  if (!clubId || !Number.isInteger(year)) return null;
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, clubId));
  if (!club) return null;
  return { club, year, data: await closingData(db, club, year, now) };
}

async function closingData(
  db: Db,
  club: { id: string; timezone: string },
  year: number,
  now: Date,
) {
  const clubId = club.id;
  const [current, previous] = await Promise.all([
    yearTotals(db, clubId, year),
    yearTotals(db, clubId, year - 1),
  ]);
  const closing = await balancesAt(db, clubId, `${year}-12-31`);
  const opening = await balancesAt(db, clubId, `${year - 1}-12-31`);
  const lock = await activeLock(db, clubId, year);
  const reserves = await db
    .select({
      name: s.clubReserves.name,
      fundName: s.clubCashFunds.name,
      id: s.clubReserves.id,
    })
    .from(s.clubReserves)
    .innerJoin(s.clubCashFunds, eq(s.clubCashFunds.id, s.clubReserves.fundId))
    .where(and(eq(s.clubReserves.clubId, clubId), isNull(s.clubReserves.archivedAt)));
  const reserveRows = [];
  for (const r of reserves) {
    const balance = await reserveBalance(db, r.id);
    if (balance !== 0) reserveRows.push({ name: r.name, fundName: r.fundName, cents: balance });
  }
  return {
    current,
    previous,
    opening: opening.reduce((sum, a) => sum + a.cents, 0),
    closing: closing.reduce((sum, a) => sum + a.cents, 0),
    accounts: closing.map((a, i) => ({
      name: a.name,
      fundName: a.fundName,
      opening: opening[i]?.cents ?? 0,
      closing: a.cents,
    })),
    reserves: reserveRows,
    lock,
    created: german(toIsoDate(calendarDayOf(now, club.timezone))),
  };
}

type ClosingData = Awaited<ReturnType<typeof closingData>>;

function closingAreas(d: ClosingData) {
  return CLUB_CASH_AREAS.map((area) => {
    const names = (kind: ClubCashDirection) =>
      [
        ...new Set(
          [...d.current, ...d.previous]
            .filter((r) => r.area === area && r.kind === kind)
            .map((r) => r.categoryName),
        ),
      ].sort((a, b) => a.localeCompare(b, 'de'));
    const pick = (list: ClosingData['current'], kind: ClubCashDirection, name: string) =>
      list.find((r) => r.area === area && r.kind === kind && r.categoryName === name)?.cents ?? 0;
    const lines = (kind: ClubCashDirection) =>
      names(kind).map((name) => ({
        name,
        cents: pick(d.current, kind, name),
        previous: pick(d.previous, kind, name),
      }));
    return { area, income: lines('income'), expense: lines('expense') };
  });
}

const total = (xs: { cents: number }[]) => xs.reduce((sum, x) => sum + x.cents, 0);
const totalPrev = (xs: { previous: number }[]) => xs.reduce((sum, x) => sum + x.previous, 0);

export async function closingCsv(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; csv: string } | null> {
  const r = await closingFor(db, payload, now);
  if (!r) return null;
  const { club, year, data } = r;
  const areas = closingAreas(data);
  const lines: string[] = [
    `Jahresabschluss ${year};${cell(club.name)}`,
    `Erstellt;${data.created}`,
    data.lock
      ? `Abgeschlossen am;${german(data.lock.lockedAt.slice(0, 10))}`
      : 'Status;Noch nicht abgeschlossen',
    '',
    `Bereich;Art;Kategorie;${year};${year - 1}`,
  ];
  let income = 0;
  let expense = 0;
  let incomePrev = 0;
  let expensePrev = 0;
  for (const a of areas) {
    for (const l of a.income)
      lines.push(
        `${cell(CLUB_CASH_AREA_LABEL[a.area])};Einnahme;${cell(l.name)};${num(l.cents)};${num(l.previous)}`,
      );
    for (const l of a.expense)
      lines.push(
        `${cell(CLUB_CASH_AREA_LABEL[a.area])};Ausgabe;${cell(l.name)};${num(l.cents)};${num(l.previous)}`,
      );
    lines.push(
      `${cell(CLUB_CASH_AREA_LABEL[a.area])};Ergebnis;;${num(total(a.income) - total(a.expense))};${num(totalPrev(a.income) - totalPrev(a.expense))}`,
    );
    income += total(a.income);
    expense += total(a.expense);
    incomePrev += totalPrev(a.income);
    expensePrev += totalPrev(a.expense);
  }
  lines.push(
    '',
    `Summe Einnahmen;;;${num(income)};${num(incomePrev)}`,
    `Summe Ausgaben;;;${num(expense)};${num(expensePrev)}`,
    `Jahresergebnis;;;${num(income - expense)};${num(incomePrev - expensePrev)}`,
    '',
    `Bestand 01.01.${year};;;${num(data.opening)};`,
    `Bestand 31.12.${year};;;${num(data.closing)};`,
    '',
    `Konto;Kasse;;Anfang ${year};Ende ${year}`,
    ...data.accounts.map(
      (a) => `${cell(a.name)};${cell(a.fundName)};;${num(a.opening)};${num(a.closing)}`,
    ),
  );
  if (data.reserves.length)
    lines.push(
      '',
      'Rücklagen;Kasse;;Bestand;',
      ...data.reserves.map((x) => `${cell(x.name)};${cell(x.fundName)};;${num(x.cents)};`),
    );
  return {
    fileName: `Jahresabschluss ${year} ${club.shortName}.csv`,
    csv: '﻿' + lines.join('\r\n') + '\r\n',
  };
}

export async function closingPdf(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; pdf: Buffer } | null> {
  const r = await closingFor(db, payload, now);
  if (!r) return null;
  const { club, year, data } = r;
  const areas = closingAreas(data);
  const doc = new SimplePdf();
  doc.text(`Jahresabschluss ${year}`, { size: 18, bold: true });
  doc.text(`${club.name} · Einnahmen-Ausgaben-Rechnung`, { size: 10 });
  doc.text(
    data.lock
      ? `Abgeschlossen am ${german(data.lock.lockedAt.slice(0, 10))} · erstellt am ${data.created}`
      : `Noch nicht abgeschlossen (Entwurf) · erstellt am ${data.created}`,
    { size: 9 },
  );
  doc.gap(10);
  const cols = [56, 330, 430];
  let income = 0;
  let expense = 0;
  let incomePrev = 0;
  let expensePrev = 0;
  for (const a of areas) {
    doc.gap(6);
    doc.text(CLUB_CASH_AREA_LABEL[a.area], { size: 12, bold: true });
    doc.row(['Kategorie', String(year), String(year - 1)], cols, {
      bold: true,
      alignRight: [1, 2],
    });
    if (a.income.length === 0 && a.expense.length === 0) doc.row(['Keine Buchungen', '', ''], cols);
    for (const l of a.income)
      doc.row([`Einnahme: ${l.name}`, `${num(l.cents)} €`, `${num(l.previous)} €`], cols, {
        alignRight: [1, 2],
      });
    for (const l of a.expense)
      doc.row([`Ausgabe: ${l.name}`, `${num(l.cents)} €`, `${num(l.previous)} €`], cols, {
        alignRight: [1, 2],
      });
    doc.row(
      [
        'Ergebnis',
        `${num(total(a.income) - total(a.expense))} €`,
        `${num(totalPrev(a.income) - totalPrev(a.expense))} €`,
      ],
      cols,
      { bold: true, alignRight: [1, 2] },
    );
    income += total(a.income);
    expense += total(a.expense);
    incomePrev += totalPrev(a.income);
    expensePrev += totalPrev(a.expense);
  }
  doc.gap(10);
  doc.text('Gesamtergebnis', { size: 12, bold: true });
  doc.row(['', String(year), String(year - 1)], cols, { bold: true, alignRight: [1, 2] });
  doc.row(['Summe Einnahmen', `${num(income)} €`, `${num(incomePrev)} €`], cols, {
    alignRight: [1, 2],
  });
  doc.row(['Summe Ausgaben', `${num(expense)} €`, `${num(expensePrev)} €`], cols, {
    alignRight: [1, 2],
  });
  doc.row(
    ['Jahresergebnis', `${num(income - expense)} €`, `${num(incomePrev - expensePrev)} €`],
    cols,
    { bold: true, alignRight: [1, 2] },
  );
  doc.gap(10);
  doc.text('Bestände', { size: 12, bold: true });
  doc.row(['Konto (Kasse)', `01.01.${year}`, `31.12.${year}`], cols, {
    bold: true,
    alignRight: [1, 2],
  });
  for (const a of data.accounts)
    doc.row([`${a.name} (${a.fundName})`, `${num(a.opening)} €`, `${num(a.closing)} €`], cols, {
      alignRight: [1, 2],
    });
  doc.row(['Summe', `${num(data.opening)} €`, `${num(data.closing)} €`], cols, {
    bold: true,
    alignRight: [1, 2],
  });
  if (data.reserves.length) {
    doc.gap(10);
    doc.text('Rücklagen (gebundener Teil des Bestands)', { size: 12, bold: true });
    for (const x of data.reserves)
      doc.row([`${x.name} (${x.fundName})`, `${num(x.cents)} €`], [56, 330], {
        alignRight: [1],
      });
  }
  doc.gap(12);
  doc.text(
    'Einfache Einnahmen-Ausgaben-Rechnung ohne doppelte Buchführung; ersetzt keine Steuerberatung.',
    { size: 8 },
  );
  return { fileName: `Jahresabschluss ${year} ${club.shortName}.pdf`, pdf: doc.build() };
}
