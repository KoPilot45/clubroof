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
import { and, asc, desc, eq, lte } from 'drizzle-orm';
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

// ── Kassenbericht (Export) ──────────────────────────────────────────────────

const REPORT_LINK_MS = 10 * 60 * 1000;

/** Signierter Link (10 Minuten) zum Kassenbericht als CSV – nur mit Leserecht für die Kasse. */
export async function cashReportLink(
  db: Db,
  actor: Actor,
  teamId: string,
  range: { from?: string; to?: string },
  now: Date,
): Promise<{ token: string; expiresAt: string }> {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  requireModule(actor, 'team_cash', team);
  if (!permissions.readCash) throw forbidden('Den Kassenbericht sehen Kassenverantwortliche.');
  if (range.from && range.to && range.from > range.to)
    throw new HttpError(400, 'invalid_range', 'Der Zeitraum ist ungültig.');
  const expiresAt = new Date(now.getTime() + REPORT_LINK_MS);
  const id = `c:${team.id}|${range.from ?? ''}|${range.to ?? ''}`;
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
};

/** Kassenbericht als CSV (Semikolon, UTF-8 mit BOM – öffnet direkt in Excel). */
export async function cashReportCsv(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; csv: string } | null> {
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
          and(eq(s.cashTransactions.accountId, account.id), lte(s.cashTransactions.bookedOn, to)),
        )
        .orderBy(asc(s.cashTransactions.bookedOn), asc(s.cashTransactions.createdAt))
    : [];

  const money = rows.filter((r) => !r.tx.isCharge);
  const signed = (r: (typeof rows)[number]) =>
    r.tx.direction === 'income' ? r.tx.amountCents : -r.tx.amountCents;
  let balance = money.filter((r) => r.tx.bookedOn < from).reduce((a, r) => a + signed(r), 0);
  const opening = balance;
  const lines: string[] = [
    `Kassenbericht;${cell(account?.name ?? `Mannschaftskasse ${row.team.name}`)}`,
    `Verein;${cell(row.club.name)}`,
    `Zeitraum;${germanDate(from)} – ${germanDate(to)}`,
    `Erstellt;${new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(now)}`,
    '',
    'Datum;Art;Beschreibung;Person;Einnahme;Ausgabe;Kassenstand',
    `${germanDate(from)};Anfangsbestand;;;;;${euro(opening)}`,
  ];
  let income = 0;
  let expense = 0;
  for (const r of money.filter((x) => x.tx.bookedOn >= from)) {
    balance += signed(r);
    if (r.tx.direction === 'income') income += r.tx.amountCents;
    else expense += r.tx.amountCents;
    lines.push(
      [
        germanDate(r.tx.bookedOn),
        cell(CATEGORY_LABELS[r.tx.category] ?? r.tx.category),
        cell(r.tx.description),
        cell(r.tx.personId ? `${r.firstName} ${r.lastName}` : (r.tx.counterparty ?? '')),
        r.tx.direction === 'income' ? euro(r.tx.amountCents) : '',
        r.tx.direction === 'expense' ? euro(r.tx.amountCents) : '',
        euro(balance),
      ].join(';'),
    );
  }
  lines.push(
    '',
    `Summe Einnahmen;;;;${euro(income)};;`,
    `Summe Ausgaben;;;;;${euro(expense)};`,
    `Kassenstand am ${germanDate(to)};;;;;;${euro(balance)}`,
  );

  // Offene Beträge (Strafen/Getränke abzüglich Einzahlungen) je Person bis zum Stichtag
  const persons = new Map<string, { name: string; cents: number }>();
  for (const r of rows) {
    if (!r.tx.personId) continue;
    const p = persons.get(r.tx.personId) ?? { name: `${r.lastName}, ${r.firstName}`, cents: 0 };
    p.cents += personalDelta(r.tx);
    persons.set(r.tx.personId, p);
  }
  const open = [...persons.values()].filter((p) => p.cents !== 0).sort((a, b) => a.cents - b.cents);
  if (open.length) {
    lines.push('', 'Persönliche Konten;;;;;;', 'Name;Saldo (negativ = offen);;;;;');
    for (const p of open) lines.push(`${cell(p.name)};${euro(p.cents)};;;;;`);
  }
  return {
    fileName: `Kassenbericht ${row.team.badge} ${germanDate(from)}-${germanDate(to)}.csv`,
    csv: '﻿' + lines.join('\r\n') + '\r\n',
  };
}
