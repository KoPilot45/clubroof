/**
 * Einladungen und Beitrittsanfragen (Mappe S. 10, Konzept §8).
 *
 *  - Persönliche Einladung für eine angelegte Person ohne App-Zugang: Wer den Link öffnet, legt
 *    E-Mail und Passwort fest und ist sofort angemeldet (die Person ist bereits geprüft).
 *  - Mannschafts-Link/QR-Code: Interessierte (Spieler oder Eltern) stellen eine Anfrage; das
 *    Trainerteam bzw. die Verwaltung gibt frei und verknüpft mit einer bestehenden Person oder legt
 *    sie an. Bis zur Freigabe ist keine Anmeldung möglich.
 *  - Recht: `members.invite` für die Mannschaft (Trainer) bzw. den Verein (Vorstand, Verwaltung).
 *  - Links: 32 Byte Zufall, nur als Hash gespeichert; Mannschafts-Links zusätzlich verschlüsselt,
 *    damit der QR-Code erneut angezeigt werden kann. Persönlich 14 Tage, Mannschaft 30 Tage gültig.
 */
import {
  calendarDayOf,
  can,
  scopesWith,
  toIsoDate,
  type AcceptInviteInput,
  type ApproveJoinInput,
  type InviteLink,
  type InviteOverview,
  type InvitePerson,
  type JoinInfo,
  type JoinRequestInput,
  type JoinRequestItem,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import { actorCan, type Actor } from '../actor';
import { generateToken, hashToken } from '../auth/session';
import type { Config } from '../config';
import { HttpError, forbidden, notFound } from '../errors';
import { decrypt, encrypt } from '../security/crypto';
import type { Mailer } from '../security/mailer';
import { resolveMediaUrl } from '../storage/media-links';
import type { LinkSigner } from '../storage/files';
import { checkPassword, hashPassword } from './account';

const PERSON_DAYS = 14;
const TEAM_DAYS = 30;
const DAY = 86_400_000;

type TeamRow = typeof s.teams.$inferSelect;
type Ctx = { config: Config; mailer: Mailer };

const target = (t: TeamRow) => ({ teamId: t.id, orgUnitId: t.orgUnitId });
const mayInvite = (actor: Actor, t: TeamRow) => can(actor.grants, 'members.invite', target(t));

export function canInvite(actor: Actor): boolean {
  const sc = scopesWith(actor.grants, 'members.invite');
  return sc.all || sc.orgUnitIds.length > 0 || sc.teamIds.length > 0;
}

function requireInviter(actor: Actor) {
  if (!canInvite(actor))
    throw forbidden('Einladen dürfen Trainerteams und die Mitgliederverwaltung.');
}

async function currentTeams(db: Db, actor: Actor): Promise<TeamRow[]> {
  return db
    .select({ team: s.teams })
    .from(s.teams)
    .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
    .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
    .orderBy(asc(s.teams.sortOrder))
    .then((rows) => rows.map((r) => r.team));
}

async function link(config: Config, token: string, expiresAt: Date): Promise<InviteLink> {
  const url = `${config.appUrl}/join/${token}`;
  return {
    url,
    qrSvg: await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    expiresAt: expiresAt.toISOString(),
  };
}

const active = (now: Date) =>
  and(isNull(s.invitations.revokedAt), gt(s.invitations.expiresAt, now));

// ── Übersicht für Einladende ────────────────────────────────────────────────

export async function getInviteOverview(
  db: Db,
  actor: Actor,
  ctx: Ctx,
  now: Date,
): Promise<InviteOverview> {
  requireInviter(actor);
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const teams = (await currentTeams(db, actor)).filter((t) => mayInvite(actor, t));
  const teamIds = teams.map((t) => t.id);

  const teamLinks = teamIds.length
    ? await db
        .select()
        .from(s.invitations)
        .where(
          and(eq(s.invitations.kind, 'team'), inArray(s.invitations.teamId, teamIds), active(now)),
        )
        .orderBy(desc(s.invitations.createdAt))
    : [];

  // Personen ohne App-Zugang: Spieler/Trainer meiner Mannschaften und deren Eltern
  const members = teamIds.length
    ? await db
        .select({ person: s.persons, team: s.teams, fn: s.teamMemberships.function })
        .from(s.teamMemberships)
        .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
        .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
        .where(
          and(
            inArray(s.teamMemberships.teamId, teamIds),
            or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
          ),
        )
    : [];
  const memberIds = [...new Set(members.map((m) => m.person.id))];
  const guardians = memberIds.length
    ? await db
        .select({ parent: s.persons, childId: s.guardianships.childPersonId })
        .from(s.guardianships)
        .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
        .where(inArray(s.guardianships.childPersonId, memberIds))
    : [];
  const childIdsWithParents = new Set(guardians.map((g) => g.childId));

  const people = new Map<string, InvitePerson>();
  for (const m of members) {
    // Kinder mit Elternzugang bekommen keine eigene Einladung
    if (
      m.person.userId ||
      m.person.membershipStatus === 'left' ||
      childIdsWithParents.has(m.person.id)
    )
      continue;
    const role = m.fn === 'player' ? 'Spieler' : 'Trainerteam';
    const entry = people.get(m.person.id);
    const context = `${role} ${m.team.badge}`;
    people.set(m.person.id, {
      personId: m.person.id,
      name: `${m.person.firstName} ${m.person.lastName}`,
      context: entry ? `${entry.context}, ${context}` : context,
      email: m.person.email,
      invitedAt: null,
    });
  }
  for (const g of guardians) {
    if (g.parent.userId || g.parent.membershipStatus === 'left') continue;
    const child = members.find((m) => m.person.id === g.childId)!;
    const context = `Elternteil von ${child.person.firstName} (${child.team.badge})`;
    const entry = people.get(g.parent.id);
    people.set(g.parent.id, {
      personId: g.parent.id,
      name: `${g.parent.firstName} ${g.parent.lastName}`,
      context: entry && !entry.context.includes(context) ? `${entry.context}, ${context}` : context,
      email: g.parent.email,
      invitedAt: null,
    });
  }
  const ids = [...people.keys()];
  if (ids.length) {
    const invites = await db
      .select({ personId: s.invitations.personId, createdAt: s.invitations.createdAt })
      .from(s.invitations)
      .where(
        and(eq(s.invitations.kind, 'person'), inArray(s.invitations.personId, ids), active(now)),
      );
    for (const i of invites) {
      const p = people.get(i.personId!);
      if (p && (!p.invitedAt || p.invitedAt < i.createdAt.toISOString()))
        p.invitedAt = i.createdAt.toISOString();
    }
  }

  const teamOut = await Promise.all(
    teams.map(async (t) => {
      const l = teamLinks.find((x) => x.teamId === t.id);
      const token = l?.tokenEncrypted
        ? decrypt(ctx.config.dataEncryptionKey, l.tokenEncrypted)
        : null;
      return {
        id: t.id,
        badge: t.badge,
        name: t.name,
        link:
          l && token ? { ...(await link(ctx.config, token, l.expiresAt)), uses: l.useCount } : null,
      };
    }),
  );

  return {
    teams: teamOut,
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    requests: await pendingRequests(db, actor, teams),
  };
}

async function pendingRequests(db: Db, actor: Actor, teams: TeamRow[]): Promise<JoinRequestItem[]> {
  if (teams.length === 0) return [];
  const rows = await db
    .select({ request: s.joinRequests, team: s.teams, email: s.users.email })
    .from(s.joinRequests)
    .innerJoin(s.invitations, eq(s.invitations.id, s.joinRequests.invitationId))
    .innerJoin(s.teams, eq(s.teams.id, s.invitations.teamId))
    .innerJoin(s.users, eq(s.users.id, s.joinRequests.userId))
    .where(
      and(
        eq(s.joinRequests.clubId, actor.club.id),
        eq(s.joinRequests.status, 'pending'),
        inArray(
          s.teams.id,
          teams.map((t) => t.id),
        ),
      ),
    )
    .orderBy(asc(s.joinRequests.createdAt));
  const candidates = async (first: string | null, last: string | null) => {
    if (!first || !last) return [];
    const found = await db
      .select({
        id: s.persons.id,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
        birthDate: s.persons.birthDate,
      })
      .from(s.persons)
      .where(
        and(
          eq(s.persons.clubId, actor.club.id),
          isNull(s.persons.userId),
          sql`lower(${s.persons.lastName}) = lower(${last.trim()})`,
          sql`lower(${s.persons.firstName}) = lower(${first.trim()})`,
        ),
      )
      .limit(5);
    return found.map((p) => ({
      personId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      birthDate: p.birthDate,
    }));
  };
  return Promise.all(
    rows.map(async ({ request: r, team, email }) => ({
      id: r.id,
      team: { id: team.id, badge: team.badge, name: team.name },
      relation: r.relation as 'player' | 'parent',
      name: `${r.firstName} ${r.lastName}`,
      email,
      birthDate: r.birthDate,
      child:
        r.relation === 'parent'
          ? {
              name: `${r.childFirstName ?? ''} ${r.childLastName ?? ''}`.trim(),
              birthDate: r.childBirthDate,
            }
          : null,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      matches: await candidates(r.firstName, r.lastName),
      childMatches:
        r.relation === 'parent' ? await candidates(r.childFirstName, r.childLastName) : [],
    })),
  );
}

// ── Einladungen erstellen ───────────────────────────────────────────────────

export async function invitePerson(
  db: Db,
  actor: Actor,
  ctx: Ctx,
  input: { personId: string; email?: string | null; send: boolean },
  now: Date,
): Promise<InviteLink> {
  requireInviter(actor);
  const overview = await getInviteOverview(db, actor, ctx, now);
  const person = overview.people.find((p) => p.personId === input.personId);
  // Vereinsweite Einladende dürfen jede Person ohne Zugang einladen
  const [row] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
  if (!row) throw notFound('Die Person');
  if (!person && !actorCan(actor, 'members.invite')) throw notFound('Die Person');
  if (row.userId)
    throw new HttpError(409, 'has_account', 'Diese Person hat bereits einen App-Zugang.');
  if (row.membershipStatus === 'left')
    throw new HttpError(409, 'left', 'Ausgetretene Mitglieder können nicht eingeladen werden.');
  const email = input.email?.trim().toLowerCase() || row.email;

  // Ältere Einladungen dieser Person verfallen
  await db
    .update(s.invitations)
    .set({ revokedAt: now })
    .where(and(eq(s.invitations.personId, row.id), isNull(s.invitations.revokedAt)));
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + PERSON_DAYS * DAY);
  await db.insert(s.invitations).values({
    clubId: actor.club.id,
    kind: 'person',
    tokenHash: hashToken(token),
    personId: row.id,
    email,
    createdByPersonId: actor.person.id,
    expiresAt,
    maxUses: 1,
    createdAt: now,
  });
  const result = await link(ctx.config, token, expiresAt);
  if (input.send) {
    if (!email)
      throw new HttpError(400, 'email_required', 'Für den Versand fehlt eine E-Mail-Adresse.');
    await ctx.mailer.send({
      to: email,
      subject: `Einladung in die App von ${actor.club.name}`,
      text: [
        `Hallo ${row.firstName},`,
        '',
        `${actor.person.firstName} ${actor.person.lastName} lädt dich in die Vereins-App von ${actor.club.name} ein.`,
        `Über diesen Link legst du dein Passwort fest (gültig ${PERSON_DAYS} Tage):`,
        '',
        result.url,
      ].join('\n'),
    });
  }
  return result;
}

