import { resolve } from 'node:path';

export type Config = {
  host: string;
  port: number;
  databaseUrl: string | undefined;
  sessionTtlDays: number;
  /** Anmeldeversuche pro Minute und IP-Adresse */
  loginRateLimit: number;
  corsOrigins: string[] | true;
  /** Verzeichnis für hochgeladene Dateien */
  uploadsDir: string;
  /** Geheimnis für signierte Download-Links; ohne Angabe pro Serverstart zufällig */
  fileSigningSecret: string | undefined;
  /** Öffentliche Adresse der API (für Download-Links hinter einem Proxy) */
  publicUrl: string | undefined;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL,
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT ?? 10),
    // In der Entwicklung sind alle Ursprünge erlaubt; in Produktion explizit setzen.
    corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((o) => o.trim()) : true,
    uploadsDir: resolve(env.UPLOADS_DIR ?? 'data/uploads'),
    fileSigningSecret: env.FILE_SIGNING_SECRET,
    publicUrl: env.PUBLIC_API_URL?.replace(/\/$/, ''),
  };
}
