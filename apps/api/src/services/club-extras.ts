/**
 * Vereinskasse: Erweiterungen (Paket K5, docs/VEREINSKASSE.md): Auslagenerstattung und Fahrtkosten,
 * Übungsleiter- und Ehrenamtspauschale mit Freibetrag je Person, Zuschüsse mit Frist und
 * Verwendungsnachweis, Sponsoren-Einnahmen, Zuschuss an eine Mannschaftskasse und Inventar.
 * Buchungen entstehen immer im Kassenbuch (Periodensperre, Kategorien und Konten gelten wie sonst).
 */
import {
  CLUB_ALLOWANCE_KIND_LABEL,
  CLUB_MILEAGE_RATE_CENTS,
  calendarDayOf,
  clubAllowanceLimitCents,
  toIsoDate,
  type ClubAllowanceKind,
  type ClubAllowancePaymentInput,
  type ClubAllowanceRow,
  type ClubAllowances,
  type ClubClaimPayInput,
  type ClubClaimStatus,
  type ClubExpenseClaim,
  type ClubExpenseClaimInput,
  type ClubExpenseClaims,
  type ClubGrant,
  type ClubGrantInput,
  type ClubGrants,
  type ClubGrantStatus,
  type ClubInventory,
  type ClubInventoryInput,
  type ClubSponsorIncome,
  type ClubTeamGrantInput,
  type ClubTeamGrants,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, notFound } from '../errors';
import { deliver } from '../notify/deliver';
import { usersByPerson } from '../notify/persons';
import { mediaIdOf, resolveMediaUrl } from '../storage/media-links';
import { audit, createEntry, euro, requireClubFull, requireClubManage } from './club-cash';
import { mediaReference } from './uploads';

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));
const german = (iso: string) => iso.split('-').reverse().join('.');

async function personName(db: Db, id: string): Promise<string> {
  const [p] = await db
    .select({ first: s.persons.firstName, last: s.persons.lastName })
    .from(s.persons)
    .where(eq(s.persons.id, id));
  return p ? `${p.first} ${p.last}` : '';
}

// ── Auslagenerstattung ──────────────────────────────────────────────────────

function requireModule(actor: Actor) {
  if (!moduleEnabled(actor, 'club_cash'))
    throw new HttpError(404, 'module_off', 'Die Vereinskasse ist nicht aktiviert.');
}

export async function submitClaim(
  db: Db,
  actor: Actor,
  input: ClubExpenseClaimInput,
  now: Date,
): Promise<{ id: string }> {
  requireModule(actor);
  const description = input.description.trim();
  if (description.length < 3)
    throw new HttpError(400, 'description_required', 'Bitte beschreibe die Auslage.');
  if (input.expenseDate > today(actor, now))
    throw new HttpError(400, 'invalid_date', 'Das Datum liegt in der Zukunft.');
  let amountCents: number;
  let kilometers: number | null = null;
  if (input.kind === 'mileage') {
    kilometers = input.kilometers ?? 0;
    if (!Number.isInteger(kilometers) || kilometers < 1 || kilometers > 5000)
      throw new HttpError(
        400,
        'invalid_km',
        'Bitte die gefahrenen Kilometer angeben (1 bis 5000).',
      );
    amountCents = kilometers * CLUB_MILEAGE_RATE_CENTS;
  } else {
    amountCents = input.amountCents ?? 0;
    if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 1_000_000)
      throw new HttpError(400, 'invalid_amount', 'Bitte den Betrag angeben.');
  }
  if (input.kind === 'expense' && actor.club.claimReceiptRequired && !input.receiptImageId)
    throw new HttpError(
      400,
      'receipt_required',
      'Der Verein verlangt zu jeder Auslage einen Beleg. Bitte füge ein Foto oder eine Datei hinzu.',
    );
  const receiptRef = input.receiptImageId
    ? await mediaReference(db, actor, input.receiptImageId, 'claim')
    : null;
  const [row] = await db
    .insert(s.clubExpenseClaims)
    .values({
      clubId: actor.club.id,
      personId: actor.person.id,
      kind: input.kind,
      description,
      amountCents,
      kilometers,
      expenseDate: input.expenseDate,
      receiptRef,
      createdAt: now,
    })
    .returning({ id: s.clubExpenseClaims.id });
  await audit(
    db,
    actor,
    'clubcash.claim',
    'club_expense_claim',
    row!.id,
    `Auslage eingereicht: ${euro(amountCents)} – ${description}`,
    now,
  );
  return { id: row!.id };
}