export async function createTeamLink(
  db: Db,
  actor: Actor,
  ctx: Ctx,
  teamId: string,
  now: Date,
): Promise<InviteLink> {
  const team = (await currentTeams(db, actor)).find((t) => t.id === teamId);
  if (!team || !mayInvite(actor, team))
    throw forbidden('Für diese Mannschaft darfst du nicht einladen.');
  await revokeTeamLink(db, actor, teamId, now);
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + TEAM_DAYS * DAY);
  await db.insert(s.invitations).values({
    clubId: actor.club.id,
    kind: 'team',
    tokenHash: hashToken(token),
    tokenEncrypted: encrypt(ctx.config.dataEncryptionKey, token),
    teamId,
    createdByPersonId: actor.person.id,
    expiresAt,
    createdAt: now,
  });
  return link(ctx.config, token, expiresAt);
}

export async function revokeTeamLink(db: Db, actor: Actor, teamId: string, now: Date) {
  const team = (await currentTeams(db, actor)).find((t) => t.id === teamId);
  if (!team || !mayInvite(actor, team))
    throw forbidden('Für diese Mannschaft darfst du nicht einladen.');
  await db
    .update(s.invitations)
    .set({ revokedAt: now })
    .where(
      and(
        eq(s.invitations.teamId, teamId),
        eq(s.invitations.kind, 'team'),
        isNull(s.invitations.revokedAt),
      ),
    );
}

