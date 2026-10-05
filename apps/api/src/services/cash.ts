/**
 * Mannschaftskasse (Mappe S. 16, Konzept §4). Kassenstand und Buchungen nur mit Kassenrechten;
 * jedes Mitglied sieht sein persönliches Konto (Strafen, Getränke, Einzahlungen).
 */
import {
  calendarDayOf,
  resolveModule,
  toIsoDate,
  type CashEntry,
  type CreateCashBookingInput,
  type TeamCash,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden } from '../errors';
import { loadTeamForActor, requireModule, type TeamRow } from './team-access';

type TxRow = typeof s.cashTransactions.$inferSelect;

function personalDelta(t: TxRow): number {
  if (t.isCharge) return -t.amountCents;
  return t.category === 'einzahlung' ? t.amountCents : 0;
}

function cashConfig(actor: Actor, team: TeamRow) {
  const { config } = resolveModule(actor.modules, 'team_cash', {
    teamId: team.id,
    orgUnitId: team.orgUnitId,
  });
  return { fines: config.fines === true, drinks: config.drinks === true };
}

async function accountFor(db: Db, actor: Actor, team: TeamRow, create = false) {
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

export async function getTeamCash(db: Db, actor: Actor, teamId: string): Promise<TeamCash> {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  requireModule(actor, 'team_cash', team);
  const account = await accountFor(db, actor, team);

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
  });

  const money = rows.filter((r) => !r.tx.isCharge);
  const income = money
    .filter((r) => r.tx.direction === 'income')
    .reduce((a, r) => a + r.tx.amountCents, 0);
  const expense = money
    .filter((r) => r.tx.direction === 'expense')
    .reduce((a, r) => a + r.tx.amountCents, 0);

  const balances = new Map<string, { name: string; balanceCents: number }>();
  for (const r of rows) {
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
    config: cashConfig(actor, team),
    balanceCents: permissions.readCash ? income - expense : null,
    incomeCents: permissions.readCash ? income : null,
    expenseCents: permissions.readCash ? expense : null,
    entries: permissions.readCash ? rows.map(toEntry) : null,
    members: permissions.readCash
      ? [...balances.entries()]
          .map(([personId, v]) => ({ personId, ...v }))
          .sort((a, b) => a.balanceCents - b.balanceCents)
      : null,
    personal,
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

  const account = (await accountFor(db, actor, team, true))!;
  const [tx] = await db
    .insert(s.cashTransactions)
    .values({
      clubId: actor.club.id,
      accountId: account.id,
      direction: kind.direction,
      isCharge: kind.isCharge,
      category: kind.category,
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

  return getTeamCash(db, actor, teamId);
}
