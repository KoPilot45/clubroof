/**
 * Eigener Zugang für Kinder (Paket KIND-EIGENER-ZUGANG).
 *
 * Ein Kind bleibt dieselbe Person; die Eltern legen ihm einen eigenen Zugang an (persönliche
 * Einladung, das Konto wird an die bestehende Person gehängt). Die Stufe des Elternzugangs
 * (`guardianships.access`) gilt je Kind für alle Eltern:
 *   manage = Mitsicht und Mitentscheiden · view = nur Mitsicht · none = eigenständig.
 * Eltern senken jederzeit; Erhöhen braucht die Zustimmung des Kindes (Anfrage, sobald es ein Konto
 * hat). Das Kind setzt jede Stufe selbst. Jede Änderung steht im Audit-Log.
 */
import {
  guardianAccessChange,
  isGuardianAccess,
  type ChildAccessInfo,
  type GuardianAccess,
  type InviteLink,
  type MyGuardianAccess,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gt, inArray, isNull, isNotNull } from 'drizzle-orm';
import QRCode from 'qrcode';
import type { Actor } from '../actor';
import { generateToken, hashToken } from '../auth/session';
import type { Config } from '../config';
import { HttpError, notFound } from '../errors';
import { deliver } from '../notify/deliver';
import type { Mailer } from '../security/mailer';

type Ctx = { config: Config; mailer: Mailer };
const DAY = 86_400_000;
const INVITE_DAYS = 14;

const level = (v: string): GuardianAccess => (isGuardianAccess(v) ? v : 'manage');

/** Verknüpfung der handelnden Eltern zum Kind (Stufe 3 eingeschlossen) – sonst „nicht gefunden“. */
async function ownChild(db: Db, actor: Actor, childId: string) {
  const [row] = await db
    .select({ g: s.guardianships, child: s.persons })
    .from(s.guardianships)
    .innerJoin(s.persons, eq(s.persons.id, s.guardianships.childPersonId))
    .where(
      and(
        eq(s.guardianships.guardianPersonId, actor.person.id),
        eq(s.guardianships.childPersonId, childId),
        eq(s.guardianships.clubId, actor.club.id),
      ),
    );
  if (!row) throw notFound('Das Kind');
  return row;
}

async function audit(
  db: Db,
  actor: Actor,
  action: string,
  childId: string,
  label: string,
  now: Date,
) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action,
    entityType: 'person',
    entityId: childId,
    data: { label },
    createdAt: now,
  });
}

const openInvite = (childId: string, now: Date) =>
  and(
    eq(s.invitations.personId, childId),
    eq(s.invitations.kind, 'person'),
    isNotNull(s.invitations.guardianAccess),
    isNull(s.invitations.revokedAt),
    gt(s.invitations.expiresAt, now),
  );

const levelName: Record<GuardianAccess, string> = {
  manage: 'Mitsicht und Mitentscheiden',
  view: 'nur Mitsicht',
  none: 'eigenständig',
};

// ── Eltern ──────────────────────────────────────────────────────────────────

export async function getChildAccess(
  db: Db,
  actor: Actor,
  childId: string,
  now: Date,
): Promise<ChildAccessInfo> {
  const { g, child } = await ownChild(db, actor, childId);
  const [invite] = await db
    .select()
    .from(s.invitations)
    .where(openInvite(childId, now))
    .orderBy(desc(s.invitations.createdAt))
    .limit(1);
  return {
    childId,
    name: `${child.firstName} ${child.lastName}`,
    account: child.userId ? 'active' : invite ? 'invited' : 'none',
    access: level(g.access),
    requestedAccess: g.requestedAccess ? level(g.requestedAccess) : null,
    invitedAccess: !child.userId && invite?.guardianAccess ? level(invite.guardianAccess) : null,
    invitedEmail: !child.userId ? (invite?.email ?? null) : null,
    changedAt: g.accessChangedAt?.toISOString() ?? null,
  };
}