// ── Öffentliche Seite des Links ─────────────────────────────────────────────

async function loadInvitation(db: Db, token: string, now: Date) {
  const [row] = await db
    .select({ invitation: s.invitations, club: s.clubs, person: s.persons, team: s.teams })
    .from(s.invitations)
    .innerJoin(s.clubs, eq(s.clubs.id, s.invitations.clubId))
    .leftJoin(s.persons, eq(s.persons.id, s.invitations.personId))
    .leftJoin(s.teams, eq(s.teams.id, s.invitations.teamId))
    .where(eq(s.invitations.tokenHash, hashToken(token)));
  const i = row?.invitation;
  if (
    !row ||
    !i ||
    i.revokedAt ||
    i.expiresAt <= now ||
    (i.maxUses !== null && i.useCount >= i.maxUses)
  )
    throw new HttpError(
      410,
      'invite_invalid',
      'Diese Einladung ist abgelaufen oder wurde bereits verwendet.',
    );
  return row;
}

export async function getJoinInfo(
  db: Db,
  links: LinkSigner,
  token: string,
  now: Date,
): Promise<JoinInfo> {
  const row = await loadInvitation(db, token, now);
  return {
    kind: row.invitation.kind as 'person' | 'team',
    club: {
      name: row.club.name,
      shortName: row.club.shortName,
      colorTheme: row.club.colorTheme,
      logoUrl: resolveMediaUrl(links, row.club.logoUrl, now),
    },
    team: row.team ? { badge: row.team.badge, name: row.team.name } : null,
    person: row.person ? { firstName: row.person.firstName, email: row.invitation.email } : null,
  };
}

