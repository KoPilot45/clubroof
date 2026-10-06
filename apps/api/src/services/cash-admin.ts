/**
 * Kassenverwaltung (Festlegung 07.10.2026): Kassenwart und Trainerteam buchen Einzahlungen,
 * Getränke-Strichlisten, Umlagen und Mannschaftsbeiträge, stornieren Fehlbuchungen, erinnern an
 * offene Beträge, bestätigen Zahlungsmeldungen, bestimmen Kassenwarte und halten Kassenprüfungen
 * fest. Alles verlangt `cash.manage` für die Mannschaft.
 */
import {
  calendarDayOf,
  toIsoDate,
  type CashClosing,
  type CashFee,
  type PaymentMethod,
  type PaymentNotice,
  type TeamCash,
  type TreasurerCandidates,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { coachUsers } from '../notify/coaches';
import { deliver } from '../notify/deliver';
import { usersByPerson, usersOfPersons } from '../notify/persons';
import {
  accountFor,
  cashConfig,
  cashSettings,
  getTeamCash,
  loadCashTeam,
  personalBalances,
  personNames,
} from './cash';
import type { TeamRow } from './team-access';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Account = typeof s.cashAccounts.$inferSelect;

const euro = (cents: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));

async function loadManaged(db: Db, actor: Actor, teamId: string) {
  const loaded = await loadCashTeam(db, actor, teamId);
  if (!loaded.permissions.manageCash) {
    throw forbidden('Die Kassenverwaltung ist für Kassenwart und Trainerteam.');
  }
  const account = (await accountFor(db, actor, loaded.team, true))!;
  return { ...loaded, account };
}

/** Aktive Mitglieder der Mannschaft (für Prüfungen und Beiträge). */
async function teamMembers(db: Db | Tx, teamId: string, day: string, onlyPlayers = false) {
  const rows = await db
    .select({ personId: s.teamMemberships.personId, fn: s.teamMemberships.function })
    .from(s.teamMemberships)
    .where(
      and(
        eq(s.teamMemberships.teamId, teamId),
        lte(s.teamMemberships.validFrom, day),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, day)),
      ),
    );
  return [...new Set(rows.filter((r) => !onlyPlayers || r.fn === 'player').map((r) => r.personId))];
}

async function requireMembers(db: Db, teamId: string, personIds: string[], day: string) {
  const members = new Set(await teamMembers(db, teamId, day));
  if (personIds.some((p) => !members.has(p))) {
    throw new HttpError(400, 'invalid_person', 'Nicht alle Personen gehören zur Mannschaft.');
  }
}

async function audit(
  db: Db | Tx,
  actor: Actor,
  action: string,
  entityId: string,
  data: Record<string, unknown>,
  now: Date,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'cash_account',
    entityId,
    data,
    createdAt: now,
  });
}

/** Benachrichtigt Personen (bzw. Eltern) über neue Forderungen auf ihrem Konto. */
export async function notifyCharges(
  db: Db | Tx,
  club: { id: string; timezone: string },
  team: { id: string; badge: string },
  charges: { personId: string; amountCents: number; description: string }[],
  exceptUserId: string | null,
  now: Date,
) {
  const users = await usersByPerson(
    db,
    charges.map((c) => c.personId),
  );
  const names = new Map(
    (
      await personNames(
        db,
        charges.map((c) => c.personId),
      )
    ).map((p) => [p.id, p.name]),
  );
  for (const c of charges) {
    const recipients = (users.get(c.personId) ?? []).filter((u) => u !== exceptUserId);
    if (recipients.length === 0) continue;
    await deliver(
      db,
      club,
      recipients,
      {
        level: 'info',
        topic: 'cash',
        teamId: team.id,
        title: `Mannschaftskasse ${team.badge}: ${euro(c.amountCents)}`,
        body: `${c.description} – ${names.get(c.personId) ?? ''}`.trim(),
        link: `/teams/${team.id}/cash`,
      },
      now,
    );
  }
}

// ── Ansicht für TeamCash ────────────────────────────────────────────────────

