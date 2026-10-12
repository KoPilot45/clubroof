import {
  CLUB_ALLOWANCE_KINDS,
  CLUB_GRANT_STATUSES,
  type ClubAllowances,
  type ClubExpenseClaims,
  type ClubGrants,
  type ClubInventory,
  type ClubSponsorIncome,
  type ClubTeamGrants,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createGrant,
  createInventoryItem,
  createTeamGrant,
  decideClaim,
  getAllowances,
  getInventory,
  getSponsorIncome,
  listClaims,
  listGrants,
  listSponsorChoices,
  listTeamGrants,
  payAllowance,
  payClaim,
  receiveGrant,
  setGrantProof,
  setGrantStatus,
  submitClaim,
  updateInventoryItem,
} from '../services/club-extras';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const year = z.coerce.number().int().min(2000).max(2100);
const idParams = z.object({ id: z.uuid() });
const money = z.number().int().min(1).max(100_000_000);

/** Vereinskasse: Auslagen, Pauschalen, Zuschüsse, Sponsoren, Mannschaftszuschuss, Inventar (Paket K5). */
export const clubExtrasRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  const claims = (request: { actor?: unknown }) =>
    listClaims(app.db, request.actor as never, app.now());

  // ── Auslagenerstattung (Mitglieder reichen ein, Kassenwart prüft) ────────
  app.get('/club-cash/claims', async (request): Promise<ClubExpenseClaims> => claims(request));
  app.post(
    '/club-cash/claims',
    {
      schema: {
        body: z.object({
          kind: z.enum(['expense', 'mileage']),
          description: z.string().trim().min(3).max(200),
          amountCents: money.optional(),
          kilometers: z.number().int().min(1).max(5000).optional(),
          expenseDate: day,
          receiptImageId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubExpenseClaims> => {
      await submitClaim(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return claims(request);
    },
  );
  app.post(
    '/club-cash/claims/:id/approve',
    { schema: { params: idParams } },
    async (request): Promise<ClubExpenseClaims> => {
      await decideClaim(app.db, request.actor!, request.params.id, { approve: true }, app.now());
      return claims(request);
    },
  );
  app.post(
    '/club-cash/claims/:id/reject',
    {
      schema: { params: idParams, body: z.object({ reason: z.string().trim().min(3).max(300) }) },
    },
    async (request): Promise<ClubExpenseClaims> => {
      await decideClaim(
        app.db,
        request.actor!,
        request.params.id,
        { approve: false, reason: request.body.reason },
        app.now(),
      );
      return claims(request);
    },
  );
  app.post(
    '/club-cash/claims/:id/pay',
    {
      schema: {
        params: idParams,
        body: z.object({ accountId: z.uuid(), categoryId: z.uuid(), paidOn: day }),
      },
    },
    async (request): Promise<ClubExpenseClaims> => {
      await payClaim(app.db, request.actor!, request.params.id, request.body, app.now());
      return claims(request);
    },
  );

  // ── Übungsleiter- und Ehrenamtspauschale ─────────────────────────────────
  app.get(
    '/club-cash/allowances',
    { schema: { querystring: z.object({ year }) } },
    async (request): Promise<ClubAllowances> =>
      getAllowances(app.db, request.actor!, request.query.year),
  );
  app.post(
    '/club-cash/allowances',
    {
      schema: {
        body: z.object({
          personId: z.uuid(),
          kind: z.enum(CLUB_ALLOWANCE_KINDS),
          amountCents: money,
          paidOn: day,
          accountId: z.uuid(),
          categoryId: z.uuid(),
          note: z.string().trim().max(200).nullish(),
          force: z.boolean().optional(),
        }),
      },
    },
    async (request, reply): Promise<ClubAllowances> => {
      await payAllowance(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return getAllowances(app.db, request.actor!, Number(request.body.paidOn.slice(0, 4)));
    },
  );

  // ── Zuschüsse ────────────────────────────────────────────────────────────
  const grants = (request: { actor?: unknown }) =>
    listGrants(app.db, request.actor as never, app.now());
  app.get('/club-cash/grants', async (request): Promise<ClubGrants> => grants(request));
  app.post(
    '/club-cash/grants',
    {
      schema: {
        body: z.object({
          name: z.string().trim().min(2).max(100),
          grantor: z.string().trim().min(2).max(100),
          amountCents: money,
          proofDeadline: day.nullish(),
          note: z.string().trim().max(300).nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubGrants> => {
      await createGrant(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return grants(request);
    },
  );
  app.post(
    '/club-cash/grants/:id/status',
    {
      schema: { params: idParams, body: z.object({ status: z.enum(CLUB_GRANT_STATUSES) }) },
    },
    async (request): Promise<ClubGrants> => {
      await setGrantStatus(
        app.db,
        request.actor!,
        request.params.id,
        request.body.status,
        app.now(),
      );
      return grants(request);
    },
  );
  app.post(
    '/club-cash/grants/:id/receive',
    {
      schema: {
        params: idParams,
        body: z.object({ accountId: z.uuid(), categoryId: z.uuid(), receivedOn: day }),
      },
    },
    async (request): Promise<ClubGrants> => {
      await receiveGrant(app.db, request.actor!, request.params.id, request.body, app.now());
      return grants(request);
    },
  );
  app.post(
    '/club-cash/grants/:id/proof',
    { schema: { params: idParams, body: z.object({ submitted: z.boolean() }) } },
    async (request): Promise<ClubGrants> => {
      await setGrantProof(
        app.db,
        request.actor!,
        request.params.id,
        request.body.submitted,
        app.now(),
      );
      return grants(request);
    },
  );

  // ── Sponsoren-Einnahmen ──────────────────────────────────────────────────
  app.get(
    '/club-cash/sponsor-income',
    { schema: { querystring: z.object({ year }) } },
    async (request): Promise<ClubSponsorIncome> =>
      getSponsorIncome(app.db, request.actor!, request.query.year),
  );
  app.get('/club-cash/sponsor-choices', async (request): Promise<{ id: string; name: string }[]> =>
    listSponsorChoices(app.db, request.actor!),
  );

  // ── Zuschuss an eine Mannschaftskasse ────────────────────────────────────
  app.get('/club-cash/team-grants', async (request): Promise<ClubTeamGrants> =>
    listTeamGrants(app.db, request.actor!),
  );
  app.post(
    '/club-cash/team-grants',
    {
      schema: {
        body: z.object({
          teamId: z.uuid(),
          accountId: z.uuid(),
          categoryId: z.uuid(),
          amountCents: money,
          bookedOn: day,
          note: z.string().trim().max(120).nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubTeamGrants> => {
      await createTeamGrant(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return listTeamGrants(app.db, request.actor!);
    },
  );

  // ── Inventar ─────────────────────────────────────────────────────────────
  const itemBody = z.object({
    name: z.string().trim().min(2).max(100),
    category: z.string().trim().max(60).nullish(),
    quantity: z.number().int().min(1).max(100_000).optional(),
    acquiredOn: day.nullish(),
    costCents: z.number().int().min(0).max(1_000_000_000).nullish(),
    location: z.string().trim().max(100).nullish(),
    note: z.string().trim().max(300).nullish(),
  });
  app.get('/club-cash/inventory', async (request): Promise<ClubInventory> =>
    getInventory(app.db, request.actor!),
  );
  app.post(
    '/club-cash/inventory',
    { schema: { body: itemBody } },
    async (request, reply): Promise<ClubInventory> => {
      await createInventoryItem(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return getInventory(app.db, request.actor!);
    },
  );
  app.patch(
    '/club-cash/inventory/:id',
    {
      schema: {
        params: idParams,
        body: itemBody.partial().extend({
          dispose: z.boolean().optional(),
          reason: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request): Promise<ClubInventory> => {
      await updateInventoryItem(app.db, request.actor!, request.params.id, request.body, app.now());
      return getInventory(app.db, request.actor!);
    },
  );
};