async function ensureEmailFree(db: Db, email: string) {
  const [taken] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (taken)
    throw new HttpError(
      409,
      'email_taken',
      'Mit dieser E-Mail-Adresse gibt es bereits ein Konto. Bitte melde dich an oder nutze „Passwort vergessen“.',
    );
}

/** Persönliche Einladung annehmen: Konto anlegen und mit der Person verknüpfen. */
export async function acceptInvite(
  db: Db,
  token: string,
  input: AcceptInviteInput,
  now: Date,
): Promise<{ userId: string }> {
  const row = await loadInvitation(db, token, now);
  if (row.invitation.kind !== 'person' || !row.person)
    throw new HttpError(400, 'wrong_kind', 'Dieser Link ist eine Mannschafts-Einladung.');
  if (row.person.userId)
    throw new HttpError(409, 'has_account', 'Für diese Person gibt es bereits ein Konto.');
  const email = input.email.trim().toLowerCase();
  await ensureEmailFree(db, email);
  checkPassword(input.password, email);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    // Einladung atomar verbrauchen (schützt vor doppeltem Einlösen)
    const [used] = await tx
      .update(s.invitations)
      .set({ useCount: sql`${s.invitations.useCount} + 1`, revokedAt: now })
      .where(and(eq(s.invitations.id, row.invitation.id), isNull(s.invitations.revokedAt)))
      .returning({ id: s.invitations.id });
    if (!used)
      throw new HttpError(410, 'invite_invalid', 'Diese Einladung wurde bereits verwendet.');
    const [user] = await tx
      .insert(s.users)
      .values({
        email,
        displayName: `${row.person!.firstName} ${row.person!.lastName}`,
        passwordHash,
        passwordChangedAt: now,
      })
      .returning({ id: s.users.id });
    await tx
      .update(s.persons)
      .set({ userId: user!.id, email: row.person!.email ?? email })
      .where(eq(s.persons.id, row.person!.id));
    await tx.insert(s.auditLog).values({
      clubId: row.club.id,
      actorUserId: user!.id,
      action: 'invite.accepted',
      entityType: 'person',
      entityId: row.person!.id,
      data: { label: `App-Zugang eingerichtet: ${row.person!.firstName} ${row.person!.lastName}` },
      createdAt: now,
    });
    return { userId: user!.id };
  });
}

