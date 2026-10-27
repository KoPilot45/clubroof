import {
  MODULES,
  effectiveClubCode,
  scopesWith,
  isLocale,
  type AccountClub,
  type ColorMode,
  type Locale,
  type MeResponse,
  type MyTeam,
  type TeamFunction,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, count, eq, inArray, isNull, notInArray } from 'drizzle-orm';
import { actorCan, isAdminActor, loadActor, moduleEnabled, type Actor } from '../actor';
import { forbidden } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { loadScopeContext, targetsWith } from './scopes';
import { adminPermissions } from './admin';
import { newsPermissions } from './editorial';
import { clubCashLevel } from './club-cash';
import { canInvite } from './invitations';
import { areaAccess } from './area-overview';
import { twoFactorMissing } from './two-factor';

/** Vereine des Kontos für die Vereinsauswahl; leer bei Konten mit nur einem Verein. */
export async function accountClubs(db: Db, actor: Actor): Promise<AccountClub[]> {
  const rows = await db
    .select({ club: s.clubs })
    .from(s.persons)
    .innerJoin(s.clubs, eq(s.clubs.id, s.persons.clubId))
    .where(
      and(
        eq(s.persons.userId, actor.user.id),
        notInArray(s.persons.membershipStatus, ['left']),
        notInArray(s.clubs.status, ['suspended', 'archived']),
      ),
    )
    .orderBy(s.clubs.name);
  if (rows.length < 2) return [];
  const unread = await db
    .select({ clubId: s.notifications.clubId, n: count() })
    .from(s.notifications)
    .where(and(eq(s.notifications.userId, actor.user.id), isNull(s.notifications.readAt)))
    .groupBy(s.notifications.clubId);
  return rows.map(({ club }) => ({
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    shortCode: effectiveClubCode(club.shortCode, club.shortName),
    logoUrl: resolveMediaUrl(actor.links, club.logoUrl),
    colorTheme: club.colorTheme,
    active: club.id === actor.club.id,
    // Nur die Zahl, nie der Inhalt anderer Vereine
    unread:
      club.id === actor.club.id ? 0 : Number(unread.find((u) => u.clubId === club.id)?.n ?? 0),
  }));
}

export async function buildMe(db: Db, actor: Actor): Promise<MeResponse> {
  const ctx = await loadScopeContext(db, actor);
  const [userRow] = await db
    .select({
      colorMode: s.users.colorMode,
      language: s.users.language,
      quickLinks: s.users.quickLinks,
      clubTiles: s.users.clubTiles,
    })
    .from(s.users)
    .where(eq(s.users.id, actor.user.id));
  const colorMode: ColorMode =
    userRow?.colorMode === 'dark' || userRow?.colorMode === 'system' ? userRow.colorMode : 'light';
  const language: Locale | null = isLocale(userRow?.language) ? userRow.language : null;
  const refereeModule = moduleEnabled(actor, 'referees');
  const isReferee =
    refereeModule &&
    (
      await db
        .select({ id: s.referees.personId })
        .from(s.referees)
        .where(and(inArray(s.referees.personId, actor.managedIds), eq(s.referees.active, true)))
        .limit(1)
    ).length > 0;
  const teams = new Map<string, MyTeam>();
  for (const m of actor.memberships) {
    const key = `${m.teamId}:${m.personId}`;
    const existing = teams.get(key);
    if (existing) {
      if (!existing.functions.includes(m.function)) existing.functions.push(m.function);
      continue;
    }
    teams.set(key, {
      id: m.team.id,
      name: m.team.name,
      badge: m.team.badge,
      ageGroup: m.team.ageGroup,
      league: m.team.league,
      participationMode: m.team.participationMode,
      personId: m.personId,
      functions: [m.function as TeamFunction],
      modules: MODULES.filter((mod) => moduleEnabled(actor, mod.key, m.team)).map((mod) => mod.key),
    });
  }

  return {
    user: {
      id: actor.user.id,
      email: actor.user.email,
      displayName: actor.user.displayName,
      colorMode,
      language,
      quickLinks: userRow?.quickLinks ?? null,
      clubTiles: userRow?.clubTiles ?? null,
    },
    person: {
      id: actor.person.id,
      firstName: actor.person.firstName,
      lastName: actor.person.lastName,
      avatarUrl: resolveMediaUrl(actor.links, actor.person.avatarUrl),
    },
    club: {
      id: actor.club.id,
      name: actor.club.name,
      shortName: actor.club.shortName,
      shortCode: effectiveClubCode(actor.club.shortCode, actor.club.shortName),
      logoUrl: resolveMediaUrl(actor.links, actor.club.logoUrl),
      colorTheme: actor.club.colorTheme,
      colorMode: actor.club.colorMode,
      timezone: actor.club.timezone,
    },
    clubs: await accountClubs(db, actor),
    managedPersons: actor.managed.map((m) => ({
      ...m,
      avatarUrl: resolveMediaUrl(actor.links, m.avatarUrl),
    })),
    teams: [...teams.values()],
    roles: actor.grants.map((g) => ({
      key: g.key,
      name: g.name,
      scopeType: g.scopeType,
      scopeId: g.scopeId,
    })),
    canAdminister: isAdminActor(actor),
    areaOverview: await areaAccess(db, actor),
    admin: adminPermissions(actor),
    news: newsPermissions(actor),
    clubCash: (() => {
      const level = clubCashLevel(actor);
      return level !== 'none' && moduleEnabled(actor, 'club_cash')
        ? {
            level,
            manage:
              actorCan(actor, 'clubcash.manage') ||
              scopesWith(actor.grants, 'clubcash.manage').orgUnitIds.length > 0,
            viewer: (() => {
              const read = scopesWith(actor.grants, 'clubcash.read');
              return read.all || read.orgUnitIds.length > 0
                ? ('treasury' as const)
                : ('board' as const);
            })(),
          }
        : null;
    })(),
    create: {
      polls: targetsWith(actor, ctx, 'polls.manage'),
      documents: targetsWith(actor, ctx, 'documents.manage'),
    },
    canManageClub: actorCan(actor, 'club.settings.manage'),
    canInvite: canInvite(actor),
    security: {
      twoFactorEnabled: actor.user.twoFactorEnabled === true,
      twoFactorRequired: twoFactorMissing(actor),
    },
    referees: {
      manage: refereeModule && actorCan(actor, 'referees.manage'),
      active: isReferee,
    },
    equipment: { manage: actorCan(actor, 'facilities.manage') },
    clubModules: MODULES.filter((mod) => moduleEnabled(actor, mod.key)).map((mod) => mod.key),
  };
}

