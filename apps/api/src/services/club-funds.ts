/**
 * Kassen der Vereinskasse (Paket K6): Der Verein legt Kassen selbst an, ordnet sie einer oder
 * mehreren Abteilungen zu und bestimmt genau eine Hauptkasse. Kassen werden nie gelöscht, nur
 * stillgelegt. Rechte können für den ganzen Verein oder für Abteilungen (und damit deren Kassen)
 * gelten.
 */
import {
  scopesWith,
  type ClubCashFund,
  type ClubCashFundInput,
  type Permission,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';

type CashPermission = Extract<Permission, 'clubcash.read' | 'clubcash.manage' | 'clubcash.audit'>;

/** Hauptkasse des Vereins; wird beim ersten Zugriff angelegt, falls noch keine existiert. */
export async function ensureMainFund(db: Db, clubId: string, now: Date): Promise<string> {
  const [main] = await db
    .select({ id: s.clubCashFunds.id })
    .from(s.clubCashFunds)
    .where(and(eq(s.clubCashFunds.clubId, clubId), eq(s.clubCashFunds.isMain, true)));
  if (main) return main.id;
  const [row] = await db
    .insert(s.clubCashFunds)
    .values({ clubId, name: 'Hauptkasse', isMain: true, sortOrder: 0, createdAt: now })
    .returning({ id: s.clubCashFunds.id });
  return row!.id;
}

/**
 * Kassen, für die der Nutzer das Recht hat. `null` = alle (Recht für den ganzen Verein bzw.
 * Vorstand mit Einsicht). Sonst nur Kassen, die einer Abteilung seines Geltungsbereichs zugeordnet
 * sind.
 */
export async function fundScope(
  db: Db,
  actor: Actor,
  permission: CashPermission,
  viewerWide = false,
): Promise<string[] | null> {
  if (actorCan(actor, permission) || viewerWide) return null;
  const { orgUnitIds } = scopesWith(actor.grants, permission);
  if (orgUnitIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: s.clubCashFundUnits.fundId })
    .from(s.clubCashFundUnits)
    .innerJoin(s.clubCashFunds, eq(s.clubCashFunds.id, s.clubCashFundUnits.fundId))
    .where(
      and(
        eq(s.clubCashFunds.clubId, actor.club.id),
        inArray(s.clubCashFundUnits.orgUnitId, orgUnitIds),
      ),
    );
  return rows.map((r) => r.id);
}

/** Wirft 403, wenn der Nutzer das Recht nicht für diese Kasse hat. */
export async function assertFund(
  db: Db,
  actor: Actor,
  fundId: string,
  permission: CashPermission,
  viewerWide = false,
): Promise<void> {
  const scope = await fundScope(db, actor, permission, viewerWide);
  if (scope !== null && !scope.includes(fundId))
    throw forbidden('Für diese Kasse hast du keine Berechtigung.');
}

/** Kassen anlegen und ändern darf nur, wer die Vereinskasse für den ganzen Verein führt. */
export function requireFundAdmin(actor: Actor) {
  if (!actorCan(actor, 'clubcash.manage'))
    throw forbidden('Kassen legt die Kassenführung des ganzen Vereins an.');
}

export async function listFunds(
  db: Db,
  clubId: string,
  allowed: string[] | null,
): Promise<ClubCashFund[]> {
  const funds = await db
    .select()
    .from(s.clubCashFunds)
    .where(eq(s.clubCashFunds.clubId, clubId))
    .orderBy(asc(s.clubCashFunds.sortOrder), asc(s.clubCashFunds.createdAt));
  const visible = allowed === null ? funds : funds.filter((f) => allowed.includes(f.id));
  if (visible.length === 0) return [];
  const ids = visible.map((f) => f.id);

  const [units, accounts, moved, booked] = await Promise.all([
    db
      .select({
        fundId: s.clubCashFundUnits.fundId,
        id: s.orgUnits.id,
        name: s.orgUnits.name,
      })
      .from(s.clubCashFundUnits)
      .innerJoin(s.orgUnits, eq(s.orgUnits.id, s.clubCashFundUnits.orgUnitId))
      .where(inArray(s.clubCashFundUnits.fundId, ids))
      .orderBy(asc(s.orgUnits.name)),
    db
      .select({
        fundId: s.clubCashAccounts.fundId,
        accountId: s.clubCashAccounts.id,
        opening: s.clubCashAccounts.openingBalanceCents,
        archivedAt: s.clubCashAccounts.archivedAt,
      })
      .from(s.clubCashAccounts)
      .where(inArray(s.clubCashAccounts.fundId, ids)),
    db
      .select({
        accountId: s.clubCashEntries.accountId,
        cents: sql<number>`coalesce(sum(case when ${s.clubCashEntries.kind} in ('income','transfer_in') then ${s.clubCashEntries.amountCents} else -${s.clubCashEntries.amountCents} end), 0)::int`,
      })
      .from(s.clubCashEntries)
      .where(and(eq(s.clubCashEntries.clubId, clubId), isNull(s.clubCashEntries.cancelledAt)))
      .groupBy(s.clubCashEntries.accountId),
    db
      .selectDistinct({ fundId: s.clubCashAccounts.fundId })
      .from(s.clubCashEntries)
      .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, s.clubCashEntries.accountId))
      .where(inArray(s.clubCashAccounts.fundId, ids)),
  ]);
  const movedOf = new Map(moved.map((m) => [m.accountId, Number(m.cents)]));
  const hasEntries = new Set(booked.map((b) => b.fundId));

  return visible.map((f) => {
    const own = accounts.filter((a) => a.fundId === f.id);
    return {
      id: f.id,
      name: f.name,
      isMain: f.isMain,
      archived: !!f.archivedAt,
      units: units.filter((u) => u.fundId === f.id).map((u) => ({ id: u.id, name: u.name })),
      accountCount: own.filter((a) => !a.archivedAt).length,
      balanceCents: own
        .filter((a) => !a.archivedAt)
        .reduce((sum, a) => sum + a.opening + (movedOf.get(a.accountId) ?? 0), 0),
      hasEntries: hasEntries.has(f.id),
    };
  });
}