export async function cashAdminView(
  db: Db,
  actor: Actor,
  team: TeamRow,
  account: Account | null,
  manage: boolean,
): Promise<Pick<TeamCash, 'treasurers' | 'paymentNotices' | 'fees' | 'closings'>> {
  const [treasurers, notices, fees, closings] = await Promise.all([
    treasurersOf(db, actor, team.id),
    db
      .select({
        notice: s.cashPaymentNotices,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.cashPaymentNotices)
      .innerJoin(s.persons, eq(s.persons.id, s.cashPaymentNotices.personId))
      .where(
        and(
          eq(s.cashPaymentNotices.teamId, team.id),
          manage
            ? eq(s.cashPaymentNotices.status, 'pending')
            : inArray(s.cashPaymentNotices.personId, actor.managedIds),
        ),
      )
      .orderBy(desc(s.cashPaymentNotices.createdAt))
      .limit(30),
    db
      .select()
      .from(s.cashFees)
      .where(and(eq(s.cashFees.teamId, team.id), isNotNull(s.cashFees.nextDueOn)))
      .orderBy(asc(s.cashFees.createdAt)),
    account
      ? db
          .select({
            closing: s.cashClosings,
            firstName: s.persons.firstName,
            lastName: s.persons.lastName,
          })
          .from(s.cashClosings)
          .leftJoin(s.persons, eq(s.persons.id, s.cashClosings.createdByPersonId))
          .where(eq(s.cashClosings.teamId, team.id))
          .orderBy(desc(s.cashClosings.closedOn))
      : Promise.resolve([]),
  ]);
  return {
    treasurers,
    paymentNotices: notices.map(({ notice, firstName, lastName }): PaymentNotice => ({
      id: notice.id,
      personId: notice.personId,
      name: `${firstName} ${lastName}`,
      amountCents: notice.amountCents,
      paymentMethod: notice.paymentMethod as PaymentMethod,
      note: notice.note,
      createdAt: notice.createdAt.toISOString(),
      status: notice.status as PaymentNotice['status'],
    })),
    fees: fees.map((f): CashFee => ({
      id: f.id,
      name: f.name,
      amountCents: f.amountCents,
      interval: f.interval as CashFee['interval'],
      nextDueOn: f.nextDueOn,
    })),
    closings: closings.map(({ closing, firstName, lastName }): CashClosing => ({
      id: closing.id,
      closedOn: closing.closedOn,
      balanceCents: closing.balanceCents,
      openCents: closing.openCents,
      auditor: closing.auditor,
      note: closing.note,
      createdBy: firstName ? `${firstName} ${lastName}` : null,
    })),
  };
}

// ── Einstellungen ───────────────────────────────────────────────────────────

export async function updateCashSettings(
  db: Db,
  actor: Actor,
  teamId: string,
  input: Partial<{
    iban: string | null;
    accountHolder: string | null;
    paypalLink: string | null;
    drinkPriceCents: number | null;
    showMemberBalances: boolean;
    autoReminder: boolean;
  }>,
  now: Date,
): Promise<TeamCash> {
  const { account } = await loadManaged(db, actor, teamId);
  const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
  const next = {
    ...account.settings,
    ...Object.fromEntries(
      Object.entries({
        iban: clean(input.iban)?.replace(/\s+/g, ' ').toUpperCase() ?? clean(input.iban),
        accountHolder: clean(input.accountHolder),
        paypalLink: clean(input.paypalLink),
        drinkPriceCents: input.drinkPriceCents,
        showMemberBalances: input.showMemberBalances,
        autoReminder: input.autoReminder,
      }).filter(([, v]) => v !== undefined),
    ),
  };
  if (next.paypalLink && !/^https:\/\/(www\.)?paypal\.(me|com)\//i.test(next.paypalLink)) {
    throw new HttpError(
      400,
      'invalid_paypal',
      'Bitte gib einen PayPal-Link wie https://paypal.me/… an.',
    );
  }
  await db.update(s.cashAccounts).set({ settings: next }).where(eq(s.cashAccounts.id, account.id));
  await audit(db, actor, 'cash.settings', account.id, { keys: Object.keys(input) }, now);
  return getTeamCash(db, actor, teamId, now);
}

// ── Einzahlungen, Strichliste, Umlage ───────────────────────────────────────

/** Eine oder mehrere Einzahlungen (z. B. „hat bar bezahlt“) in einem Schritt. */
export async function recordPayments(
  db: Db,
  actor: Actor,
  teamId: string,
  input: {
    items: { personId: string; amountCents: number }[];
    paymentMethod: PaymentMethod;
    bookedOn?: string | null;
  },
  now: Date,
): Promise<TeamCash> {
  const { team, account } = await loadManaged(db, actor, teamId);
  const day = today(actor, now);
  await requireMembers(
    db,
    team.id,
    input.items.map((i) => i.personId),
    day,
  );
  await db.transaction(async (tx) => {
    await tx.insert(s.cashTransactions).values(
      input.items.map((i) => ({
        clubId: actor.club.id,
        accountId: account.id,
        direction: 'income' as const,
        isCharge: false,
        category: 'einzahlung',
        amountCents: i.amountCents,
        description: 'Einzahlung Mannschaftskasse',
        personId: i.personId,
        paymentMethod: input.paymentMethod,
        bookedOn: input.bookedOn ?? day,
        createdByPersonId: actor.person.id,
        createdAt: now,
      })),
    );
    await audit(tx, actor, 'cash.payments', account.id, { count: input.items.length }, now);
  });
  return getTeamCash(db, actor, teamId, now);
}

/** Getränke-Strichliste: je Person die Anzahl, Preis aus den Einstellungen (oder angegeben). */
export async function recordDrinks(
  db: Db,
  actor: Actor,
  teamId: string,
  input: {
    items: { personId: string; count: number }[];
    priceCents?: number | null;
    bookedOn?: string | null;
  },
  now: Date,
): Promise<TeamCash> {
  const { team, account } = await loadManaged(db, actor, teamId);
  if (!cashConfig(actor, team).drinks) {
    throw new HttpError(
      400,
      'drinks_disabled',
      'Getränke sind für diese Mannschaft nicht aktiviert.',
    );
  }
  const price = input.priceCents ?? cashSettings(account).drinkPriceCents;
  if (!price) throw new HttpError(400, 'price_required', 'Bitte lege einen Getränkepreis fest.');
  const items = input.items.filter((i) => i.count > 0);
  if (items.length === 0)
    throw new HttpError(400, 'validation', 'Bitte trage mindestens ein Getränk ein.');
  const day = today(actor, now);
  await requireMembers(
    db,
    team.id,
    items.map((i) => i.personId),
    day,
  );
  const charges = items.map((i) => ({
    personId: i.personId,
    amountCents: i.count * price,
    description: `${i.count} ${i.count === 1 ? 'Getränk' : 'Getränke'} à ${euro(price)}`,
  }));
  await db.transaction(async (tx) => {
    await tx.insert(s.cashTransactions).values(
      charges.map((c) => ({
        clubId: actor.club.id,
        accountId: account.id,
        direction: 'income' as const,
        isCharge: true,
        category: 'getraenke',
        ...c,
        bookedOn: input.bookedOn ?? day,
        createdByPersonId: actor.person.id,
        createdAt: now,
      })),
    );
    await audit(tx, actor, 'cash.drinks', account.id, { persons: items.length }, now);
  });
  await notifyCharges(db, actor.club, team, charges, actor.user.id, now);
  return getTeamCash(db, actor, teamId, now);
}

/** Verteilt einen Betrag auf Cent genau (Rest geht an die ersten Personen). */
export function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rest = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}

