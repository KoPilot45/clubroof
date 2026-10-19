import {
  CLUB_FEE_INTERVALS,
  type ClubFeeAssignment,
  type ClubFeeGenerateResult,
  type ClubFeeImportPreview,
  type ClubFees,
  type ClubFeeRuleResult,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { decodeText } from '../services/csv';
import {
  cancelDue,
  commitImport,
  createAssignment,
  createFeeType,
  endAssignment,
  generateDues,
  getClubFees,
  listAssignments,
  previewImport,
  recordPayment,
  searchFeeMembers,
  remindAllOverdue,
  remindDue,
  updateFeeType,
  assignByRules,
  setReminderSettings,
} from '../services/club-fees';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idParams = z.object({ id: z.uuid() });
const cents = z.number().int().min(1).max(100_000_000);

/** Mitgliedsbeiträge der Vereinskasse (Paket K2); Rechte wie die Vereinskasse (`clubcash.*`). */
export const clubFeeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  const overview = (request: { actor?: unknown }, query: { status?: never; q?: never } = {}) =>
    getClubFees(app.db, request.actor as never, query, app.now());

  app.get(
    '/club-cash/fees',
    {
      schema: {
        querystring: z.object({
          status: z.enum(['open', 'overdue', 'paid', 'cancelled', 'all']).optional(),
          q: z.string().max(80).optional(),
        }),
      },
    },
    async (request): Promise<ClubFees> =>
      getClubFees(app.db, request.actor!, request.query, app.now()),
  );

  app.get(
    '/club-cash/fees/assignments',
    { schema: { querystring: z.object({ q: z.string().max(80).optional() }) } },
    async (request): Promise<ClubFeeAssignment[]> =>
      listAssignments(app.db, request.actor!, request.query.q, app.now()),
  );

  app.get(
    '/club-cash/fees/members',
    { schema: { querystring: z.object({ q: z.string().max(60) }) } },
    async (request) => searchFeeMembers(app.db, request.actor!, request.query.q),
  );

  // ── Beitragsarten ────────────────────────────────────────────────────────
  app.post(
    '/club-cash/fees/types',
    {
      schema: {
        body: z.object({
          name: z.string().trim().min(2).max(60),
          amountCents: cents,
          interval: z.enum(CLUB_FEE_INTERVALS),
          categoryId: z.uuid().nullish(),
          fundId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply): Promise<ClubFees> => {
      await createFeeType(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return overview(request);
    },
  );
  app.patch(
    '/club-cash/fees/types/:id',
    {
      schema: {
        params: idParams,
        body: z.object({
          name: z.string().trim().min(2).max(60).optional(),
          amountCents: cents.optional(),
          categoryId: z.uuid().nullable().optional(),
          fundId: z.uuid().nullable().optional(),
          archived: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<ClubFees> => {
      await updateFeeType(app.db, request.actor!, request.params.id, request.body, app.now());
      return overview(request);
    },
  );

  // ── Zuordnung zu Mitgliedern ─────────────────────────────────────────────
  app.post(
    '/club-cash/fees/assignments',
    {
      schema: {
        body: z.object({
          personId: z.uuid(),
          feeTypeId: z.uuid(),
          amountOverrideCents: cents.nullish(),
          validFrom: day,
        }),
      },
    },
    async (request, reply): Promise<ClubFeeAssignment[]> => {
      await createAssignment(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return listAssignments(app.db, request.actor!, undefined, app.now());
    },
  );
  app.post(
    '/club-cash/fees/assignments/:id/end',
    { schema: { params: idParams, body: z.object({ validTo: day }) } },
    async (request): Promise<ClubFeeAssignment[]> => {
      await endAssignment(
        app.db,
        request.actor!,
        request.params.id,
        request.body.validTo,
        app.now(),
      );
      return listAssignments(app.db, request.actor!, undefined, app.now());
    },
  );

  // ── Sollstellung, Zahlung, Storno, Erinnerung ────────────────────────────
  app.post(
    '/club-cash/fees/generate',
    { schema: { body: z.object({ upTo: day.optional() }) } },
    async (request, reply): Promise<ClubFeeGenerateResult> => {
      reply.code(201);
      return generateDues(app.db, request.actor!, request.body.upTo, app.now());
    },
  );
  app.post(
    '/club-cash/fees/dues/:id/payments',
    {
      schema: {
        params: idParams,
        body: z.object({ accountId: z.uuid(), amountCents: cents, paidOn: day }),
      },
    },
    async (request, reply): Promise<ClubFees> => {
      await recordPayment(app.db, request.actor!, request.params.id, request.body, app.now());
      reply.code(201);
      return overview(request);
    },
  );
  app.post(
    '/club-cash/fees/dues/:id/cancel',
    {
      schema: { params: idParams, body: z.object({ reason: z.string().trim().min(3).max(300) }) },
    },
    async (request): Promise<ClubFees> => {
      await cancelDue(app.db, request.actor!, request.params.id, request.body.reason, app.now());
      return overview(request);
    },
  );
  app.post(
    '/club-cash/fees/dues/:id/remind',
    { schema: { params: idParams } },
    async (request): Promise<{ level: number; notified: boolean }> =>
      remindDue(app.db, request.actor!, request.params.id, app.now()),
  );
  app.post(
    '/club-cash/fees/remind-overdue',
    async (request): Promise<{ reminded: number; withoutLogin: number }> =>
      remindAllOverdue(app.db, request.actor!, app.now()),
  );

  app.put(
    '/club-cash/fees/reminder',
    {
      schema: {
        body: z.object({
          days: z.number().int().min(0).max(90),
          text: z.string().max(500).nullable(),
        }),
      },
    },
    async (request): Promise<{ ok: true }> => {
      await setReminderSettings(app.db, request.actor!, request.body, app.now());
      return { ok: true };
    },
  );
  app.post(
    '/club-cash/fees/assign-by-rules',
    {
      schema: {
        body: z.object({
          apply: z.boolean(),
          rules: z
            .array(
              z.object({
                when: z.enum(['under_age', 'inactive', 'rest']),
                age: z.number().int().min(1).max(99).optional(),
                feeTypeId: z.uuid(),
              }),
            )
            .min(1)
            .max(3),
        }),
      },
    },
    async (request): Promise<ClubFeeRuleResult> =>
      assignByRules(app.db, request.actor!, request.body, app.now()),
  );

  // ── CSV-Import vom Kontoauszug ───────────────────────────────────────────
  app.post(
    '/club-cash/fees/import/preview',
    {
      bodyLimit: 3 * 1024 * 1024,
      schema: {
        body: z.object({
          dataBase64: z.string().min(1).max(4_000_000),
          accountId: z.uuid().nullish(),
        }),
      },
    },
    async (request): Promise<ClubFeeImportPreview> =>
      previewImport(
        app.db,
        request.actor!,
        decodeText(Buffer.from(request.body.dataBase64, 'base64')),
        app.now(),
        request.body.accountId ?? null,
      ),
  );
  app.post(
    '/club-cash/fees/import/commit',
    {
      schema: {
        body: z.object({
          accountId: z.uuid(),
          items: z
            .array(z.object({ dueId: z.uuid(), amountCents: cents, paidOn: day }))
            .min(1)
            .max(500),
        }),
      },
    },
    async (request, reply): Promise<{ booked: number }> => {
      reply.code(201);
      return commitImport(app.db, request.actor!, request.body, app.now());
    },
  );
};