/** Eigener Zugang: Einladung für das Kind mit gewählter Stufe (nur Kinder ohne Konto). */
export async function inviteChild(
  db: Db,
  actor: Actor,
  ctx: Ctx,
  childId: string,
  input: { email: string; access: GuardianAccess; send: boolean },
  now: Date,
): Promise<InviteLink> {
  const { child } = await ownChild(db, actor, childId);
  if (child.userId)
    throw new HttpError(409, 'has_account', 'Dieses Kind hat bereits einen eigenen Zugang.');
  if (child.membershipStatus === 'left')
    throw new HttpError(409, 'left', 'Ausgetretene Mitglieder können nicht eingeladen werden.');
  const email = input.email.trim().toLowerCase();
  // Das Konto bleibt getrennt: keine Adresse eines bestehenden Kontos (auch nicht die der Eltern)
  const [taken] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (taken)
    throw new HttpError(
      409,
      'email_taken',
      'Mit dieser E-Mail-Adresse gibt es bereits ein Konto. Das Kind braucht eine eigene Adresse.',
    );

  await db
    .update(s.invitations)
    .set({ revokedAt: now })
    .where(and(eq(s.invitations.personId, childId), isNull(s.invitations.revokedAt)));
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * DAY);
  await db.insert(s.invitations).values({
    clubId: actor.club.id,
    kind: 'person',
    tokenHash: hashToken(token),
    personId: childId,
    email,
    guardianAccess: input.access,
    createdByPersonId: actor.person.id,
    expiresAt,
    maxUses: 1,
    createdAt: now,
  });
  const url = `${ctx.config.appUrl}/join/${token}`;
  if (input.send) {
    await ctx.mailer.send({
      to: email,
      subject: `Einladung in die App von ${actor.club.name}`,
      text: [
        `Hallo ${child.firstName},`,
        '',
        `${actor.person.firstName} ${actor.person.lastName} richtet dir einen eigenen Zugang zur Vereins-App von ${actor.club.name} ein.`,
        `Über diesen Link legst du dein Passwort fest (gültig ${INVITE_DAYS} Tage):`,
        '',
        url,
      ].join('\n'),
    });
  }
  await audit(
    db,
    actor,
    'child_access.invited',
    childId,
    `Eigener Zugang eingerichtet: ${child.firstName} ${child.lastName} (${levelName[input.access]})`,
    now,
  );
  return {
    url,
    code: null,
    qrSvg: await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Offene Einladung widerrufen (Zugang sperren, solange das Kind sie nicht angenommen hat). */
export async function revokeChildInvite(db: Db, actor: Actor, childId: string, now: Date) {
  const { child } = await ownChild(db, actor, childId);
  const revoked = await db
    .update(s.invitations)
    .set({ revokedAt: now })
    .where(openInvite(childId, now))
    .returning({ id: s.invitations.id });
  if (revoked.length === 0)
    throw new HttpError(
      409,
      'no_invitation',
      child.userId
        ? 'Das Kind hat die Einladung angenommen. Das Konto gehört dem Kind; du kannst deine Stufe ändern.'
        : 'Es gibt keine offene Einladung.',
    );
  await audit(
    db,
    actor,
    'child_access.revoked',
    childId,
    `Einladung widerrufen: ${child.firstName} ${child.lastName}`,
    now,
  );
}

/** Stufe ändern. Senken gilt sofort; Erhöhen wird bei Kindern mit Konto zur Anfrage. */
export async function setChildAccess(
  db: Db,
  actor: Actor,
  childId: string,
  access: GuardianAccess,
  now: Date,
): Promise<ChildAccessInfo> {
  const { g, child } = await ownChild(db, actor, childId);
  const current = level(g.access);
  const decision = guardianAccessChange(current, access, 'guardian', !!child.userId);
  const where = and(
    eq(s.guardianships.childPersonId, childId),
    eq(s.guardianships.clubId, actor.club.id),
  );
  const who = `${child.firstName} ${child.lastName}`;
  if (decision === 'apply') {
    await db
      .update(s.guardianships)
      .set({ access, accessChangedAt: now, requestedAccess: null, requestedAt: null })
      .where(where);
    await audit(
      db,
      actor,
      'child_access.changed',
      childId,
      `Elternzugang geändert: ${who} (${levelName[current]} → ${levelName[access]})`,
      now,
    );
  } else if (decision === 'consent') {
    await db
      .update(s.guardianships)
      .set({ requestedAccess: access, requestedAt: now })
      .where(where);
    await audit(
      db,
      actor,
      'child_access.requested',
      childId,
      `Höhere Stufe angefragt: ${who} (${levelName[access]})`,
      now,
    );
    await deliver(
      db,
      actor.club,
      child.userId ? [child.userId] : [],
      {
        level: 'important',
        topic: 'admin',
        title: 'Deine Eltern fragen um Mitsicht',
        body: `${actor.person.firstName} möchte wieder mitsehen (${levelName[access]}). Du entscheidest unter „Ich“.`,
        link: '/mehr',
      },
      now,
    );
  }
  return getChildAccess(db, actor, childId, now);
}

// ── Kind ────────────────────────────────────────────────────────────────────

export async function getMyGuardianAccess(db: Db, actor: Actor): Promise<MyGuardianAccess> {
  const rows = await db
    .select({ g: s.guardianships, guardian: s.persons })
    .from(s.guardianships)
    .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
    .where(eq(s.guardianships.childPersonId, actor.person.id));
  return {
    guardians: rows.map(({ g, guardian }) => ({
      guardianPersonId: guardian.id,
      name: `${guardian.firstName} ${guardian.lastName}`,
      access: level(g.access),
      requestedAccess: g.requestedAccess ? level(g.requestedAccess) : null,
      changedAt: g.accessChangedAt?.toISOString() ?? null,
    })),
  };
}

async function childRows(db: Db, actor: Actor) {
  const rows = await db
    .select()
    .from(s.guardianships)
    .where(eq(s.guardianships.childPersonId, actor.person.id));
  if (rows.length === 0) throw notFound('Der Elternzugang');
  return rows;
}

async function notifyGuardians(
  db: Db,
  actor: Actor,
  guardianIds: string[],
  title: string,
  now: Date,
) {
  const users = guardianIds.length
    ? await db
        .select({ userId: s.persons.userId })
        .from(s.persons)
        .where(and(inArray(s.persons.id, guardianIds), isNotNull(s.persons.userId)))
    : [];
  await deliver(
    db,
    actor.club,
    users.map((u) => u.userId!),
    { level: 'important', topic: 'admin', title, link: '/mehr' },
    now,
  );
}

/** Das Kind setzt die Stufe selbst (senken, beenden – und auch wieder erhöhen). */
export async function setMyGuardianAccess(
  db: Db,
  actor: Actor,
  access: GuardianAccess,
  now: Date,
): Promise<MyGuardianAccess> {
  const rows = await childRows(db, actor);
  const current = level(rows[0]!.access);
  if (guardianAccessChange(current, access, 'child', true) === 'apply') {
    await db
      .update(s.guardianships)
      .set({ access, accessChangedAt: now, requestedAccess: null, requestedAt: null })
      .where(eq(s.guardianships.childPersonId, actor.person.id));
    await audit(
      db,
      actor,
      'child_access.changed',
      actor.person.id,
      `Elternzugang vom Kind geändert: ${actor.person.firstName} ${actor.person.lastName} (${levelName[current]} → ${levelName[access]})`,
      now,
    );
    await notifyGuardians(
      db,
      actor,
      rows.map((r) => r.guardianPersonId),
      `${actor.person.firstName} hat die Mitsicht geändert: ${levelName[access]}`,
      now,
    );
  }
  return getMyGuardianAccess(db, actor);
}

/** Das Kind beantwortet die Anfrage der Eltern nach einer höheren Stufe. */
export async function answerGuardianRequest(
  db: Db,
  actor: Actor,
  approve: boolean,
  now: Date,
): Promise<MyGuardianAccess> {
  const rows = await childRows(db, actor);
  const requested = rows[0]!.requestedAccess;
  if (!requested || !isGuardianAccess(requested))
    throw new HttpError(409, 'no_request', 'Es gibt keine offene Anfrage.');
  const who = `${actor.person.firstName} ${actor.person.lastName}`;
  await db
    .update(s.guardianships)
    .set(
      approve
        ? { access: requested, accessChangedAt: now, requestedAccess: null, requestedAt: null }
        : { requestedAccess: null, requestedAt: null },
    )
    .where(eq(s.guardianships.childPersonId, actor.person.id));
  await audit(
    db,
    actor,
    approve ? 'child_access.consented' : 'child_access.declined',
    actor.person.id,
    `${approve ? 'Zugestimmt' : 'Abgelehnt'}: ${who} (${levelName[requested]})`,
    now,
  );
  await notifyGuardians(
    db,
    actor,
    rows.map((r) => r.guardianPersonId),
    `${actor.person.firstName} hat ${approve ? 'zugestimmt' : 'abgelehnt'}: ${levelName[requested]}`,
    now,
  );
  return getMyGuardianAccess(db, actor);
}
