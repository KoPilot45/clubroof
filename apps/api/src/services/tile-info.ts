/**
 * Hinweise in den Menükacheln („Du hast 12,50 € offen“, „2 zur Freigabe“).
 * Ein Aufruf je Menü; Rechte werden von den bestehenden Diensten geprüft, was die Person nicht sehen darf,
 * erscheint nicht. Texte sind deutsch formuliert und werden in der Sprache der Person ausgeliefert.
 */
import {
  DEFAULT_LOCALE,
  intlLocale,
  isLocale,
  translate,
  type Locale,
  type TileHub,
  type TileInfo,
  type TileInfoEntry,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, count, eq, gt, ne } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import type { Config } from '../config';
import type { Mailer } from '../security/mailer';
import { getTeamCash } from './cash';
import { getAdminOverview } from './admin';
import { scopeVisible } from './home';
import { getEditorialOverview, newsPermissions } from './editorial';
import { listHelperEvents } from './helpers';
import { canInvite, getInviteOverview } from './invitations';
import { getModuleOverview } from './modules';
import { listTasks } from './tasks';
import { getTeamOverview } from './teams';
import { twoFactorMissing } from './two-factor';

const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

async function localeOf(db: Db, actor: Actor): Promise<Locale> {
  const [row] = await db
    .select({ language: s.users.language })
    .from(s.users)
    .where(eq(s.users.id, actor.user.id));
  return isLocale(row?.language) ? row.language : DEFAULT_LOCALE;
}

