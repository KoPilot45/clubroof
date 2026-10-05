/**
 * Spielerbewegungen (Mappe S. 8, Konzept §6): Wechsel im Verein, Leihe, Zugang, Abgang.
 * Recht: `teams.transfers.manage` für jede beteiligte Mannschaft (Sportliche Leitung vereinsweit,
 * Jugendleitung für die Jugend). Bewegungen gelten ab heute; die Mannschaftszuordnungen und die
 * Teilnehmerlisten künftiger Termine werden angepasst, der Eintrag bleibt als Historie.
 */
import {
  addDays,
  calendarDayOf,
  can,
  scopesWith,
  toIsoDate,
  type CreateTransferInput,
  type TransferItem,
  type TransferOverview,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify, recipientsFor } from './event-admin';

type TeamRow = typeof s.teams.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const LABELS = {
  internal: 'Wechsel',
  loan: 'Leihe',
  join: 'Zugang',
  leave: 'Abgang',
} as const;

async function currentTeams(db: Db | Tx, actor: Actor): Promise<TeamRow[]> {
  return db
    .select({ team: s.teams })
    .from(s.teams)
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
    .orderBy(asc(s.teams.sortOrder))
    .then((rows) => rows.map((r) => r.team));
}

const mayTransfer = (actor: Actor, team: TeamRow) =>
  can(actor.grants, 'teams.transfers.manage', { teamId: team.id, orgUnitId: team.orgUnitId });

export async function listTransfers(db: Db, actor: Actor): Promise<TransferOverview> {
  const scopes = scopesWith(actor.grants, 'teams.transfers.manage');
  const any = scopes.all || scopes.orgUnitIds.length > 0 || scopes.teamIds.length > 0;
  if (!any && !actorCan(actor, 'members.read'))
    throw forbidden('Spielerbewegungen sieht die Sportliche Leitung.');
  const fromTeams = s.teams;
  const rows = await db
    .select({ transfer: s.playerTransfers, person: s.persons })
    .from(s.playerTransfers)
    .innerJoin(s.persons, eq(s.persons.id, s.playerTransfers.personId))
    .where(eq(s.playerTransfers.clubId, actor.club.id))
    .orderBy(desc(s.playerTransfers.startsOn), desc(s.playerTransfers.createdAt))
    .limit(100);
  const teamIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.transfer.fromTeamId, r.transfer.toTeamId])
        .filter((x): x is string => !!x),
    ),
  ];
  const teams = teamIds.length
    ? await db.select().from(fromTeams).where(inArray(fromTeams.id, teamIds))
    : [];
  const ref = (id: string | null) => {
    const t = id ? teams.find((x) => x.id === id) : undefined;
    return t ? { id: t.id, badge: t.badge, name: t.name } : null;
  };
  const items: TransferItem[] = rows.map(({ transfer, person }) => ({
    id: transfer.id,
    kind: transfer.kind,
    person: { id: person.id, name: `${person.firstName} ${person.lastName}` },
    fromTeam: ref(transfer.fromTeamId),
    toTeam: ref(transfer.toTeamId),
    startsOn: transfer.startsOn,
    endsOn: transfer.endsOn,
    externalClub: transfer.externalClub,
    note: transfer.note,
  }));
  return {
    items,
    teams: (await currentTeams(db, actor))
      .filter((t) => mayTransfer(actor, t))
      .map((t) => ({ id: t.id, badge: t.badge, name: t.name })),
  };
}

/** Teilnehmerlisten künftiger Termine anpassen (nur Spielerrolle, Gastspieler bleiben). */
async function syncFuture(
  tx: Tx,
  actor: Actor,
  team: TeamRow,
  personId: string,
  add: boolean,
  now: Date,
  until?: string | null,
) {
  const events = await tx
    .select({ id: s.events.id, startsAt: s.events.startsAt })
    .from(s.events)
    .where(
      and(
        eq(s.events.teamId, team.id),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, now),
      ),
    );
  const ids = events
    .filter((e) => !until || toIsoDate(calendarDayOf(e.startsAt, actor.club.timezone)) <= until)
    .map((e) => e.id);
  if (ids.length === 0) return;
  if (!add) {
    await tx
      .delete(s.eventParticipants)
      .where(
        and(
          inArray(s.eventParticipants.eventId, ids),
          eq(s.eventParticipants.personId, personId),
          eq(s.eventParticipants.role, 'player'),
        ),
      );
    return;
  }
  await tx
    .insert(s.eventParticipants)
    .values(
      ids.map((eventId) => ({
        clubId: actor.club.id,
        eventId,
        personId,
        role: 'player' as const,
        status:
          team.participationMode === 'active_response' ? ('pending' as const) : ('yes' as const),
      })),
    )
    .onConflictDoNothing();
}

