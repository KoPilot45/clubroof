import {
  SPONSOR_LABELS,
  type AdminSponsors,
  type SponsorAds,
  type SponsorPage,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createSponsor,
  deleteSponsor,
  getSponsorAds,
  getSponsorPage,
  listAdminSponsors,
  setLabel,
  setOrder,
  updateSponsor,
} from '../services/sponsors';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const body = z.object({
  name: z.string().trim().min(2).max(80),
  slogan: z.string().trim().max(80).nullish(),
  description: z.string().trim().max(1000).nullish(),
  linkUrl: z.string().trim().max(300).nullish(),
  startsOn: day.nullish(),
  endsOn: day.nullish(),
  advertise: z.boolean(),
  hideForYouth: z.boolean(),
  logoImageId: z.uuid().nullish(),
  logoDarkImageId: z.uuid().nullish(),
});

/** Sponsoren (Paket SPO): Anzeige für Mitglieder und Pflege durch die Vereinsadministration. */
export const sponsorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/sponsors', async (request): Promise<SponsorPage> =>
    getSponsorPage(app.db, request.actor!, app.now()),
  );
  // Container (Home, Team, Verein): bis zu drei zufällige Sponsoren mit Werbung, je Sitzung stabil (`seed`)
  app.get(
    '/sponsors/ads',
    { schema: { querystring: z.object({ seed: z.string().max(64).optional() }) } },
    async (request): Promise<SponsorAds> =>
      getSponsorAds(app.db, request.actor!, request.query.seed, app.now()),
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
          removeLogoDark: z.boolean().optional(),
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
