import { MATCH_KINDS, SCHEDULE_FIELDS } from '@clubroof/core';
import type {
  SchedulePreview,
  TeamCandidate,
  TeamManage,
  TeamProfile,
  CashStats,
  EventDetail,
  Facility,
  MyTeamCard,
  TeamModule,
  RosterEntry,
  TeamCash,
  TeamOverview,
  TeamStats,
  TreasurerCandidates,
} from '@clubroof/core';
import { schema as s } from '@clubroof/db';
import { and, asc, eq, ne } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { runScheduleImport, undoScheduleImport } from '../services/schedule-import';
import {
  addTeamMember,
  getTeamManage,
  removeTeamMember,
  searchCandidates,
  updateTeamMember,
  updateTeamProfile,
} from '../services/team-manage';
import {
  archiveFineType,
  assignFine,
  cashReportLink,
  createBooking,
  createFineType,
  getCashStats,
  getTeamCash,
  updateFineType,
} from '../services/cash';
import {
  cancelTransaction,
  createClosing,
  createFee,
  createLevy,
  createPaymentNotice,
  decidePaymentNotice,
  endFee,
  getTreasurers,
  recordDrinks,
  recordPayments,
  sendCashReminders,
  setTreasurer,
  updateCashSettings,
} from '../services/cash-admin';
import { cancelEvent, createTeamEvent, updateEvent } from '../services/event-admin';
import { setTeamModule, teamModulesForCoach } from '../services/modules';
import { getMyTeams, getRoster, getTeamOverview, getTeamStats } from '../services/teams';

const teamParams = z.object({ teamId: z.uuid() });
const paymentMethod = z.enum(['bar', 'ueberweisung', 'paypal']);
const cents = z.number().int().min(1).max(1_000_000);
const isoDateTime = z.iso.datetime({ offset: true });

