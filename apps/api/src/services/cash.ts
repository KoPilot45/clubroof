/**
 * Mannschaftskasse (Mappe S. 16, Konzept §4). Kassenstand, Buchungen und Statistik sieht die ganze
 * Mannschaft (Festlegung 07.10.2026); buchen nur Kassenverantwortliche. Den Strafenkatalog pflegen
 * Trainerteam und Kassenwart – sie vergeben auch die Strafen.
 */
import {
  calendarDayOf,
  resolveModule,
  toIsoDate,
  type AssignFineInput,
  CASH_EXPENSE_CATEGORIES,
  CASH_INCOME_CATEGORIES,
  type CashEntry,
  type CashSettings,
  type PaymentMethod,
  type CashStats,
  type CreateCashBookingInput,
  type FineType,
  type SaveFineTypeInput,
  type TeamCash,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { SimplePdf } from '../storage/pdf';
import { cashAdminView, notifyCharges } from './cash-admin';
import { mediaReference } from './uploads';
import { loadTeamForActor, requireModule, type TeamRow } from './team-access';

type TxRow = typeof s.cashTransactions.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type AccountSettings = (typeof s.cashAccounts.$inferSelect)['settings'];

export async function personNames(db: Db | Tx, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: s.persons.id, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.persons)
    .where(inArray(s.persons.id, [...new Set(ids)]));
  return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }));
}

export function personalDelta(t: TxRow): number {
  if (t.isCharge) return -t.amountCents;
  return t.category === 'einzahlung' ? t.amountCents : 0;
}

export function cashConfig(actor: Actor, team: TeamRow) {
  const { config } = resolveModule(actor.modules, 'team_cash', {
    teamId: team.id,
    orgUnitId: team.orgUnitId,
  });
  return { fines: config.fines === true, drinks: config.drinks === true };
}

export async function accountFor(db: Db, actor: Actor, team: TeamRow, create = false) {
  const [account] = await db
    .select()
    .from(s.cashAccounts)
    .where(eq(s.cashAccounts.teamId, team.id));
  if (account || !create) return account ?? null;
  const [created] = await db
    .insert(s.cashAccounts)
    .values({ clubId: actor.club.id, teamId: team.id, name: `Mannschaftskasse ${team.name}` })
    .returning();
  return created!;
}

/** Kassenstand, Buchungen und Statistik: ganze Mannschaft und Kassenverantwortliche. */
export async function loadCashTeam(db: Db, actor: Actor, teamId: string) {
  const loaded = await loadTeamForActor(db, actor, teamId);
  requireModule(actor, 'team_cash', loaded.team);
  return { ...loaded, seesAll: loaded.isMember || loaded.permissions.readCash };
}

export function cashSettings(account: { settings: AccountSettings } | null): CashSettings {
  const v = account?.settings ?? {};
  return {
    iban: v.iban ?? null,
    accountHolder: v.accountHolder ?? null,
    paypalLink: v.paypalLink ?? null,
    drinkPriceCents: v.drinkPriceCents ?? null,
    showMemberBalances: v.showMemberBalances !== false,
    autoReminder: v.autoReminder === true,
  };
}