/** Umlage: Kosten auf Personen verteilen (gleichmäßig) oder je Person festen Betrag fordern. */
export async function createLevy(
  db: Db,
  actor: Actor,
  teamId: string,
  input: {
    description: string;
    mode: 'split' | 'each';
    amountCents: number;
    personIds: string[];
    bookedOn?: string | null;
  },
  now: Date,
): Promise<TeamCash> {
  const { team, account } = await loadManaged(db, actor, teamId);
  const personIds = [...new Set(input.personIds)];
  const day = today(actor, now);
  await requireMembers(db, team.id, personIds, day);
  const amounts =
    input.mode === 'split'
      ? splitCents(input.amountCents, personIds.length)
      : personIds.map(() => input.amountCents);
  if (amounts.some((a) => a < 1)) {
    throw new HttpError(400, 'validation', 'Der Betrag ist zu klein für so viele Personen.');
  }
  const charges = personIds.map((personId, i) => ({
    personId,
    amountCents: amounts[i]!,
    description: `Umlage: ${input.description.trim()}`,
  }));
  await db.transaction(async (tx) => {
    await tx.insert(s.cashTransactions).values(
      charges.map((c) => ({
        clubId: actor.club.id,
        accountId: account.id,
        direction: 'income' as const,
        isCharge: true,
        category: 'umlage',
        ...c,
        bookedOn: input.bookedOn ?? day,
        createdByPersonId: actor.person.id,
        createdAt: now,
      })),
    );
    await audit(
      tx,
      actor,
      'cash.levy',
      account.id,
      { persons: personIds.length, mode: input.mode },
      now,
    );
  });
  await notifyCharges(db, actor.club, team, charges, actor.user.id, now);
  return getTeamCash(db, actor, teamId, now);
}

