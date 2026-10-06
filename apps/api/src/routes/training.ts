import { EXERCISE_CATEGORIES, type Exercise, type TrainingPlan } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createExercise,
  deleteExercise,
  getTrainingPlan,
  listExercises,
  saveTrainingPlan,
} from '../services/training';

const id = z.object({ id: z.uuid() });

/** Trainingsplanung. Rechte prüft `services/training.ts`. */
export const trainingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/exercises', async (request): Promise<Exercise[]> =>
    listExercises(app.db, request.actor!),
  );

  app.post(
    '/exercises',
    {
      schema: {
        body: z.object({
          title: z.string().trim().min(2).max(80),
          category: z.enum(EXERCISE_CATEGORIES),
          durationMinutes: z.number().int().min(1).max(120),
          players: z.string().trim().max(40).nullish(),
          material: z.string().trim().max(200).nullish(),
          description: z.string().trim().max(2000).nullish(),
        }),
      },
    },
    async (request, reply): Promise<Exercise[]> => {
      reply.code(201);
      return createExercise(app.db, request.actor!, request.body, app.now());
    },
  );

  app.delete('/exercises/:id', { schema: { params: id } }, async (request): Promise<Exercise[]> =>
    deleteExercise(app.db, request.actor!, request.params.id),
  );

  app.get(
    '/events/:id/training-plan',
    { schema: { params: id } },
    async (request): Promise<TrainingPlan> =>
      getTrainingPlan(app.db, request.actor!, request.params.id),
  );

  app.put(
    '/events/:id/training-plan',
    {
      schema: {
        params: id,
        body: z.object({
          focus: z.string().trim().max(120).nullish(),
          notes: z.string().trim().max(2000).nullish(),
          items: z
            .array(
              z.object({
                exerciseId: z.uuid().nullish(),
                title: z.string().trim().min(1).max(80),
                minutes: z.number().int().min(1).max(120),
                note: z.string().trim().max(300).nullish(),
              }),
            )
            .max(20),
        }),
      },
    },
    async (request): Promise<TrainingPlan> =>
      saveTrainingPlan(app.db, request.actor!, request.params.id, request.body, app.now()),
  );
};
