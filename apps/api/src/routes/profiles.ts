import {
  CONTACT_VISIBILITIES,
  PLAYER_POSITIONS,
  PREFERRED_FEET,
  type PersonProfile,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getProfile, updateProfile } from '../services/profiles';

const params = z.object({ personId: z.uuid() });

export const profileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/persons/:personId', { schema: { params } }, async (request): Promise<PersonProfile> =>
    getProfile(app.db, request.actor!, request.params.personId, app.now()),
  );

  app.patch(
    '/persons/:personId',
    {
      schema: {
        params,
        body: z.object({
          phone: z
            .string()
            .trim()
            .max(30)
            .nullish()
            .transform((v) => v ?? null)
            .optional(),
          email: z.string().trim().max(120).email().nullable().optional(),
          position: z.enum(PLAYER_POSITIONS).nullable().optional(),
          preferredFoot: z.enum(PREFERRED_FEET).nullable().optional(),
          contactVisibility: z.enum(CONTACT_VISIBILITIES).optional(),
          avatarImageId: z.uuid().nullable().optional(),
        }),
      },
    },
    async (request): Promise<PersonProfile> =>
      updateProfile(app.db, request.actor!, request.params.personId, request.body, app.now()),
  );
};