// ── Mannschaftsbeiträge ─────────────────────────────────────────────────────

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

function nextMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m!, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(d!, last));
  return date.toISOString().slice(0, 10);
}

/**
 * Bucht fällige Beiträge allen aktuellen Spielern als Forderung (auch nachholend, höchstens
 * 12 Fälligkeiten je Lauf). Läuft im Hintergrund und direkt nach dem Anlegen.
 */
export async function chargeDueFees(
  db: Db | Tx,
  club: { id: string; timezone: string },
  now: Date,
  teamId?: string,
): Promise<number> {
  const day = toIsoDate(calendarDayOf(now, club.timezone));
  const fees = await db
    .select({ fee: s.cashFees, team: s.teams })
    .from(s.cashFees)
    .innerJoin(s.teams, eq(s.teams.id, s.cashFees.teamId))
    .where(
      and(
        eq(s.cashFees.clubId, club.id),
        lte(s.cashFees.nextDueOn, day),
        ...(teamId ? [eq(s.cashFees.teamId, teamId)] : []),
      ),
    );
  let charged = 0;
  for (const { fee, team } of fees) {
    const [account] = await db
      .select()
      .from(s.cashAccounts)
      .where(eq(s.cashAccounts.teamId, team.id));
    if (!account) continue;
    let due: string | null = fee.nextDueOn;
    const all: { personId: string; amountCents: number; description: string }[] = [];
    for (let i = 0; due && due <= day && i < 12; i++) {
      const players = await teamMembers(db, team.id, due, true);
      const [, m] = due.split('-').map(Number);
      const label =
        fee.interval === 'monthly' ? `${fee.name} ${MONTHS[m! - 1]} ${due.slice(0, 4)}` : fee.name;
      if (players.length) {
        await db.insert(s.cashTransactions).values(
          players.map((personId) => ({
            clubId: club.id,
            accountId: account.id,
            direction: 'income' as const,
            isCharge: true,
            category: 'beitrag',
            amountCents: fee.amountCents,
            description: label,
            personId,
            feeId: fee.id,
            bookedOn: due!,
            createdByPersonId: fee.createdByPersonId,
            createdAt: now,
          })),
        );
        all.push(
          ...players.map((personId) => ({
            personId,
            amountCents: fee.amountCents,
            description: label,
          })),
        );
      }
      due = fee.interval === 'monthly' ? nextMonth(due) : null;
    }
    await db.update(s.cashFees).set({ nextDueOn: due }).where(eq(s.cashFees.id, fee.id));
    charged += all.length;
    await notifyCharges(db, club, team, all, null, now);
  }
  return charged;
}

