import {
  SPONSOR_LABELS,
  SPONSOR_PLACEMENTS,
  SPONSOR_SCOPES,
  SPONSOR_TIERS,
  type AdminSponsors,
  type SponsorBanner,
  type SponsorPage,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createSponsor,
  deleteSponsor,
  getSponsorBanner,
  getSponsorPage,
  listAdminSponsors,
  setLabel,
  setOrder,
  updateSponsor,
} from '../services/sponsors';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const body = z.object({
  name: z.string().trim().min(2).max(80),
  tier: z.enum(SPONSOR_TIERS),
  linkUrl: z.string().trim().max(300).nullish(),
  scope: z.enum(SPONSOR_SCOPES),
  startsOn: day.nullish(),
  endsOn: day.nullish(),
  logoImageId: z.uuid().nullish(),
  bannerImageId: z.uuid().nullish(),
});

/** Sponsoren (Paket SPO): Anzeige für Mitglieder und Pflege durch die Vereinsadministration. */
export const sponsorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/sponsors', async (request): Promise<SponsorPage> =>
    getSponsorPage(app.db, request.actor!, app.now()),
  );
  app.get(
    '/sponsors/banner',
    { schema: { querystring: z.object({ placement: z.enum(SPONSOR_PLACEMENTS) }) } },
    async (request): Promise<SponsorBanner> =>
      getSponsorBanner(app.db, request.actor!, request.query.placement, app.now()),
  );

  app.get('/admin/sponsors', async (request): Promise<AdminSponsors> =>
    listAdminSponsors(app.db, request.actor!, app.now()),
  );
  app.post(
    '/admin/sponsors',
    { schema: { body } },
    async (request, reply): Promise<AdminSponsors> => {
      reply.code(201);
      return createSponsor(app.db, request.actor!, request.body, app.now());
    },
  );
  app.patch(
    '/admin/sponsors/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: body.extend({
          removeLogo: z.boolean().optional(),
          removeBanner: z.boolean().optional(),
        }),
      },
    },
    async (request): Promise<AdminSponsors> =>
      updateSponsor(app.db, request.actor!, request.params.id, request.body, app.now()),
  );
  app.delete(
    '/admin/sponsors/:id',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request): Promise<AdminSponsors> =>
      deleteSponsor(app.db, request.actor!, request.params.id, app.now()),
  );
  app.put(
    '/admin/sponsors/order',
    { schema: { body: z.object({ ids: z.array(z.uuid()).max(200) }) } },
    async (request): Promise<AdminSponsors> =>
      setOrder(app.db, request.actor!, request.body.ids, app.now()),
  );
  app.put(
    '/admin/sponsors/label',
    { schema: { body: z.object({ label: z.enum(SPONSOR_LABELS) }) } },
    async (request): Promise<AdminSponsors> =>
      setLabel(app.db, request.actor!, request.body.label, app.now()),
  );
};
