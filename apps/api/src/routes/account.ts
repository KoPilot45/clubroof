import type { AccountInfo, AccountLinkCode, AccountLinkPreview } from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  accountInfo,
  attachAccount,
  createAccountLinkCode,
  previewAccountLink,
} from '../services/account-club';

const limited = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

/** Konto ohne Verein (nur Sitzung) und Aufnahme eines Kontos durch den Verein per Code/QR. */
export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/account',
    { preHandler: app.authenticateAccount },
    async (request): Promise<AccountInfo> => accountInfo(app.db, request.sessionUser!.id),
  );

  app.post(
    '/account/link-code',
    { ...limited, preHandler: app.authenticateAccount },
    async (request, reply): Promise<AccountLinkCode> => {
      reply.code(201);
      return createAccountLinkCode(app.db, request.sessionUser!.id, app.now());
    },
  );

  app.get(
    '/account-links/:code',
    {
      ...limited,
      preHandler: app.authenticate,
      schema: { params: z.object({ code: z.string().min(8).max(60) }) },
    },
    async (request): Promise<AccountLinkPreview> =>
      previewAccountLink(app.db, request.actor!, request.params.code, app.now()),
  );

  app.post(
    '/members/attach-account',
    {
      ...limited,
      preHandler: app.authenticate,
      schema: {
        body: z.object({
          code: z.string().min(8).max(60),
          firstName: z.string().trim().min(1).max(60),
          lastName: z.string().trim().min(1).max(60),
          birthDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullish(),
          teamId: z.string().uuid().nullish(),
        }),
      },
    },
    async (request, reply) => {
      const out = await attachAccount(app.db, request.actor!, app.mailer, request.body, app.now());
      reply.code(201);
      return out;
    },
  );
};