const claimStatus = (v: string) => v as ClubClaimStatus;

export async function listClaims(db: Db, actor: Actor, now: Date): Promise<ClubExpenseClaims> {
  requireModule(actor);
  const manage = actorCan(actor, 'clubcash.manage');
  const c = s.clubExpenseClaims;
  const rows = await db
    .select({
      claim: c,
      first: s.persons.firstName,
      last: s.persons.lastName,
    })
    .from(c)
    .innerJoin(s.persons, eq(s.persons.id, c.personId))
    .where(
      manage
        ? eq(c.clubId, actor.club.id)
        : and(eq(c.clubId, actor.club.id), eq(c.personId, actor.person.id)),
    )
    .orderBy(desc(c.createdAt));
  const deciders = new Map<string, string>();
  for (const id of new Set(
    rows.map((r) => r.claim.decidedByPersonId).filter((x): x is string => !!x),
  ))
    deciders.set(id, await personName(db, id));
  const claims: ClubExpenseClaim[] = rows.map((r) => ({
    id: r.claim.id,
    personId: r.claim.personId,
    personName: `${r.first} ${r.last}`,
    kind: r.claim.kind as 'expense' | 'mileage',
    description: r.claim.description,
    amountCents: r.claim.amountCents,
    kilometers: r.claim.kilometers,
    expenseDate: r.claim.expenseDate,
    receiptUrl: resolveMediaUrl(actor.links, r.claim.receiptRef, now),
    status: claimStatus(r.claim.status),
    awaitingSecondApproval: r.claim.status === 'submitted' && !!r.claim.firstApprovedByPersonId,
    decidedByName: r.claim.decidedByPersonId
      ? (deciders.get(r.claim.decidedByPersonId) ?? null)
      : null,
    decidedAt: r.claim.decidedAt?.toISOString() ?? null,
    rejectReason: r.claim.rejectReason,
    paidOn: r.claim.paidOn,
    createdAt: r.claim.createdAt.toISOString(),
  }));
  const open = claims.filter((x) => x.status === 'submitted' || x.status === 'approved');
  return {
    canManage: manage,
    claims,
    openCount: open.length,
    openCents: open.reduce((sum, x) => sum + x.amountCents, 0),
  };
}

async function loadClaim(db: Db, actor: Actor, id: string) {
  const [claim] = await db
    .select()
    .from(s.clubExpenseClaims)
    .where(and(eq(s.clubExpenseClaims.id, id), eq(s.clubExpenseClaims.clubId, actor.club.id)));
  if (!claim) throw notFound('Die Auslage');
  return claim;
}

async function tell(
  db: Db,
  actor: Actor,
  personId: string,
  title: string,
  body: string,
  key: string,
  now: Date,
) {
  const users = (await usersByPerson(db, [personId])).get(personId) ?? [];
  await deliver(
    db,
    actor.club,
    users,
    { level: 'info', topic: 'cash', title, body, dedupeKey: key },
    now,
  );
}