/** Persönliche Salden aller Personen (ohne Stornos). */
export async function personalBalances(db: Db | Tx, accountId: string) {
  const rows = await db
    .select({
      tx: s.cashTransactions,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.cashTransactions)
    .innerJoin(s.persons, eq(s.persons.id, s.cashTransactions.personId))
    .where(
      and(eq(s.cashTransactions.accountId, accountId), isNull(s.cashTransactions.cancelledAt)),
    );
  const balances = new Map<string, { name: string; balanceCents: number }>();
  for (const r of rows) {
    const b = balances.get(r.tx.personId!) ?? {
      name: `${r.firstName} ${r.lastName}`,
      balanceCents: 0,
    };
    b.balanceCents += personalDelta(r.tx);
    balances.set(r.tx.personId!, b);
  }
  return balances;
}

async function fineCatalog(db: Db, team: TeamRow): Promise<FineType[]> {
  const rows = await db
    .select({ type: s.cashFineTypes, given: count(s.cashTransactions.id) })
    .from(s.cashFineTypes)
    .leftJoin(
      s.cashTransactions,
      and(
        eq(s.cashTransactions.fineTypeId, s.cashFineTypes.id),
        isNull(s.cashTransactions.cancelledAt),
      ),
    )
    .where(and(eq(s.cashFineTypes.teamId, team.id), isNull(s.cashFineTypes.archivedAt)))
    .groupBy(s.cashFineTypes.id)
    .orderBy(asc(s.cashFineTypes.amountCents), asc(s.cashFineTypes.name));
  return rows.map(({ type, given }) => ({
    id: type.id,
    name: type.name,
    amountCents: type.amountCents,
    timesGiven: Number(given),
  }));
}

export async function getTeamCash(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date = new Date(),
): Promise<TeamCash> {
  const { team, permissions, seesAll } = await loadCashTeam(db, actor, teamId);
  const account = await accountFor(db, actor, team);
  const config = cashConfig(actor, team);
  const settings = cashSettings(account);
  // Offene Beträge anderer: ganze Mannschaft, außer die Kasse hat das abgeschaltet
  const seesOthers = seesAll && (settings.showMemberBalances || permissions.manageCash);

  const rows = account
    ? await db
        .select({
          tx: s.cashTransactions,
          firstName: s.persons.firstName,
          lastName: s.persons.lastName,
        })
        .from(s.cashTransactions)
        .leftJoin(s.persons, eq(s.persons.id, s.cashTransactions.personId))
        .where(eq(s.cashTransactions.accountId, account.id))
        .orderBy(desc(s.cashTransactions.bookedOn), desc(s.cashTransactions.createdAt))
    : [];

  const cancellers = new Map(
    (
      await personNames(
        db,
        rows.map((r) => r.tx.cancelledByPersonId).filter((id): id is string => !!id),
      )
    ).map((p) => [p.id, p.name]),
  );
  const toEntry = (r: (typeof rows)[number]): CashEntry => ({
    id: r.tx.id,
    bookedOn: r.tx.bookedOn,
    direction: r.tx.direction,
    isCharge: r.tx.isCharge,
    amountCents: r.tx.amountCents,
    category: r.tx.category,
    description: r.tx.description,
    counterparty: r.tx.counterparty,
    person: r.tx.personId ? { id: r.tx.personId, name: `${r.firstName} ${r.lastName}` } : null,
    paymentMethod: (r.tx.paymentMethod as PaymentMethod | null) ?? null,
    receiptUrl: resolveMediaUrl(actor.links, r.tx.receiptRef, now),
    cancelled: r.tx.cancelledAt
      ? {
          at: r.tx.cancelledAt.toISOString(),
          by: r.tx.cancelledByPersonId ? (cancellers.get(r.tx.cancelledByPersonId) ?? null) : null,
          reason: r.tx.cancelReason,
        }
      : null,
  });

  const active = rows.filter((r) => !r.tx.cancelledAt);
  const money = active.filter((r) => !r.tx.isCharge);
  const income = money
    .filter((r) => r.tx.direction === 'income')
    .reduce((a, r) => a + r.tx.amountCents, 0);
  const expense = money
    .filter((r) => r.tx.direction === 'expense')
    .reduce((a, r) => a + r.tx.amountCents, 0);

  const balances = new Map<string, { name: string; balanceCents: number }>();
  for (const r of active) {
    if (!r.tx.personId) continue;
    const current = balances.get(r.tx.personId) ?? {
      name: `${r.firstName} ${r.lastName}`,
      balanceCents: 0,
    };
    current.balanceCents += personalDelta(r.tx);
    balances.set(r.tx.personId, current);
  }

  const memberIds = new Set(
    actor.memberships.filter((m) => m.teamId === team.id).map((m) => m.personId),
  );
  const personal = actor.managed
    .filter((p) => memberIds.has(p.id))
    .map((p) => ({
      personId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      balanceCents: balances.get(p.id)?.balanceCents ?? 0,
      entries: rows.filter((r) => r.tx.personId === p.id).map(toEntry),
    }));

  return {
    team: { id: team.id, name: team.name, badge: team.badge },
    permissions,
    config,
    balanceCents: seesAll ? income - expense : null,
    incomeCents: seesAll ? income : null,
    expenseCents: seesAll ? expense : null,
    entries: seesAll
      ? rows
          .filter((r) => seesOthers || !r.tx.personId || actor.managedIds.includes(r.tx.personId))
          .map(toEntry)
      : null,
    members: seesOthers
      ? [...balances.entries()]
          .map(([personId, v]) => ({ personId, ...v }))
          .sort((a, b) => a.balanceCents - b.balanceCents)
      : null,
    personal,
    fineCatalog: config.fines ? await fineCatalog(db, team) : [],
    settings: seesAll || personal.length ? settings : { ...settings, iban: null, paypalLink: null },
    ...(await cashAdminView(db, actor, team, account, permissions.manageCash)),
  };
}

// ── Strafenkatalog ──────────────────────────────────────────────────────────

async function loadFineTeam(db: Db, actor: Actor, teamId: string) {
  const loaded = await loadCashTeam(db, actor, teamId);
  if (!cashConfig(actor, loaded.team).fines) {
    throw new HttpError(
      400,
      'fines_disabled',
      'Strafen sind für diese Mannschaft nicht aktiviert.',
    );
  }
  return loaded;
}

function requireFines(permissions: { manageFines: boolean }) {
  if (!permissions.manageFines) {
    throw forbidden('Den Strafenkatalog pflegen Trainerteam und Kassenwart.');
  }
}

export async function createFineType(
  db: Db,
  actor: Actor,
  teamId: string,
  input: SaveFineTypeInput,
): Promise<TeamCash> {
  const { team, permissions } = await loadFineTeam(db, actor, teamId);
  requireFines(permissions);
  await db.insert(s.cashFineTypes).values({
    clubId: actor.club.id,
    teamId: team.id,
    name: input.name.trim(),
    amountCents: input.amountCents,
  });
  return getTeamCash(db, actor, teamId);
}

async function loadFineType(db: Db, actor: Actor, fineTypeId: string) {
  const [type] = await db
    .select()
    .from(s.cashFineTypes)
    .where(
      and(
        eq(s.cashFineTypes.id, fineTypeId),
        eq(s.cashFineTypes.clubId, actor.club.id),
        isNull(s.cashFineTypes.archivedAt),
      ),
    );
  if (!type) throw notFound('Die Strafe');
  return type;
}

export async function updateFineType(
  db: Db,
  actor: Actor,
  fineTypeId: string,
  input: SaveFineTypeInput,
): Promise<TeamCash> {
  const type = await loadFineType(db, actor, fineTypeId);
  const { permissions } = await loadFineTeam(db, actor, type.teamId);
  requireFines(permissions);
  // Bereits vergebene Strafen behalten ihren Betrag – der neue gilt ab jetzt
  await db
    .update(s.cashFineTypes)
    .set({ name: input.name.trim(), amountCents: input.amountCents })
    .where(eq(s.cashFineTypes.id, type.id));
  return getTeamCash(db, actor, type.teamId);
}

export async function archiveFineType(
  db: Db,
  actor: Actor,
  fineTypeId: string,
  now: Date,
): Promise<TeamCash> {
  const type = await loadFineType(db, actor, fineTypeId);
  const { permissions } = await loadFineTeam(db, actor, type.teamId);
  requireFines(permissions);
  await db.update(s.cashFineTypes).set({ archivedAt: now }).where(eq(s.cashFineTypes.id, type.id));
  return getTeamCash(db, actor, type.teamId);
}

/** Strafe an eine oder mehrere Personen vergeben – je Person eine Forderung auf ihrem Konto. */
export async function assignFine(
  db: Db,
  actor: Actor,
  teamId: string,
  input: AssignFineInput,
  now: Date,
): Promise<TeamCash> {
  const { team, permissions } = await loadFineTeam(db, actor, teamId);
  requireFines(permissions);
  const type = input.fineTypeId ? await loadFineType(db, actor, input.fineTypeId) : null;
  if (type && type.teamId !== team.id) throw notFound('Die Strafe');
  if (!type && !permissions.manageCash) {
    throw forbidden('Bitte wähle eine Strafe aus dem Strafenkatalog.');
  }
  const amountCents = type?.amountCents ?? input.amountCents;
  const description = type?.name ?? input.description?.trim();
  if (!amountCents || !description) {
    throw new HttpError(400, 'validation', 'Bitte gib Betrag und Beschreibung an.');
  }
  const personIds = [...new Set(input.personIds)];
  const members = await db
    .select({ personId: s.teamMemberships.personId })
    .from(s.teamMemberships)
    .where(
      and(eq(s.teamMemberships.teamId, team.id), inArray(s.teamMemberships.personId, personIds)),
    );
  if (new Set(members.map((m) => m.personId)).size !== personIds.length) {
    throw new HttpError(400, 'invalid_person', 'Nicht alle Personen gehören zur Mannschaft.');
  }

  const account = (await accountFor(db, actor, team, true))!;
  const bookedOn = input.bookedOn ?? toIsoDate(calendarDayOf(now, actor.club.timezone));
  await db.transaction(async (tx) => {
    const rows = await tx
      .insert(s.cashTransactions)
      .values(
        personIds.map((personId) => ({
          clubId: actor.club.id,
          accountId: account.id,
          direction: 'income' as const,
          isCharge: true,
          category: 'strafe',
          amountCents,
          description,
          personId,
          fineTypeId: type?.id ?? null,
          bookedOn,
          createdByPersonId: actor.person.id,
          createdAt: now,
        })),
      )
      .returning({ id: s.cashTransactions.id });
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'cash.fine_assigned',
      entityType: 'cash_transaction',
      entityId: rows[0]!.id,
      data: { teamId: team.id, persons: personIds.length, amountCents, description },
      createdAt: now,
    });
  });
  await notifyCharges(
    db,
    actor.club,
    team,
    personIds.map((personId) => ({ personId, amountCents, description: `Strafe: ${description}` })),
    actor.user.id,
    now,
  );
  return getTeamCash(db, actor, teamId, now);
}

