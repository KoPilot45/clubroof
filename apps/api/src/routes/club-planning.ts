import type { ClubBudget, ClubClosing, ClubReserveMove, ClubReserves } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  closeYear,
  closingLink,
  copyBudget,
  createReserve,
  deleteBudgetLine,
  getBudget,
  getClosing,
  getReserves,
  listReserveMoves,
  moveReserve,
  reopenYear,
  saveBudgetLine,
  updateReserve,
} from '../services/club-planning';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const year = z.coerce.number().int().min(2000).max(2100);
const idParams = z.object({ id: z.uuid() });
const money = z.number().int().min(0).max(1_000_000_000);

/** Vereinskasse: Haushaltsplan, Rücklagen, Jahresabschluss und Periodensperre (Paket K3). */
export const clubPlanningRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const budget = (
    request: { actor?: unknown },
    y: number,
    fundId: string | null,
  ): Promise<ClubBudget> => getBudget(app.db, request.actor as never, y, fundId, app.now());

  // ── Haushaltsplan ────────────────────────────────────────────────────────
  app.get(
    '/club-cash/budget',
    {
      schema: { querystring: z.object({ year, fundId: z.uuid().optional() }) },
    },
    async (request): Promise<ClubBudget> =>
      budget(request, request.query.year, request.query.fundId ?? null),
  );
  app.put(
    '/club-cash/budget',
    {
      schema: {
        body: z.object({
          fundId: z.uuid(),
          year,
          categoryId: z.uuid(),
          costCenterId: z.uuid().nullish(),
          plannedCents: money,
          note: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request): Promise<ClubBudget> => {
      await saveBudgetLine(app.db, request.actor!, request.body, app.now());
      return budget(request, request.body.year, request.body.fundId);
    },
  );
  app.delete(
    '/club-cash/budget/:id',
    {
      schema: {
        params: idParams,
        querystring: z.object({ year, fundId: z.uuid().optional() }),
      },
    },
    async (request): Promise<ClubBudget> => {
      await deleteBudgetLine(app.db, request.actor!, request.params.id, app.now());
      return budget(request, request.query.year, request.query.fundId ?? null);
    },
  );
  app.post(
    '/club-cash/budget/copy',
    {
      schema: {
        body: z.object({ fundId: z.uuid(), fromYear: year, toYear: year }),
      },
    },
    async (request): Promise<ClubBudget & { copied: number }> => {
      const { copied } = await copyBudget(
        app.db,
        request.actor!,
        request.body.fromYear,
        request.body.toYear,
        request.body.fundId,
        app.now(),
      );
      return { ...(await budget(request, request.body.toYear, request.body.fundId)), copied };
    },
  );

  // ── Rücklagen ────────────────────────────────────────────────────────────
  app.get('/club-cash/reserves', async (request): Promise<ClubReserves> =>
    getReserves(app.db, request.actor!, app.now()),
  );
  app.post(
    '/club-cash/reserves',
    {
      schema: {
        body: z.object({
          fundId: z.uuid(),
          name: z.string().trim().min(2).max(60),
          targetCents: money.min(1).nullish(),
          note: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubReserves> => {
      await createReserve(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return getReserves(app.db, request.actor!, app.now());
    },
  );
  app.patch(
    '/club-cash/reserves/:id',
    {
      schema: {
        params: idParams,
        body: z.object({
          name: z.string().trim().min(2).max(60).optional(),
          targetCents: money.min(1).nullable().optional(),
          note: z.string().trim().max(200).nullable().optional(),
          archived: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<ClubReserves> => {
      await updateReserve(app.db, request.actor!, request.params.id, request.body, app.now());
      return getReserves(app.db, request.actor!, app.now());
    },
  );
  app.post(
    '/club-cash/reserves/:id/moves',
    {
      schema: {
        params: idParams,
        body: z.object({
          kind: z.enum(['allocate', 'release']),
          amountCents: money.min(1),
          bookedOn: day,
          note: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubReserves> => {
      await moveReserve(app.db, request.actor!, request.params.id, request.body, app.now());
      reply.code(201);
      return getReserves(app.db, request.actor!, app.now());
    },
  );
  app.get(
    '/club-cash/reserves/:id/moves',
    { schema: { params: idParams } },
    async (request): Promise<ClubReserveMove[]> =>
      listReserveMoves(app.db, request.actor!, request.params.id),
  );

  // ── Jahresabschluss ──────────────────────────────────────────────────────
  app.get(
    '/club-cash/closing',
    { schema: { querystring: z.object({ year }) } },
    async (request): Promise<ClubClosing> =>
      getClosing(app.db, request.actor!, request.query.year, app.now()),
  );
  app.post(
    '/club-cash/closing/close',
    { schema: { body: z.object({ year }) } },
    async (request): Promise<ClubClosing> => {
      await closeYear(app.db, request.actor!, request.body.year, app.now());
      return getClosing(app.db, request.actor!, request.body.year, app.now());
    },
  );
  app.post(
    '/club-cash/closing/reopen',
    { schema: { body: z.object({ year, reason: z.string().trim().min(3).max(300) }) } },
    async (request): Promise<ClubClosing> => {
      await reopenYear(app.db, request.actor!, request.body.year, request.body.reason, app.now());
      return getClosing(app.db, request.actor!, request.body.year, app.now());
    },
  );
  app.get(
    '/club-cash/closing/link',
    {
      schema: { querystring: z.object({ year, format: z.enum(['csv', 'pdf']) }) },
    },
    async (request): Promise<{ url: string; expiresAt: string }> => {
      const { token, expiresAt } = await closingLink(
        app.db,
        request.actor!,
        request.query.year,
        request.query.format,
        app.now(),
      );
      const base = app.config.publicUrl ?? `${request.protocol}://${request.headers.host}`;
      return { url: `${base}/files/${token}`, expiresAt };
    },
  );
};