export async function decideClaim(
  db: Db,
  actor: Actor,
  id: string,
  decision: { approve: true } | { approve: false; reason: string },
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const claim = await loadClaim(db, actor, id);
  if (claim.status !== 'submitted')
    throw new HttpError(409, 'already_decided', 'Über diese Auslage ist schon entschieden.');
  if (!decision.approve && decision.reason.trim().length < 3)
    throw new HttpError(400, 'reason_required', 'Bitte die Ablehnung begründen.');
  // Vier-Augen-Prinzip: ab der Grenze geben zwei verschiedene Personen frei, nie die einreichende selbst
  const limit = actor.club.claimSecondApprovalCents;
  if (decision.approve && limit !== null && claim.amountCents >= limit) {
    if (claim.personId === actor.person.id)
      throw new HttpError(
        403,
        'own_claim',
        'Diese Auslage hast du selbst eingereicht. Bei diesem Betrag geben zwei andere Personen frei.',
      );
    if (!claim.firstApprovedByPersonId) {
      await db
        .update(s.clubExpenseClaims)
        .set({ firstApprovedByPersonId: actor.person.id })
        .where(eq(s.clubExpenseClaims.id, id));
      await audit(
        db,
        actor,
        'clubcash.claim',
        'club_expense_claim',
        id,
        `Auslage erstmals freigegeben (zweite Freigabe fehlt): ${euro(claim.amountCents)} – ${claim.description}`,
        now,
      );
      return;
    }
    if (claim.firstApprovedByPersonId === actor.person.id)
      throw new HttpError(
        409,
        'second_person_needed',
        'Du hast schon freigegeben. Ab diesem Betrag muss eine zweite Person bestätigen.',
      );
  }
  await db
    .update(s.clubExpenseClaims)
    .set({
      status: decision.approve ? 'approved' : 'rejected',
      decidedByPersonId: actor.person.id,
      decidedAt: now,
      rejectReason: decision.approve ? null : decision.reason.trim(),
    })
    .where(eq(s.clubExpenseClaims.id, id));
  await audit(
    db,
    actor,
    'clubcash.claim',
    'club_expense_claim',
    id,
    decision.approve
      ? `Auslage genehmigt: ${euro(claim.amountCents)} – ${claim.description}`
      : `Auslage abgelehnt: ${euro(claim.amountCents)} – ${claim.description}`,
    now,
  );
  await tell(
    db,
    actor,
    claim.personId,
    decision.approve ? 'Deine Auslage wurde genehmigt' : 'Deine Auslage wurde abgelehnt',
    decision.approve
      ? `${claim.description}: ${euro(claim.amountCents)} – die Erstattung folgt.`
      : `${claim.description}: ${decision.reason.trim()}`,
    `club-claim:${id}:${decision.approve ? 'ok' : 'no'}`,
    now,
  );
}

export async function payClaim(
  db: Db,
  actor: Actor,
  id: string,
  input: ClubClaimPayInput,
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const claim = await loadClaim(db, actor, id);
  if (claim.status !== 'approved')
    throw new HttpError(409, 'not_approved', 'Nur genehmigte Auslagen werden erstattet.');
  const name = await personName(db, claim.personId);
  const entry = await createEntry(
    db,
    actor,
    {
      accountId: input.accountId,
      kind: 'expense',
      amountCents: claim.amountCents,
      bookedOn: input.paidOn,
      categoryId: input.categoryId,
      counterparty: name,
      purpose: `Auslagenerstattung: ${claim.description}`,
      receiptImageId: mediaIdOf(claim.receiptRef),
    },
    now,
  );
  await db
    .update(s.clubExpenseClaims)
    .set({ status: 'paid', entryId: entry.id, paidOn: input.paidOn })
    .where(eq(s.clubExpenseClaims.id, id));
  await audit(
    db,
    actor,
    'clubcash.claim',
    'club_expense_claim',
    id,
    `Auslage erstattet: ${euro(claim.amountCents)} an ${name}`,
    now,
  );
  await tell(
    db,
    actor,
    claim.personId,
    'Deine Auslage wurde erstattet',
    `${claim.description}: ${euro(claim.amountCents)} am ${german(input.paidOn)}.`,
    `club-claim:${id}:paid`,
    now,
  );
}

// ── Übungsleiter- und Ehrenamtspauschale ────────────────────────────────────

