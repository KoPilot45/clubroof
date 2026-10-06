/**
 * Persönliches Dashboard (Konzept §3): kein kompletter Feed, sondern je Block ein relevanter
 * Auszug. Zusammengesetzt aus Rolle, Mannschaften, aktivierten Modulen und Kindern.
 */
import {
  can,
  scopesWith,
  type ActionItem,
  type CashTeaser,
  type ClubOverview,
  type HomeResponse,
  type NewsItem,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notExists,
  or,
  sql,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { resolveMediaUrl } from '../storage/media-links';
import { fetchEventRows, summarizeEvents } from './events';

const DAY = 24 * 60 * 60 * 1000;

/** Bedingung „für mich sichtbar“ für Inhalte mit Geltungsbereich (News, Umfragen). */
export function scopeVisible(actor: Actor, columns: { scopeType: PgColumn; scopeId: PgColumn }) {
  const conditions = [eq(columns.scopeType, 'club')];
  if (actor.orgUnitIds.length) {
    conditions.push(
      and(eq(columns.scopeType, 'org_unit'), inArray(columns.scopeId, actor.orgUnitIds))!,
    );
  }
  if (actor.teamIds.length) {
    conditions.push(and(eq(columns.scopeType, 'team'), inArray(columns.scopeId, actor.teamIds))!);
  }
  return or(...conditions);
}

export async function scopeLabels(db: Db, clubId: string) {
  const [units, teams] = await Promise.all([
    db
      .select({ id: s.orgUnits.id, name: s.orgUnits.name })
      .from(s.orgUnits)
      .where(eq(s.orgUnits.clubId, clubId)),
    db
      .select({ id: s.teams.id, badge: s.teams.badge, orgUnitId: s.teams.orgUnitId })
      .from(s.teams)
      .where(eq(s.teams.clubId, clubId)),
  ]);
  return {
    label(type: 'club' | 'org_unit' | 'team', id: string | null): string {
      if (type === 'club') return 'Verein';
      if (type === 'org_unit') return units.find((u) => u.id === id)?.name ?? 'Bereich';
      return teams.find((t) => t.id === id)?.badge ?? 'Team';
    },
    teamOrgUnit(teamId: string | null): string | null {
      return teams.find((t) => t.id === teamId)?.orgUnitId ?? null;
    },
  };
}

export async function loadNews(
  db: Db,
  actor: Actor,
  now: Date,
  limit: number,
): Promise<NewsItem[]> {
  const labels = await scopeLabels(db, actor.club.id);
  const rows = await db
    .select()
    .from(s.announcements)
    .where(
      and(
        eq(s.announcements.clubId, actor.club.id),
        eq(s.announcements.status, 'published'),
        lte(s.announcements.publishedAt, now),
        scopeVisible(actor, s.announcements),
      ),
    )
    .orderBy(desc(s.announcements.publishedAt))
    .limit(30);

  // Priorität + Aktualität: Dringendes und Wichtiges der letzten 72 Stunden zuerst.
  const weight = (n: (typeof rows)[number]) => {
    const fresh = now.getTime() - n.publishedAt!.getTime() < 3 * DAY;
    return fresh ? { urgent: 2, important: 1, info: 0 }[n.priority] : 0;
  };
  rows.sort((a, b) => weight(b) - weight(a) || b.publishedAt!.getTime() - a.publishedAt!.getTime());

  const selected = rows.slice(0, limit);
  const liked = await likedByUser(
    db,
    actor.user.id,
    selected.map((n) => n.id),
  );
  return selected.map((n) => toNewsItem(actor, n, labels, liked.has(n.id)));
}

export async function likedByUser(db: Db, userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: s.announcementLikes.announcementId })
    .from(s.announcementLikes)
    .where(
      and(eq(s.announcementLikes.userId, userId), inArray(s.announcementLikes.announcementId, ids)),
    );
  return new Set(rows.map((r) => r.id));
}

