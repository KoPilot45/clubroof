/**
 * Umfragen (Konzept §11): eine Frage, eine Stimme je Person, Frist und Regeln, wann
 * Ergebnisse sichtbar sind („immer“, „nach eigener Stimme“, „nach Fristende“).
 */
import { can, type CreatePollInput, type PollDetail, type PollSummary } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, count, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { usersInScope } from './editorial';
import { notify } from './event-admin';
import { scopeLabels, scopeVisible } from './home';
import { loadScopeContext, requireScope, targetOf } from './scopes';

type PollRow = typeof s.polls.$inferSelect;
const DAY = 24 * 60 * 60 * 1000;

function isOpen(poll: PollRow, now: Date): boolean {
  return poll.closesAt === null || poll.closesAt > now;
}

function resultsVisible(actor: Actor, poll: PollRow, voted: boolean, now: Date): boolean {
  // Ersteller sehen ihre Ergebnisse immer
  if (poll.createdByPersonId === actor.person.id) return true;
  switch (poll.resultVisibility) {
    case 'always':
      return true;
    case 'after_vote':
      return voted || !isOpen(poll, now);
    case 'after_close':
      return !isOpen(poll, now);
  }
}

async function summaries(
  db: Db,
  actor: Actor,
  polls: PollRow[],
  now: Date,
): Promise<PollSummary[]> {
  if (polls.length === 0) return [];
  const ids = polls.map((p) => p.id);
  const [labels, counts, mine] = await Promise.all([
    scopeLabels(db, actor.club.id),
    db
      .select({ pollId: s.pollVotes.pollId, n: count() })
      .from(s.pollVotes)
      .where(inArray(s.pollVotes.pollId, ids))
      .groupBy(s.pollVotes.pollId),
    db
      .select({ pollId: s.pollVotes.pollId, optionId: s.pollVotes.optionId })
      .from(s.pollVotes)
      .where(and(inArray(s.pollVotes.pollId, ids), eq(s.pollVotes.personId, actor.person.id))),
  ]);
  return polls.map((p) => ({
    id: p.id,
    question: p.question,
    source: { type: p.scopeType, label: labels.label(p.scopeType, p.scopeId) },
    closesAt: p.closesAt?.toISOString() ?? null,
    isOpen: isOpen(p, now),
    votes: Number(counts.find((c) => c.pollId === p.id)?.n ?? 0),
    myOptionId: mine.find((m) => m.pollId === p.id)?.optionId ?? null,
  }));
}

/** Offene Umfragen und solche, die in den letzten 30 Tagen geendet haben. */
export async function listPolls(
  db: Db,
  actor: Actor,
  now: Date,
  filter: { teamId?: string } = {},
): Promise<PollSummary[]> {
  const rows = await db
    .select()
    .from(s.polls)
    .where(
      and(
        eq(s.polls.clubId, actor.club.id),
        scopeVisible(actor, s.polls),
        or(isNull(s.polls.closesAt), gt(s.polls.closesAt, new Date(now.getTime() - 30 * DAY))),
        filter.teamId
          ? and(eq(s.polls.scopeType, 'team'), eq(s.polls.scopeId, filter.teamId))
          : undefined,
      ),
    )
    .orderBy(desc(s.polls.createdAt));
  const list = await summaries(db, actor, rows, now);
  // Offene zuerst, darin die mit nächster Frist zuerst
  return list.sort(
    (a, b) =>
      Number(b.isOpen) - Number(a.isOpen) ||
      (a.closesAt ?? '9999').localeCompare(b.closesAt ?? '9999'),
  );
}

async function loadVisible(db: Db, actor: Actor, id: string): Promise<PollRow> {
  const [poll] = await db
    .select()
    .from(s.polls)
    .where(
      and(
        eq(s.polls.id, id),
        eq(s.polls.clubId, actor.club.id),
        or(scopeVisible(actor, s.polls), eq(s.polls.createdByPersonId, actor.person.id)),
      ),
    );
  if (!poll) throw notFound('Die Umfrage');
  return poll;
}

export async function getPoll(db: Db, actor: Actor, id: string, now: Date): Promise<PollDetail> {
  const poll = await loadVisible(db, actor, id);
  const [summary] = await summaries(db, actor, [poll], now);
  const [options, optionCounts, creator] = await Promise.all([
    db
      .select()
      .from(s.pollOptions)
      .where(eq(s.pollOptions.pollId, id))
      .orderBy(s.pollOptions.sortOrder),
    db
      .select({ optionId: s.pollVotes.optionId, n: count() })
      .from(s.pollVotes)
      .where(eq(s.pollVotes.pollId, id))
      .groupBy(s.pollVotes.optionId),
    poll.createdByPersonId
      ? db
          .select({ firstName: s.persons.firstName, lastName: s.persons.lastName })
          .from(s.persons)
          .where(eq(s.persons.id, poll.createdByPersonId))
      : Promise.resolve([]),
  ]);
  const visible =
    resultsVisible(actor, poll, summary!.myOptionId !== null, now) ||
    actorCan(actor, 'polls.manage', null);

  return {
    ...summary!,
    description: poll.description,
    createdBy: creator[0] ? `${creator[0].firstName} ${creator[0].lastName}` : null,
    resultVisibility: poll.resultVisibility,
    resultsVisible: visible,
    options: options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: visible ? Number(optionCounts.find((c) => c.optionId === o.id)?.n ?? 0) : null,
    })),
    canClose: isOpen(poll, now) && (await mayManage(db, actor, poll)),
  };
}