async function checkUnits(db: Db, clubId: string, unitIds: string[]) {
  const unique = [...new Set(unitIds)];
  if (unique.length === 0) return unique;
  const found = await db
    .select({ id: s.orgUnits.id })
    .from(s.orgUnits)
    .where(and(eq(s.orgUnits.clubId, clubId), inArray(s.orgUnits.id, unique)));
  if (found.length !== unique.length) throw notFound('Die Abteilung');
  return unique;
}

async function audit(
  db: Db,
  actor: Actor,
  action: string,
  id: string,
  label: string,
  now: Date,
): Promise<void> {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'club_cash_fund',
    entityId: id,
    data: { label },
    createdAt: now,
  });
}

export async function createFund(
  db: Db,
  actor: Actor,
  input: ClubCashFundInput,
  now: Date,
): Promise<{ id: string }> {
  requireFundAdmin(actor);
  const name = input.name.trim();
  const clubId = actor.club.id;
  await ensureMainFund(db, clubId, now);
  const [dup] = await db
    .select({ id: s.clubCashFunds.id })
    .from(s.clubCashFunds)
    .where(
      and(eq(s.clubCashFunds.clubId, clubId), sql`lower(${s.clubCashFunds.name}) = lower(${name})`),
    );
  if (dup) throw new HttpError(409, 'duplicate', 'Eine Kasse mit diesem Namen gibt es schon.');
  const unitIds = await checkUnits(db, clubId, input.unitIds);
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.clubCashFunds)
    .where(eq(s.clubCashFunds.clubId, clubId))) as [{ n: number }];
  if (input.isMain)
    await db
      .update(s.clubCashFunds)
      .set({ isMain: false })
      .where(eq(s.clubCashFunds.clubId, clubId));
  const [row] = await db
    .insert(s.clubCashFunds)
    .values({ clubId, name, isMain: !!input.isMain, sortOrder: n, createdAt: now })
    .returning({ id: s.clubCashFunds.id });
  if (unitIds.length)
    await db
      .insert(s.clubCashFundUnits)
      .values(unitIds.map((orgUnitId) => ({ fundId: row!.id, orgUnitId })));
  await audit(db, actor, 'clubcash.fund', row!.id, `Vereinskasse: Kasse angelegt: ${name}`, now);
  return { id: row!.id };
}

export async function updateFund(
  db: Db,
  actor: Actor,
  id: string,
  input: Partial<ClubCashFundInput> & { archived?: boolean },
  now: Date,
): Promise<void> {
  requireFundAdmin(actor);
  const clubId = actor.club.id;
  const [fund] = await db
    .select()
    .from(s.clubCashFunds)
    .where(and(eq(s.clubCashFunds.id, id), eq(s.clubCashFunds.clubId, clubId)));
  if (!fund) throw notFound('Die Kasse');
  const patch: Partial<typeof s.clubCashFunds.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    const [dup] = await db
      .select({ id: s.clubCashFunds.id })
      .from(s.clubCashFunds)
      .where(
        and(
          eq(s.clubCashFunds.clubId, clubId),
          sql`lower(${s.clubCashFunds.name}) = lower(${name})`,
          sql`${s.clubCashFunds.id} <> ${id}`,
        ),
      );
    if (dup) throw new HttpError(409, 'duplicate', 'Eine Kasse mit diesem Namen gibt es schon.');
    patch.name = name;
  }
  if (input.archived === true) {
    if (fund.isMain)
      throw new HttpError(
        409,
        'main_fund',
        'Die Hauptkasse kann nicht stillgelegt werden. Lege zuerst eine andere Kasse als Hauptkasse fest.',
      );
    patch.archivedAt = now;
  } else if (input.archived === false) patch.archivedAt = null;
  if (input.isMain === true) {
    if (fund.archivedAt && input.archived !== false)
      throw new HttpError(409, 'archived', 'Eine stillgelegte Kasse kann nicht Hauptkasse sein.');
    await db
      .update(s.clubCashFunds)
      .set({ isMain: false })
      .where(eq(s.clubCashFunds.clubId, clubId));
    patch.isMain = true;
  } else if (input.isMain === false && fund.isMain) {
    throw new HttpError(
      409,
      'main_fund',
      'Es muss immer eine Hauptkasse geben. Lege eine andere Kasse als Hauptkasse fest.',
    );
  }
  if (input.unitIds) {
    const unitIds = await checkUnits(db, clubId, input.unitIds);
    await db.delete(s.clubCashFundUnits).where(eq(s.clubCashFundUnits.fundId, id));
    if (unitIds.length)
      await db
        .insert(s.clubCashFundUnits)
        .values(unitIds.map((orgUnitId) => ({ fundId: id, orgUnitId })));
  }
  if (Object.keys(patch).length)
    await db.update(s.clubCashFunds).set(patch).where(eq(s.clubCashFunds.id, id));
  await audit(
    db,
    actor,
    'clubcash.fund',
    id,
    input.archived === true
      ? `Vereinskasse: Kasse stillgelegt: ${fund.name}`
      : input.isMain === true
        ? `Vereinskasse: Hauptkasse gewechselt: ${patch.name ?? fund.name}`
        : `Vereinskasse: Kasse geändert: ${fund.name}`,
    now,
  );
}