export async function createTransfer(
  db: Db,
  actor: Actor,
  input: CreateTransferInput,
  now: Date,
): Promise<TransferOverview> {
  const [person] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
  if (!person) throw notFound('Das Mitglied');
  const teams = await currentTeams(db, actor);
  const from = input.fromTeamId ? teams.find((t) => t.id === input.fromTeamId) : undefined;
  const to = input.toTeamId ? teams.find((t) => t.id === input.toTeamId) : undefined;
  if (input.fromTeamId && !from)
    throw new HttpError(400, 'invalid_team', 'Unbekannte abgebende Mannschaft.');
  if (input.toTeamId && !to)
    throw new HttpError(400, 'invalid_team', 'Unbekannte aufnehmende Mannschaft.');

  const needsFrom = input.kind === 'internal' || input.kind === 'leave';
  const needsTo = input.kind !== 'leave';
  if (needsFrom && !from)
    throw new HttpError(400, 'from_required', 'Bitte die abgebende Mannschaft wählen.');
  if (needsTo && !to)
    throw new HttpError(400, 'to_required', 'Bitte die aufnehmende Mannschaft wählen.');
  if (from && to && from.id === to.id)
    throw new HttpError(400, 'same_team', 'Abgebende und aufnehmende Mannschaft sind gleich.');
  for (const t of [from, to]) {
    if (t && !mayTransfer(actor, t))
      throw forbidden(`Für ${t.badge} darfst du keine Spielerbewegungen erfassen.`);
  }
  if (needsTo && person.membershipStatus === 'left')
    throw new HttpError(
      409,
      'left',
      'Ausgetretene Mitglieder können keiner Mannschaft zugeordnet werden.',
    );

  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const yesterday = toIsoDate(addDays(calendarDayOf(now, actor.club.timezone), -1));
  if (input.kind === 'loan' && (!input.endsOn || input.endsOn <= today))
    throw new HttpError(400, 'loan_end', 'Eine Leihe braucht ein Enddatum in der Zukunft.');
  if (input.kind === 'join' && !input.externalClub?.trim())
    throw new HttpError(400, 'external_required', 'Bitte den abgebenden Verein angeben.');

  const active = await db
    .select()
    .from(s.teamMemberships)
    .where(
      and(
        eq(s.teamMemberships.personId, person.id),
        eq(s.teamMemberships.function, 'player'),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
        lte(s.teamMemberships.validFrom, today),
      ),
    );
  const inFrom = from ? active.find((m) => m.teamId === from.id) : undefined;
  if (needsFrom && !inFrom)
    throw new HttpError(409, 'not_in_team', `${person.firstName} spielt nicht in ${from!.badge}.`);
  if (to && active.some((m) => m.teamId === to.id))
    throw new HttpError(
      409,
      'already_in_team',
      `${person.firstName} spielt bereits in ${to.badge}.`,
    );

  await db.transaction(async (tx) => {
    if (inFrom && input.kind !== 'loan') {
      if (inFrom.validFrom >= today) {
        await tx.delete(s.teamMemberships).where(eq(s.teamMemberships.id, inFrom.id));
      } else {
        await tx
          .update(s.teamMemberships)
          .set({ validTo: yesterday })
          .where(eq(s.teamMemberships.id, inFrom.id));
      }
      await syncFuture(tx, actor, from!, person.id, false, now);
    }
    if (to) {
      const loan = input.kind === 'loan';
      await tx
        .insert(s.teamMemberships)
        .values({
          clubId: actor.club.id,
          teamId: to.id,
          personId: person.id,
          function: 'player',
          jerseyNumber: input.jerseyNumber ?? null,
          // Bei einer Leihe bleibt das Stammteam erhalten
          isPrimaryTeam: loan ? false : (inFrom?.isPrimaryTeam ?? true),
          validFrom: today,
          validTo: loan ? input.endsOn! : null,
        })
        .onConflictDoUpdate({
          target: [
            s.teamMemberships.teamId,
            s.teamMemberships.personId,
            s.teamMemberships.function,
            s.teamMemberships.validFrom,
          ],
          set: { validTo: loan ? input.endsOn! : null },
        });
      await syncFuture(tx, actor, to, person.id, true, now, loan ? input.endsOn : null);
    }
    await tx.insert(s.playerTransfers).values({
      clubId: actor.club.id,
      personId: person.id,
      kind: input.kind,
      fromTeamId:
        from?.id ??
        (input.kind === 'loan' ? (active.find((m) => m.isPrimaryTeam)?.teamId ?? null) : null),
      toTeamId: to?.id ?? null,
      startsOn: today,
      endsOn: input.kind === 'loan' ? input.endsOn! : null,
      externalClub: input.externalClub?.trim() || null,
      note: input.note?.trim() || null,
      createdByPersonId: actor.person.id,
      createdAt: now,
    });
    const route = [from?.badge, to?.badge ?? input.externalClub?.trim()]
      .filter(Boolean)
      .join(' → ');
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'transfer.created',
      entityType: 'person',
      entityId: person.id,
      data: { label: `${LABELS[input.kind]}: ${person.firstName} ${person.lastName} (${route})` },
      createdAt: now,
    });
  });

  if (to) {
    await notify(
      db,
      actor,
      await recipientsFor(db, [person.id], actor.user.id),
      {
        level: 'info',
        title: input.kind === 'loan' ? `Leihe: ${to.name}` : `Neue Mannschaft: ${to.name}`,
        body:
          input.kind === 'loan'
            ? `Du spielst bis ${input.endsOn!.split('-').reverse().join('.')} zusätzlich in ${to.badge}.`
            : `Du gehörst ab heute zu ${to.badge}.`,
        link: `/notifications`,
      },
      now,
    );
  }
  return listTransfers(db, actor);
}