// ── Kassenstatistik ─────────────────────────────────────────────────────────

/** Verlauf und Auswertung der Saison: ganze Mannschaft und Kassenverantwortliche. */
export async function getCashStats(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<CashStats> {
  const { team, seesAll, permissions } = await loadCashTeam(db, actor, teamId);
  if (!seesAll) throw forbidden('Die Kassenstatistik sieht die Mannschaft.');
  const account = await accountFor(db, actor, team);
  const [season] = await db.select().from(s.seasons).where(eq(s.seasons.id, team.seasonId));
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const rows = account
    ? await db
        .select({
          tx: s.cashTransactions,
          firstName: s.persons.firstName,
          lastName: s.persons.lastName,
        })
        .from(s.cashTransactions)
        .leftJoin(s.persons, eq(s.persons.id, s.cashTransactions.personId))
        .where(
          and(
            eq(s.cashTransactions.accountId, account.id),
            lte(s.cashTransactions.bookedOn, today),
            isNull(s.cashTransactions.cancelledAt),
          ),
        )
        .orderBy(asc(s.cashTransactions.bookedOn))
    : [];
  const signed = (t: TxRow) => (t.direction === 'income' ? t.amountCents : -t.amountCents);
  const start = season!.startsOn;
  const money = rows.filter((r) => !r.tx.isCharge);

  // Monate von Saisonbeginn bis heute; Stand vor Saisonbeginn als Startwert
  let balance = money.filter((r) => r.tx.bookedOn < start).reduce((a, r) => a + signed(r.tx), 0);
  const months: CashStats['months'] = [];
  for (let m = start.slice(0, 7); m <= today.slice(0, 7);) {
    const inMonth = money.filter((r) => r.tx.bookedOn.startsWith(m) && r.tx.bookedOn >= start);
    const incomeCents = inMonth
      .filter((r) => r.tx.direction === 'income')
      .reduce((a, r) => a + r.tx.amountCents, 0);
    const expenseCents = inMonth
      .filter((r) => r.tx.direction === 'expense')
      .reduce((a, r) => a + r.tx.amountCents, 0);
    balance += incomeCents - expenseCents;
    months.push({ month: m, incomeCents, expenseCents, balanceCents: balance });
    const [y, mo] = m.split('-').map(Number);
    m = mo === 12 ? `${y! + 1}-01` : `${y}-${String(mo! + 1).padStart(2, '0')}`;
  }

  const seasonRows = rows.filter((r) => r.tx.bookedOn >= start);
  const categories = new Map<string, { incomeCents: number; expenseCents: number }>();
  for (const { tx } of seasonRows.filter((r) => !r.tx.isCharge)) {
    const c = categories.get(tx.category) ?? { incomeCents: 0, expenseCents: 0 };
    if (tx.direction === 'income') c.incomeCents += tx.amountCents;
    else c.expenseCents += tx.amountCents;
    categories.set(tx.category, c);
  }

  const fineRows = seasonRows.filter((r) => r.tx.isCharge && r.tx.category === 'strafe');
  const fines = new Map<string, { count: number; amountCents: number }>();
  for (const { tx } of fineRows) {
    const f = fines.get(tx.description) ?? { count: 0, amountCents: 0 };
    f.count += 1;
    f.amountCents += tx.amountCents;
    fines.set(tx.description, f);
  }

  // Persönliche Konten über alle Zeit (offene Beträge verfallen nicht mit der Saison)
  const personal = new Map<
    string,
    { name: string; count: number; amountCents: number; balance: number }
  >();
  for (const r of rows) {
    if (!r.tx.personId) continue;
    const p = personal.get(r.tx.personId) ?? {
      name: `${r.firstName} ${r.lastName}`,
      count: 0,
      amountCents: 0,
      balance: 0,
    };
    p.balance += personalDelta(r.tx);
    if (r.tx.isCharge && r.tx.category === 'strafe' && r.tx.bookedOn >= start) {
      p.count += 1;
      p.amountCents += r.tx.amountCents;
    }
    personal.set(r.tx.personId, p);
  }
  const charged = rows.filter((r) => r.tx.isCharge).reduce((a, r) => a + r.tx.amountCents, 0);
  const openCents = [...personal.values()].reduce((a, p) => a + Math.max(0, -p.balance), 0);

  return {
    months,
    categories: [...categories.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.incomeCents + b.expenseCents - (a.incomeCents + a.expenseCents)),
    fines: [...fines.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || b.amountCents - a.amountCents),
    finesByPerson: [...personal.entries()]
      .filter(([, p]) => p.count > 0)
      .filter(
        ([personId]) =>
          cashSettings(account).showMemberBalances ||
          permissions.manageCash ||
          actor.managedIds.includes(personId),
      )
      .map(([personId, p]) => ({
        personId,
        name: p.name,
        count: p.count,
        amountCents: p.amountCents,
        openCents: Math.max(0, -p.balance),
      }))
      .sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name)),
    openCents,
    paidRate: charged ? Math.round(((charged - openCents) / charged) * 100) : null,
  };
}

