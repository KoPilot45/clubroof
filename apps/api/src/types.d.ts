import type { Db } from '@clubroof/db';
import type { Actor } from './actor';
import type { SessionUser } from './auth/session';
import type { Config } from './config';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Config;
    /** Aktuelle Zeit – in Tests fest einstellbar */
    now: () => Date;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    sessionUser: SessionUser | null;
    actor: Actor | null;
  }
}
