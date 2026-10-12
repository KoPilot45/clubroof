import {
  CLUB_AUDIT_MAX_SAMPLE,
  type ClubAuditDetail,
  type ClubAudits,
  type ClubDonations,
  type ClubTaxInfo,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  addFinding,
  auditReportLink,
  drawSample,
  getAudit,
  listAudits,
  removeFinding,
  startAudit,
  submitAudit,
} from '../services/club-audit';
import {
  approveTemplate,
  createDonation,
  getTaxInfo,
  issueReceipt,
  listDonations,
  receiptLink,
  saveTaxInfo,
} from '../services/club-donations';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const year = z.coerce.number().int().min(2000).max(2100);
const idParams = z.object({ id: z.uuid() });

/** Vereinskasse: Kassenprüfung, Spenden und Zuwendungsbestätigungen (Paket K4). */
export const clubAuditRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  const origin = (request: { protocol: string; headers: { host?: string } }) =>
    app.config.publicUrl ?? `${request.protocol}://${request.headers.host}`;

  // ── Kassenprüfung ────────────────────────────────────────────────────────
  app.get('/club-cash/audits', async (request): Promise<ClubAudits> =>
    listAudits(app.db, request.actor!, app.now()),
  );
  app.post(
    '/club-cash/audits',
    {
      schema: { body: z.object({ year, fundId: z.uuid().nullish() }) },
    },
    async (request, reply): Promise<ClubAuditDetail> => {
      const { id } = await startAudit(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return getAudit(app.db, request.actor!, id, app.now());
    },
  );
  app.get(
    '/club-cash/audits/:id',
    { schema: { params: idParams } },
    async (request): Promise<ClubAuditDetail> =>
      getAudit(app.db, request.actor!, request.params.id, app.now()),
  );
  app.post(
    '/club-cash/audits/:id/sample',
    {
      schema: {
        params: idParams,
        body: z.object({ count: z.number().int().min(1).max(CLUB_AUDIT_MAX_SAMPLE) }),
      },
    },
    async (request): Promise<ClubAuditDetail> => {
      await drawSample(app.db, request.actor!, request.params.id, request.body.count, app.now());
      return getAudit(app.db, request.actor!, request.params.id, app.now());
    },
  );
  app.post(
    '/club-cash/audits/:id/findings',
    {
      schema: {
        params: idParams,
        body: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('note'), text: z.string().trim().min(3).max(500) }),
          z.object({
            kind: z.enum(['checked', 'objection']),
            entryId: z.uuid(),
            text: z.string().trim().max(500).nullish(),
          }),
        ]),
      },
    },
    async (request, reply): Promise<ClubAuditDetail> => {
      await addFinding(app.db, request.actor!, request.params.id, request.body, app.now());
      reply.code(201);
      return getAudit(app.db, request.actor!, request.params.id, app.now());
    },
  );
  app.delete(
    '/club-cash/audits/:id/findings/:findingId',
    { schema: { params: z.object({ id: z.uuid(), findingId: z.uuid() }) } },
    async (request): Promise<ClubAuditDetail> => {
      await removeFinding(app.db, request.actor!, request.params.id, request.params.findingId);
      return getAudit(app.db, request.actor!, request.params.id, app.now());
    },
  );
  app.post(
    '/club-cash/audits/:id/submit',
    {
      schema: {
        params: idParams,
        body: z.object({ conclusion: z.string().trim().min(10).max(2000) }),
      },
    },
    async (request): Promise<ClubAuditDetail> => {
      await submitAudit(
        app.db,
        request.actor!,
        request.params.id,
        request.body.conclusion,
        app.now(),
      );
      return getAudit(app.db, request.actor!, request.params.id, app.now());
    },
  );
  app.get(
    '/club-cash/audits/:id/report-link',
    {
      schema: { params: idParams, querystring: z.object({ format: z.enum(['csv', 'pdf']) }) },
    },
    async (request): Promise<{ url: string; expiresAt: string }> => {
      const { token, expiresAt } = await auditReportLink(
        app.db,
        request.actor!,
        request.params.id,
        request.query.format,
        app.now(),
      );
      return { url: `${origin(request)}/files/${token}`, expiresAt };
    },
  );

  // ── Spenden und Zuwendungsbestätigungen ──────────────────────────────────
  app.get(
    '/club-cash/donations',
    { schema: { querystring: z.object({ year }) } },
    async (request): Promise<ClubDonations> =>
      listDonations(app.db, request.actor!, request.query.year, app.now()),
  );
  app.post(
    '/club-cash/donations',
    {
      schema: {
        body: z.object({
          accountId: z.uuid(),
          categoryId: z.uuid(),
          donorName: z.string().trim().min(2).max(120),
          donorAddress: z.string().trim().min(5).max(240),
          personId: z.uuid().nullish(),
          amountCents: z.number().int().min(1).max(100_000_000),
          donatedOn: day,
          waiver: z.boolean(),
        }),
      },
    },
    async (request, reply): Promise<ClubDonations> => {
      await createDonation(app.db, request.actor!, request.body, app.now());
      reply.code(201);
      return listDonations(
        app.db,
        request.actor!,
        Number(request.body.donatedOn.slice(0, 4)),
        app.now(),
      );
    },
  );
  app.post(
    '/club-cash/donations/:id/issue',
    {
      schema: { params: idParams, querystring: z.object({ year }) },
    },
    async (request): Promise<ClubDonations> => {
      await issueReceipt(app.db, request.actor!, request.params.id, app.now());
      return listDonations(app.db, request.actor!, request.query.year, app.now());
    },
  );
  app.get(
    '/club-cash/donations/:id/receipt-link',
    { schema: { params: idParams } },
    async (request): Promise<{ url: string; expiresAt: string }> => {
      const { token, expiresAt } = await receiptLink(
        app.db,
        request.actor!,
        request.params.id,
        app.now(),
      );
      return { url: `${origin(request)}/files/${token}`, expiresAt };
    },
  );
  app.get('/club-cash/tax', async (request): Promise<ClubTaxInfo> => {
    await listDonations(app.db, request.actor!, 2000, app.now());
    return getTaxInfo(app.db, request.actor!.club.id);
  });
  app.put(
    '/club-cash/tax',
    {
      schema: {
        body: z.object({
          taxOffice: z.string().trim().min(2).max(120),
          taxNumber: z.string().trim().min(3).max(40),
          exemptionKind: z.enum(['freistellung', 'feststellung']),
          exemptionDate: day,
          exemptionPeriod: z.string().trim().min(4).max(40),
          purposes: z.string().trim().min(3).max(200),
        }),
      },
    },
    async (request): Promise<ClubTaxInfo> => {
      await saveTaxInfo(app.db, request.actor!, request.body, app.now());
      return getTaxInfo(app.db, request.actor!.club.id);
    },
  );
  app.post(
    '/club-cash/tax/approve',
    { schema: { body: z.object({ note: z.string().trim().min(3).max(200) }) } },
    async (request): Promise<ClubTaxInfo> => {
      await approveTemplate(app.db, request.actor!, request.body.note, app.now());
      return getTaxInfo(app.db, request.actor!.club.id);
    },
  );
};