const KIND = {
  income: { direction: 'income', isCharge: false, category: 'einnahme', needsPerson: false },
  expense: { direction: 'expense', isCharge: false, category: 'ausgabe', needsPerson: false },
  fine: { direction: 'income', isCharge: true, category: 'strafe', needsPerson: true },
  drinks: { direction: 'income', isCharge: true, category: 'getraenke', needsPerson: true },
  payment: { direction: 'income', isCharge: false, category: 'einzahlung', needsPerson: true },
} as const;

export async function createBooking(
  db: Db,
  actor: Actor,
  teamId: string,
  input: CreateCashBookingInput,
  now: Date,
): Promise<TeamCash> {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  requireModule(actor, 'team_cash', team);
  if (!permissions.manageCash)
    throw forbidden('Buchungen dürfen nur Kassenverantwortliche erfassen.');

  const kind = KIND[input.kind];
  const config = cashConfig(actor, team);
  if (input.kind === 'fine' && !config.fines) {
    throw new HttpError(
      400,
      'fines_disabled',
      'Strafen sind für diese Mannschaft nicht aktiviert.',
    );
  }
  if (input.kind === 'drinks' && !config.drinks) {
    throw new HttpError(
      400,
      'drinks_disabled',
      'Getränke sind für diese Mannschaft nicht aktiviert.',
    );
  }
  if (kind.needsPerson) {
    if (!input.personId)
      throw new HttpError(400, 'person_required', 'Bitte wähle eine Person aus.');
    const [member] = await db
      .select({ id: s.teamMemberships.id })
      .from(s.teamMemberships)
      .where(
        and(eq(s.teamMemberships.teamId, team.id), eq(s.teamMemberships.personId, input.personId)),
      );
    if (!member)
      throw new HttpError(400, 'invalid_person', 'Die Person gehört nicht zur Mannschaft.');
  }

  // Einnahmen und Ausgaben mit Kategorie (für Statistik und Bericht)
  let category: string = kind.category;
  if (input.category && (input.kind === 'income' || input.kind === 'expense')) {
    const allowed: readonly string[] =
      input.kind === 'income' ? CASH_INCOME_CATEGORIES : CASH_EXPENSE_CATEGORIES;
    if (!allowed.includes(input.category))
      throw new HttpError(400, 'invalid_category', 'Unbekannte Kategorie.');
    category = input.category;
  }
  const receiptRef = input.receiptImageId
    ? await mediaReference(db, actor, input.receiptImageId, 'receipt')
    : null;

  const account = (await accountFor(db, actor, team, true))!;
  const [tx] = await db
    .insert(s.cashTransactions)
    .values({
      clubId: actor.club.id,
      accountId: account.id,
      direction: kind.direction,
      isCharge: kind.isCharge,
      category,
      paymentMethod: kind.isCharge ? null : (input.paymentMethod ?? null),
      receiptRef,
      amountCents: input.amountCents,
      description: input.description.trim(),
      counterparty: input.counterparty?.trim() || null,
      personId: kind.needsPerson ? input.personId! : null,
      bookedOn: input.bookedOn ?? toIsoDate(calendarDayOf(now, actor.club.timezone)),
      createdByPersonId: actor.person.id,
      createdAt: now,
    })
    .returning();

  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'cash.booked',
    entityType: 'cash_transaction',
    entityId: tx!.id,
    data: { teamId: team.id, kind: input.kind, amountCents: input.amountCents },
    createdAt: now,
  });

  return getTeamCash(db, actor, teamId, now);
}

