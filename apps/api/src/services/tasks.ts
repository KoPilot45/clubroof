/**
 * Mannschaftsaufgaben (Konzept §4). Anlegen, zuteilen und löschen darf das Trainerteam
 * (`events.manage` für die Mannschaft). Mitglieder (und Eltern für ihr Kind) übernehmen offene
 * Aufgaben und haken eigene als erledigt ab.
 */
import {
  addDays,
  calendarDayOf,
  toIsoDate,
  type CreateTeamTaskInput,
  type TeamTask,
  type TeamTaskList,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { notify, recipientsFor } from './event-admin';
import { loadTeamForActor, requireModule, type TeamRow } from './team-access';

type TaskRow = typeof s.teamTasks.$inferSelect;

const name = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

async function teamMembers(db: Db, team: TeamRow, today: string) {
  return db
    .select({
      personId: s.persons.id,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
    })
    .from(s.teamMemberships)
    .innerJoin(s.persons, eq(s.persons.id, s.teamMemberships.personId))
    .where(
      and(
        eq(s.teamMemberships.teamId, team.id),
        or(isNull(s.teamMemberships.validTo), gte(s.teamMemberships.validTo, today)),
      ),
    )
    .orderBy(asc(s.persons.lastName), asc(s.persons.firstName));
}

async function loadTeam(db: Db, actor: Actor, teamId: string) {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  requireModule(actor, 'team_tasks', team);
  return { team, manage: permissions.manageEvents };
}

async function toItems(
  db: Db,
  actor: Actor,
  rows: TaskRow[],
  manage: boolean,
): Promise<TeamTask[]> {
  if (rows.length === 0) return [];
  const personIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.assigneePersonId, r.createdByPersonId])
        .filter((x): x is string => !!x),
    ),
  ];
  const eventIds = [...new Set(rows.map((r) => r.eventId).filter((x): x is string => !!x))];
  const [people, events] = await Promise.all([
    personIds.length
      ? db
          .select({
            id: s.persons.id,
            firstName: s.persons.firstName,
            lastName: s.persons.lastName,
          })
          .from(s.persons)
          .where(inArray(s.persons.id, personIds))
      : [],
    eventIds.length
      ? db
          .select({ id: s.events.id, title: s.events.title, startsAt: s.events.startsAt })
          .from(s.events)
          .where(inArray(s.events.id, eventIds))
      : [],
  ]);
  const person = (id: string | null) => people.find((p) => p.id === id);
  return rows.map((r) => {
    const assignee = person(r.assigneePersonId);
    const event = events.find((e) => e.id === r.eventId);
    const mine = !!r.assigneePersonId && actor.managedIds.includes(r.assigneePersonId);
    return {
      id: r.id,
      title: r.title,
      note: r.note,
      dueOn: r.dueOn,
      event: event
        ? { id: event.id, title: event.title, startsAt: event.startsAt.toISOString() }
        : null,
      assignee: assignee ? { personId: assignee.id, name: name(assignee) } : null,
      doneAt: r.doneAt?.toISOString() ?? null,
      createdBy: person(r.createdByPersonId) ? name(person(r.createdByPersonId)!) : null,
      can: {
        take: !r.doneAt && !r.assigneePersonId,
        complete: !r.doneAt && (mine || manage),
        manage,
      },
    };
  });
}

export async function listTasks(
  db: Db,
  actor: Actor,
  teamId: string,
  now: Date,
): Promise<TeamTaskList> {
  const { team, manage } = await loadTeam(db, actor, teamId);
  const [open, done] = await Promise.all([
    db
      .select()
      .from(s.teamTasks)
      .where(and(eq(s.teamTasks.teamId, team.id), isNull(s.teamTasks.doneAt)))
      .orderBy(asc(s.teamTasks.dueOn), asc(s.teamTasks.createdAt)),
    db
      .select()
      .from(s.teamTasks)
      .where(and(eq(s.teamTasks.teamId, team.id), isNotNull(s.teamTasks.doneAt)))
      .orderBy(desc(s.teamTasks.doneAt))
      .limit(20),
  ]);
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  const members = manage ? await teamMembers(db, team, today) : [];
  const events = manage
    ? await db
        .select({ id: s.events.id, title: s.events.title, startsAt: s.events.startsAt })
        .from(s.events)
        .where(
          and(
            eq(s.events.teamId, team.id),
            eq(s.events.status, 'scheduled'),
            gt(s.events.startsAt, now),
            lt(s.events.startsAt, new Date(now.getTime() + 35 * 24 * 3_600_000)),
          ),
        )
        .orderBy(asc(s.events.startsAt))
        .limit(30)
    : [];
  return {
    open: await toItems(db, actor, open, manage),
    done: await toItems(db, actor, done, manage),
    canManage: manage,
    members: members
      .map((m) => ({ personId: m.personId, name: name(m) }))
      .filter((m, i, all) => all.findIndex((x) => x.personId === m.personId) === i),
    events: events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() })),
  };
}

async function notifyAssignee(db: Db, actor: Actor, team: TeamRow, task: TaskRow, now: Date) {
  if (!task.assigneePersonId) return;
  await notify(
    db,
    actor,
    await recipientsFor(db, [task.assigneePersonId], actor.user.id),
    {
      level: 'action',
      topic: 'tasks',
      teamId: team.id,
      title: `Aufgabe: ${task.title}`,
      body: `${team.badge}${task.dueOn ? ` · bis ${task.dueOn.split('-').reverse().join('.')}` : ''}`,
      link: `/teams/${team.id}/tasks`,
    },
    now,
  );
}