export function toNewsItem(
  actor: Actor,
  n: typeof s.announcements.$inferSelect,
  labels: Awaited<ReturnType<typeof scopeLabels>>,
  likedByMe: boolean,
): NewsItem {
  return {
    id: n.id,
    title: n.title,
    teaser: n.teaser,
    body: n.body,
    priority: n.priority,
    source: { type: n.scopeType, label: labels.label(n.scopeType, n.scopeId) },
    imageUrl: resolveMediaUrl(actor.links, n.imageUrl),
    publishedAt: n.publishedAt!.toISOString(),
    viewCount: n.viewCount,
    likeCount: n.likeCount,
    likedByMe,
  };
}

async function loadActions(db: Db, actor: Actor, now: Date): Promise<ActionItem[]> {
  const actions: ActionItem[] = [];

  // 1. Offene Zu-/Absagen der nächsten 14 Tage (für mich und meine Kinder)
  const pendingRows = await fetchEventRows(
    db,
    and(
      eq(s.events.clubId, actor.club.id),
      eq(s.events.status, 'scheduled'),
      gt(s.events.startsAt, now),
      lte(s.events.startsAt, new Date(now.getTime() + 14 * DAY)),
      inArray(
        s.events.id,
        db
          .select({ id: s.eventParticipants.eventId })
          .from(s.eventParticipants)
          .where(
            and(
              inArray(s.eventParticipants.personId, actor.managedIds),
              eq(s.eventParticipants.status, 'pending'),
            ),
          ),
      ),
    ),
  );
  const pendingSummaries = await summarizeEvents(db, actor, pendingRows, now);
  for (const ev of pendingSummaries) {
    for (const r of ev.myResponses.filter((r) => r.status === 'pending' && r.canRespond)) {
      actions.push({
        kind: 'attendance',
        id: `${ev.id}:${r.personId}`,
        title: r.relation === 'child' ? `Zusage offen für ${r.firstName}` : 'Zusage offen',
        subtitle: `${ev.team?.badge ? `${ev.team.badge} · ` : ''}${ev.title}`,
        dueAt: ev.deadline ?? ev.startsAt,
        link: `/events/${ev.id}`,
      });
    }
  }

  // 2. Offene Umfragen, an denen ich noch nicht teilgenommen habe
  const polls = await db
    .select({ id: s.polls.id, question: s.polls.question, closesAt: s.polls.closesAt })
    .from(s.polls)
    .where(
      and(
        eq(s.polls.clubId, actor.club.id),
        or(isNull(s.polls.closesAt), gt(s.polls.closesAt, now)),
        scopeVisible(actor, s.polls),
        // Eigene Umfragen sind keine offene Aufgabe für die erstellende Person
        or(isNull(s.polls.createdByPersonId), ne(s.polls.createdByPersonId, actor.person.id)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(s.pollVotes)
            .where(
              and(eq(s.pollVotes.pollId, s.polls.id), eq(s.pollVotes.personId, actor.person.id)),
            ),
        ),
      ),
    );
  const options = polls.length
    ? await db
        .select({ id: s.pollOptions.id, pollId: s.pollOptions.pollId, label: s.pollOptions.label })
        .from(s.pollOptions)
        .where(
          inArray(
            s.pollOptions.pollId,
            polls.map((p) => p.id),
          ),
        )
        .orderBy(asc(s.pollOptions.sortOrder))
    : [];
  for (const p of polls) {
    actions.push({
      kind: 'poll',
      id: p.id,
      title: 'Umfrage beantworten',
      subtitle: p.question,
      dueAt: p.closesAt?.toISOString() ?? null,
      link: `/polls/${p.id}`,
      options: options.filter((o) => o.pollId === p.id).map(({ id, label }) => ({ id, label })),
    });
  }

  // 3. Freigaben: News, die auf mich als Freigebende warten
  const publishScopes = scopesWith(actor.grants, 'news.publish');
  if (publishScopes.all || publishScopes.orgUnitIds.length || publishScopes.teamIds.length) {
    const labels = await scopeLabels(db, actor.club.id);
    const pending = await db
      .select()
      .from(s.announcements)
      .where(
        and(
          eq(s.announcements.clubId, actor.club.id),
          eq(s.announcements.status, 'pending_approval'),
        ),
      );
    for (const n of pending) {
      const target =
        n.scopeType === 'team'
          ? { teamId: n.scopeId, orgUnitId: labels.teamOrgUnit(n.scopeId) }
          : n.scopeType === 'org_unit'
            ? { orgUnitId: n.scopeId }
            : {};
      if (!can(actor.grants, 'news.publish', target)) continue;
      actions.push({
        kind: 'approval',
        id: n.id,
        title: 'News freigeben',
        subtitle: n.title,
        dueAt: null,
        link: `/admin/news/${n.id}`,
      });
    }
  }

  // 4. Weitere Aufgaben aus dem Notification-Center, die nicht schon oben enthalten sind
  const tasks = await db
    .select()
    .from(s.notifications)
    .where(
      and(
        eq(s.notifications.userId, actor.user.id),
        eq(s.notifications.level, 'action'),
        isNull(s.notifications.doneAt),
      ),
    )
    .orderBy(desc(s.notifications.createdAt));
  const covered = new Set(actions.map((a) => a.link));
  for (const t of tasks) {
    if (t.link && covered.has(t.link)) continue;
    if (t.link?.startsWith('/polls/') || t.title.startsWith('Zusage offen')) continue;
    actions.push({
      kind: 'task',
      id: t.id,
      title: t.title,
      subtitle: t.body ?? '',
      dueAt: null,
      link: t.link ?? '/notifications',
    });
  }

  actions.sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    return a.dueAt ? -1 : b.dueAt ? 1 : 0;
  });
  return actions;
}