export async function createFee(
  db: Db,
  actor: Actor,
  teamId: string,
  input: {
    name: string;
    amountCents: number;
    interval: CashFee['interval'];
    startsOn?: string | null;
  },
  now: Date,
): Promise<TeamCash> {
  const { team, account } = await loadManaged(db, actor, teamId);
  const [fee] = await db
    .insert(s.cashFees)
    .values({
      clubId: actor.club.id,
      teamId: team.id,
      name: input.name.trim(),
      amountCents: input.amountCents,
      interval: input.interval,
      nextDueOn: input.startsOn ?? today(actor, now),
      createdByPersonId: actor.person.id,
    })
    .returning();
  await audit(db, actor, 'cash.fee_created', account.id, { feeId: fee!.id, ...input }, now);
  await chargeDueFees(db, actor.club, now, team.id);
  return getTeamCash(db, actor, teamId, now);
}

export async function endFee(db: Db, actor: Actor, feeId: string, now: Date): Promise<TeamCash> {
  const [fee] = await db
    .select()
    .from(s.cashFees)
    .where(and(eq(s.cashFees.id, feeId), eq(s.cashFees.clubId, actor.club.id)));
  if (!fee) throw notFound('Der Beitrag');
  const { account } = await loadManaged(db, actor, fee.teamId);
  await db.update(s.cashFees).set({ nextDueOn: null }).where(eq(s.cashFees.id, fee.id));
  await audit(db, actor, 'cash.fee_ended', account.id, { feeId }, now);
  return getTeamCash(db, actor, fee.teamId, now);
}

// ── Storno ──────────────────────────────────────────────────────────────────

export async function cancelTransaction(
  db: Db,
  actor: Actor,
  transactionId: string,
  reason: string | null,
  now: Date,
): Promise<TeamCash> {
  const [row] = await db
    .select({ tx: s.cashTransactions, teamId: s.cashAccounts.teamId })
    .from(s.cashTransactions)
    .innerJoin(s.cashAccounts, eq(s.cashAccounts.id, s.cashTransactions.accountId))
    .where(
      and(eq(s.cashTransactions.id, transactionId), eq(s.cashTransactions.clubId, actor.club.id)),
    );
  if (!row?.teamId) throw notFound('Die Buchung');
  await loadManaged(db, actor, row.teamId);
  if (row.tx.cancelledAt)
    throw new HttpError(409, 'already_cancelled', 'Die Buchung ist bereits storniert.');
  await db
    .update(s.cashTransactions)
    .set({
      cancelledAt: now,
      cancelledByPersonId: actor.person.id,
      cancelReason: reason?.trim() || null,
    })
    .where(eq(s.cashTransactions.id, transactionId));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'cash.cancelled',
    entityType: 'cash_transaction',
    entityId: transactionId,
    data: { amountCents: row.tx.amountCents, description: row.tx.description, reason },
    createdAt: now,
  });
  return getTeamCash(db, actor, row.teamId, now);
}

// ── Erinnerungen an offene Beträge ──────────────────────────────────────────

async function remind(
  db: Db | Tx,
  club: { id: string; timezone: string },
  team: { id: string; badge: string; name: string },
  account: Account,
  personIds: string[] | null,
  dedupe: string,
  now: Date,
): Promise<number> {
  const balances = await personalBalances(db, account.id);
  const settings = cashSettings(account);
  const open = [...balances.entries()].filter(
    ([personId, b]) => b.balanceCents < 0 && (!personIds || personIds.includes(personId)),
  );
  const users = await usersByPerson(
    db,
    open.map(([id]) => id),
  );
  const how = settings.iban
    ? ` Überweisung an ${settings.accountHolder ?? 'die Mannschaftskasse'}, IBAN ${settings.iban}.`
    : settings.paypalLink
      ? ` Per PayPal: ${settings.paypalLink}`
      : '';
  let sent = 0;
  for (const [personId, b] of open) {
    const recipients = users.get(personId) ?? [];
    if (recipients.length === 0) continue;
    sent += await deliver(
      db,
      club,
      recipients,
      {
        level: 'info',
        topic: 'cash',
        teamId: team.id,
        title: `Offener Betrag Mannschaftskasse ${team.badge}`,
        body: `${b.name}: ${euro(-b.balanceCents)} offen.${how}`,
        link: `/teams/${team.id}/cash`,
        dedupeKey: `cash-reminder:${team.id}:${personId}:${dedupe}`,
      },
      now,
    );
  }
  return sent;
}