// ── Kassenbericht (Export) ──────────────────────────────────────────────────

const REPORT_LINK_MS = 10 * 60 * 1000;

/** Signierter Link (10 Minuten) zum Kassenbericht als CSV – nur mit Leserecht für die Kasse. */
export async function cashReportLink(
  db: Db,
  actor: Actor,
  teamId: string,
  range: { from?: string; to?: string; format?: 'csv' | 'pdf' },
  now: Date,
): Promise<{ token: string; expiresAt: string }> {
  const { team, seesAll } = await loadCashTeam(db, actor, teamId);
  if (!seesAll) throw forbidden('Den Kassenbericht sieht die Mannschaft.');
  if (range.from && range.to && range.from > range.to)
    throw new HttpError(400, 'invalid_range', 'Der Zeitraum ist ungültig.');
  const expiresAt = new Date(now.getTime() + REPORT_LINK_MS);
  const prefix = range.format === 'pdf' ? 'cp:' : 'c:';
  const id = `${prefix}${team.id}|${range.from ?? ''}|${range.to ?? ''}`;
  return { token: actor.links.create(id, expiresAt), expiresAt: expiresAt.toISOString() };
}

const euro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const germanDate = (iso: string) => iso.split('-').reverse().join('.');
/** Textfelder für Excel sicher machen (Trennzeichen, Anführungszeichen, Formel-Injektion) */
function cell(value: string | null | undefined): string {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const CATEGORY_LABELS: Record<string, string> = {
  einnahme: 'Einnahme',
  ausgabe: 'Ausgabe',
  strafe: 'Strafe',
  getraenke: 'Getränke',
  einzahlung: 'Einzahlung',
  sponsoring: 'Sponsoring',
  einnahmen_spieltag: 'Spieltag',
  veranstaltung: 'Veranstaltung',
  spende: 'Spende',
  zuschuss: 'Zuschuss',
  material: 'Material',
  fahrtkosten: 'Fahrtkosten',
  startgeld: 'Startgeld',
  schiedsrichter: 'Schiedsrichter',
  uebertrag: 'Übertrag',
  umlage: 'Umlage',
  beitrag: 'Beitrag',
};

type CashReport = {
  fileBase: string;
  accountName: string;
  clubName: string;
  from: string;
  to: string;
  created: string;
  opening: number;
  rows: {
    date: string;
    kind: string;
    description: string;
    person: string;
    income: number | null;
    expense: number | null;
    balance: number;
  }[];
  income: number;
  expense: number;
  closing: number;
  open: { name: string; cents: number }[];
  closings: { closedOn: string; balanceCents: number; auditor: string | null }[];
};

/** Daten des Kassenberichts (ohne Stornos) – Grundlage für CSV und PDF. */
async function buildCashReport(db: Db, payload: string, now: Date): Promise<CashReport | null> {
  const [teamId, fromArg, toArg] = payload.split('|');
  const [row] = await db
    .select({ team: s.teams, club: s.clubs, season: s.seasons })
    .from(s.teams)
    .innerJoin(s.clubs, eq(s.clubs.id, s.teams.clubId))
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(eq(s.teams.id, teamId!));
  if (!row) return null;
  const tz = row.club.timezone;
  const from = fromArg || row.season.startsOn;
  const to = toArg || toIsoDate(calendarDayOf(now, tz));
  const [account] = await db
    .select()
    .from(s.cashAccounts)
    .where(eq(s.cashAccounts.teamId, row.team.id));
  const rows = account
    ? await db
        .select({
          tx: s.cashTransactions,
          firstName: s.persons.firstName,
          lastName: s.persons.lastName,
        })
        .from(s.cashTransactions)
        .leftJoin(s.persons, eq(s.persons.id, s.cashTransactions.personId))
        .where(
          and(
            eq(s.cashTransactions.accountId, account.id),
            lte(s.cashTransactions.bookedOn, to),
            isNull(s.cashTransactions.cancelledAt),
          ),
        )
        .orderBy(asc(s.cashTransactions.bookedOn), asc(s.cashTransactions.createdAt))
    : [];

  const money = rows.filter((r) => !r.tx.isCharge);
  const signed = (r: (typeof rows)[number]) =>
    r.tx.direction === 'income' ? r.tx.amountCents : -r.tx.amountCents;
  let balance = money.filter((r) => r.tx.bookedOn < from).reduce((a, r) => a + signed(r), 0);
  const opening = balance;
  let income = 0;
  let expense = 0;
  const lines: CashReport['rows'] = [];
  for (const r of money.filter((x) => x.tx.bookedOn >= from)) {
    balance += signed(r);
    if (r.tx.direction === 'income') income += r.tx.amountCents;
    else expense += r.tx.amountCents;
    lines.push({
      date: germanDate(r.tx.bookedOn),
      kind: CATEGORY_LABELS[r.tx.category] ?? r.tx.category,
      description: r.tx.description,
      person: r.tx.personId ? `${r.firstName} ${r.lastName}` : (r.tx.counterparty ?? ''),
      income: r.tx.direction === 'income' ? r.tx.amountCents : null,
      expense: r.tx.direction === 'expense' ? r.tx.amountCents : null,
      balance,
    });
  }

  // Offene Beträge (Forderungen abzüglich Einzahlungen) je Person bis zum Stichtag
  const persons = new Map<string, { name: string; cents: number }>();
  for (const r of rows) {
    if (!r.tx.personId) continue;
    const p = persons.get(r.tx.personId) ?? { name: `${r.lastName}, ${r.firstName}`, cents: 0 };
    p.cents += personalDelta(r.tx);
    persons.set(r.tx.personId, p);
  }
  const closings = await db
    .select()
    .from(s.cashClosings)
    .where(and(eq(s.cashClosings.teamId, row.team.id), lte(s.cashClosings.closedOn, to)))
    .orderBy(asc(s.cashClosings.closedOn));
  return {
    fileBase: `Kassenbericht ${row.team.badge} ${germanDate(from)}-${germanDate(to)}`,
    accountName: account?.name ?? `Mannschaftskasse ${row.team.name}`,
    clubName: row.club.name,
    from,
    to,
    created: new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz,
    }).format(now),
    opening,
    rows: lines,
    income,
    expense,
    closing: balance,
    open: [...persons.values()].filter((p) => p.cents !== 0).sort((a, b) => a.cents - b.cents),
    closings: closings.map((c) => ({
      closedOn: c.closedOn,
      balanceCents: c.balanceCents,
      auditor: c.auditor,
    })),
  };
}