export async function getTileInfo(
  db: Db,
  actor: Actor,
  hub: TileHub,
  teamId: string | null,
  now: Date,
  ctx: { config: Config; mailer: Mailer },
): Promise<TileInfo> {
  const locale = await localeOf(db, actor);
  const intl = intlLocale(locale);
  const tz = actor.club.timezone;
  const euro = (cents: number) =>
    new Intl.NumberFormat(intl, { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(intl, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
  const day = (iso: string) =>
    new Intl.DateTimeFormat(intl, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
  const info: TileInfo = {};
  const put = (key: string, entry: TileInfoEntry) => {
    const hint = entry.hint ? translate(entry.hint, locale) : undefined;
    if (hint || entry.badge) info[key] = { ...entry, hint };
  };
  const today = now.toISOString().slice(0, 10);
  // „Neu seit dem letzten Besuch“: ohne Merker gelten die letzten 7 Tage als neu
  const seenRows = await db.select().from(s.userSeen).where(eq(s.userSeen.userId, actor.user.id));
  const seen = new Map(seenRows.map((r) => [r.key, r.seenAt]));
  const since = (key: string) => seen.get(key) ?? new Date(now.getTime() - 7 * 24 * 3600_000);
  const putNew = (tile: string, n: number) => {
    if (n > 0) put(tile, { hint: `${n} neu`, tone: 'info' });
  };
  const total = async (query: PromiseLike<{ n: number }[]>) => (await query)[0]?.n ?? 0;

  let canManageTeamEvents = false;
  if (hub === 'team' && teamId) {
    const [overview, cash, tasks] = await Promise.all([
      safe(() => getTeamOverview(db, actor, teamId, now)),
      actor.teamIds.includes(teamId) || actorCan(actor, 'cash.manage')
        ? safe(() => getTeamCash(db, actor, teamId, now))
        : Promise.resolve(null),
      safe(() => listTasks(db, actor, teamId, now)),
    ]);
    canManageTeamEvents = !!overview?.permissions.manageEvents;
    const next = overview?.nextEvent;
    if (next) {
      const missing = next.myResponses.some((r) => r.canRespond && r.status === 'pending');
      if (missing) put('events', { hint: `Antwort fehlt: ${when(next.startsAt)}`, tone: 'action' });
      else if (overview.permissions.manageEvents)
        put('events', {
          hint: `${next.counts.yes} von ${overview.squad?.players ?? next.counts.yes} zugesagt`,
          tone: 'info',
        });
      else put('events', { hint: `Nächster: ${when(next.startsAt)}`, tone: 'neutral' });
    }
    if (overview?.squad) {
      const parts = [
        `${overview.squad.players} Spieler`,
        overview.squad.absent ? `${overview.squad.absent} nicht verfügbar` : null,
      ];
      put('roster', { hint: parts.filter(Boolean).join(' · '), tone: 'neutral' });
    }
    const h = overview?.highlights;
    if (h && h.played > 0)
      put('stats', { hint: `Bilanz ${h.won}-${h.drawn}-${h.lost}`, tone: 'neutral' });
    if (cash) {
      const net = cash.personal.reduce((sum, p) => sum + p.balanceCents, 0);
      if (cash.permissions.manageCash && cash.balanceCents !== null) {
        const pending = cash.paymentNotices.filter((n) => n.status === 'pending').length;
        const parts = [`Kasse ${euro(cash.balanceCents)}`, pending ? `${pending} Meldungen` : null];
        put('cash', {
          hint: parts.filter(Boolean).join(' · '),
          tone: pending ? 'action' : 'neutral',
        });
      } else if (cash.personal.length) {
        if (net < 0) put('cash', { hint: `Du hast ${euro(-net)} offen`, tone: 'action' });
        else if (net > 0) put('cash', { hint: `Du hast ${euro(net)} Guthaben`, tone: 'success' });
        else put('cash', { hint: 'Ausgeglichen', tone: 'success' });
      }
      if (cash.fineCatalog.length) put('fines', { hint: `${cash.fineCatalog.length} Strafen` });
    }
    if (tasks) {
      const mine = new Set(actor.managedIds);
      const myOpen = tasks.open.filter((t) => t.assignee && mine.has(t.assignee.personId)).length;
      const overdue = tasks.open.filter((t) => t.dueOn && t.dueOn < today).length;
      if (tasks.canManage && tasks.open.length) {
        const parts = [`${tasks.open.length} offen`, overdue ? `${overdue} überfällig` : null];
        put('tasks', {
          hint: parts.filter(Boolean).join(' · '),
          tone: overdue ? 'urgent' : 'info',
        });
      } else if (myOpen) put('tasks', { hint: `Für dich: ${myOpen} offen`, tone: 'action' });
      else {
        const free = tasks.open.filter((t) => !t.assignee).length;
        if (free) put('tasks', { hint: `${free} zu vergeben`, tone: 'info' });
      }
    }
  }

  if (hub === 'team' && teamId) {
    if (canManageTeamEvents)
      putNew(
        'exercises',
        await total(
          db
            .select({ n: count() })
            .from(s.exercises)
            .where(
              and(
                eq(s.exercises.clubId, actor.club.id),
                gt(s.exercises.createdAt, since('exercises')),
                ne(s.exercises.createdByPersonId, actor.person.id),
              ),
            ),
        ),
      );
    putNew(
      'docs',
      await total(
        db
          .select({ n: count() })
          .from(s.documents)
          .where(
            and(
              eq(s.documents.clubId, actor.club.id),
              eq(s.documents.scopeType, 'team'),
              eq(s.documents.scopeId, teamId),
              gt(s.documents.createdAt, since(`documents:${teamId}`)),
            ),
          ),
      ),
    );
  }

  if (hub === 'cash' && teamId) {
    const cash = await safe(() => getTeamCash(db, actor, teamId, now));
    if (cash) {
      const pending = cash.paymentNotices.filter((n) => n.status === 'pending');
      const openTotal = (cash.members ?? []).reduce(
        (sum, m) => sum + (m.balanceCents < 0 ? -m.balanceCents : 0),
        0,
      );
      if (pending.length)
        put('payments', { hint: `${pending.length} Zahlungsmeldungen`, tone: 'action' });
      else if (openTotal)
        put('payments', { hint: `Offen gesamt ${euro(openTotal)}`, tone: 'info' });
      if (!cash.settings.iban && !cash.settings.paypalLink && cash.permissions.manageCash)
        put('settings', { hint: 'Bezahlinfos fehlen', tone: 'action' });
      if (!cash.treasurers.length && cash.permissions.manageCash)
        put('treasurers', { hint: 'Noch keine Person bestimmt', tone: 'action' });
    }
  }

  if (hub === 'club') {
    const [helpers, editorial] = await Promise.all([
      safe(() => listHelperEvents(db, actor, now)),
      newsPermissions(actor).publish ? safe(() => getEditorialOverview(db, actor, now)) : null,
    ]);
    const spots = (helpers ?? []).reduce((sum, e) => sum + e.openSpots, 0);
    if (spots) put('helpers', { hint: `${spots} Plätze frei`, tone: 'info' });
    if (editorial?.toApprove.length)
      put('editorial', { hint: `${editorial.toApprove.length} zur Freigabe`, tone: 'action' });
    putNew(
      'news',
      await total(
        db
          .select({ n: count() })
          .from(s.announcements)
          .where(
            and(
              eq(s.announcements.clubId, actor.club.id),
              eq(s.announcements.status, 'published'),
              scopeVisible(actor, s.announcements),
              gt(s.announcements.publishedAt, since('news')),
            ),
          ),
      ),
    );
    const topics = await total(
      db
        .select({ n: count() })
        .from(s.forumTopics)
        .where(
          and(eq(s.forumTopics.clubId, actor.club.id), gt(s.forumTopics.createdAt, since('forum'))),
        ),
    );
    const posts = await total(
      db
        .select({ n: count() })
        .from(s.forumPosts)
        .where(
          and(eq(s.forumPosts.clubId, actor.club.id), gt(s.forumPosts.createdAt, since('forum'))),
        ),
    );
    putNew('forum', topics + posts);
    putNew(
      'wiki',
      await total(
        db
          .select({ n: count() })
          .from(s.wikiPages)
          .where(
            and(eq(s.wikiPages.clubId, actor.club.id), gt(s.wikiPages.updatedAt, since('wiki'))),
          ),
      ),
    );
    putNew(
      'docs',
      await total(
        db
          .select({ n: count() })
          .from(s.documents)
          .where(
            and(
              eq(s.documents.clubId, actor.club.id),
              scopeVisible(actor, s.documents),
              gt(s.documents.createdAt, since('documents')),
            ),
          ),
      ),
    );
    const nextEvent = (helpers ?? [])[0]?.event;
    if (nextEvent) put('events', { hint: `${day(nextEvent.startsAt)}: ${nextEvent.title}` });
  }

  if (hub === 'more') {
    if (twoFactorMissing(actor))
      put('settings', { hint: '2-Faktor-Anmeldung einrichten', tone: 'urgent' });
    const [invites, editorial, modules] = await Promise.all([
      canInvite(actor) ? safe(() => getInviteOverview(db, actor, ctx, now)) : null,
      newsPermissions(actor).publish ? safe(() => getEditorialOverview(db, actor, now)) : null,
      actorCan(actor, 'club.modules.manage') ? safe(() => getModuleOverview(db, actor, now)) : null,
    ]);
    const requests = invites?.requests.length ?? 0;
    if (requests)
      put('invites', { hint: `${requests} Anfragen warten auf Freigabe`, tone: 'action' });
    const open = requests + (editorial?.toApprove.length ?? 0) + (modules?.updates.length ?? 0);
    if (open) put('admin', { hint: `${open} offene Aufgaben`, tone: 'action' });
  }

  if (hub === 'admin') {
    const [overview, editorial, modules, invites] = await Promise.all([
      safe(() => getAdminOverview(db, actor, now)),
      newsPermissions(actor).publish ? safe(() => getEditorialOverview(db, actor, now)) : null,
      actorCan(actor, 'club.modules.manage') ? safe(() => getModuleOverview(db, actor, now)) : null,
      canInvite(actor) ? safe(() => getInviteOverview(db, actor, ctx, now)) : null,
    ]);
    if (overview) {
      const parts = [
        `${overview.members.active} aktive Mitglieder`,
        overview.members.withoutTeam ? `${overview.members.withoutTeam} ohne Mannschaft` : null,
      ];
      put('members', {
        hint: parts.filter(Boolean).join(' · '),
        tone: overview.members.withoutTeam ? 'action' : 'neutral',
      });
    }
    if (editorial?.toApprove.length)
      put('news', { hint: `${editorial.toApprove.length} zur Freigabe`, tone: 'action' });
    if (modules?.updates.length)
      put('modules', {
        hint:
          modules.updates.length === 1
            ? 'Es gibt 1 neue Funktion'
            : `Es gibt ${modules.updates.length} neue Funktionen`,
        tone: 'info',
      });
    if (invites?.requests.length)
      put('invites', { hint: `${invites.requests.length} Beitrittsanfragen`, tone: 'action' });
    if (actorCan(actor, 'club.settings.manage')) {
      if (!actor.club.logoUrl) put('club', { hint: 'Logo fehlt', tone: 'action' });
      else if (!actor.club.requireTwoFactor)
        put('club', { hint: '2-Faktor-Pflicht ist aus', tone: 'info' });
    }
  }

  return info;
}
