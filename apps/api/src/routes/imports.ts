import {
  IMPORT_AREAS,
  IMPORT_DUPLICATE_MODES,
  type ImportAreasResponse,
  type ImportPreview,
  type ImportRunInfo,
  type ImportTemplateFile,
} from '@clubroof/core';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  commitImport,
  listImportAreas,
  listImportRuns,
  previewImport,
  templateRows,
  undoImport,
} from '../services/import-engine';
import { writeCsv, writeXlsx } from '../services/table-file';

const body = z.object({
  area: z.enum(IMPORT_AREAS),
  teamId: z.uuid().nullish(),
  file: z.object({
    name: z.string().max(200),
    dataBase64: z.string().min(1).max(7_200_000),
  }),
  sheet: z.string().max(100).nullish(),
  mapping: z.array(z.string().max(40).nullable()).max(200).nullish(),
  duplicates: z.enum(IMPORT_DUPLICATE_MODES).optional(),
  excluded: z.array(z.number().int().positive()).max(6000).optional(),
  edits: z.record(z.string(), z.record(z.string(), z.string().max(300))).optional(),
});

/** Import-Assistent (Paket IM). Rechte je Bereich prüft `services/import-engine.ts`. */
export const importRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/import/areas', async (request): Promise<ImportAreasResponse> =>
    listImportAreas(app.db, request.actor!),
  );

  app.get(
    '/import/template/:area',
    {
      schema: {
        params: z.object({ area: z.enum(IMPORT_AREAS) }),
        querystring: z.object({ format: z.enum(['xlsx', 'csv']).default('xlsx') }),
      },
    },
    async (request): Promise<ImportTemplateFile> => {
      const { area } = request.params;
      const t = templateRows(area);
      if (request.query.format === 'csv')
        return {
          name: `clubroof-${area}-vorlage.csv`,
          contentType: 'text/csv;charset=utf-8',
          dataBase64: Buffer.from(writeCsv(t.sheet), 'utf8').toString('base64'),
        };
      return {
        name: `clubroof-${area}-vorlage.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dataBase64: Buffer.from(
          writeXlsx([
            { name: 'Vorlage', rows: t.sheet },
            { name: 'Erklärung', rows: t.explanation },
          ]),
        ).toString('base64'),
      };
    },
  );

  const limit = { bodyLimit: 8 * 1024 * 1024 };

  app.post(
    '/import/preview',
    { ...limit, schema: { body } },
    async (request): Promise<ImportPreview> =>
      previewImport(app.db, request.actor!, request.body, app.now()),
  );

  app.post(
    '/import/commit',
    { ...limit, schema: { body } },
    async (request): Promise<ImportPreview> =>
      commitImport(app.db, request.actor!, request.body, app.now()),
  );

  app.get('/import/runs', async (request): Promise<ImportRunInfo[]> =>
    listImportRuns(app.db, request.actor!, app.now()),
  );

  app.post(
    '/import/runs/:id/undo',
    { schema: { params: z.object({ id: z.uuid() }) } },
    async (request) => {
      await undoImport(app.db, request.actor!, request.params.id, app.now());
      return { ok: true };
    },
  );
};