/** Anfrage über einen Mannschafts-Link: Konto anlegen (noch ohne Zugang) und Freigabe anfordern. */
export async function requestJoin(
  db: Db,
  token: string,
  input: JoinRequestInput,
  now: Date,
): Promise<void> {
  const row = await loadInvitation(db, token, now);
  if (row.invitation.kind !== 'team' || !row.team)
    throw new HttpError(400, 'wrong_kind', 'Dieser Link ist eine persönliche Einladung.');
  const email = input.email.trim().toLowerCase();
  await ensureEmailFree(db, email);
  checkPassword(input.password, email);
  if (
    input.relation === 'parent' &&
    (!input.childFirstName?.trim() || !input.childLastName?.trim())
  )
    throw new HttpError(400, 'child_required', 'Bitte Vor- und Nachname des Kindes angeben.');

  const [user] = await db
    .insert(s.users)
    .values({
      email,
      displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: now,
    })
    .returning({ id: s.users.id });
  await db.insert(s.joinRequests).values({
    clubId: row.club.id,
    invitationId: row.invitation.id,
    userId: user!.id,
    relation: input.relation,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthDate: input.birthDate ?? null,
    childFirstName: input.childFirstName?.trim() || null,
    childLastName: input.childLastName?.trim() || null,
    childBirthDate: input.childBirthDate ?? null,
    message: input.message?.trim() || null,
    createdAt: now,
  });

  // Einladende der Mannschaft benachrichtigen
  const assignments = await db
    .select({
      userId: s.persons.userId,
      permissions: s.roles.permissions,
      scopeType: s.roleAssignments.scopeType,
      scopeId: s.roleAssignments.scopeId,
    })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .innerJoin(s.persons, eq(s.persons.id, s.roleAssignments.personId))
    .where(eq(s.roleAssignments.clubId, row.club.id));
  const recipients = [
    ...new Set(
      assignments
        .filter((a) => a.userId && can([a], 'members.invite', target(row.team!)))
        .map((a) => a.userId!),
    ),
  ];
  if (recipients.length) {
    await db.insert(s.notifications).values(
      recipients.map((userId) => ({
        clubId: row.club.id,
        userId,
        level: 'action' as const,
        category: 'verwaltung',
        title: `Beitrittsanfrage ${row.team!.badge}`,
        body: `${input.firstName.trim()} ${input.lastName.trim()}${input.relation === 'parent' ? ` (für ${input.childFirstName?.trim()})` : ''}`,
        link: '/admin/invites',
        createdAt: now,
      })),
    );
  }
}

// ── Freigabe ────────────────────────────────────────────────────────────────

async function loadRequest(db: Db, actor: Actor, id: string) {
  const [row] = await db
    .select({ request: s.joinRequests, team: s.teams, invitation: s.invitations, user: s.users })
    .from(s.joinRequests)
    .innerJoin(s.invitations, eq(s.invitations.id, s.joinRequests.invitationId))
    .innerJoin(s.teams, eq(s.teams.id, s.invitations.teamId))
    .innerJoin(s.users, eq(s.users.id, s.joinRequests.userId))
    .where(and(eq(s.joinRequests.id, id), eq(s.joinRequests.clubId, actor.club.id)));
  if (!row || !mayInvite(actor, row.team)) throw notFound('Die Anfrage');
  if (row.request.status !== 'pending')
    throw new HttpError(409, 'decided', 'Über diese Anfrage wurde bereits entschieden.');
  return row;
}

async function personToLink(db: Db, actor: Actor, personId: string) {
  const [p] = await db
    .select()
    .from(s.persons)
    .where(and(eq(s.persons.id, personId), eq(s.persons.clubId, actor.club.id)));
  if (!p) throw new HttpError(400, 'invalid_person', 'Unbekannte Person.');
  return p;
}

