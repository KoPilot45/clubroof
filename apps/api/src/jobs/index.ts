/**
 * Hintergrundaufgaben: Erinnerungen, Sammelhinweise und Push-Versand. Ein Postgres-Advisory-Lock
 * stellt sicher, dass bei mehreren Server-Prozessen immer nur einer arbeitet.
 */
import { schema as s, type Db } from '@clubroof/db';
import { sql } from 'drizzle-orm';
import type { PushSender } from '../notify/push';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
import { dispatchPush } from './push';
import { sendCoachDigests, sendReminders } from './responses';
import { autoCashReminders, chargeDueFees } from '../services/cash-admin';

const LOCK_RESPONSES = 4_172_026;
const LOCK_PUSH = 4_172_027;
const LOCK_CASH = 4_172_028;

export type JobResult = { reminders: number; digests: number; pushes: number; fees: number };

/**
 * Jede Aufgabe läuft in einer eigenen Transaktion mit Transaktions-Lock (wird mit der
 * Transaktion freigegeben – auch bei einem Fehler oder Verbindungsabbruch).
 */
async function locked<T>(db: Db, id: number, fallback: T, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const [row] = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${id}) as locked`,
    );
    return row?.locked ? fn(tx) : fallback;
  });
}

export async function runJobs(db: Db, sender: PushSender, now: Date): Promise<JobResult> {
  const { reminders, digests } = await locked(
    db,
    LOCK_RESPONSES,
    { reminders: 0, digests: 0 },
    async (tx) => {
      let reminders = 0;
      let digests = 0;
      for (const club of await tx.select().from(s.clubs)) {
        reminders += await sendReminders(tx, club, now);
        digests += await sendCoachDigests(tx, club, now);
      }
      return { reminders, digests };
    },
  );
  // Mannschaftsbeiträge buchen und monatlich an offene Beträge erinnern
  const fees = await locked(db, LOCK_CASH, 0, async (tx) => {
    let charged = 0;
    for (const club of await tx.select().from(s.clubs)) {
      charged += await chargeDueFees(tx, club, now);
      await autoCashReminders(tx, club, now);
    }
    return charged;
  });
  const pushes = await locked(db, LOCK_PUSH, 0, (tx) => dispatchPush(tx, sender, now));
  return { reminders, digests, pushes, fees };
}

/** Startet die Aufgaben im Minutentakt; liefert eine Stopp-Funktion. */
export function startJobs(
  db: Db,
  sender: PushSender,
  now: () => Date,
  log: { error: (obj: unknown, msg: string) => void },
  intervalMs = 60_000,
): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runJobs(db, sender, now());
    } catch (err) {
      log.error(err, 'Hintergrundaufgaben fehlgeschlagen');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  void tick();
  return () => clearInterval(timer);
}
