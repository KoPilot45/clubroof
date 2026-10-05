import { createDb } from '@clubroof/db';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { db, sql } = createDb(config.databaseUrl);
const app = await buildApp({ db, config, logger: true });

const shutdown = async () => {
  await app.close();
  await sql.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.host, port: config.port });
