/**
 * Auswertungen der Vereinskasse (Paket ST): Kassenstand und Geldbewegungen je Periode mit Vorjahr, Bereiche,
 * Plan gegen Ist, Beiträge, Ausgaben je Abteilung und Rücklagen. Alles wird hier berechnet und aggregiert geliefert.
 * Rechte wie die Kassenübersicht: Wer die Kasse sehen darf, sieht auch die Auswertung; Beiträge nur die
 * Kassenführung des ganzen Vereins. Perioden und „heute“ in der Vereinszeitzone.
 */
import {
  CLUB_CASH_AREAS,
  calendarDayOf,
  toIsoDate,
  type ClubCashArea,
  type ClubCashStats,
  type ClubStatsInterval,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden } from '../errors';
import { requireLevel, seesAllFunds } from './club-cash';
import { ensureMainFund, fundScope, listFunds } from './club-funds';
import { getBudget, getReserves } from './club-planning';

const NO_ID = '00000000-0000-0000-0000-000000000000';

export type ClubStatsQuery = {
  from?: string;
  to?: string;
  interval?: ClubStatsInterval;
  fundId?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
/** Datum um Jahre verschieben; der 29. Februar wird zum 28. */
function shiftYears(day: string, years: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const target = y! + years;
  const last = new Date(Date.UTC(target, m!, 0)).getUTCDate();
  return `${target}-${pad(m!)}-${pad(Math.min(d!, last))}`;
}
const monthKey = (day: string) => day.slice(0, 7);
const quarterKey = (day: string) =>
  `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`;
const keyOf = (interval: ClubStatsInterval, day: string) =>
  interval === 'quarter' ? quarterKey(day) : monthKey(day);
/** Letzter Kalendertag der Periode, in der `day` liegt. */
function periodEnd(interval: ClubStatsInterval, day: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const endMonth = interval === 'quarter' ? Math.ceil(m / 3) * 3 : m;
  return `${y}-${pad(endMonth)}-${pad(new Date(Date.UTC(y, endMonth, 0)).getUTCDate())}`;
}
/** Alle Periodenenden vom Beginn des Zeitraums bis zu seinem Ende. */
function periodEnds(interval: ClubStatsInterval, from: string, to: string): string[] {
  const ends: string[] = [];
  let end = periodEnd(interval, from);
  while (end < periodEnd(interval, to)) {
    ends.push(end);
    const [y, m] = end.split('-').map(Number);
    const next = m === 12 ? `${y! + 1}-01-01` : `${y}-${pad(m! + 1)}-01`;
    end = periodEnd(interval, next);
  }
  ends.push(periodEnd(interval, to));
  return ends;
}

export async function getClubCashStats(
  db: Db,
  actor: Actor,
  query: ClubStatsQuery,
  now: Date,
): Promise<ClubCashStats> {
  requireLevel(actor);
  const clubId = actor.club.id;
  const interval: ClubStatsInterval = query.interval ?? 'month';
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const to = query.to ?? today;
  const from = query.from ?? `${to.slice(0, 4)}-01-01`;
  if (from > to) throw new HttpError(400, 'invalid_range', 'Der Zeitraum ist ungültig.');

  await ensureMainFund(db, clubId, now);
  const funds = await listFunds(
    db,
    clubId,
    await fundScope(db, actor, 'clubcash.read', seesAllFunds(actor)),
  );
  if (query.fundId && !funds.some((f) => f.id === query.fundId))
    throw forbidden('Diese Kasse siehst du nicht.');
  const fundIds = (query.fundId ? funds.filter((f) => f.id === query.fundId) : funds).map(
    (f) => f.id,
  );
  const accounts = fundIds.length
    ? await db
        .select({
          id: s.clubCashAccounts.id,
          opening: s.clubCashAccounts.openingBalanceCents,
        })
        .from(s.clubCashAccounts)
        .where(
          and(
            eq(s.clubCashAccounts.clubId, clubId),
            inArray(s.clubCashAccounts.fundId, fundIds),
            // wie der Gesamtbestand der Übersicht: stillgelegte Konten zählen nicht mit
            isNull(s.clubCashAccounts.archivedAt),
          ),
        )
    : [];
  const accountIds = accounts.map((a) => a.id).concat(NO_ID);
  const opening = accounts.reduce((sum, a) => sum + a.opening, 0);

  // Alle Buchungen bis zum Ende des Zeitraums (Vereinsgröße: wenige tausend Zeilen) – Bestand und Bewegungen in einem Zug
  const e = s.clubCashEntries;
  const entries = await db
    .select({
      kind: e.kind,
      cents: e.amountCents,
      day: e.bookedOn,
      categoryId: e.categoryId,
      costCenterId: e.costCenterId,
      area: s.clubCashCategories.area,
    })
    .from(e)
    .leftJoin(s.clubCashCategories, eq(s.clubCashCategories.id, e.categoryId))
    .where(
      and(
        eq(e.clubId, clubId),
        isNull(e.cancelledAt),
        inArray(e.accountId, accountIds),
        lte(e.bookedOn, periodEnd(interval, to)),
      ),
    );
  const signed = (r: { kind: string; cents: number }) =>
    r.kind === 'income' || r.kind === 'transfer_in' ? r.cents : -r.cents;
  const balanceAt = (day: string) =>
    opening + entries.filter((r) => r.day <= day).reduce((sum, r) => sum + signed(r), 0);
  const flowIn = (a: string, b: string, kind: 'income' | 'expense') =>
    entries
      .filter((r) => r.kind === kind && r.day >= a && r.day <= b)
      .reduce((sum, r) => sum + r.cents, 0);

  const ends = periodEnds(interval, from, to);
  const startOf = (end: string, i: number) => (i === 0 ? from : shiftDay(ends[i - 1]!));
  const balance = ends.map((end) => ({
    key: keyOf(interval, end),
    cents: balanceAt(end),
    previousCents: balanceAt(shiftYears(end, -1)),
  }));
  const flows = ends.map((end, i) => {
    const a = startOf(end, i);
    return {
      key: keyOf(interval, end),
      incomeCents: flowIn(a, end, 'income'),
      expenseCents: flowIn(a, end, 'expense'),
      previousIncomeCents: flowIn(shiftYears(a, -1), shiftYears(end, -1), 'income'),
      previousExpenseCents: flowIn(shiftYears(a, -1), shiftYears(end, -1), 'expense'),
    };
  });

  const inRange = entries.filter((r) => r.day >= from && r.day <= to);
  const areas = CLUB_CASH_AREAS.map((area: ClubCashArea) => ({
    area,
    incomeCents: inRange
      .filter((r) => r.area === area && r.kind === 'income')
      .reduce((sum, r) => sum + r.cents, 0),
    expenseCents: inRange
      .filter((r) => r.area === area && r.kind === 'expense')
      .reduce((sum, r) => sum + r.cents, 0),
  }));

  // Plan gegen Ist je Kategorie (Jahr des Zeitraumendes), über alle sichtbaren Kassen zusammengefasst
  const year = Number(to.slice(0, 4));
  const budget = await getBudget(db, actor, year, query.fundId ?? null, now);
  const byCategory = new Map<string, NonNullable<ClubCashStats['plan']>['lines'][number]>();
  for (const l of budget.lines) {
    const cur = byCategory.get(l.categoryId);
    if (cur) {
      cur.plannedCents += l.plannedCents;
      cur.actualCents += l.actualCents;
    } else {
      byCategory.set(l.categoryId, {
        categoryId: l.categoryId,
        name: l.categoryName,
        direction: l.direction,
        area: l.area,
        plannedCents: l.plannedCents,
        actualCents: l.actualCents,
      });
    }
  }
  const plan = byCategory.size ? { year, lines: [...byCategory.values()] } : null;

  // Beiträge: nur die Kassenführung des ganzen Vereins
  let fees: ClubCashStats['fees'] = null;
  if (seesAllFunds(actor)) {
    const dues = await db
      .select({
        id: s.clubFeeDues.id,
        dueOn: s.clubFeeDues.dueOn,
        amount: s.clubFeeDues.amountCents,
        cancelled: s.clubFeeDues.cancelledAt,
        paid: sql<number>`coalesce((select sum(p.amount_cents) from club_fee_payments p where p.due_id = ${s.clubFeeDues.id}), 0)::int`,
      })
      .from(s.clubFeeDues)
      .where(eq(s.clubFeeDues.clubId, clubId));
    const live = dues
      .filter((d) => !d.cancelled && d.dueOn >= from && d.dueOn <= to)
      .map((d) => ({ ...d, paid: Number(d.paid) }));
    const openOf = (d: (typeof live)[number]) => Math.max(0, d.amount - d.paid);
    const overdue = live.filter((d) => openOf(d) > 0 && d.dueOn < today);
    const payments = await db
      .select({ paidOn: s.clubFeePayments.paidOn, cents: s.clubFeePayments.amountCents })
      .from(s.clubFeePayments)
      .where(eq(s.clubFeePayments.clubId, clubId));
    fees = {
      dueCents: live.reduce((sum, d) => sum + d.amount, 0),
      paidCents: live.reduce((sum, d) => sum + Math.min(d.paid, d.amount), 0),
      openCents: live.reduce((sum, d) => sum + openOf(d), 0),
      overdueCents: overdue.reduce((sum, d) => sum + openOf(d), 0),
      overdueCount: overdue.length,
      received: ends.map((end, i) => {
        const a = startOf(end, i);
        return {
          key: keyOf(interval, end),
          cents: payments
            .filter((p) => p.paidOn >= a && p.paidOn <= end)
            .reduce((sum, p) => sum + p.cents, 0),
        };
      }),
    };
  }

  const centers = await db
    .select({ id: s.clubCostCenters.id, name: s.clubCostCenters.name })
    .from(s.clubCostCenters)
    .where(and(eq(s.clubCostCenters.clubId, clubId), eq(s.clubCostCenters.kind, 'department')));
  const departments = centers
    .map((c) => ({
      id: c.id,
      name: c.name,
      expenseCents: inRange
        .filter((r) => r.kind === 'expense' && r.costCenterId === c.id)
        .reduce((sum, r) => sum + r.cents, 0),
    }))
    .filter((d) => d.expenseCents > 0)
    .sort((a, b) => b.expenseCents - a.expenseCents);

  const reserves = (await getReserves(db, actor, now)).reserves
    .filter((r) => !r.archived && (!query.fundId || r.fundId === query.fundId))
    .map((r) => ({
      id: r.id,
      name: r.name,
      balanceCents: r.balanceCents,
      targetCents: r.targetCents,
    }));

  return {
    from,
    to,
    interval,
    fundId: query.fundId ?? null,
    balance,
    flows,
    areas,
    plan,
    fees,
    departments,
    reserves,
    totals: {
      balanceCents: balanceAt(to),
      previousBalanceCents: balanceAt(shiftYears(to, -1)),
      incomeCents: flowIn(from, to, 'income'),
      expenseCents: flowIn(from, to, 'expense'),
      previousExpenseCents: flowIn(shiftYears(from, -1), shiftYears(to, -1), 'expense'),
    },
  };
}

/** Der Tag nach `day`. */
function shiftDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
