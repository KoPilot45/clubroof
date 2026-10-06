import type { TeamTaskList } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  takeTask,
  updateTask,
} from '../services/tasks';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const taskParams = z.object({ id: z.uuid() });

/** Mannschaftsaufgaben. Rechte prüft `services/tasks.ts`. */
export const taskRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/teams/:teamId/tasks',
    { schema: { params: z.object({ teamId: z.uuid() }) } },
    async (request): Promise<TeamTaskList> =>
      listTasks(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.post(
    '/teams/:teamId/tasks',
    {
      schema: {
        params: z.object({ teamId: z.uuid() }),
        body: z.object({
          title: z.string().trim().min(2).max(100),
          note: z.string().trim().max(500).nullish(),
          dueOn: isoDate.nullish(),
          eventId: z.uuid().nullish(),
          assigneePersonId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply): Promise<TeamTaskList> => {
      reply.code(201);
      return createTask(app.db, request.actor!, request.params.teamId, request.body, app.now());
    },
  );

  app.post(
    '/tasks/:id/take',
    { schema: { params: taskParams, body: z.object({ personId: z.uuid() }) } },
    async (request): Promise<TeamTaskList> =>
      takeTask(app.db, request.actor!, request.params.id, request.body.personId, app.now()),
  );

  app.post(
    '/tasks/:id/done',
    { schema: { params: taskParams } },
    async (request): Promise<TeamTaskList> =>
      completeTask(app.db, request.actor!, request.params.id, app.now()),
  );

  app.patch(
    '/tasks/:id',
    {
      schema: {
        params: taskParams,
        body: z.object({
          assigneePersonId: z.uuid().nullable().optional(),
          reopen: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<TeamTaskList> =>
      updateTask(app.db, request.actor!, request.params.id, request.body, app.now()),
  );

  app.delete(
    '/tasks/:id',
    { schema: { params: taskParams } },
    async (request): Promise<TeamTaskList> =>
      deleteTask(app.db, request.actor!, request.params.id, app.now()),
  );
};
