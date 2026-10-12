/**
 * Vereinskasse (Paket K1, docs/VEREINSKASSE.md): Konten, Kassenbuch mit Belegen, Kategorien nach
 * den vier steuerlichen Bereichen, Kostenstellen, Umbuchung und Storno. Getrennt von den
 * Mannschaftskassen. Keine Löschung – nur Storno mit Begründung; jede Änderung steht im Protokoll.
 */
import {
  CLUB_CASH_ACCOUNT_KINDS,
  CLUB_CASH_AREAS,
  CLUB_CASH_CATEGORY_TEMPLATE,
  CLUB_CASH_VISIBILITIES,
  CLUB_CASH_VISIBILITY_INFO,
  CLUB_COST_CENTER_KINDS,
  type ClubCash,
  type ClubCashAccount,
  type ClubCashAccountKind,
  type ClubCashArea,
  type ClubCashDirection,
  type ClubCashEntry,
  type ClubCashEntryInput,
  type ClubCashEntryQuery,
  type ClubCashTransferInput,
  type ClubCashVisibility,
  type ClubCostCenterKind,
  scopesWith,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { assertFund, ensureMainFund, fundScope, listFunds } from './club-funds';
import { assertNoReceipt, assertPeriodOpen } from './club-periods';
import { mediaReference } from './uploads';
import { resolveMediaUrl } from '../storage/media-links';

type Level = 'full' | 'reports' | 'none';

/** Platzhalter, damit `inArray` bei leerer Liste gültig bleibt (trifft nie). */
const NO_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Wer die Kasse in welchem Umfang sieht: Kassenführung immer (für den ganzen Verein oder für
 * einzelne Abteilungen und deren Kassen), Vorstand je nach Einstellung des Vereins.
 */
export function clubCashLevel(actor: Actor): Level {
  const read = scopesWith(actor.grants, 'clubcash.read');
  if (read.all || read.orgUnitIds.length > 0) return 'full';
  const visibility = actor.club.clubCashVisibility as ClubCashVisibility;
  const isBoard = actor.grants.some((g) => g.key === 'board' && g.scopeType === 'club');
  if (isBoard && visibility === 'board_all') return 'full';
  if (isBoard && visibility === 'board_reports') return 'reports';
  return 'none';
}

/** Sieht der Nutzer alle Kassen (Recht für den ganzen Verein oder Vorstand mit Einsicht)? */
export const seesAllFunds = (actor: Actor) =>
  actorCan(actor, 'clubcash.read') ||
  scopesWith(actor.grants, 'clubcash.read').orgUnitIds.length === 0;

export function requireLevel(actor: Actor): Exclude<Level, 'none'> {
  if (!moduleEnabled(actor, 'club_cash'))
    throw new HttpError(404, 'module_off', 'Die Vereinskasse ist nicht aktiviert.');
  const level = clubCashLevel(actor);
  if (level === 'none') throw forbidden('Die Vereinskasse sehen nur Kassenführung und Prüfer.');
  return level;
}

export function requireFull(actor: Actor) {
  if (requireLevel(actor) !== 'full')
    throw forbidden('Du siehst die Vereinskasse nur als Auswertung, nicht einzelne Buchungen.');
}

/** Buchen darf, wer das Recht für den ganzen Verein oder für Abteilungen mit Kassen hat. */
export function requireManage(actor: Actor) {
  requireLevel(actor);
  const manage = scopesWith(actor.grants, 'clubcash.manage');
  if (!manage.all && manage.orgUnitIds.length === 0)
    throw forbidden('Die Vereinskasse führt der Kassenwart (Verein).');
}

// Beiträge, Planung und Abschluss gelten für den ganzen Verein: nur Rechte ohne Beschränkung auf einzelne Kassen.
export function requireClubLevel(actor: Actor): Exclude<Level, 'none'> {
  const level = requireLevel(actor);
  if (!seesAllFunds(actor)) throw forbidden('Das sieht nur die Kassenführung des ganzen Vereins.');
  return level;
}

export function requireClubFull(actor: Actor) {
  if (requireClubLevel(actor) !== 'full')
    throw forbidden('Du siehst die Vereinskasse nur als Auswertung, nicht einzelne Buchungen.');
}

export function requireClubManage(actor: Actor) {
  requireLevel(actor);
  if (!actorCan(actor, 'clubcash.manage'))
    throw forbidden('Die Vereinskasse führt der Kassenwart (Verein).');
}

export async function audit(
  db: Db,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  label: string,
  now: Date,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType,
    entityId,
    data: { label },
    createdAt: now,
  });
}

