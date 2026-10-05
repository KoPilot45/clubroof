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
  /** Adresse der App/Web-App für Links in E-Mails (Einladung, Passwort zurücksetzen) */
  appUrl: string;
  /** SMTP-Server, z. B. smtp://localhost:1025 (Mailpit). Ohne Angabe werden Mails nur protokolliert. */
  smtpUrl: string | undefined;
  mailFrom: string;
  /** Schlüssel zum Verschlüsseln gespeicherter Geheimnisse (2-Faktor, Einladungslinks) */
  dataEncryptionKey: string;
  /** Einmal-Code für die Ersteinrichtung eines Vereins auf einem leeren Server */
  setupToken: string | undefined;
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
    appUrl: (env.APP_URL ?? 'http://localhost:8081').replace(/\/$/, ''),
    smtpUrl: env.SMTP_URL,
    mailFrom: env.MAIL_FROM ?? 'Clubroof <no-reply@clubroof.local>',
    dataEncryptionKey: encryptionKey(env),
    setupToken: env.SETUP_TOKEN,
  };
}

/**
 * In Produktion muss DATA_ENCRYPTION_KEY gesetzt sein (sonst Startabbruch). In der Entwicklung
 * gilt ein fester Schlüssel, damit verschlüsselte Daten Neustarts überstehen.
 */
function encryptionKey(env: NodeJS.ProcessEnv): string {
  if (env.DATA_ENCRYPTION_KEY) return env.DATA_ENCRYPTION_KEY;
  if (env.NODE_ENV === 'production') {
    throw new Error('DATA_ENCRYPTION_KEY fehlt – in Produktion zwingend erforderlich.');
  }
  return 'clubroof-entwicklung-nicht-fuer-produktion';
}