async function loadCash(db: Db, actor: Actor): Promise<CashTeaser[]> {
  const cashScopes = scopesWith(actor.grants, 'cash.read');
  const accounts = await db
    .select({ account: s.cashAccounts, team: s.teams })
    .from(s.cashAccounts)
    .innerJoin(s.teams, eq(s.teams.id, s.cashAccounts.teamId))
    .where(eq(s.cashAccounts.clubId, actor.club.id))
    .orderBy(asc(s.teams.sortOrder));

  const relevant = accounts.filter(({ team }) => {
    if (!moduleEnabled(actor, 'team_cash', team)) return false;
    return (
      actor.teamIds.includes(team.id) ||
      cashScopes.all ||
      cashScopes.teamIds.includes(team.id) ||
      cashScopes.orgUnitIds.includes(team.orgUnitId)
    );
  });
  if (relevant.length === 0) return [];

  const sums = await db
    .select({
      accountId: s.cashTransactions.accountId,
      personId: s.cashTransactions.personId,
      isCharge: s.cashTransactions.isCharge,
      direction: s.cashTransactions.direction,
      category: s.cashTransactions.category,
      total: sql<number>`sum(${s.cashTransactions.amountCents})::int`,
    })
    .from(s.cashTransactions)
    .where(
      inArray(
        s.cashTransactions.accountId,
        relevant.map((r) => r.account.id),
      ),
    )
    .groupBy(
      s.cashTransactions.accountId,
      s.cashTransactions.personId,
      s.cashTransactions.isCharge,
      s.cashTransactions.direction,
      s.cashTransactions.category,
    );

  return relevant.map(({ account, team }) => {
    const rows = sums.filter((r) => r.accountId === account.id);
    const income = rows
      .filter((r) => !r.isCharge && r.direction === 'income')
      .reduce((a, r) => a + r.total, 0);
    const expense = rows
      .filter((r) => !r.isCharge && r.direction === 'expense')
      .reduce((a, r) => a + r.total, 0);
    const mayReadBalance = actorCan(actor, 'cash.read', team);

    const own = rows.filter((r) => r.personId !== null && actor.managedIds.includes(r.personId));
    const personal = own.length
      ? own.reduce(
          (a, r) => a + (r.isCharge ? -r.total : r.category === 'einzahlung' ? r.total : 0),
          0,
        )
      : null;

    return {
      teamId: team.id,
      teamName: team.name,
      badge: team.badge,
      balanceCents: mayReadBalance ? income - expense : null,
      incomeCents: mayReadBalance ? income : null,
      expenseCents: mayReadBalance ? expense : null,
      personalBalanceCents: personal,
    };
  });
}

