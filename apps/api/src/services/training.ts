/**
 * Trainingsplanung (optionales Modul, Mappe S. 17): Übungsbibliothek des Vereins und ein Plan je
 * Training. Das Trainerteam sieht und bearbeitet den Ablauf; Spieler sehen Schwerpunkt und Material.
 */
import {
  EXERCISE_CATEGORIES,
  scopesWith,
  type CreateExerciseInput,
  type Exercise,
  type ExerciseCategory,
  type SaveTrainingPlanInput,
  type TrainingPlan,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { loadTeamForActor } from './team-access';

const isCategory = (v: string): v is ExerciseCategory =>
  (EXERCISE_CATEGORIES as readonly string[]).includes(v);

/** Trainer (irgendeiner Mannschaft) mit aktiviertem Modul */
function requireCoach(actor: Actor) {
  if (!moduleEnabled(actor, 'training_planning'))
    throw forbidden('Die Trainingsplanung ist im Verein nicht aktiviert.');
  const sc = scopesWith(actor.grants, 'events.manage');
  if (!sc.all && sc.orgUnitIds.length === 0 && sc.teamIds.length === 0)
    throw forbidden('Die Übungsbibliothek ist für Trainerteams.');
}

export async function listExercises(db: Db, actor: Actor): Promise<Exercise[]> {
  requireCoach(actor);
  const rows = await db
    .select({ exercise: s.exercises, firstName: s.persons.firstName, lastName: s.persons.lastName })
    .from(s.exercises)
    .leftJoin(s.persons, eq(s.persons.id, s.exercises.createdByPersonId))
    .where(eq(s.exercises.clubId, actor.club.id))
    .orderBy(asc(s.exercises.category), asc(s.exercises.title));
  const admin = actorCan(actor, 'club.modules.manage');
  return rows.map(({ exercise: e, firstName, lastName }) => ({
    id: e.id,
    title: e.title,
    category: isCategory(e.category) ? e.category : 'game',
    durationMinutes: e.durationMinutes,
    players: e.players,
    material: e.material,
    description: e.description,
    createdBy: firstName ? `${firstName} ${lastName}` : null,
    canDelete: admin || e.createdByPersonId === actor.person.id,
  }));
}

export async function createExercise(
  db: Db,
  actor: Actor,
  input: CreateExerciseInput,
  now: Date,
): Promise<Exercise[]> {
  requireCoach(actor);
  await db.insert(s.exercises).values({
    clubId: actor.club.id,
    title: input.title.trim(),
    category: input.category,
    durationMinutes: input.durationMinutes,
    players: input.players?.trim() || null,
    material: input.material?.trim() || null,
    description: input.description?.trim() || null,
    createdByPersonId: actor.person.id,
    createdAt: now,
  });
  return listExercises(db, actor);
}

export async function deleteExercise(db: Db, actor: Actor, id: string): Promise<Exercise[]> {
  const list = await listExercises(db, actor);
  const exercise = list.find((e) => e.id === id);
  if (!exercise) throw notFound('Die Übung');
  if (!exercise.canDelete) throw forbidden('Löschen kann, wer die Übung angelegt hat.');
  await db.delete(s.exercises).where(eq(s.exercises.id, id));
  return list.filter((e) => e.id !== id);
}

async function loadTraining(db: Db, actor: Actor, eventId: string) {
  const [event] = await db
    .select()
    .from(s.events)
    .where(and(eq(s.events.id, eventId), eq(s.events.clubId, actor.club.id)));
  if (!event || !event.teamId) throw notFound('Das Training');
  const { team, permissions } = await loadTeamForActor(db, actor, event.teamId);
  if (!moduleEnabled(actor, 'training_planning', team))
    throw forbidden('Die Trainingsplanung ist für die Mannschaft nicht aktiviert.');
  if (event.type !== 'training')
    throw new HttpError(400, 'not_training', 'Trainingspläne gibt es nur für Trainings.');
  return { event, team, canEdit: permissions.manageEvents };
}

/** Material aus den Übungen, ohne Dopplungen (Kommas trennen mehrere Angaben) */
function materialOf(list: (string | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const entry of list)
    for (const part of (entry ?? '').split(','))
      if (part.trim()) seen.set(part.trim().toLowerCase(), part.trim());
  return [...seen.values()];
}

export async function getTrainingPlan(
  db: Db,
  actor: Actor,
  eventId: string,
): Promise<TrainingPlan> {
  const { event, team, canEdit } = await loadTraining(db, actor, eventId);
  const [plan] = await db
    .select()
    .from(s.trainingPlans)
    .where(eq(s.trainingPlans.eventId, event.id));
  const items = plan?.items ?? [];
  const exerciseIds = items.map((i) => i.exerciseId).filter((x): x is string => !!x);
  const library = exerciseIds.length
    ? await db.select().from(s.exercises).where(inArray(s.exercises.id, exerciseIds))
    : [];
  const full = items.map((i) => {
    const ex = library.find((e) => e.id === i.exerciseId);
    return {
      exerciseId: i.exerciseId,
      title: i.title,
      minutes: i.minutes,
      note: i.note,
      category: ex && isCategory(ex.category) ? ex.category : null,
      material: ex?.material ?? null,
      description: ex?.description ?? null,
    };
  });
  let previous: TrainingPlan['previous'] = null;
  if (canEdit) {
    const [prev] = await db
      .select({ eventId: s.events.id, startsAt: s.events.startsAt, focus: s.trainingPlans.focus })
      .from(s.trainingPlans)
      .innerJoin(s.events, eq(s.events.id, s.trainingPlans.eventId))
      .where(and(eq(s.events.teamId, team.id), lt(s.events.startsAt, event.startsAt)))
      .orderBy(desc(s.events.startsAt))
      .limit(1);
    previous = prev ? { ...prev, startsAt: prev.startsAt.toISOString() } : null;
  }
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + 90 * 60_000);
  return {
    eventId: event.id,
    focus: plan?.focus ?? null,
    material: materialOf(full.map((i) => i.material)),
    items: canEdit ? full : null,
    notes: canEdit ? (plan?.notes ?? null) : null,
    totalMinutes: items.reduce((a, i) => a + i.minutes, 0),
    eventMinutes: Math.round((end.getTime() - event.startsAt.getTime()) / 60_000),
    canEdit,
    updatedAt: plan?.updatedAt.toISOString() ?? null,
    previous,
  };
}

