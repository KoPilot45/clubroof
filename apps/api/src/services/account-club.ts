/**
 * Konten ohne Verein und Aufnahme per Code/QR: Das Konto zeigt einen kurzlebigen Code, ein Admin oder
 * Trainer gibt ihn ein (oder scannt den QR-Code) und nimmt das Konto in Verein und Mannschaft auf.
 */
import type {
  AccountInfo,
  AccountLinkCode,
  AccountLinkPreview,
  AttachAccountInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gt, gte, isNull, ne } from 'drizzle-orm';
import QRCode from 'qrcode';
import { calendarDayOf, scopesWith, toIsoDate } from '@clubroof/core';
import { actorCan, type Actor } from '../actor';
import { hashToken } from '../auth/session';
import { HttpError, forbidden, notFound } from '../errors';
import type { Mailer } from '../security/mailer';
import { generateCode, normalizeCode } from './codes';
import { canInvite } from './invitations';

const PURPOSE = 'account_link';
const LINK_MINUTES = 15;
const QR_PREFIX = 'clubroof-konto:';

export async function accountInfo(db: Db, userId: string): Promise<AccountInfo> {
  const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));
  if (!user) throw notFound('Das Konto');
  const requests = await db
    .select({ clubName: s.clubs.name, status: s.joinRequests.status, at: s.joinRequests.createdAt })
    .from(s.joinRequests)
    .innerJoin(s.clubs, eq(s.clubs.id, s.joinRequests.clubId))
    .where(and(eq(s.joinRequests.userId, userId), ne(s.joinRequests.status, 'approved')))
    .orderBy(desc(s.joinRequests.createdAt));
  const [op] = await db
    .select({ active: s.operators.active })
    .from(s.operators)
    .where(eq(s.operators.userId, userId));
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName },
    requests: requests.map((r) => ({
      clubName: r.clubName,
      status: r.status === 'rejected' ? 'rejected' : 'pending',
    })),
    isOperator: op?.active === true,
  };
}

const linkHash = (code: string) => hashToken(`account-link:${normalizeCode(code)}`);

/** Neuen Aufnahme-Code für das Konto erzeugen; frühere Codes verfallen. */
export async function createAccountLinkCode(
  db: Db,
  userId: string,
  now: Date,
): Promise<AccountLinkCode> {
  await db
    .update(s.authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(s.authTokens.userId, userId),
        eq(s.authTokens.purpose, PURPOSE),
        isNull(s.authTokens.usedAt),
      ),
    );
  const code = generateCode(8);
  const expiresAt = new Date(now.getTime() + LINK_MINUTES * 60_000);
  await db.insert(s.authTokens).values({
    userId,
    purpose: PURPOSE,
    tokenHash: linkHash(code),
    expiresAt,
    createdAt: now,
  });
  return {
    code,
    qrSvg: await QRCode.toString(`${QR_PREFIX}${code}`, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    }),
    expiresAt: expiresAt.toISOString(),
  };
}

function requireAdder(actor: Actor) {
  if (!canInvite(actor) && !actorCan(actor, 'members.manage'))
    throw forbidden('Aufnehmen dürfen Trainerteams und die Mitgliederverwaltung.');
}

async function findLink(db: Db, code: string, now: Date) {
  const [row] = await db
    .select({ token: s.authTokens, user: s.users })
    .from(s.authTokens)
    .innerJoin(s.users, eq(s.users.id, s.authTokens.userId))
    .where(
      and(
        eq(s.authTokens.tokenHash, linkHash(code.replace(QR_PREFIX, ''))),
        eq(s.authTokens.purpose, PURPOSE),
        isNull(s.authTokens.usedAt),
        gt(s.authTokens.expiresAt, now),
      ),
    );
  if (!row) throw new HttpError(410, 'code_invalid', 'Der Code ist abgelaufen oder ungültig.');
  return row;
}