async function paidSoFar(
  db: Db,
  clubId: string,
  year: number,
  personId?: string,
  kind?: ClubAllowanceKind,
) {
  const p = s.clubAllowancePayments;
  const rows = await db
    .select({
      personId: p.personId,
      kind: p.kind,
      cents: sql<number>`coalesce(sum(${p.amountCents}), 0)::int`,
    })
    .from(p)
    .innerJoin(s.clubCashEntries, eq(s.clubCashEntries.id, p.entryId))
    .where(
      and(
        eq(p.clubId, clubId),
        eq(p.year, year),
        isNull(s.clubCashEntries.cancelledAt),
        personId ? eq(p.personId, personId) : undefined,
        kind ? eq(p.kind, kind) : undefined,
      ),
    )
    .groupBy(p.personId, p.kind);
  return rows.map((r) => ({
    personId: r.personId,
    kind: r.kind as ClubAllowanceKind,
    cents: Number(r.cents),
  }));
}

export async function getAllowances(db: Db, actor: Actor, year: number): Promise<ClubAllowances> {
  requireClubFull(actor);
  const sums = await paidSoFar(db, actor.club.id, year);
  const ids = [...new Set(sums.map((x) => x.personId))];
  const names = new Map<string, string>();
  if (ids.length) {
    const people = await db
      .select({ id: s.persons.id, first: s.persons.firstName, last: s.persons.lastName })
      .from(s.persons)
      .where(inArray(s.persons.id, ids));
    for (const p of people) names.set(p.id, `${p.first} ${p.last}`);
  }
  const rows: ClubAllowanceRow[] = sums
    .map((x) => {
      const limit = clubAllowanceLimitCents(x.kind, year);
      return {
        personId: x.personId,
        personName: names.get(x.personId) ?? '',
        kind: x.kind,
        limitCents: limit,
        paidCents: x.cents,
        remainingCents: Math.max(0, limit - x.cents),
        status:
          x.cents >= limit
            ? ('full' as const)
            : x.cents >= limit * 0.9
              ? ('warn' as const)
              : ('ok' as const),
      };
    })
    .sort((a, b) => a.personName.localeCompare(b.personName, 'de'));
  const p = s.clubAllowancePayments;
  const payments = await db
    .select({ payment: p, first: s.persons.firstName, last: s.persons.lastName })
    .from(p)
    .innerJoin(s.clubCashEntries, eq(s.clubCashEntries.id, p.entryId))
    .innerJoin(s.persons, eq(s.persons.id, p.personId))
    .where(
      and(eq(p.clubId, actor.club.id), eq(p.year, year), isNull(s.clubCashEntries.cancelledAt)),
    )
    .orderBy(desc(p.paidOn), desc(p.createdAt));
  return {
    year,
    canManage: actorCan(actor, 'clubcash.manage'),
    rows,
    payments: payments.map((r) => ({
      id: r.payment.id,
      personName: `${r.first} ${r.last}`,
      kind: r.payment.kind as ClubAllowanceKind,
      amountCents: r.payment.amountCents,
      paidOn: r.payment.paidOn,
      note: r.payment.note,
    })),
  };
}