/** Persönliche Einstellungen: Darstellung (hell, dunkel oder wie das Gerät) und Sprache. */
export async function setPreferences(
  db: Db,
  actor: Actor,
  input: {
    colorMode?: ColorMode;
    language?: Locale | null;
    quickLinks?: string[] | null;
    clubTiles?: { order: string[]; hidden: string[] } | null;
  },
): Promise<MeResponse> {
  const patch: {
    colorMode?: ColorMode;
    language?: Locale | null;
    quickLinks?: string[] | null;
    clubTiles?: { order: string[]; hidden: string[] } | null;
  } = {};
  if (input.colorMode !== undefined) patch.colorMode = input.colorMode;
  if (input.language !== undefined) patch.language = input.language;
  if (input.quickLinks !== undefined) patch.quickLinks = input.quickLinks;
  if (input.clubTiles !== undefined) patch.clubTiles = input.clubTiles;
  if (Object.keys(patch).length)
    await db.update(s.users).set(patch).where(eq(s.users.id, actor.user.id));
  return buildMe(db, actor);
}

/** Bereich als angesehen merken (für „neu seit dem letzten Besuch“). */
export async function markSeen(db: Db, actor: Actor, key: string, now: Date): Promise<void> {
  await db
    .insert(s.userSeen)
    .values({ userId: actor.user.id, clubId: actor.club.id, key, seenAt: now })
    .onConflictDoUpdate({
      target: [s.userSeen.userId, s.userSeen.clubId, s.userSeen.key],
      set: { seenAt: now },
    });
}

/** Aktiven Verein der Sitzung wechseln. Nur Vereine, in denen das Konto eine aktive Person hat. */
export async function switchClub(
  db: Db,
  actor: Actor,
  clubId: string,
  now: Date,
  links: Actor['links'],
): Promise<MeResponse> {
  const target = await loadActor(db, actor.user, now, links, clubId).catch(() => null);
  if (!target || target.club.id !== clubId)
    throw forbidden('In diesem Verein hast du keinen Zugang.');
  await db
    .update(s.sessions)
    .set({ activeClubId: clubId })
    .where(eq(s.sessions.id, actor.user.sessionId));
  await db.update(s.users).set({ lastClubId: clubId }).where(eq(s.users.id, actor.user.id));
  return buildMe(db, target);
}