/** Erinnerung per Knopfdruck (alle mit offenem Betrag oder ausgewählte). Höchstens einmal am Tag. */
export async function sendCashReminders(
  db: Db,
  actor: Actor,
  teamId: string,
  personIds: string[] | null,
  now: Date,
): Promise<{ sent: number }> {
  const { team, account } = await loadManaged(db, actor, teamId);
  const sent = await remind(db, actor.club, team, account, personIds, today(actor, now), now);
  await audit(db, actor, 'cash.reminders', account.id, { sent }, now);
  return { sent };
}

/** Automatische Erinnerung am Monatsersten ab 10 Uhr (Vereinszeit) für Kassen mit „autoReminder“. */
export async function autoCashReminders(
  db: Db | Tx,
  club: { id: string; timezone: string },
  now: Date,
): Promise<number> {
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: club.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (t: string) => local.find((p) => p.type === t)?.value ?? '';
  if (part('day') !== '01' || Number(part('hour')) < 10) return 0;
  const accounts = await db
    .select({ account: s.cashAccounts, team: s.teams })
    .from(s.cashAccounts)
    .innerJoin(s.teams, eq(s.teams.id, s.cashAccounts.teamId))
    .where(eq(s.cashAccounts.clubId, club.id));
  let sent = 0;
  for (const { account, team } of accounts) {
    if (!cashSettings(account).autoReminder) continue;
    sent += await remind(db, club, team, account, null, `${part('year')}-${part('month')}`, now);
  }
  return sent;
}

// ── „Ich habe überwiesen“ ───────────────────────────────────────────────────

async function managerUsers(db: Db | Tx, teamId: string, day: string): Promise<string[]> {
  const treasurers = await db
    .select({ userId: s.persons.userId })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
    .where(
      and(
        eq(s.roles.key, 'treasurer'),
        eq(s.roleAssignments.scopeType, 'team'),
        eq(s.roleAssignments.scopeId, teamId),
      ),
    );
  return [
    ...new Set([
      ...treasurers.map((t) => t.userId).filter((u): u is string => !!u),
      ...(await coachUsers(db, teamId, day)),
    ]),
  ];
}