export async function saveTrainingPlan(
  db: Db,
  actor: Actor,
  eventId: string,
  input: SaveTrainingPlanInput,
  now: Date,
): Promise<TrainingPlan> {
  const { event, canEdit } = await loadTraining(db, actor, eventId);
  if (!canEdit) throw forbidden('Den Trainingsplan bearbeitet das Trainerteam.');
  // Gelöschte oder fremde Übungen bleiben als freier Programmpunkt erhalten
  const ids = input.items.map((i) => i.exerciseId).filter((x): x is string => !!x);
  const known = new Set(
    ids.length
      ? (
          await db
            .select({ id: s.exercises.id })
            .from(s.exercises)
            .where(and(inArray(s.exercises.id, ids), eq(s.exercises.clubId, actor.club.id)))
        ).map((r) => r.id)
      : [],
  );
  const values = {
    clubId: actor.club.id,
    focus: input.focus?.trim() || null,
    notes: input.notes?.trim() || null,
    items: input.items.map((i) => ({
      exerciseId: i.exerciseId && known.has(i.exerciseId) ? i.exerciseId : null,
      title: i.title.trim(),
      minutes: i.minutes,
      note: i.note?.trim() || null,
    })),
    updatedByPersonId: actor.person.id,
    updatedAt: now,
  };
  await db
    .insert(s.trainingPlans)
    .values({ eventId: event.id, ...values })
    .onConflictDoUpdate({ target: s.trainingPlans.eventId, set: values });
  return getTrainingPlan(db, actor, event.id);
}
