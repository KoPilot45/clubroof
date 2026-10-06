/** Versendet fällige Push-Nachrichten aus der Warteschlange. */
import { schema as s, type Db } from '@clubroof/db';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
import { and, eq, inArray, lte } from 'drizzle-orm';
import type { PushMessage, PushSender } from '../notify/push';

const MAX_ATTEMPTS = 3;

export async function dispatchPush(db: Db | Tx, sender: PushSender, now: Date): Promise<number> {
  const due = await db
    .select({ outbox: s.pushOutbox, notification: s.notifications })
    .from(s.pushOutbox)
    .innerJoin(s.notifications, eq(s.notifications.id, s.pushOutbox.notificationId))
    .where(and(eq(s.pushOutbox.status, 'pending'), lte(s.pushOutbox.sendAfter, now)))
    .limit(500);
  if (due.length === 0) return 0;

  // Schon gelesen (z. B. in der Ruhezeit in der App angesehen) → kein Push mehr
  const read = due.filter((d) => d.notification.readAt);
  if (read.length)
    await db
      .update(s.pushOutbox)
      .set({ status: 'dropped' })
      .where(
        inArray(
          s.pushOutbox.id,
          read.map((d) => d.outbox.id),
        ),
      );
  const toSend = due.filter((d) => !d.notification.readAt);
  if (toSend.length === 0) return 0;

  const devices = await db
    .select()
    .from(s.pushDevices)
    .where(inArray(s.pushDevices.userId, [...new Set(toSend.map((d) => d.outbox.userId))]));
  const messages: { outboxId: string; token: string; message: PushMessage }[] = [];
  for (const d of toSend) {
    for (const device of devices.filter((x) => x.userId === d.outbox.userId)) {
      messages.push({
        outboxId: d.outbox.id,
        token: device.token,
        message: {
          to: device.token,
          title: d.notification.title,
          body: d.notification.body ?? '',
          data: { link: d.notification.link, notificationId: d.notification.id },
          priority: d.notification.level === 'urgent' ? 'high' : 'normal',
        },
      });
    }
  }
  const results = messages.length ? await sender.send(messages.map((m) => m.message)) : [];

  const gone = new Set<string>();
  const failed = new Map<string, string>();
  const ok = new Set<string>();
  results.forEach((r, i) => {
    const m = messages[i]!;
    if (r.ok) ok.add(m.outboxId);
    else {
      if (r.deviceGone) gone.add(m.token);
      else failed.set(m.outboxId, r.error);
    }
  });
  if (gone.size) await db.delete(s.pushDevices).where(inArray(s.pushDevices.token, [...gone]));

  let sent = 0;
  for (const d of toSend) {
    const id = d.outbox.id;
    if (ok.has(id) || !messages.some((m) => m.outboxId === id) || !failed.has(id)) {
      // Erfolgreich, kein Gerät mehr oder nur abgemeldete Geräte → erledigt
      await db
        .update(s.pushOutbox)
        .set({ status: ok.has(id) ? 'sent' : 'dropped', sentAt: ok.has(id) ? now : null })
        .where(eq(s.pushOutbox.id, id));
      if (ok.has(id)) sent++;
      continue;
    }
    const attempts = d.outbox.attempts + 1;
    await db
      .update(s.pushOutbox)
      .set({
        attempts,
        error: failed.get(id)!,
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        sendAfter: new Date(now.getTime() + attempts * 5 * 60_000),
      })
      .where(eq(s.pushOutbox.id, id));
  }
  return sent;
}