export async function createPaymentNotice(
  db: Db,
  actor: Actor,
  teamId: string,
  input: {
    personId: string;
    amountCents: number;
    paymentMethod: PaymentMethod;
    note?: string | null;
  },
  now: Date,
): Promise<TeamCash> {
  const { team, isMember } = await loadCashTeam(db, actor, teamId);
  if (!isMember || !actor.managedIds.includes(input.personId)) {
    throw forbidden('Du kannst nur Zahlungen für dich oder deine Kinder melden.');
  }
  await requireMembers(db, team.id, [input.personId], today(actor, now));
  await db.insert(s.cashPaymentNotices).values({
    clubId: actor.club.id,
    teamId: team.id,
    personId: input.personId,
    amountCents: input.amountCents,
    paymentMethod: input.paymentMethod,
    note: input.note?.trim() || null,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  const person = actor.managed.find((m) => m.id === input.personId)!;
  await deliver(
    db,
    actor.club,
    (await managerUsers(db, team.id, today(actor, now))).filter((u) => u !== actor.user.id),
    {
      level: 'info',
      topic: 'cash',
      teamId: team.id,
      title: `Zahlung gemeldet: ${euro(input.amountCents)}`,
      body: `${person.firstName} ${person.lastName} hat ${input.paymentMethod === 'paypal' ? 'per PayPal' : input.paymentMethod === 'bar' ? 'bar' : 'per Überweisung'} bezahlt – bitte bestätigen.`,
      link: `/teams/${team.id}/cash-admin`,
    },
    now,
  );
  return getTeamCash(db, actor, teamId, now);
}

export async function decidePaymentNotice(
  db: Db,
  actor: Actor,
  noticeId: string,
  confirm: boolean,
  now: Date,
): Promise<TeamCash> {
  const [notice] = await db
    .select()
    .from(s.cashPaymentNotices)
    .where(
      and(eq(s.cashPaymentNotices.id, noticeId), eq(s.cashPaymentNotices.clubId, actor.club.id)),
    );
  if (!notice) throw notFound('Die Meldung');
  const { team, account } = await loadManaged(db, actor, notice.teamId);
  if (notice.status !== 'pending')
    throw new HttpError(409, 'decided', 'Die Meldung ist schon erledigt.');
  await db.transaction(async (tx) => {
    let transactionId: string | null = null;
    if (confirm) {
      const [row] = await tx
        .insert(s.cashTransactions)
        .values({
          clubId: actor.club.id,
          accountId: account.id,
          direction: 'income',
          isCharge: false,
          category: 'einzahlung',
          amountCents: notice.amountCents,
          description: 'Einzahlung Mannschaftskasse',
          personId: notice.personId,
          paymentMethod: notice.paymentMethod,
          bookedOn: today(actor, now),
          createdByPersonId: actor.person.id,
          createdAt: now,
        })
        .returning({ id: s.cashTransactions.id });
      transactionId = row!.id;
    }
    await tx
      .update(s.cashPaymentNotices)
      .set({
        status: confirm ? 'confirmed' : 'rejected',
        decidedAt: now,
        decidedByPersonId: actor.person.id,
        transactionId,
      })
      .where(eq(s.cashPaymentNotices.id, notice.id));
  });
  await deliver(
    db,
    actor.club,
    await usersOfPersons(db, [notice.personId]),
    {
      level: 'info',
      topic: 'cash',
      teamId: team.id,
      title: confirm ? 'Zahlung bestätigt' : 'Zahlung nicht gefunden',
      body: confirm
        ? `${euro(notice.amountCents)} sind in der Mannschaftskasse ${team.badge} eingegangen.`
        : `Die gemeldete Zahlung über ${euro(notice.amountCents)} ist noch nicht angekommen. Bitte wende dich an die Kasse.`,
      link: `/teams/${team.id}/cash`,
    },
    now,
  );
  return getTeamCash(db, actor, notice.teamId, now);
}

// ── Kassenwarte ─────────────────────────────────────────────────────────────

async function treasurersOf(db: Db, actor: Actor, teamId: string) {
  const rows = await db
    .select({
      personId: s.persons.id,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
    .where(
      and(
        eq(s.roleAssignments.clubId, actor.club.id),
        eq(s.roles.key, 'treasurer'),
        eq(s.roleAssignments.scopeType, 'team'),
        eq(s.roleAssignments.scopeId, teamId),
      ),
    );
  return rows.map((r) => ({ personId: r.personId, name: `${r.firstName} ${r.lastName}` }));
}

/** Infrage kommen Mitglieder mit eigenem Login und Eltern der Spieler (Kinder ohne Login nicht). */
async function treasurerCandidates(db: Db, actor: Actor, team: TeamRow, day: string) {
  const memberIds = await teamMembers(db, team.id, day);
  const players = await teamMembers(db, team.id, day, true);
  const [members, parents] = await Promise.all([
    memberIds.length
      ? db
          .select({
            id: s.persons.id,
            firstName: s.persons.firstName,
            lastName: s.persons.lastName,
          })
          .from(s.persons)
          .where(and(inArray(s.persons.id, memberIds), isNotNull(s.persons.userId)))
      : [],
    players.length
      ? db
          .select({
            id: s.persons.id,
            firstName: s.persons.firstName,
            lastName: s.persons.lastName,
            child: s.guardianships.childPersonId,
          })
          .from(s.guardianships)
          .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
          .where(and(inArray(s.guardianships.childPersonId, players), isNotNull(s.persons.userId)))
      : [],
  ]);
  const childNames = new Map(
    (
      await personNames(
        db,
        parents.map((p) => p.child),
      )
    ).map((p) => [p.id, p.name.split(' ')[0]]),
  );
  const result = new Map<string, { personId: string; name: string; relation: string }>();
  for (const m of members)
    result.set(m.id, {
      personId: m.id,
      name: `${m.firstName} ${m.lastName}`,
      relation: 'Mannschaft',
    });
  for (const p of parents) {
    if (!result.has(p.id)) {
      result.set(p.id, {
        personId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        relation: `Elternteil von ${childNames.get(p.child) ?? ''}`.trim(),
      });
    }
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTreasurers(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<TreasurerCandidates> {
  const { team } = await loadManaged(db, actor, teamId);
  return {
    treasurers: await treasurersOf(db, actor, team.id),
    candidates: await treasurerCandidates(db, actor, team, today(actor, now)),
  };
}

export async function setTreasurer(
  db: Db,
  actor: Actor,
  teamId: string,
  personId: string,
  enabled: boolean,
  now: Date,
): Promise<TreasurerCandidates> {
  const { team } = await loadManaged(db, actor, teamId);
  const [role] = await db
    .select()
    .from(s.roles)
    .where(and(eq(s.roles.clubId, actor.club.id), eq(s.roles.key, 'treasurer')));
  if (!role) throw notFound('Die Rolle Kassenwart');
  const current = await treasurersOf(db, actor, team.id);
  if (enabled) {
    const candidates = await treasurerCandidates(db, actor, team, today(actor, now));
    if (!candidates.some((c) => c.personId === personId)) {
      throw new HttpError(
        400,
        'invalid_person',
        'Kassenwart kann nur jemand aus der Mannschaft (mit Login) oder ein Elternteil werden.',
      );
    }
    if (!current.some((t) => t.personId === personId)) {
      await db.insert(s.roleAssignments).values({
        clubId: actor.club.id,
        personId,
        roleId: role.id,
        scopeType: 'team',
        scopeId: team.id,
        createdAt: now,
      });
    }
  } else {
    await db
      .delete(s.roleAssignments)
      .where(
        and(
          eq(s.roleAssignments.personId, personId),
          eq(s.roleAssignments.roleId, role.id),
          eq(s.roleAssignments.scopeType, 'team'),
          eq(s.roleAssignments.scopeId, team.id),
        ),
      );
  }
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: enabled ? 'role.assigned' : 'role.revoked',
    entityType: 'person',
    entityId: personId,
    data: { role: 'treasurer', scopeType: 'team', scopeId: team.id, via: 'cash' },
    createdAt: now,
  });
  return getTreasurers(db, actor, teamId, now);
}

// ── Kassenprüfung / Saisonabschluss ─────────────────────────────────────────

export async function createClosing(
  db: Db,
  actor: Actor,
  teamId: string,
  input: { auditor?: string | null; note?: string | null; closedOn?: string | null },
  now: Date,
): Promise<TeamCash> {
  const { account } = await loadManaged(db, actor, teamId);
  const closedOn = input.closedOn ?? today(actor, now);
  const cash = await getTeamCash(db, actor, teamId, now);
  const rows = await db
    .select()
    .from(s.cashTransactions)
    .where(
      and(
        eq(s.cashTransactions.accountId, account.id),
        isNull(s.cashTransactions.cancelledAt),
        lte(s.cashTransactions.bookedOn, closedOn),
      ),
    );
  const balanceCents = rows
    .filter((r) => !r.isCharge)
    .reduce((a, r) => a + (r.direction === 'income' ? r.amountCents : -r.amountCents), 0);
  const openCents = (cash.members ?? []).reduce((a, m) => a + Math.max(0, -m.balanceCents), 0);
  await db.insert(s.cashClosings).values({
    clubId: actor.club.id,
    teamId,
    closedOn,
    balanceCents,
    openCents,
    auditor: input.auditor?.trim() || null,
    note: input.note?.trim() || null,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  await audit(db, actor, 'cash.closing', account.id, { closedOn, balanceCents }, now);
  return getTeamCash(db, actor, teamId, now);
}