export async function createTask(
  db: Db,
  actor: Actor,
  teamId: string,
  input: CreateTeamTaskInput,
  now: Date,
): Promise<TeamTaskList> {
  const { team, manage } = await loadTeam(db, actor, teamId);
  if (!manage) throw forbidden('Aufgaben legt das Trainerteam an.');
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  if (input.assigneePersonId) {
    const members = await teamMembers(db, team, today);
    if (!members.some((m) => m.personId === input.assigneePersonId))
      throw new HttpError(400, 'not_member', 'Die Person gehört nicht zur Mannschaft.');
  }
  if (input.eventId) {
    const [event] = await db
      .select({ id: s.events.id })
      .from(s.events)
      .where(and(eq(s.events.id, input.eventId), eq(s.events.teamId, team.id)));
    if (!event)
      throw new HttpError(400, 'invalid_event', 'Der Termin gehört nicht zur Mannschaft.');
  }
  if (input.dueOn && input.dueOn < toIsoDate(addDays(calendarDayOf(now, actor.club.timezone), -1)))
    throw new HttpError(400, 'in_past', 'Das Fälligkeitsdatum liegt in der Vergangenheit.');
  const [task] = await db
    .insert(s.teamTasks)
    .values({
      clubId: actor.club.id,
      teamId: team.id,
      eventId: input.eventId ?? null,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      dueOn: input.dueOn ?? null,
      assigneePersonId: input.assigneePersonId ?? null,
      createdByPersonId: actor.person.id,
      createdAt: now,
    })
    .returning();
  await notifyAssignee(db, actor, team, task!, now);
  return listTasks(db, actor, team.id, now);
}

async function loadTask(db: Db, actor: Actor, id: string) {
  const [task] = await db
    .select()
    .from(s.teamTasks)
    .where(and(eq(s.teamTasks.id, id), eq(s.teamTasks.clubId, actor.club.id)));
  if (!task) throw notFound('Die Aufgabe');
  const { team, manage } = await loadTeam(db, actor, task.teamId);
  return { task, team, manage };
}

/** Offene Aufgabe für sich selbst oder ein eigenes Kind übernehmen. */
export async function takeTask(db: Db, actor: Actor, id: string, personId: string, now: Date) {
  const { task, team } = await loadTask(db, actor, id);
  if (!actor.managedIds.includes(personId))
    throw forbidden('Du kannst nur für dich oder dein Kind übernehmen.');
  if (task.doneAt) throw new HttpError(409, 'done', 'Die Aufgabe ist schon erledigt.');
  // Gleichzeitiges Übernehmen: nur wer zuerst kommt, bekommt die Aufgabe
  const taken = await db
    .update(s.teamTasks)
    .set({ assigneePersonId: personId })
    .where(and(eq(s.teamTasks.id, id), isNull(s.teamTasks.assigneePersonId)))
    .returning({ id: s.teamTasks.id });
  if (!taken.length) throw new HttpError(409, 'taken', 'Die Aufgabe hat schon jemand übernommen.');
  return listTasks(db, actor, team.id, now);
}

export async function completeTask(db: Db, actor: Actor, id: string, now: Date) {
  const { task, team, manage } = await loadTask(db, actor, id);
  const mine = !!task.assigneePersonId && actor.managedIds.includes(task.assigneePersonId);
  if (!mine && !manage) throw forbidden('Abhaken kann, wer die Aufgabe übernommen hat.');
  if (!task.doneAt)
    await db
      .update(s.teamTasks)
      .set({ doneAt: now, doneByPersonId: actor.person.id })
      .where(eq(s.teamTasks.id, id));
  return listTasks(db, actor, team.id, now);
}

/** Verantwortliche: wieder öffnen, neu zuteilen oder freigeben. */
export async function updateTask(
  db: Db,
  actor: Actor,
  id: string,
  input: { assigneePersonId?: string | null; reopen?: boolean },
  now: Date,
) {
  const { task, team, manage } = await loadTask(db, actor, id);
  if (!manage) throw forbidden('Aufgaben verwaltet das Trainerteam.');
  const patch: Partial<TaskRow> = {};
  if (input.reopen) Object.assign(patch, { doneAt: null, doneByPersonId: null });
  if (input.assigneePersonId !== undefined) {
    if (input.assigneePersonId) {
      const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
      const members = await teamMembers(db, team, today);
      if (!members.some((m) => m.personId === input.assigneePersonId))
        throw new HttpError(400, 'not_member', 'Die Person gehört nicht zur Mannschaft.');
    }
    patch.assigneePersonId = input.assigneePersonId;
  }
  if (Object.keys(patch).length) {
    const [updated] = await db
      .update(s.teamTasks)
      .set(patch)
      .where(eq(s.teamTasks.id, id))
      .returning();
    if (input.assigneePersonId && input.assigneePersonId !== task.assigneePersonId)
      await notifyAssignee(db, actor, team, updated!, now);
  }
  return listTasks(db, actor, team.id, now);
}

export async function deleteTask(db: Db, actor: Actor, id: string, now: Date) {
  const { team, manage } = await loadTask(db, actor, id);
  if (!manage) throw forbidden('Aufgaben verwaltet das Trainerteam.');
  await db.delete(s.teamTasks).where(eq(s.teamTasks.id, id));
  return listTasks(db, actor, team.id, now);
}

/** Offene Aufgaben für Startseite und „Meine Teams“. */
export async function openTasksFor(db: Db, actor: Actor) {
  if (actor.managedIds.length === 0) return [];
  return db
    .select({ task: s.teamTasks, team: s.teams })
    .from(s.teamTasks)
    .innerJoin(s.teams, eq(s.teams.id, s.teamTasks.teamId))
    .where(and(inArray(s.teamTasks.assigneePersonId, actor.managedIds), isNull(s.teamTasks.doneAt)))
    .orderBy(asc(s.teamTasks.dueOn));
}
