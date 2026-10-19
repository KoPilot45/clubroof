import {
  EXPORT_AREAS,
  EXPORT_FORMATS,
  type ExportAreasResponse,
  type ExportFile,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { exportFile, listExportAreas } from '../services/exports';

/** Exporte (Paket IMPORT-EXPORT, Stufe 3). Rechte je Bereich prüft `services/exports.ts`. */
export const exportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/export/areas', async (request): Promise<ExportAreasResponse> => ({
    areas: await listExportAreas(app.db, request.actor!),
  }));

  app.get(
    '/export/:area',
    {
      schema: {
        params: z.object({ area: z.enum(EXPORT_AREAS) }),
        querystring: z.object({
          teamId: z.uuid().optional(),
          format: z.enum(EXPORT_FORMATS).default('xlsx'),
        }),
      },
    },
    async (request): Promise<ExportFile> =>
      exportFile(
        app.db,
        request.actor!,
        { area: request.params.area, ...request.query },
        app.now(),
      ),
  );
};
