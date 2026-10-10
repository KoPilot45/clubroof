import {
  CLUB_CASH_ACCOUNT_KINDS,
  CLUB_CASH_AREAS,
  CLUB_CASH_DIRECTIONS,
  CLUB_CASH_VISIBILITIES,
  CLUB_COST_CENTER_KINDS,
  type ClubCash,
  type ClubCashEntry,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  applyCategoryTemplate,
  cancelEntry,
  createAccount,
  createCategory,
  createCostCenter,
  createEntry,
  createTransfer,
  getClubCash,
  listEntries,
  setVisibility,
  updateAccount,
  updateCategory,
  updateCostCenter,
} from '../services/club-cash';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idParams = z.object({ id: z.uuid() });
const cents = z.number().int().min(1).max(100_000_000);

/** Vereinskasse (Paket K1): getrennt von den Mannschaftskassen, eigene Rechte `clubcash.*`. */
export const clubCashRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const overview = (request: { actor?: unknown }) =>
    getClubCash(app.db, request.actor as never, app.now());

  app.get('/club-cash', async (request): Promise<ClubCash> => overview(request));

  app.get(
    '/club-cash/entries',
    {
      schema: {
        querystring: z.object({
          accountId: z.uuid().optional(),
          categoryId: z.uuid().optional(),
          costCenterId: z.uuid().optional(),
          q: z.string().max(80).optional(),
          from: day.optional(),
          to: day.optional(),
          includeCancelled: z.enum(['true', 'false']).optional(),
        }),
      },
    },
    async (request): Promise<ClubCashEntry[]> =>
      listEntries(
        app.db,
        request.actor!,
        { ...request.query, includeCancelled: request.query.includeCancelled === 'true' },
        app.now(),
      ),
  );

  app.post(
    '/club-cash/entries',
    {
      schema: {
        body: z.object({
          accountId: z.uuid(),
          kind: z.enum(CLUB_CASH_DIRECTIONS),
          amountCents: cents,
          bookedOn: day,
          categoryId: z.uuid(),
          costCenterId: z.uuid().nullish(),
          counterparty: z.string().trim().max(120).nullish(),
          purpose: z.string().trim().min(1).max(200),
          receiptNo: z.string().trim().max(40).nullish(),
          receiptImageId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubCashEntry> => {
      reply.code(201);
      return createEntry(app.db, request.actor!, request.body, app.now());
    },
  );

  app.post(
    '/club-cash/transfers',
    {
      schema: {
        body: z.object({
          fromAccountId: z.uuid(),
          toAccountId: z.uuid(),
          amountCents: cents,
          bookedOn: day,
          purpose: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubCashEntry[]> => {
      reply.code(201);
      return createTransfer(app.db, request.actor!, request.body, app.now());
    },
  );

  app.post(
    '/club-cash/entries/:id/cancel',
    {
      schema: { params: idParams, body: z.object({ reason: z.string().trim().min(3).max(300) }) },
    },
    async (request): Promise<ClubCash> => {
      await cancelEntry(app.db, request.actor!, request.params.id, request.body.reason, app.now());
      return overview(request);
    },
  );

  // ── Konten ───────────────────────────────────────────────────────────────
  app.post(
    '/club-cash/accounts',
    {
      schema: {
        body: z.object({
          name: z.string().trim().min(2).max(60),
          kind: z.enum(CLUB_CASH_ACCOUNT_KINDS),
          openingBalanceCents: z.number().int().min(-100_000_000).max(100_000_000).optional(),
        }),
      },
    },
    async (request, reply): Promise<ClubCash> => {
      await createAccount(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return overview(request);
    },
  );
  app.patch(
    '/club-cash/accounts/:id',
    {
      schema: {
        params: idParams,
        body: z.object({
          name: z.string().trim().min(2).max(60).optional(),
          kind: z.enum(CLUB_CASH_ACCOUNT_KINDS).optional(),
          openingBalanceCents: z.number().int().min(-100_000_000).max(100_000_000).optional(),
          archived: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<ClubCash> => {
      await updateAccount(app.db, request.actor!, request.params.id, request.body, app.now());
      return overview(request);
    },
  );

  // ── Kategorien ───────────────────────────────────────────────────────────
  app.post(
    '/club-cash/categories',
    {
      schema: {
        body: z.object({
          name: z.string().trim().min(2).max(60),
          direction: z.enum(CLUB_CASH_DIRECTIONS),
          area: z.enum(CLUB_CASH_AREAS),
        }),
      },
    },
    async (request, reply): Promise<ClubCash> => {
      await createCategory(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return overview(request);
    },
  );
  app.patch(
    '/club-cash/categories/:id',
    {
      schema: {
        params: idParams,
        body: z.object({
          name: z.string().trim().min(2).max(60).optional(),
          area: z.enum(CLUB_CASH_AREAS).optional(),
          archived: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<ClubCash> => {
      await updateCategory(app.db, request.actor!, request.params.id, request.body, app.now());
      return overview(request);
    },
  );
  app.post('/club-cash/categories/template', async (request, reply): Promise<ClubCash> => {
    await applyCategoryTemplate(app.db, request.actor!, app.now());
    reply.code(201);
    return overview(request);
  });

  // ── Kostenstellen ────────────────────────────────────────────────────────
  app.post(
    '/club-cash/cost-centers',
    {
      schema: {
        body: z.object({
          name: z.string().trim().min(2).max(60),
          kind: z.enum(CLUB_COST_CENTER_KINDS),
        }),
      },
    },
    async (request, reply): Promise<ClubCash> => {
      await createCostCenter(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return overview(request);
    },
  );
  app.patch(
    '/club-cash/cost-centers/:id',
    {
      schema: {
        params: idParams,
        body: z.object({
          name: z.string().trim().min(2).max(60).optional(),
          archived: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<ClubCash> => {
      await updateCostCenter(app.db, request.actor!, request.params.id, request.body, app.now());
      return overview(request);
    },
  );

  // ── Einstellung: wer darf einsehen? ──────────────────────────────────────
  app.put(
    '/club-cash/visibility',
    { schema: { body: z.object({ visibility: z.enum(CLUB_CASH_VISIBILITIES) }) } },
    async (request): Promise<ClubCash> => {
      await setVisibility(app.db, request.actor!, request.body.visibility, app.now());
      // Der Actor trägt noch den alten Wert – neu laden
      request.actor!.club = { ...request.actor!.club, clubCashVisibility: request.body.visibility };
      return overview(request);
    },
  );
};