/** Kassenbericht als CSV (Semikolon, UTF-8 mit BOM – öffnet direkt in Excel). */
export async function cashReportCsv(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; csv: string } | null> {
  const r = await buildCashReport(db, payload, now);
  if (!r) return null;
  const lines: string[] = [
    `Kassenbericht;${cell(r.accountName)}`,
    `Verein;${cell(r.clubName)}`,
    `Zeitraum;${germanDate(r.from)} – ${germanDate(r.to)}`,
    `Erstellt;${r.created}`,
    '',
    'Datum;Art;Beschreibung;Person;Einnahme;Ausgabe;Kassenstand',
    `${germanDate(r.from)};Anfangsbestand;;;;;${euro(r.opening)}`,
    ...r.rows.map((l) =>
      [
        l.date,
        cell(l.kind),
        cell(l.description),
        cell(l.person),
        l.income !== null ? euro(l.income) : '',
        l.expense !== null ? euro(l.expense) : '',
        euro(l.balance),
      ].join(';'),
    ),
    '',
    `Summe Einnahmen;;;;${euro(r.income)};;`,
    `Summe Ausgaben;;;;;${euro(r.expense)};`,
    `Kassenstand am ${germanDate(r.to)};;;;;;${euro(r.closing)}`,
  ];
  if (r.open.length) {
    lines.push('', 'Persönliche Konten;;;;;;', 'Name;Saldo (negativ = offen);;;;;');
    for (const p of r.open) lines.push(`${cell(p.name)};${euro(p.cents)};;;;;`);
  }
  if (r.closings.length) {
    lines.push('', 'Kassenprüfungen;;;;;;', 'Datum;Kassenstand;Geprüft von;;;;');
    for (const c of r.closings)
      lines.push(`${germanDate(c.closedOn)};${euro(c.balanceCents)};${cell(c.auditor)};;;;`);
  }
  return { fileName: `${r.fileBase}.csv`, csv: '﻿' + lines.join('\r\n') + '\r\n' };
}