export async function payAllowance(
  db: Db,
  actor: Actor,
  input: ClubAllowancePaymentInput,
  now: Date,
): Promise<{ exceeded: false }> {
  requireClubManage(actor);
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1)
    throw new HttpError(400, 'invalid_amount', 'Der Betrag muss größer als 0 sein.');
  const [person] = await db
    .select({ id: s.persons.id })
    .from(s.persons)
    .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Die Person');
  const year = Number(input.paidOn.slice(0, 4));
  const limit = clubAllowanceLimitCents(input.kind, year);
  const [sum] = await paidSoFar(db, actor.club.id, year, input.personId, input.kind);
  const after = (sum?.cents ?? 0) + input.amountCents;
  if (after > limit && !input.force)
    throw new HttpError(
      409,
      'allowance_exceeded',
      `Damit würde der Freibetrag (${CLUB_ALLOWANCE_KIND_LABEL[input.kind]} ${euro(limit)} im Jahr ${year}) überschritten: bisher ${euro(sum?.cents ?? 0)}, mit dieser Zahlung ${euro(after)}. Bitte steuerlich klären oder die Zahlung bewusst trotzdem buchen.`,
    );
  const name = await personName(db, input.personId);
  const entry = await createEntry(
    db,
    actor,
    {
      accountId: input.accountId,
      kind: 'expense',
      amountCents: input.amountCents,
      bookedOn: input.paidOn,
      categoryId: input.categoryId,
      counterparty: name,
      purpose: `${CLUB_ALLOWANCE_KIND_LABEL[input.kind]} ${name}`,
    },
    now,
  );
  await db.insert(s.clubAllowancePayments).values({
    clubId: actor.club.id,
    personId: input.personId,
    year,
    kind: input.kind,
    amountCents: input.amountCents,
    paidOn: input.paidOn,
    entryId: entry.id,
    note: input.note?.trim() || null,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  await audit(
    db,
    actor,
    'clubcash.allowance',
    'club',
    actor.club.id,
    `${CLUB_ALLOWANCE_KIND_LABEL[input.kind]}: ${euro(input.amountCents)} an ${name} (${year})${after > limit ? ' – Freibetrag überschritten' : ''}`,
    now,
  );
  return { exceeded: false };
}

// ── Zuschüsse ───────────────────────────────────────────────────────────────

function toGrant(g: typeof s.clubGrants.$inferSelect, day: string): ClubGrant {
  const open = g.status !== 'rejected' && !g.proofSubmittedAt && !!g.proofDeadline;
  const soon = new Date(`${day}T00:00:00Z`).getTime() + 30 * 86_400_000;
  return {
    id: g.id,
    name: g.name,
    grantor: g.grantor,
    amountCents: g.amountCents,
    status: g.status as ClubGrantStatus,
    proofDeadline: g.proofDeadline,
    proofSubmittedAt: g.proofSubmittedAt?.toISOString() ?? null,
    proofOverdue: open && g.proofDeadline! < day,
    proofDueSoon:
      open && g.proofDeadline! >= day && new Date(`${g.proofDeadline}T00:00:00Z`).getTime() <= soon,
    note: g.note,
  };
}

export async function listGrants(db: Db, actor: Actor, now: Date): Promise<ClubGrants> {
  requireClubFull(actor);
  const day = today(actor, now);
  const rows = await db
    .select()
    .from(s.clubGrants)
    .where(eq(s.clubGrants.clubId, actor.club.id))
    .orderBy(asc(s.clubGrants.proofDeadline), desc(s.clubGrants.createdAt));
  const grants = rows.map((g) => toGrant(g, day));
  return {
    canManage: actorCan(actor, 'clubcash.manage'),
    grants,
    receivedCents: grants
      .filter((g) => g.status === 'received')
      .reduce((n, g) => n + g.amountCents, 0),
    expectedCents: grants
      .filter((g) => g.status === 'approved' || g.status === 'applied')
      .reduce((n, g) => n + g.amountCents, 0),
  };
}

export async function createGrant(
  db: Db,
  actor: Actor,
  input: ClubGrantInput,
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1)
    throw new HttpError(400, 'invalid_amount', 'Der Betrag muss größer als 0 sein.');
  const [row] = await db
    .insert(s.clubGrants)
    .values({
      clubId: actor.club.id,
      name: input.name.trim(),
      grantor: input.grantor.trim(),
      amountCents: input.amountCents,
      proofDeadline: input.proofDeadline ?? null,
      note: input.note?.trim() || null,
      createdAt: now,
    })
    .returning({ id: s.clubGrants.id });
  await audit(
    db,
    actor,
    'clubcash.grant',
    'club_grant',
    row!.id,
    `Zuschuss angelegt: ${input.name.trim()} (${euro(input.amountCents)}, ${input.grantor.trim()})`,
    now,
  );
}