/** Name und E-Mail zum Code, damit der Aufnehmende die Person erkennt (und die Namensfelder vorbelegt). */
export async function previewAccountLink(
  db: Db,
  actor: Actor,
  code: string,
  now: Date,
): Promise<AccountLinkPreview> {
  requireAdder(actor);
  const { user } = await findLink(db, code, now);
  return { displayName: user.displayName, email: user.email };
}

/** Konto in den Verein des Aufnehmenden aufnehmen (neue Person, optional direkt in eine Mannschaft). */
export async function attachAccount(
  db: Db,
  actor: Actor,
  mailer: Mailer,
  input: AttachAccountInput,
  now: Date,
): Promise<{ personId: string }> {
  requireAdder(actor);
  const { token, user } = await findLink(db, input.code, now);
  const [member] = await db
    .select({ id: s.persons.id })
    .from(s.persons)
    .where(
      and(
        eq(s.persons.userId, user.id),
        eq(s.persons.clubId, actor.club.id),
        ne(s.persons.membershipStatus, 'left'),
      ),
    );
  if (member)
    throw new HttpError(
      409,
      'already_member',
      'Dieses Konto ist in eurem Verein bereits Mitglied.',
    );
  let team: typeof s.teams.$inferSelect | null = null;
  if (input.teamId) {
    const [row] = await db
      .select({ team: s.teams })
      .from(s.teams)
      .where(and(eq(s.teams.id, input.teamId), eq(s.teams.clubId, actor.club.id)));
    if (!row) throw notFound('Die Mannschaft');
    // Nur Mannschaften, für die die handelnde Person auch sonst einladen darf
    if (!actorCan(actor, 'members.invite', row.team))
      throw forbidden('Für diese Mannschaft darfst du nicht aufnehmen.');
    team = row.team;
  } else if (
    !scopesWith(actor.grants, 'members.invite').all &&
    !actorCan(actor, 'members.manage')
  ) {
    // Wer nur für Mannschaften einladen darf, nimmt auch nur in eine Mannschaft auf
    throw new HttpError(400, 'team_required', 'Bitte wähle eine Mannschaft.');
  }
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const personId = await db.transaction(async (tx) => {
    const [used] = await tx
      .update(s.authTokens)
      .set({ usedAt: now })
      .where(and(eq(s.authTokens.id, token.id), isNull(s.authTokens.usedAt)))
      .returning({ id: s.authTokens.id });
    if (!used) throw new HttpError(410, 'code_invalid', 'Der Code ist abgelaufen oder ungültig.');
    const [person] = await tx
      .insert(s.persons)
      .values({
        clubId: actor.club.id,
        userId: user.id,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        birthDate: input.birthDate ?? null,
        email: user.email,
        memberSince: today,
      })
      .returning({ id: s.persons.id });
    if (team) {
      await tx.insert(s.teamMemberships).values({
        clubId: actor.club.id,
        teamId: team.id,
        personId: person!.id,
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
            gte(s.events.startsAt, now),
          ),
        );
      if (future.length)
        await tx
          .insert(s.eventParticipants)
          .values(
            future.map((e) => ({
              clubId: actor.club.id,
              eventId: e.id,
              personId: person!.id,
              role: 'player' as const,
              status:
                team!.participationMode === 'active_response'
                  ? ('pending' as const)
                  : ('yes' as const),
            })),
          )
          .onConflictDoNothing();
    }
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'account.attached',
      entityType: 'person',
      entityId: person!.id,
      data: {
        label: `Konto aufgenommen: ${input.firstName.trim()} ${input.lastName.trim()}${team ? ` → ${team.badge}` : ''}`,
      },
      createdAt: now,
    });
    return person!.id;
  });
  await mailer.send({
    to: user.email,
    subject: `Willkommen bei ${actor.club.name}`,
    text: `Hallo ${input.firstName.trim()},\n\n${actor.club.name} hat dich in die Vereins-App aufgenommen. Melde dich einfach neu an.`,
  });
  return { personId };
}