async function loadClubOverview(db: Db, actor: Actor, now: Date): Promise<ClubOverview | null> {
  if (!actorCan(actor, 'club.overview.read')) return null;
  const clubId = actor.club.id;
  const [[teams], [members], [approvals], [nextEvent]] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.teams)
      .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
      .where(and(eq(s.teams.clubId, clubId), eq(s.seasons.isCurrent, true))),
    db
      .select({ n: count() })
      .from(s.persons)
      .where(and(eq(s.persons.clubId, clubId), eq(s.persons.membershipStatus, 'active'))),
    db
      .select({ n: count() })
      .from(s.announcements)
      .where(
        and(eq(s.announcements.clubId, clubId), eq(s.announcements.status, 'pending_approval')),
      ),
    db
      .select({ id: s.events.id, title: s.events.title, startsAt: s.events.startsAt })
      .from(s.events)
      .where(
        and(
          eq(s.events.clubId, clubId),
          isNull(s.events.teamId),
          eq(s.events.type, 'club_event'),
          eq(s.events.status, 'scheduled'),
          gt(s.events.startsAt, now),
        ),
      )
      .orderBy(asc(s.events.startsAt))
      .limit(1),
  ]);
  return {
    teams: teams?.n ?? 0,
    members: members?.n ?? 0,
    pendingApprovals: approvals?.n ?? 0,
    nextClubEvent: nextEvent
      ? { id: nextEvent.id, title: nextEvent.title, startsAt: nextEvent.startsAt.toISOString() }
      : null,
  };
}

/** Meine Termine (eigene Teilnahmen, Teilnahmen der Kinder und Vereinstermine). */
export function myEventsCondition(actor: Actor, from: Date, to: Date) {
  return and(
    eq(s.events.clubId, actor.club.id),
    or(gte(s.events.endsAt, from), and(isNull(s.events.endsAt), gte(s.events.startsAt, from))),
    lte(s.events.startsAt, to),
    or(
      isNull(s.events.teamId),
      inArray(
        s.events.id,
        sql`(select ${s.eventParticipants.eventId} from ${s.eventParticipants} where ${inArray(
          s.eventParticipants.personId,
          actor.managedIds,
        )})`,
      ),
    ),
  );
}

export async function loadHome(db: Db, actor: Actor, now: Date): Promise<HomeResponse> {
  const upcomingRows = await fetchEventRows(
    db,
    myEventsCondition(actor, now, new Date(now.getTime() + 30 * DAY)),
    40,
  );
  // Vereinstermine nur, wenn sie innerhalb von 14 Tagen liegen – sonst verdrängen sie Teamtermine.
  const filtered = upcomingRows
    .filter((r) => r.team !== null || r.event.startsAt.getTime() - now.getTime() < 14 * DAY)
    .slice(0, 6);
  const upcoming = await summarizeEvents(db, actor, filtered, now);

  const matchRow = upcomingRows.find(
    (r) =>
      (r.event.type === 'match' || r.event.type === 'tournament') && r.event.status === 'scheduled',
  );
  const [nextMatch] = matchRow ? await summarizeEvents(db, actor, [matchRow], now) : [];

  const [news, actions, cash, clubOverview, [unread]] = await Promise.all([
    loadNews(db, actor, now, 3),
    loadActions(db, actor, now),
    loadCash(db, actor),
    loadClubOverview(db, actor, now),
    db
      .select({ n: count() })
      .from(s.notifications)
      .where(and(eq(s.notifications.userId, actor.user.id), isNull(s.notifications.readAt))),
  ]);

  return {
    nextMatch: nextMatch ?? null,
    upcoming,
    news,
    actions: actions.slice(0, 5),
    cash,
    clubOverview,
    unreadNotifications: unread?.n ?? 0,
  };
}