async function loadGrant(db: Db, actor: Actor, id: string) {
  const [grant] = await db
    .select()
    .from(s.clubGrants)
    .where(and(eq(s.clubGrants.id, id), eq(s.clubGrants.clubId, actor.club.id)));
  if (!grant) throw notFound('Der Zuschuss');
  return grant;
}

const GRANT_FLOW: Record<ClubGrantStatus, ClubGrantStatus[]> = {
  planned: ['applied', 'rejected'],
  applied: ['approved', 'rejected'],
  approved: ['rejected'],
  received: [],
  rejected: ['planned'],
};

export async function setGrantStatus(
  db: Db,
  actor: Actor,
  id: string,
  status: ClubGrantStatus,
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const grant = await loadGrant(db, actor, id);
  if (status === 'received')
    throw new HttpError(400, 'use_receive', 'Der Eingang wird mit der Buchung erfasst.');
  if (!GRANT_FLOW[grant.status as ClubGrantStatus].includes(status))
    throw new HttpError(409, 'invalid_transition', 'Dieser Schritt ist nicht möglich.');
  await db.update(s.clubGrants).set({ status }).where(eq(s.clubGrants.id, id));
  await audit(
    db,
    actor,
    'clubcash.grant',
    'club_grant',
    id,
    `Zuschuss ${grant.name}: Status ${status}`,
    now,
  );
}

export async function receiveGrant(
  db: Db,
  actor: Actor,
  id: string,
  input: { accountId: string; categoryId: string; receivedOn: string },
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const grant = await loadGrant(db, actor, id);
  if (grant.status !== 'approved')
    throw new HttpError(409, 'not_approved', 'Eingehen kann nur ein bewilligter Zuschuss.');
  const entry = await createEntry(
    db,
    actor,
    {
      accountId: input.accountId,
      kind: 'income',
      amountCents: grant.amountCents,
      bookedOn: input.receivedOn,
      categoryId: input.categoryId,
      counterparty: grant.grantor,
      purpose: `Zuschuss ${grant.name}`,
    },
    now,
  );
  await db
    .update(s.clubGrants)
    .set({ status: 'received', entryId: entry.id })
    .where(eq(s.clubGrants.id, id));
  await audit(
    db,
    actor,
    'clubcash.grant',
    'club_grant',
    id,
    `Zuschuss ${grant.name}: ${euro(grant.amountCents)} eingegangen`,
    now,
  );
}

/** Verwendungsnachweis eingereicht (oder wieder offen) – Frist und Warnung entfallen. */
export async function setGrantProof(
  db: Db,
  actor: Actor,
  id: string,
  submitted: boolean,
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const grant = await loadGrant(db, actor, id);
  await db
    .update(s.clubGrants)
    .set({ proofSubmittedAt: submitted ? now : null })
    .where(eq(s.clubGrants.id, id));
  await audit(
    db,
    actor,
    'clubcash.grant',
    'club_grant',
    id,
    `Zuschuss ${grant.name}: Verwendungsnachweis ${submitted ? 'eingereicht' : 'wieder offen'}`,
    now,
  );
}

// ── Sponsoren-Einnahmen ─────────────────────────────────────────────────────

