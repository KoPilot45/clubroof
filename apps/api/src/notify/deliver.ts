/**
 * Zentrale Zustellung aller Benachrichtigungen (Konzept §10).
 * - Dringendes kommt immer an, auch als Push und während der Ruhezeit.
 * - Sonst entscheiden die persönlichen Einstellungen: Thema aus, Mannschaft stummgeschaltet,
 *   nur in der App oder zusätzlich als Push (in der Ruhezeit zurückgestellt).
 * - `dedupeKey` verhindert doppelte Erinnerungen und Sammelhinweise.
 */
import {
  pushSendAfter,
  topicInfo,
  type NotificationLevel,
  type NotificationMode,
  type NotificationTopic,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { inArray } from 'drizzle-orm';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type PrefRow = typeof s.notificationPreferences.$inferSelect;

export type NotificationInput = {
  level: NotificationLevel;
  topic: NotificationTopic;
  teamId?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Gleiche Meldung je Empfänger höchstens einmal */
  dedupeKey?: string;
};

export function modeFor(pref: PrefRow | undefined, topic: NotificationTopic): NotificationMode {
  const custom = pref?.topics[topic];
  return custom === 'push' || custom === 'app' || custom === 'off'
    ? custom
    : topicInfo(topic).defaultMode;
}

/** Liefert die Anzahl tatsächlich angelegter Benachrichtigungen. */
export async function deliver(
  db: Db | Tx,
  club: { id: string; timezone: string },
  userIds: string[],
  n: NotificationInput,
  now: Date,
): Promise<number> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  const prefs = await db
    .select()
    .from(s.notificationPreferences)
    .where(inArray(s.notificationPreferences.userId, unique));
  const prefOf = (userId: string) => prefs.find((p) => p.userId === userId);
  const urgent = n.level === 'urgent';

  const recipients = unique.filter((userId) => {
    if (urgent) return true;
    const pref = prefOf(userId);
    if (modeFor(pref, n.topic) === 'off') return false;
    return !(n.teamId && pref?.mutedTeamIds.includes(n.teamId));
  });
  if (recipients.length === 0) return 0;

  const inserted = await db
    .insert(s.notifications)
    .values(
      recipients.map((userId) => ({
        clubId: club.id,
        userId,
        level: n.level,
        category: topicInfo(n.topic).category,
        topic: n.topic,
        teamId: n.teamId ?? null,
        title: n.title,
        body: n.body ?? null,
        link: n.link ?? null,
        dedupeKey: n.dedupeKey ?? null,
        createdAt: now,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: s.notifications.id, userId: s.notifications.userId });

  const forPush = inserted.filter(
    ({ userId }) => urgent || modeFor(prefOf(userId), n.topic) === 'push',
  );
  if (forPush.length) {
    const devices = await db
      .select({ userId: s.pushDevices.userId })
      .from(s.pushDevices)
      .where(
        inArray(
          s.pushDevices.userId,
          forPush.map((r) => r.userId),
        ),
      );
    const withDevice = forPush.filter((r) => devices.some((d) => d.userId === r.userId));
    if (withDevice.length) {
      await db.insert(s.pushOutbox).values(
        withDevice.map((r) => {
          const pref = prefOf(r.userId);
          const quiet =
            urgent || pref?.quietHoursEnabled === false
              ? null
              : { start: pref?.quietStart ?? '22:00', end: pref?.quietEnd ?? '07:00' };
          return {
            clubId: club.id,
            notificationId: r.id,
            userId: r.userId,
            sendAfter: pushSendAfter(now, quiet, club.timezone),
            createdAt: now,
          };
        }),
      );
    }
  }
  return inserted.length;
}