export const euro = (cents: number) =>
  `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// ── Lesen ───────────────────────────────────────────────────────────────────

export async function getClubCash(
  db: Db,
  actor: Actor,
  now: Date,
  fundIdQuery: string | null = null,
): Promise<ClubCash> {
  const level = requireLevel(actor);
  const clubId = actor.club.id;
  const year = now.getUTCFullYear();

  await ensureMainFund(db, clubId, now);
  const funds = await listFunds(
    db,
    clubId,
    await fundScope(db, actor, 'clubcash.read', seesAllFunds(actor)),
  );
  if (fundIdQuery && !funds.some((f) => f.id === fundIdQuery))
    throw forbidden('Diese Kasse siehst du nicht.');
  const shownFunds = fundIdQuery ? funds.filter((f) => f.id === fundIdQuery) : funds;
  const fundIds = shownFunds.map((f) => f.id);

  const [accounts, categories, centers] = await Promise.all([
    fundIds.length
      ? db
          .select()
          .from(s.clubCashAccounts)
          .where(
            and(eq(s.clubCashAccounts.clubId, clubId), inArray(s.clubCashAccounts.fundId, fundIds)),
          )
          .orderBy(asc(s.clubCashAccounts.sortOrder), asc(s.clubCashAccounts.createdAt))
      : Promise.resolve([] as (typeof s.clubCashAccounts.$inferSelect)[]),
    db
      .select()
      .from(s.clubCashCategories)
      .where(eq(s.clubCashCategories.clubId, clubId))
      .orderBy(asc(s.clubCashCategories.sortOrder), asc(s.clubCashCategories.name)),
    db
      .select()
      .from(s.clubCostCenters)
      .where(eq(s.clubCostCenters.clubId, clubId))
      .orderBy(asc(s.clubCostCenters.name)),
  ]);

  // Kontostand = Anfangsbestand + Zugänge − Abgänge (ohne Stornierte)
  const moved = await db
    .select({
      accountId: s.clubCashEntries.accountId,
      cents: sql<number>`coalesce(sum(case when ${s.clubCashEntries.kind} in ('income','transfer_in') then ${s.clubCashEntries.amountCents} else -${s.clubCashEntries.amountCents} end), 0)::int`,
    })
    .from(s.clubCashEntries)
    .where(
      and(
        eq(s.clubCashEntries.clubId, clubId),
        isNull(s.clubCashEntries.cancelledAt),
        inArray(s.clubCashEntries.accountId, accounts.map((a) => a.id).concat(NO_ID)),
      ),
    )
    .groupBy(s.clubCashEntries.accountId);
  const balanceOf = new Map(moved.map((m) => [m.accountId, Number(m.cents)]));

  const accountList: ClubCashAccount[] = accounts.map((a) => ({
    id: a.id,
    fundId: a.fundId,
    name: a.name,
    kind: a.kind as ClubCashAccountKind,
    openingBalanceCents: a.openingBalanceCents,
    balanceCents: a.openingBalanceCents + (balanceOf.get(a.id) ?? 0),
    archived: !!a.archivedAt,
  }));

  const areaRows = await db
    .select({
      area: s.clubCashCategories.area,
      kind: s.clubCashEntries.kind,
      cents: sql<number>`coalesce(sum(${s.clubCashEntries.amountCents}), 0)::int`,
    })
    .from(s.clubCashEntries)
    .innerJoin(s.clubCashCategories, eq(s.clubCashCategories.id, s.clubCashEntries.categoryId))
    .where(
      and(
        eq(s.clubCashEntries.clubId, clubId),
        isNull(s.clubCashEntries.cancelledAt),
        inArray(s.clubCashEntries.accountId, accounts.map((a) => a.id).concat(NO_ID)),
        gte(s.clubCashEntries.bookedOn, `${year}-01-01`),
        lte(s.clubCashEntries.bookedOn, `${year}-12-31`),
      ),
    )
    .groupBy(s.clubCashCategories.area, s.clubCashEntries.kind);
  const areaTotals = CLUB_CASH_AREAS.map((area) => ({
    area,
    incomeCents: Number(areaRows.find((r) => r.area === area && r.kind === 'income')?.cents ?? 0),
    expenseCents: Number(areaRows.find((r) => r.area === area && r.kind === 'expense')?.cents ?? 0),
  }));

  return {
    level,
    canManage: !!(
      scopesWith(actor.grants, 'clubcash.manage').all ||
      scopesWith(actor.grants, 'clubcash.manage').orgUnitIds.length
    ),
    canManageFunds: actorCan(actor, 'clubcash.manage'),
    canAudit: actorCan(actor, 'clubcash.audit'),
    canChangeSettings: actorCan(actor, 'club.settings.manage'),
    visibility: actor.club.clubCashVisibility as ClubCashVisibility,
    year,
    funds,
    units: await db
      .select({ id: s.orgUnits.id, name: s.orgUnits.name })
      .from(s.orgUnits)
      .where(eq(s.orgUnits.clubId, clubId))
      .orderBy(asc(s.orgUnits.sortOrder), asc(s.orgUnits.name)),
    fundId: fundIdQuery,
    accounts: accountList,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      direction: c.direction as ClubCashDirection,
      area: c.area as ClubCashArea,
      archived: !!c.archivedAt,
    })),
    costCenters: centers.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind as ClubCostCenterKind,
      archived: !!c.archivedAt,
    })),
    areaTotals,
    totalBalanceCents: accountList
      .filter((a) => !a.archived)
      .reduce((sum, a) => sum + a.balanceCents, 0),
    recent:
      level === 'full'
        ? (await listEntries(db, actor, { fundId: fundIdQuery ?? undefined }, now, 8)).slice(0, 8)
        : [],
  };
}

export async function listEntries(
  db: Db,
  actor: Actor,
  query: ClubCashEntryQuery,
  now: Date,
  limit = 200,
): Promise<ClubCashEntry[]> {
  requireFull(actor);
  const e = s.clubCashEntries;
  const conditions = [eq(e.clubId, actor.club.id)];
  const scope = await fundScope(db, actor, 'clubcash.read', seesAllFunds(actor));
  if (scope !== null) {
    if (query.fundId && !scope.includes(query.fundId))
      throw forbidden('Diese Kasse siehst du nicht.');
    conditions.push(inArray(s.clubCashAccounts.fundId, scope.concat(NO_ID)));
  }
  if (query.fundId) conditions.push(eq(s.clubCashAccounts.fundId, query.fundId));
  if (!query.includeCancelled) conditions.push(isNull(e.cancelledAt));
  if (query.accountId) conditions.push(eq(e.accountId, query.accountId));
  if (query.categoryId) conditions.push(eq(e.categoryId, query.categoryId));
  if (query.costCenterId) conditions.push(eq(e.costCenterId, query.costCenterId));
  if (query.from) conditions.push(gte(e.bookedOn, query.from));
  if (query.to) conditions.push(lte(e.bookedOn, query.to));
  if (query.q?.trim()) {
    const like = `%${query.q.trim().replace(/[%_]/g, '')}%`;
    conditions.push(
      or(ilike(e.purpose, like), ilike(e.counterparty, like), ilike(e.receiptNo, like))!,
    );
  }
  const rows = await db
    .select({
      entry: e,
      accountName: s.clubCashAccounts.name,
      fundId: s.clubCashAccounts.fundId,
      fundName: s.clubCashFunds.name,
      categoryName: s.clubCashCategories.name,
      area: s.clubCashCategories.area,
      costCenterName: s.clubCostCenters.name,
    })
    .from(e)
    .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, e.accountId))
    .innerJoin(s.clubCashFunds, eq(s.clubCashFunds.id, s.clubCashAccounts.fundId))
    .leftJoin(s.clubCashCategories, eq(s.clubCashCategories.id, e.categoryId))
    .leftJoin(s.clubCostCenters, eq(s.clubCostCenters.id, e.costCenterId))
    .where(and(...conditions))
    .orderBy(desc(e.bookedOn), desc(e.createdAt))
    .limit(limit);

  const personIds = [
    ...new Set(
      rows.flatMap((r) =>
        [r.entry.createdByPersonId, r.entry.cancelledByPersonId].filter((x): x is string => !!x),
      ),
    ),
  ];
  const people = personIds.length
    ? await db
        .select({ id: s.persons.id, first: s.persons.firstName, last: s.persons.lastName })
        .from(s.persons)
        .where(inArray(s.persons.id, personIds))
    : [];
  const nameOf = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? `${p.first} ${p.last}` : null;
  };

  return rows.map((r) => ({
    id: r.entry.id,
    kind: r.entry.kind as ClubCashEntry['kind'],
    accountId: r.entry.accountId,
    accountName: r.accountName,
    fundId: r.fundId,
    fundName: r.fundName,
    amountCents: r.entry.amountCents,
    bookedOn: r.entry.bookedOn,
    categoryId: r.entry.categoryId,
    categoryName: r.categoryName,
    area: (r.area as ClubCashArea | null) ?? null,
    costCenterId: r.entry.costCenterId,
    costCenterName: r.costCenterName,
    counterparty: r.entry.counterparty,
    purpose: r.entry.purpose,
    receiptNo: r.entry.receiptNo,
    receiptUrl: resolveMediaUrl(actor.links, r.entry.receiptRef, now),
    transferId: r.entry.transferId,
    createdByName: nameOf(r.entry.createdByPersonId),
    createdAt: r.entry.createdAt.toISOString(),
    cancelled: r.entry.cancelledAt
      ? {
          at: r.entry.cancelledAt.toISOString(),
          byName: nameOf(r.entry.cancelledByPersonId),
          reason: r.entry.cancelReason ?? '',
        }
      : null,
  }));
}

// ── Buchen ──────────────────────────────────────────────────────────────────

async function activeAccount(db: Db, actor: Actor, id: string) {
  const [account] = await db
    .select()
    .from(s.clubCashAccounts)
    .where(and(eq(s.clubCashAccounts.id, id), eq(s.clubCashAccounts.clubId, actor.club.id)));
  if (!account) throw notFound('Das Konto');
  if (account.archivedAt) throw new HttpError(409, 'archived', 'Das Konto ist archiviert.');
  await assertFund(db, actor, account.fundId, 'clubcash.manage');
  const [fund] = await db
    .select({ archivedAt: s.clubCashFunds.archivedAt })
    .from(s.clubCashFunds)
    .where(eq(s.clubCashFunds.id, account.fundId));
  if (fund?.archivedAt) throw new HttpError(409, 'archived', 'Die Kasse ist stillgelegt.');
  return account;
}

export async function createEntry(
  db: Db,
  actor: Actor,
  input: ClubCashEntryInput,
  now: Date,
): Promise<ClubCashEntry> {
  requireManage(actor);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new HttpError(400, 'invalid_amount', 'Der Betrag muss größer als 0 sein.');
  await assertPeriodOpen(db, actor.club.id, input.bookedOn);
  const account = await activeAccount(db, actor, input.accountId);
  const [category] = await db
    .select()
    .from(s.clubCashCategories)
    .where(
      and(
        eq(s.clubCashCategories.id, input.categoryId),
        eq(s.clubCashCategories.clubId, actor.club.id),
      ),
    );
  if (!category) throw notFound('Die Kategorie');
  if (category.archivedAt) throw new HttpError(409, 'archived', 'Die Kategorie ist archiviert.');
  if (category.direction !== input.kind)
    throw new HttpError(
      400,
      'category_direction',
      input.kind === 'income'
        ? 'Für Einnahmen passt nur eine Einnahmekategorie.'
        : 'Für Ausgaben passt nur eine Ausgabekategorie.',
    );
  let costCenterId: string | null = null;
  if (input.costCenterId) {
    const [center] = await db
      .select()
      .from(s.clubCostCenters)
      .where(
        and(
          eq(s.clubCostCenters.id, input.costCenterId),
          eq(s.clubCostCenters.clubId, actor.club.id),
        ),
      );
    if (!center || center.archivedAt) throw notFound('Die Kostenstelle');
    costCenterId = center.id;
  }
  const receiptRef = input.receiptImageId
    ? await mediaReference(db, actor, input.receiptImageId, 'receipt')
    : null;
  const purpose = input.purpose.trim();
  if (!purpose)
    throw new HttpError(400, 'invalid_purpose', 'Bitte einen Verwendungszweck angeben.');
  const [row] = await db
    .insert(s.clubCashEntries)
    .values({
      clubId: actor.club.id,
      accountId: account.id,
      kind: input.kind,
      amountCents: input.amountCents,
      bookedOn: input.bookedOn,
      categoryId: category.id,
      costCenterId,
      counterparty: input.counterparty?.trim() || null,
      purpose,
      receiptNo: input.receiptNo?.trim() || null,
      receiptRef,
      createdByPersonId: actor.person.id,
      createdAt: now,
    })
    .returning({ id: s.clubCashEntries.id });
  await audit(
    db,
    actor,
    'clubcash.entry',
    'club_cash_entry',
    row!.id,
    `Vereinskasse: ${input.kind === 'income' ? 'Einnahme' : 'Ausgabe'} ${euro(input.amountCents)} – ${purpose}`,
    now,
  );
  const [created] = (await listEntries(db, actor, { includeCancelled: true }, now)).filter(
    (e) => e.id === row!.id,
  );
  return created!;
}

export async function createTransfer(
  db: Db,
  actor: Actor,
  input: ClubCashTransferInput,
  now: Date,
): Promise<ClubCashEntry[]> {
  requireManage(actor);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
    throw new HttpError(400, 'invalid_amount', 'Der Betrag muss größer als 0 sein.');
  if (input.fromAccountId === input.toAccountId)
    throw new HttpError(400, 'same_account', 'Quelle und Ziel müssen verschiedene Konten sein.');
  await assertPeriodOpen(db, actor.club.id, input.bookedOn);
  const from = await activeAccount(db, actor, input.fromAccountId);
  const to = await activeAccount(db, actor, input.toAccountId);
  const transferId = randomUUID();
  const purpose = input.purpose?.trim() || `Umbuchung ${from.name} → ${to.name}`;
  const base = {
    clubId: actor.club.id,
    amountCents: input.amountCents,
    bookedOn: input.bookedOn,
    purpose,
    transferId,
    createdByPersonId: actor.person.id,
    createdAt: now,
  };
  await db.insert(s.clubCashEntries).values([
    { ...base, accountId: from.id, kind: 'transfer_out' },
    { ...base, accountId: to.id, kind: 'transfer_in' },
  ]);
  await audit(
    db,
    actor,
    'clubcash.transfer',
    'club_cash_transfer',
    transferId,
    `Vereinskasse: Umbuchung ${euro(input.amountCents)} von ${from.name} nach ${to.name}`,
    now,
  );
  return (await listEntries(db, actor, {}, now)).filter((e) => e.transferId === transferId);
}

export async function cancelEntry(
  db: Db,
  actor: Actor,
  entryId: string,
  reason: string,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const why = reason.trim();
  if (why.length < 3) throw new HttpError(400, 'reason_required', 'Bitte eine Begründung angeben.');
  const [entry] = await db
    .select()
    .from(s.clubCashEntries)
    .where(and(eq(s.clubCashEntries.id, entryId), eq(s.clubCashEntries.clubId, actor.club.id)));
  if (!entry) throw notFound('Die Buchung');
  if (entry.cancelledAt)
    throw new HttpError(409, 'already_cancelled', 'Die Buchung ist bereits storniert.');
  await assertPeriodOpen(db, actor.club.id, entry.bookedOn);
  await assertNoReceipt(db, entry.id);
  // Auch eine Umbuchung zwischen Kassen: Rechte für jede betroffene Kasse nötig
  const sides = await db
    .select({ fundId: s.clubCashAccounts.fundId })
    .from(s.clubCashEntries)
    .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, s.clubCashEntries.accountId))
    .where(
      entry.transferId
        ? eq(s.clubCashEntries.transferId, entry.transferId)
        : eq(s.clubCashEntries.id, entry.id),
    );
  for (const side of sides) await assertFund(db, actor, side.fundId, 'clubcash.manage');
  // Beide Seiten einer Umbuchung werden gemeinsam storniert
  const target = entry.transferId
    ? eq(s.clubCashEntries.transferId, entry.transferId)
    : eq(s.clubCashEntries.id, entry.id);
  await db
    .update(s.clubCashEntries)
    .set({
      cancelledAt: now,
      cancelledByPersonId: actor.person.id,
      cancelReason: why,
    })
    .where(and(target, isNull(s.clubCashEntries.cancelledAt)));
  await audit(
    db,
    actor,
    'clubcash.cancel',
    'club_cash_entry',
    entry.id,
    `Vereinskasse: Buchung storniert (${euro(entry.amountCents)} – ${entry.purpose}): ${why}`,
    now,
  );
}

// ── Konten, Kategorien, Kostenstellen ───────────────────────────────────────

export type ClubCashAccountInput = {
  name?: string;
  kind?: ClubCashAccountKind;
  openingBalanceCents?: number;
  archived?: boolean;
};

export async function createAccount(
  db: Db,
  actor: Actor,
  input: Required<Pick<ClubCashAccountInput, 'name' | 'kind'>> &
    Pick<ClubCashAccountInput, 'openingBalanceCents'> & { fundId?: string | null },
  now: Date,
): Promise<void> {
  requireManage(actor);
  if (!CLUB_CASH_ACCOUNT_KINDS.includes(input.kind))
    throw new HttpError(400, 'invalid_kind', 'Unbekannte Kontoart.');
  const fundId = input.fundId ?? (await ensureMainFund(db, actor.club.id, now));
  const [fund] = await db
    .select()
    .from(s.clubCashFunds)
    .where(and(eq(s.clubCashFunds.id, fundId), eq(s.clubCashFunds.clubId, actor.club.id)));
  if (!fund) throw notFound('Die Kasse');
  if (fund.archivedAt) throw new HttpError(409, 'archived', 'Die Kasse ist stillgelegt.');
  await assertFund(db, actor, fund.id, 'clubcash.manage');
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.clubCashAccounts)
    .where(eq(s.clubCashAccounts.clubId, actor.club.id))) as [{ n: number }];
  const [row] = await db
    .insert(s.clubCashAccounts)
    .values({
      clubId: actor.club.id,
      fundId: fund.id,
      name: input.name.trim(),
      kind: input.kind,
      openingBalanceCents: input.openingBalanceCents ?? 0,
      sortOrder: n,
      createdAt: now,
    })
    .returning({ id: s.clubCashAccounts.id });
  await audit(
    db,
    actor,
    'clubcash.account',
    'club_cash_account',
    row!.id,
    `Vereinskasse: Konto angelegt: ${input.name.trim()} (Anfangsbestand ${euro(input.openingBalanceCents ?? 0)})`,
    now,
  );
}

export async function updateAccount(
  db: Db,
  actor: Actor,
  id: string,
  input: ClubCashAccountInput,
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [account] = await db
    .select()
    .from(s.clubCashAccounts)
    .where(and(eq(s.clubCashAccounts.id, id), eq(s.clubCashAccounts.clubId, actor.club.id)));
  if (!account) throw notFound('Das Konto');
  await assertFund(db, actor, account.fundId, 'clubcash.manage');
  const patch: Partial<typeof s.clubCashAccounts.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.archived !== undefined) patch.archivedAt = input.archived ? now : null;
  if (input.openingBalanceCents !== undefined) {
    // Anfangsbestand nur ändern, solange nichts gebucht ist (sonst verfälscht er die Historie)
    const [{ n }] = (await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.clubCashEntries)
      .where(eq(s.clubCashEntries.accountId, id))) as [{ n: number }];
    if (n > 0 && input.openingBalanceCents !== account.openingBalanceCents)
      throw new HttpError(
        409,
        'opening_locked',
        'Der Anfangsbestand ist gesperrt, sobald auf dem Konto gebucht wurde.',
      );
    patch.openingBalanceCents = input.openingBalanceCents;
  }
  if (Object.keys(patch).length === 0) return;
  await db.update(s.clubCashAccounts).set(patch).where(eq(s.clubCashAccounts.id, id));
  await audit(
    db,
    actor,
    'clubcash.account',
    'club_cash_account',
    id,
    input.archived === undefined
      ? `Vereinskasse: Konto geändert: ${account.name}`
      : input.archived
        ? `Vereinskasse: Konto archiviert: ${account.name}`
        : `Vereinskasse: Konto wieder aktiviert: ${account.name}`,
    now,
  );
}

export async function createCategory(
  db: Db,
  actor: Actor,
  input: { name: string; direction: ClubCashDirection; area: ClubCashArea },
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.clubCashCategories)
    .where(eq(s.clubCashCategories.clubId, actor.club.id))) as [{ n: number }];
  const [row] = await db
    .insert(s.clubCashCategories)
    .values({
      clubId: actor.club.id,
      name: input.name.trim(),
      direction: input.direction,
      area: input.area,
      sortOrder: n,
      createdAt: now,
    })
    .returning({ id: s.clubCashCategories.id });
  await audit(
    db,
    actor,
    'clubcash.category',
    'club_cash_category',
    row!.id,
    `Vereinskasse: Kategorie angelegt: ${input.name.trim()}`,
    now,
  );
}

export async function updateCategory(
  db: Db,
  actor: Actor,
  id: string,
  input: { name?: string; area?: ClubCashArea; archived?: boolean },
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [category] = await db
    .select()
    .from(s.clubCashCategories)
    .where(and(eq(s.clubCashCategories.id, id), eq(s.clubCashCategories.clubId, actor.club.id)));
  if (!category) throw notFound('Die Kategorie');
  const patch: Partial<typeof s.clubCashCategories.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.area !== undefined) patch.area = input.area;
  if (input.archived !== undefined) patch.archivedAt = input.archived ? now : null;
  if (Object.keys(patch).length === 0) return;
  await db.update(s.clubCashCategories).set(patch).where(eq(s.clubCashCategories.id, id));
  await audit(
    db,
    actor,
    'clubcash.category',
    'club_cash_category',
    id,
    `Vereinskasse: Kategorie geändert: ${category.name}`,
    now,
  );
}

/** Übernimmt die Kategorien-Vorlage; nur solange noch keine Kategorie existiert. */
export async function applyCategoryTemplate(db: Db, actor: Actor, now: Date): Promise<void> {
  requireManage(actor);
  await insertCategoryTemplate(db, actor.club.id, false);
  await audit(
    db,
    actor,
    'clubcash.category',
    'club_cash_category',
    actor.club.id,
    'Vereinskasse: Kategorien aus der Vorlage übernommen',
    now,
  );
}

export async function insertCategoryTemplate(db: Db, clubId: string, force: boolean) {
  const existing = await db
    .select({ id: s.clubCashCategories.id })
    .from(s.clubCashCategories)
    .where(eq(s.clubCashCategories.clubId, clubId))
    .limit(1);
  if (existing.length > 0 && !force)
    throw new HttpError(409, 'categories_exist', 'Es gibt bereits Kategorien.');
  await db
    .insert(s.clubCashCategories)
    .values(CLUB_CASH_CATEGORY_TEMPLATE.map((c, i) => ({ clubId, ...c, sortOrder: i })));
}

export async function createCostCenter(
  db: Db,
  actor: Actor,
  input: { name: string; kind: ClubCostCenterKind },
  now: Date,
): Promise<void> {
  requireManage(actor);
  if (!CLUB_COST_CENTER_KINDS.includes(input.kind))
    throw new HttpError(400, 'invalid_kind', 'Unbekannte Art der Kostenstelle.');
  const [row] = await db
    .insert(s.clubCostCenters)
    .values({ clubId: actor.club.id, name: input.name.trim(), kind: input.kind, createdAt: now })
    .returning({ id: s.clubCostCenters.id });
  await audit(
    db,
    actor,
    'clubcash.costcenter',
    'club_cost_center',
    row!.id,
    `Vereinskasse: Kostenstelle angelegt: ${input.name.trim()}`,
    now,
  );
}

export async function updateCostCenter(
  db: Db,
  actor: Actor,
  id: string,
  input: { name?: string; archived?: boolean },
  now: Date,
): Promise<void> {
  requireManage(actor);
  const [center] = await db
    .select()
    .from(s.clubCostCenters)
    .where(and(eq(s.clubCostCenters.id, id), eq(s.clubCostCenters.clubId, actor.club.id)));
  if (!center) throw notFound('Die Kostenstelle');
  const patch: Partial<typeof s.clubCostCenters.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.archived !== undefined) patch.archivedAt = input.archived ? now : null;
  if (Object.keys(patch).length === 0) return;
  await db.update(s.clubCostCenters).set(patch).where(eq(s.clubCostCenters.id, id));
  await audit(
    db,
    actor,
    'clubcash.costcenter',
    'club_cost_center',
    id,
    `Vereinskasse: Kostenstelle geändert: ${center.name}`,
    now,
  );
}

/** „Wer darf die Kasse einsehen?“ – nur die Vereinsadministration. */
export async function setVisibility(
  db: Db,
  actor: Actor,
  visibility: ClubCashVisibility,
  now: Date,
): Promise<void> {
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Wer die Vereinskasse einsehen darf, bestimmt die Vereinsadministration.');
  if (!CLUB_CASH_VISIBILITIES.includes(visibility))
    throw new HttpError(400, 'invalid_visibility', 'Unbekannte Auswahl.');
  await db
    .update(s.clubs)
    .set({ clubCashVisibility: visibility })
    .where(eq(s.clubs.id, actor.club.id));
  await audit(
    db,
    actor,
    'clubcash.settings',
    'club',
    actor.club.id,
    `Vereinskasse: Einsicht geändert (${CLUB_CASH_VISIBILITY_INFO[visibility].name})`,
    now,
  );
}