/** Team-Cockpit, Kasse und Trainer-Funktionen. */
export const teamRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/teams/:teamId/cash/report-link',
    {
      schema: {
        params: teamParams,
        querystring: z.object({
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          format: z.enum(['csv', 'pdf']).optional(),
        }),
      },
    },
    async (request): Promise<{ url: string; expiresAt: string }> => {
      const { token, expiresAt } = await cashReportLink(
        app.db,
        request.actor!,
        request.params.teamId,
        request.query,
        app.now(),
      );
      const base = app.config.publicUrl ?? `${request.protocol}://${request.headers.host}`;
      return { url: `${base}/files/${token}`, expiresAt };
    },
  );

  app.get(
    '/teams/:teamId/modules',
    { schema: { params: teamParams } },
    async (request): Promise<TeamModule[]> =>
      teamModulesForCoach(app.db, request.actor!, request.params.teamId),
  );

  app.put(
    '/teams/:teamId/modules/:key',
    {
      schema: {
        params: teamParams.extend({ key: z.string().max(40) }),
        body: z.object({ enabled: z.boolean() }),
      },
    },
    async (request): Promise<TeamModule[]> =>
      setTeamModule(
        app.db,
        request.actor!,
        request.params.teamId,
        request.params.key,
        request.body.enabled,
        app.now(),
      ),
  );

  app.get('/my-teams', async (request): Promise<MyTeamCard[]> =>
    getMyTeams(app.db, request.actor!, app.now()),
  );

  app.get(
    '/teams/:teamId',
    { schema: { params: teamParams } },
    async (request): Promise<TeamOverview> =>
      getTeamOverview(app.db, request.actor!, request.params.teamId, app.now()),
  );

  // ── Mannschaft bearbeiten (Trainerteam) ─────────────────────────────────
  app.get(
    '/teams/:teamId/manage',
    { schema: { params: teamParams } },
    async (request): Promise<TeamManage> =>
      getTeamManage(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.get(
    '/teams/:teamId/manage/candidates',
    { schema: { params: teamParams, querystring: z.object({ q: z.string().max(60) }) } },
    async (request): Promise<TeamCandidate[]> =>
      searchCandidates(app.db, request.actor!, request.params.teamId, request.query.q, app.now()),
  );

  app.post(
    '/teams/:teamId/manage/members',
    {
      schema: {
        params: teamParams,
        body: z.object({
          personId: z.uuid(),
          function: z.enum(['player', 'assistant_coach', 'team_manager']),
          jerseyNumber: z.number().int().min(0).max(99).nullish(),
        }),
      },
    },
    async (request, reply): Promise<TeamManage> => {
      await addTeamMember(app.db, request.actor!, request.params.teamId, request.body, app.now());
      reply.code(201);
      return getTeamManage(app.db, request.actor!, request.params.teamId, app.now());
    },
  );

  app.patch(
    '/teams/:teamId/manage/members/:membershipId',
    {
      schema: {
        params: teamParams.extend({ membershipId: z.uuid() }),
        body: z.object({
          function: z.enum(['player', 'assistant_coach', 'team_manager']).optional(),
          jerseyNumber: z.number().int().min(0).max(99).nullish(),
        }),
      },
    },
    async (request): Promise<TeamManage> => {
      await updateTeamMember(
        app.db,
        request.actor!,
        request.params.teamId,
        request.params.membershipId,
        request.body,
        app.now(),
      );
      return getTeamManage(app.db, request.actor!, request.params.teamId, app.now());
    },
  );

  app.delete(
    '/teams/:teamId/manage/members/:membershipId',
    { schema: { params: teamParams.extend({ membershipId: z.uuid() }) } },
    async (request): Promise<TeamManage> => {
      await removeTeamMember(
        app.db,
        request.actor!,
        request.params.teamId,
        request.params.membershipId,
        app.now(),
      );
      return getTeamManage(app.db, request.actor!, request.params.teamId, app.now());
    },
  );

  app.put(
    '/teams/:teamId/profile',
    {
      schema: {
        params: teamParams,
        body: z.object({
          matchMeetingMinutes: z.number().int().min(0).max(300).nullable().optional(),
          trainingMeetingMinutes: z.number().int().min(0).max(300).nullable().optional(),
          defaultMeetingPoint: z.string().max(120).nullable().optional(),
          importAliases: z.array(z.string().max(80)).max(10).optional(),
          leaguePosition: z.number().int().min(1).max(40).nullable().optional(),
          trainingDeadlineHours: z.number().int().min(1).max(336).nullable().optional(),
          matchDeadlineHours: z.number().int().min(1).max(336).nullable().optional(),
        }),
      },
    },
    async (request): Promise<TeamProfile> =>
      updateTeamProfile(app.db, request.actor!, request.params.teamId, request.body, app.now()),
  );

  // ── Spielplan-Import (DFBnet) ───────────────────────────────────────────
  app.post(
    '/schedule-import',
    {
      bodyLimit: 3 * 1024 * 1024,
      schema: {
        body: z.object({
          dataBase64: z.string().min(1).max(2_800_000),
          teamId: z.uuid().nullish(),
          columns: z
            .partialRecord(z.enum(SCHEDULE_FIELDS), z.string().max(80).nullable())
            .optional(),
          mapping: z.record(z.string().max(120), z.string().max(40)).optional(),
          commit: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<SchedulePreview> =>
      runScheduleImport(app.db, request.actor!, request.body, app.now()),
  );

  app.post(
    '/schedule-import/:batchId/undo',
    { schema: { params: z.object({ batchId: z.uuid() }) } },
    async (request) =>
      undoScheduleImport(app.db, request.actor!, request.params.batchId, app.now()),
  );

  app.get(
    '/teams/:teamId/roster',
    { schema: { params: teamParams } },
    async (request): Promise<RosterEntry[]> =>
      getRoster(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.get(
    '/teams/:teamId/stats',
    {
      schema: {
        params: teamParams,
        querystring: z.object({
          period: z.enum(['season', 'month', 'custom']).optional(),
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      },
    },
    async (request): Promise<TeamStats> =>
      getTeamStats(app.db, request.actor!, request.params.teamId, app.now(), request.query),
  );

  app.get(
    '/teams/:teamId/cash',
    { schema: { params: teamParams } },
    async (request): Promise<TeamCash> =>
      getTeamCash(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.post(
    '/teams/:teamId/cash/bookings',
    {
      schema: {
        params: teamParams,
        body: z.object({
          kind: z.enum(['income', 'expense', 'fine', 'drinks', 'payment']),
          amountCents: z.number().int().min(1).max(1_000_000),
          description: z.string().trim().min(2).max(120),
          personId: z.uuid().nullish(),
          counterparty: z.string().trim().max(120).nullish(),
          bookedOn: z.iso.date().nullish(),
          category: z.string().max(40).nullish(),
          paymentMethod: paymentMethod.nullish(),
          receiptImageId: z.uuid().nullish(),
        }),
      },
    },
    async (request, reply) => {
      const cash = await createBooking(
        app.db,
        request.actor!,
        request.params.teamId,
        request.body,
        app.now(),
      );
      return reply.status(201).send(cash);
    },
  );

  // ── Strafenkatalog und Kassenstatistik ──────────────────────────────────
  const fineType = z.object({
    name: z.string().trim().min(2).max(60),
    amountCents: z.number().int().min(1).max(100_000),
  });

  app.post(
    '/teams/:teamId/cash/fine-types',
    { schema: { params: teamParams, body: fineType } },
    async (request): Promise<TeamCash> =>
      createFineType(app.db, request.actor!, request.params.teamId, request.body),
  );

  app.put(
    '/cash/fine-types/:fineTypeId',
    { schema: { params: z.object({ fineTypeId: z.uuid() }), body: fineType } },
    async (request): Promise<TeamCash> =>
      updateFineType(app.db, request.actor!, request.params.fineTypeId, request.body),
  );

  app.delete(
    '/cash/fine-types/:fineTypeId',
    { schema: { params: z.object({ fineTypeId: z.uuid() }) } },
    async (request): Promise<TeamCash> =>
      archiveFineType(app.db, request.actor!, request.params.fineTypeId, app.now()),
  );

  app.post(
    '/teams/:teamId/cash/fines',
    {
      schema: {
        params: teamParams,
        body: z.object({
          fineTypeId: z.uuid().nullish(),
          amountCents: z.number().int().min(1).max(100_000).optional(),
          description: z.string().trim().min(2).max(120).optional(),
          personIds: z.array(z.uuid()).min(1).max(60),
          bookedOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) => {
      const cash = await assignFine(
        app.db,
        request.actor!,
        request.params.teamId,
        request.body,
        app.now(),
      );
      return reply.status(201).send(cash);
    },
  );

  // ── Kassenverwaltung ────────────────────────────────────────────────────
  app.put(
    '/teams/:teamId/cash/settings',
    {
      schema: {
        params: teamParams,
        body: z.object({
          iban: z
            .string()
            .trim()
            .max(42)
            .regex(/^[A-Za-z]{2}\d{2}[A-Za-z0-9 ]{10,38}$|^$/, 'Bitte gib eine gültige IBAN an.')
            .nullish(),
          accountHolder: z.string().trim().max(80).nullish(),
          paypalLink: z.string().trim().max(200).nullish(),
          drinkPriceCents: z.number().int().min(1).max(10_000).nullish(),
          showMemberBalances: z.boolean().optional(),
          autoReminder: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<TeamCash> =>
      updateCashSettings(app.db, request.actor!, request.params.teamId, request.body, app.now()),
  );

  app.post(
    '/teams/:teamId/cash/payments',
    {
      schema: {
        params: teamParams,
        body: z.object({
          items: z
            .array(z.object({ personId: z.uuid(), amountCents: cents }))
            .min(1)
            .max(60),
          paymentMethod,
          bookedOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await recordPayments(
            app.db,
            request.actor!,
            request.params.teamId,
            request.body,
            app.now(),
          ),
        ),
  );

  app.post(
    '/teams/:teamId/cash/drinks',
    {
      schema: {
        params: teamParams,
        body: z.object({
          items: z
            .array(z.object({ personId: z.uuid(), count: z.number().int().min(0).max(50) }))
            .min(1)
            .max(60),
          priceCents: z.number().int().min(1).max(10_000).nullish(),
          bookedOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await recordDrinks(
            app.db,
            request.actor!,
            request.params.teamId,
            request.body,
            app.now(),
          ),
        ),
  );

  app.post(
    '/teams/:teamId/cash/levies',
    {
      schema: {
        params: teamParams,
        body: z.object({
          description: z.string().trim().min(2).max(100),
          mode: z.enum(['split', 'each']),
          amountCents: cents,
          personIds: z.array(z.uuid()).min(1).max(60),
          bookedOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await createLevy(app.db, request.actor!, request.params.teamId, request.body, app.now()),
        ),
  );

  app.post(
    '/teams/:teamId/cash/fees',
    {
      schema: {
        params: teamParams,
        body: z.object({
          name: z.string().trim().min(2).max(60),
          amountCents: cents,
          interval: z.enum(['monthly', 'season', 'once']),
          startsOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await createFee(app.db, request.actor!, request.params.teamId, request.body, app.now()),
        ),
  );

  app.delete(
    '/cash/fees/:feeId',
    { schema: { params: z.object({ feeId: z.uuid() }) } },
    async (request): Promise<TeamCash> =>
      endFee(app.db, request.actor!, request.params.feeId, app.now()),
  );

  app.post(
    '/cash/transactions/:transactionId/cancel',
    {
      schema: {
        params: z.object({ transactionId: z.uuid() }),
        body: z.object({ reason: z.string().trim().max(200).nullish() }),
      },
    },
    async (request): Promise<TeamCash> =>
      cancelTransaction(
        app.db,
        request.actor!,
        request.params.transactionId,
        request.body.reason ?? null,
        app.now(),
      ),
  );

  app.post(
    '/teams/:teamId/cash/reminders',
    {
      schema: {
        params: teamParams,
        body: z.object({ personIds: z.array(z.uuid()).max(60).nullish() }),
      },
    },
    async (request): Promise<{ sent: number }> =>
      sendCashReminders(
        app.db,
        request.actor!,
        request.params.teamId,
        request.body.personIds ?? null,
        app.now(),
      ),
  );

  app.post(
    '/teams/:teamId/cash/payment-notices',
    {
      schema: {
        params: teamParams,
        body: z.object({
          personId: z.uuid(),
          amountCents: cents,
          paymentMethod,
          note: z.string().trim().max(200).nullish(),
        }),
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await createPaymentNotice(
            app.db,
            request.actor!,
            request.params.teamId,
            request.body,
            app.now(),
          ),
        ),
  );

  app.post(
    '/cash/payment-notices/:noticeId/:decision',
    {
      schema: {
        params: z.object({ noticeId: z.uuid(), decision: z.enum(['confirm', 'reject']) }),
      },
    },
    async (request): Promise<TeamCash> =>
      decidePaymentNotice(
        app.db,
        request.actor!,
        request.params.noticeId,
        request.params.decision === 'confirm',
        app.now(),
      ),
  );

  app.get(
    '/teams/:teamId/cash/treasurers',
    { schema: { params: teamParams } },
    async (request): Promise<TreasurerCandidates> =>
      getTreasurers(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.put(
    '/teams/:teamId/cash/treasurers/:personId',
    {
      schema: {
        params: teamParams.extend({ personId: z.uuid() }),
        body: z.object({ enabled: z.boolean() }),
      },
    },
    async (request): Promise<TreasurerCandidates> =>
      setTreasurer(
        app.db,
        request.actor!,
        request.params.teamId,
        request.params.personId,
        request.body.enabled,
        app.now(),
      ),
  );

  app.post(
    '/teams/:teamId/cash/closings',
    {
      schema: {
        params: teamParams,
        body: z.object({
          auditor: z.string().trim().max(80).nullish(),
          note: z.string().trim().max(300).nullish(),
          closedOn: z.iso.date().nullish(),
        }),
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await createClosing(
            app.db,
            request.actor!,
            request.params.teamId,
            request.body,
            app.now(),
          ),
        ),
  );

  app.get(
    '/teams/:teamId/cash/stats',
    { schema: { params: teamParams } },
    async (request): Promise<CashStats> =>
      getCashStats(app.db, request.actor!, request.params.teamId, app.now()),
  );

  app.post(
    '/teams/:teamId/events',
    {
      schema: {
        params: teamParams,
        body: z.object({
          type: z.enum(['training', 'match', 'team_event']),
          title: z.string().trim().max(120).nullish(),
          startsAt: isoDateTime,
          endsAt: isoDateTime.nullish(),
          meetingAt: isoDateTime.nullish(),
          meetingPoint: z.string().trim().max(120).nullish(),
          facilityId: z.uuid().nullish(),
          locationText: z.string().trim().max(160).nullish(),
          locationUrl: z.string().trim().max(400).nullish(),
          description: z.string().trim().max(1000).nullish(),
          opponentName: z.string().trim().max(80).nullish(),
          isHome: z.boolean().nullish(),
          allowConflict: z.boolean().optional(),
          repeatWeeks: z.number().int().min(1).max(26).optional(),
          repeatUntil: z.iso.date().nullish(),
          matchKind: z.enum(MATCH_KINDS).nullish(),
        }),
      },
    },
    async (request, reply): Promise<EventDetail> => {
      const event = await createTeamEvent(
        app.db,
        request.actor!,
        request.params.teamId,
        request.body,
        app.now(),
      );
      return reply.status(201).send(event);
    },
  );

  app.post(
    '/events/:eventId/cancel',
    {
      schema: {
        params: z.object({ eventId: z.uuid() }),
        body: z.object({ reason: z.string().trim().min(3).max(200) }),
      },
    },
    async (request): Promise<EventDetail> =>
      cancelEvent(app.db, request.actor!, request.params.eventId, request.body.reason, app.now()),
  );

  app.patch(
    '/events/:eventId',
    {
      schema: {
        params: z.object({ eventId: z.uuid() }),
        body: z.object({
          title: z.string().trim().max(120).optional(),
          startsAt: isoDateTime.optional(),
          endsAt: isoDateTime.nullish(),
          meetingAt: isoDateTime.nullish(),
          meetingPoint: z.string().trim().max(120).nullish(),
          facilityId: z.uuid().nullish(),
          locationText: z.string().trim().max(160).nullish(),
          locationUrl: z.string().trim().max(400).nullish(),
          description: z.string().trim().max(1000).nullish(),
          opponentName: z.string().trim().max(80).optional(),
          matchKind: z.enum(MATCH_KINDS).optional(),
          isHome: z.boolean().optional(),
          scope: z.enum(['single', 'following']).optional(),
          allowConflict: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<EventDetail> =>
      updateEvent(app.db, request.actor!, request.params.eventId, request.body, app.now()),
  );

  app.get('/facilities', async (request): Promise<Facility[]> =>
    app.db
      .select({ id: s.facilities.id, name: s.facilities.name, shortName: s.facilities.shortName })
      .from(s.facilities)
      .where(
        and(
          eq(s.facilities.clubId, request.actor!.club.id),
          ne(s.facilities.kind, 'changing_room'),
        ),
      )
      .orderBy(asc(s.facilities.sortOrder)),
  );

  /** Vorschläge für den Treffpunkt: Spielstätten, Kabinen (mit Anlage) und Plätze ohne Anlage. */
  app.get('/meeting-places', async (request): Promise<{ label: string }[]> => {
    const clubId = request.actor!.club.id;
    const venues = await app.db
      .select({ name: s.venues.name })
      .from(s.venues)
      .where(eq(s.venues.clubId, clubId))
      .orderBy(asc(s.venues.sortOrder));
    const facilities = await app.db
      .select({ name: s.facilities.name, kind: s.facilities.kind, venue: s.venues.name })
      .from(s.facilities)
      .leftJoin(s.venues, eq(s.venues.id, s.facilities.venueId))
      .where(eq(s.facilities.clubId, clubId))
      .orderBy(asc(s.facilities.sortOrder));
    const labels = [
      ...venues.map((v) => v.name),
      ...facilities
        .filter((f) => f.kind === 'changing_room' || !f.venue)
        .map((f) => (f.venue ? `${f.name} · ${f.venue}` : f.name)),
    ];
    return [...new Set(labels)].slice(0, 12).map((label) => ({ label }));
  });
};