/** Kassenbericht als PDF (A4, zum Ausdrucken für Versammlungen). */
export async function cashReportPdf(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; pdf: Buffer } | null> {
  const r = await buildCashReport(db, payload, now);
  if (!r) return null;
  const doc = new SimplePdf();
  doc.text(r.accountName, { size: 18, bold: true });
  doc.text(`${r.clubName} · Zeitraum ${germanDate(r.from)} – ${germanDate(r.to)}`, { size: 10 });
  doc.text(`Erstellt am ${r.created}`, { size: 9 });
  doc.gap(10);
  const cols = [56, 106, 186, 340, 430, 480, 539];
  doc.row(['Datum', 'Art', 'Beschreibung', 'Person', 'Einnahme', 'Ausgabe', 'Stand'], cols, {
    bold: true,
    alignRight: [4, 5, 6],
  });
  doc.row([germanDate(r.from), 'Anfangsbestand', '', '', '', '', euro(r.opening)], cols, {
    alignRight: [4, 5, 6],
  });
  for (const l of r.rows) {
    doc.row(
      [
        l.date,
        l.kind,
        l.description,
        l.person,
        l.income !== null ? euro(l.income) : '',
        l.expense !== null ? euro(l.expense) : '',
        euro(l.balance),
      ],
      cols,
      { alignRight: [4, 5, 6] },
    );
  }
  doc.gap(8);
  doc.text(`Summe Einnahmen: ${euro(r.income)} €   Summe Ausgaben: ${euro(r.expense)} €`, {
    size: 10,
  });
  doc.text(`Kassenstand am ${germanDate(r.to)}: ${euro(r.closing)} €`, { size: 12, bold: true });
  if (r.open.length) {
    doc.gap(12);
    doc.text('Offene Beträge der persönlichen Konten', { size: 12, bold: true });
    for (const p of r.open.filter((x) => x.cents < 0))
      doc.row([p.name, `${euro(-p.cents)} €`], [56, 300], { alignRight: [1] });
  }
  if (r.closings.length) {
    doc.gap(12);
    doc.text('Kassenprüfungen', { size: 12, bold: true });
    for (const c of r.closings)
      doc.text(
        `${germanDate(c.closedOn)}: Kassenstand ${euro(c.balanceCents)} €${c.auditor ? ` – geprüft von ${c.auditor}` : ''}`,
        { size: 10 },
      );
  }
  return { fileName: `${r.fileBase}.pdf`, pdf: doc.build() };
}