/** Ersteller und wer Umfragen im Bereich verwalten darf. */
async function mayManage(db: Db, actor: Actor, poll: PollRow): Promise<boolean> {
  if (poll.createdByPersonId === actor.person.id) return true;
  const target = targetOf(await loadScopeContext(db, actor), poll.scopeType, poll.scopeId);
  return target !== null && can(actor.grants, 'polls.manage', target);
}

export async function createPoll(
  db: Db,
  actor: Actor,
  input: CreatePollInput,
  now: Date,
): Promise<PollDetail> {
  const ctx = await loadScopeContext(db, actor);
  const { scopeId } = requireScope(
    actor,
    ctx,
    'polls.manage',
    input.scopeType,
    input.scopeId,
    'Für diesen Bereich darfst du keine Umfrage erstellen.',
  );
  const options = [...new Set(input.options.map((o) => o.trim()).filter(Boolean))];
  if (options.length < 2)
    throw new HttpError(
      400,
      'options',
      'Bitte mindestens zwei unterschiedliche Antworten angeben.',
    );
  const closesAt = input.closesAt ? new Date(input.closesAt) : null;
  if (closesAt && closesAt <= now)
    throw new HttpError(400, 'in_past', 'Das Ende der Umfrage liegt in der Vergangenheit.');

  const id = await db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(s.polls)
      .values({
        clubId: actor.club.id,
        scopeType: input.scopeType,
        scopeId,
        question: input.question.trim(),
        description: input.description?.trim() || null,
        closesAt,
        resultVisibility: input.resultVisibility,
        createdByPersonId: actor.person.id,
        createdAt: now,
      })
      .returning({ id: s.polls.id });
    await tx
      .insert(s.pollOptions)
      .values(options.map((label, i) => ({ pollId: poll!.id, label, sortOrder: i })));
    return poll!.id;
  });

  await notify(
    db,
    actor,
    await usersInScope(db, actor, ctx, input.scopeType, scopeId, now),
    {
      level: 'action',
      topic: 'polls',
      teamId: input.scopeType === 'team' ? scopeId : null,
      title: 'Neue Umfrage',
      body: input.question.trim(),
      link: `/polls/${id}`,
    },
    now,
  );
  return getPoll(db, actor, id, now);
}

export async function closePoll(db: Db, actor: Actor, id: string, now: Date): Promise<PollDetail> {
  const poll = await loadVisible(db, actor, id);
  if (!(await mayManage(db, actor, poll)))
    throw forbidden('Diese Umfrage kannst du nicht beenden.');
  if (!isOpen(poll, now)) throw new HttpError(409, 'closed', 'Die Umfrage ist bereits beendet.');
  await db.update(s.polls).set({ closesAt: now }).where(eq(s.polls.id, id));
  return getPoll(db, actor, id, now);
}

/** Abstimmen oder die eigene Stimme ändern, solange die Umfrage offen ist. */
export async function vote(
  db: Db,
  actor: Actor,
  id: string,
  optionId: string,
  now: Date,
): Promise<PollDetail> {
  const poll = await loadVisible(db, actor, id);
  if (!isOpen(poll, now)) {
    throw new HttpError(409, 'poll_closed', 'Die Umfrage ist bereits beendet.');
  }
  const [option] = await db
    .select({ id: s.pollOptions.id })
    .from(s.pollOptions)
    .where(and(eq(s.pollOptions.id, optionId), eq(s.pollOptions.pollId, id)));
  if (!option)
    throw new HttpError(400, 'invalid_option', 'Diese Antwort gehört nicht zur Umfrage.');

  await db
    .insert(s.pollVotes)
    .values({ pollId: id, optionId, personId: actor.person.id, createdAt: now })
    .onConflictDoUpdate({
      target: [s.pollVotes.pollId, s.pollVotes.personId],
      set: { optionId, createdAt: now },
    });

  // Zugehörige Aufgabe im Notification-Center als erledigt markieren
  await db
    .update(s.notifications)
    .set({ doneAt: now })
    .where(
      and(
        eq(s.notifications.userId, actor.user.id),
        eq(s.notifications.link, `/polls/${id}`),
        isNull(s.notifications.doneAt),
      ),
    );

  return getPoll(db, actor, id, now);
}