export async function approveJoin(
  db: Db,
  actor: Actor,
  ctx: Ctx,
  id: string,
  input: ApproveJoinInput,
  now: Date,
): Promise<InviteOverview> {
  const { request: r, team, user } = await loadRequest(db, actor, id);
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const existing = input.personId ? await personToLink(db, actor, input.personId) : null;
  if (existing?.userId)
    throw new HttpError(409, 'has_account', 'Diese Person hat bereits einen App-Zugang.');
  const existingChild = input.childPersonId
    ? await personToLink(db, actor, input.childPersonId)
    : null;

  await db.transaction(async (tx) => {
    const addToTeam = async (personId: string) => {
      const [already] = await tx
        .select({ id: s.teamMemberships.id })
        .from(s.teamMemberships)
        .where(
          and(
            eq(s.teamMemberships.teamId, team.id),
            eq(s.teamMemberships.personId, personId),
            isNull(s.teamMemberships.validTo),
          ),
        );
      if (already) return;
      await tx.insert(s.teamMemberships).values({
        clubId: actor.club.id,
        teamId: team.id,
        personId,
        function: 'player',
        validFrom: today,
      });
      const future = await tx
        .select({ id: s.events.id })
        .from(s.events)
        .where(
          and(
            eq(s.events.teamId, team.id),
            eq(s.events.status, 'scheduled'),
            gt(s.events.startsAt, now),
          ),
        );
      if (future.length) {
        await tx
          .insert(s.eventParticipants)
          .values(
            future.map((e) => ({
              clubId: actor.club.id,
              eventId: e.id,
              personId,
              role: 'player' as const,
              status:
                team.participationMode === 'active_response'
                  ? ('pending' as const)
                  : ('yes' as const),
            })),
          )
          .onConflictDoNothing();
      }
    };

    // Antragsteller: bestehende Person verknüpfen oder neu anlegen
    let personId: string;
    if (existing) {
      await tx
        .update(s.persons)
        .set({ userId: user.id, email: existing.email ?? user.email, membershipStatus: 'active' })
        .where(eq(s.persons.id, existing.id));
      personId = existing.id;
    } else {
      const [created] = await tx
        .insert(s.persons)
        .values({
          clubId: actor.club.id,
          userId: user.id,
          firstName: r.firstName,
          lastName: r.lastName,
          birthDate: r.birthDate,
          email: user.email,
          memberSince: today,
        })
        .returning({ id: s.persons.id });
      personId = created!.id;
    }

    if (r.relation === 'player') {
      await addToTeam(personId);
    } else {
      let childId: string;
      if (existingChild) {
        childId = existingChild.id;
      } else {
        const [child] = await tx
          .insert(s.persons)
          .values({
            clubId: actor.club.id,
            firstName: r.childFirstName!,
            lastName: r.childLastName!,
            birthDate: r.childBirthDate,
            memberSince: today,
          })
          .returning({ id: s.persons.id });
        childId = child!.id;
      }
      await tx
        .insert(s.guardianships)
        .values({
          clubId: actor.club.id,
          guardianPersonId: personId,
          childPersonId: childId,
          createdAt: now,
        })
        .onConflictDoNothing();
      await addToTeam(childId);
    }

    await tx
      .update(s.joinRequests)
      .set({ status: 'approved', decidedByPersonId: actor.person.id, decidedAt: now })
      .where(eq(s.joinRequests.id, r.id));
    await tx
      .update(s.invitations)
      .set({ useCount: sql`${s.invitations.useCount} + 1` })
      .where(eq(s.invitations.id, r.invitationId));
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'join.approved',
      entityType: 'person',
      entityId: personId,
      data: { label: `Beitritt freigegeben: ${r.firstName} ${r.lastName} → ${team.badge}` },
      createdAt: now,
    });
  });

  await ctx.mailer.send({
    to: user.email,
    subject: `Willkommen bei ${actor.club.name}`,
    text: `Hallo ${r.firstName},\n\ndeine Anfrage für ${team.name} wurde freigegeben. Du kannst dich jetzt in der App anmelden:\n\n${ctx.config.appUrl}`,
  });
  return getInviteOverview(db, actor, ctx, now);
}

export async function rejectJoin(
  db: Db,
  actor: Actor,
  ctx: Ctx,
  id: string,
  note: string | null,
  now: Date,
): Promise<InviteOverview> {
  const { request: r, team, user } = await loadRequest(db, actor, id);
  await db
    .update(s.joinRequests)
    .set({
      status: 'rejected',
      decidedByPersonId: actor.person.id,
      decidedAt: now,
      decisionNote: note,
    })
    .where(eq(s.joinRequests.id, r.id));
  await ctx.mailer.send({
    to: user.email,
    subject: `Deine Anfrage bei ${actor.club.name}`,
    text: `Hallo ${r.firstName},\n\ndeine Anfrage für ${team.name} wurde leider nicht freigegeben.${note ? `\n\nHinweis: ${note}` : ''}`,
  });
  return getInviteOverview(db, actor, ctx, now);
}

/** Status für Konten ohne Vereinszuordnung (beim Login) */
export async function pendingRequestState(db: Db, userId: string) {
  const [row] = await db
    .select({ status: s.joinRequests.status })
    .from(s.joinRequests)
    .where(eq(s.joinRequests.userId, userId))
    .orderBy(desc(s.joinRequests.createdAt))
    .limit(1);
  return row?.status ?? null;
}