export async function getSponsorIncome(
  db: Db,
  actor: Actor,
  year: number,
): Promise<ClubSponsorIncome> {
  requireClubFull(actor);
  const e = s.clubCashEntries;
  const rows = await db
    .select({
      sponsorId: e.sponsorId,
      name: s.sponsors.name,
      cents: sql<number>`coalesce(sum(${e.amountCents}), 0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(e)
    .innerJoin(s.sponsors, eq(s.sponsors.id, e.sponsorId))
    .where(
      and(
        eq(e.clubId, actor.club.id),
        isNull(e.cancelledAt),
        eq(e.kind, 'income'),
        isNotNull(e.sponsorId),
        gte(e.bookedOn, `${year}-01-01`),
        lte(e.bookedOn, `${year}-12-31`),
      ),
    )
    .groupBy(e.sponsorId, s.sponsors.name)
    .orderBy(desc(sql`sum(${e.amountCents})`));
  const sponsors = rows.map((r) => ({
    id: r.sponsorId,
    name: r.name,
    cents: Number(r.cents),
    count: Number(r.n),
  }));
  return {
    year,
    canManage: actorCan(actor, 'clubcash.manage'),
    total: sponsors.reduce((sum, x) => sum + x.cents, 0),
    sponsors,
  };
}

/** Sponsoren des Vereins zur Auswahl bei einer Einnahme. */
export async function listSponsorChoices(
  db: Db,
  actor: Actor,
): Promise<{ id: string; name: string }[]> {
  requireClubFull(actor);
  return db
    .select({ id: s.sponsors.id, name: s.sponsors.name })
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id))
    .orderBy(asc(s.sponsors.name));
}

// ── Zuschuss an eine Mannschaftskasse ───────────────────────────────────────

export async function listTeamGrants(db: Db, actor: Actor): Promise<ClubTeamGrants> {
  requireClubFull(actor);
  const teams = await db
    .select({ id: s.teams.id, name: s.teams.name })
    .from(s.teams)
    .where(eq(s.teams.clubId, actor.club.id))
    .orderBy(asc(s.teams.name));
  const g = s.clubTeamGrants;
  const rows = await db
    .select({ grant: g, teamName: s.teams.name })
    .from(g)
    .innerJoin(s.teams, eq(s.teams.id, g.teamId))
    .where(eq(g.clubId, actor.club.id))
    .orderBy(desc(g.bookedOn), desc(g.createdAt));
  return {
    canManage: actorCan(actor, 'clubcash.manage'),
    teams,
    grants: rows.map((r) => ({
      id: r.grant.id,
      teamName: r.teamName,
      amountCents: r.grant.amountCents,
      bookedOn: r.grant.bookedOn,
    })),
  };
}

export async function createTeamGrant(
  db: Db,
  actor: Actor,
  input: ClubTeamGrantInput,
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const [team] = await db
    .select()
    .from(s.teams)
    .where(and(eq(s.teams.id, input.teamId), eq(s.teams.clubId, actor.club.id)));
  if (!team) throw notFound('Die Mannschaft');
  // Das Konto der Mannschaftskasse anlegen, falls es noch keines gibt
  let [account] = await db.select().from(s.cashAccounts).where(eq(s.cashAccounts.teamId, team.id));
  const entry = await createEntry(
    db,
    actor,
    {
      accountId: input.accountId,
      kind: 'expense',
      amountCents: input.amountCents,
      bookedOn: input.bookedOn,
      categoryId: input.categoryId,
      counterparty: `Mannschaftskasse ${team.name}`,
      purpose: input.note?.trim()
        ? `Zuschuss an Mannschaftskasse ${team.name}: ${input.note.trim()}`
        : `Zuschuss an Mannschaftskasse ${team.name}`,
    },
    now,
  );
  if (!account) {
    [account] = await db
      .insert(s.cashAccounts)
      .values({
        clubId: actor.club.id,
        teamId: team.id,
        name: `Mannschaftskasse ${team.name}`,
        createdAt: now,
      })
      .returning();
  }
  const [tx] = await db
    .insert(s.cashTransactions)
    .values({
      clubId: actor.club.id,
      accountId: account!.id,
      direction: 'income',
      amountCents: input.amountCents,
      category: 'zuschuss',
      description: input.note?.trim()
        ? `Zuschuss des Vereins: ${input.note.trim()}`
        : 'Zuschuss des Vereins',
      counterparty: actor.club.name,
      bookedOn: input.bookedOn,
      createdByPersonId: actor.person.id,
      createdAt: now,
    })
    .returning({ id: s.cashTransactions.id });
  await db.insert(s.clubTeamGrants).values({
    clubId: actor.club.id,
    entryId: entry.id,
    teamId: team.id,
    transactionId: tx!.id,
    amountCents: input.amountCents,
    bookedOn: input.bookedOn,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  await audit(
    db,
    actor,
    'clubcash.teamgrant',
    'club_team_grant',
    entry.id,
    `Zuschuss ${euro(input.amountCents)} an Mannschaftskasse ${team.name}`,
    now,
  );
}

// ── Inventar ────────────────────────────────────────────────────────────────

export async function getInventory(db: Db, actor: Actor): Promise<ClubInventory> {
  requireClubFull(actor);
  const rows = await db
    .select()
    .from(s.clubInventory)
    .where(eq(s.clubInventory.clubId, actor.club.id))
    .orderBy(asc(s.clubInventory.disposedAt), asc(s.clubInventory.name));
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: r.quantity,
    acquiredOn: r.acquiredOn,
    costCents: r.costCents,
    location: r.location,
    note: r.note,
    disposedAt: r.disposedAt?.toISOString() ?? null,
    disposedReason: r.disposedReason,
  }));
  return {
    canManage: actorCan(actor, 'clubcash.manage'),
    items,
    totalCostCents: items.filter((i) => !i.disposedAt).reduce((n, i) => n + (i.costCents ?? 0), 0),
  };
}

export async function createInventoryItem(
  db: Db,
  actor: Actor,
  input: ClubInventoryInput,
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000)
    throw new HttpError(400, 'invalid_quantity', 'Die Anzahl ist ungültig.');
  if (input.costCents != null && (!Number.isInteger(input.costCents) || input.costCents < 0))
    throw new HttpError(400, 'invalid_amount', 'Der Wert ist ungültig.');
  const [row] = await db
    .insert(s.clubInventory)
    .values({
      clubId: actor.club.id,
      name: input.name.trim(),
      category: input.category?.trim() || null,
      quantity,
      acquiredOn: input.acquiredOn ?? null,
      costCents: input.costCents ?? null,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      createdAt: now,
    })
    .returning({ id: s.clubInventory.id });
  await audit(
    db,
    actor,
    'clubcash.inventory',
    'club_inventory',
    row!.id,
    `Inventar: ${quantity} × ${input.name.trim()} aufgenommen`,
    now,
  );
}

export async function updateInventoryItem(
  db: Db,
  actor: Actor,
  id: string,
  input: Partial<ClubInventoryInput> & { dispose?: boolean; reason?: string | null },
  now: Date,
): Promise<void> {
  requireClubManage(actor);
  const [item] = await db
    .select()
    .from(s.clubInventory)
    .where(and(eq(s.clubInventory.id, id), eq(s.clubInventory.clubId, actor.club.id)));
  if (!item) throw notFound('Der Gegenstand');
  const patch: Partial<typeof s.clubInventory.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.category !== undefined) patch.category = input.category?.trim() || null;
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.acquiredOn !== undefined) patch.acquiredOn = input.acquiredOn;
  if (input.costCents !== undefined) patch.costCents = input.costCents;
  if (input.location !== undefined) patch.location = input.location?.trim() || null;
  if (input.note !== undefined) patch.note = input.note?.trim() || null;
  if (input.dispose === true) {
    if ((input.reason ?? '').trim().length < 3)
      throw new HttpError(400, 'reason_required', 'Bitte den Grund der Aussonderung angeben.');
    patch.disposedAt = now;
    patch.disposedReason = input.reason!.trim();
  } else if (input.dispose === false) {
    patch.disposedAt = null;
    patch.disposedReason = null;
  }
  if (Object.keys(patch).length === 0) return;
  await db.update(s.clubInventory).set(patch).where(eq(s.clubInventory.id, id));
  await audit(
    db,
    actor,
    'clubcash.inventory',
    'club_inventory',
    id,
    input.dispose === true
      ? `Inventar: ${item.name} ausgesondert (${input.reason!.trim()})`
      : `Inventar: ${item.name} geändert`,
    now,
  );
}
