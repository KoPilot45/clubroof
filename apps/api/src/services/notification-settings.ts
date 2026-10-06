/**
 * Persönliche Benachrichtigungseinstellungen (Konzept §10): je Thema Push / nur App / aus,
 * Mannschaften stummschalten, Erinnerungszeitpunkt und Ruhezeiten. Dazu Push-Geräte.
 */
import {
  DEFAULT_QUIET_HOURS,
  DEFAULT_REMINDER_HOURS,
  NOTIFICATION_TOPICS,
  scopesWith,
  type NotificationSettings,
  type NotificationTopic,
  type UpdateNotificationSettingsInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError } from '../errors';
import { modeFor } from '../notify/deliver';

const hasAny = (actor: Actor, permission: Parameters<typeof scopesWith>[1]) => {
  const sc = scopesWith(actor.grants, permission);
  return sc.all || sc.orgUnitIds.length > 0 || sc.teamIds.length > 0;
};

/** Themen, die für diese Person überhaupt vorkommen können. */
function topicsFor(actor: Actor): NotificationTopic[] {
  const coach = hasAny(actor, 'events.manage');
  const admin =
    hasAny(actor, 'news.publish') ||
    hasAny(actor, 'members.invite') ||
    hasAny(actor, 'members.manage');
  return NOTIFICATION_TOPICS.map((t) => t.key).filter(
    (k) => (k !== 'responses' || coach) && (k !== 'admin' || admin),
  );
}

export async function getNotificationSettings(db: Db, actor: Actor): Promise<NotificationSettings> {
  const [pref] = await db
    .select()
    .from(s.notificationPreferences)
    .where(eq(s.notificationPreferences.userId, actor.user.id));
  const teams = actor.teamIds.length
    ? await db
        .select({ id: s.teams.id, badge: s.teams.badge, name: s.teams.name })
        .from(s.teams)
        .where(inArray(s.teams.id, actor.teamIds))
        .orderBy(asc(s.teams.sortOrder))
    : [];
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(s.pushDevices)
    .where(eq(s.pushDevices.userId, actor.user.id));
  const allowed = topicsFor(actor);
  return {
    topics: NOTIFICATION_TOPICS.filter((t) => allowed.includes(t.key)).map((t) => ({
      key: t.key,
      label: t.label,
      description: t.description,
      mode: modeFor(pref, t.key),
      defaultMode: t.defaultMode,
    })),
    teams: teams.map((t) => ({ ...t, muted: pref?.mutedTeamIds.includes(t.id) ?? false })),
    reminderHours: pref?.reminderHours ?? DEFAULT_REMINDER_HOURS,
    quietHours: {
      enabled: pref?.quietHoursEnabled ?? true,
      start: pref?.quietStart ?? DEFAULT_QUIET_HOURS.start,
      end: pref?.quietEnd ?? DEFAULT_QUIET_HOURS.end,
    },
    devices: Number(n),
  };
}

export async function updateNotificationSettings(
  db: Db,
  actor: Actor,
  input: UpdateNotificationSettingsInput,
  now: Date,
): Promise<NotificationSettings> {
  const [current] = await db
    .select()
    .from(s.notificationPreferences)
    .where(eq(s.notificationPreferences.userId, actor.user.id));
  const topics = { ...(current?.topics ?? {}) };
  for (const [key, mode] of Object.entries(input.topics ?? {})) {
    if (!NOTIFICATION_TOPICS.some((t) => t.key === key))
      throw new HttpError(400, 'unknown_topic', `Unbekanntes Thema: ${key}`);
    topics[key] = mode;
  }
  if (input.mutedTeamIds?.some((id) => !actor.teamIds.includes(id)))
    throw new HttpError(400, 'invalid_team', 'Nur eigene Mannschaften lassen sich stummschalten.');
  const values = {
    topics,
    mutedTeamIds: input.mutedTeamIds ?? current?.mutedTeamIds ?? [],
    reminderHours: input.reminderHours ?? current?.reminderHours ?? DEFAULT_REMINDER_HOURS,
    quietHoursEnabled: input.quietHours?.enabled ?? current?.quietHoursEnabled ?? true,
    quietStart: input.quietHours?.start ?? current?.quietStart ?? DEFAULT_QUIET_HOURS.start,
    quietEnd: input.quietHours?.end ?? current?.quietEnd ?? DEFAULT_QUIET_HOURS.end,
    updatedAt: now,
  };
  await db
    .insert(s.notificationPreferences)
    .values({ userId: actor.user.id, clubId: actor.club.id, ...values })
    .onConflictDoUpdate({ target: s.notificationPreferences.userId, set: values });
  return getNotificationSettings(db, actor);
}

/** Gerät für Push anmelden (ein Token gehört immer zum zuletzt angemeldeten Konto). */
export async function registerDevice(
  db: Db,
  actor: Actor,
  token: string,
  platform: string,
  now: Date,
) {
  await db
    .insert(s.pushDevices)
    .values({ clubId: actor.club.id, userId: actor.user.id, token, platform, lastSeenAt: now })
    .onConflictDoUpdate({
      target: s.pushDevices.token,
      set: { clubId: actor.club.id, userId: actor.user.id, platform, lastSeenAt: now },
    });
}

export async function unregisterDevice(db: Db, actor: Actor, token: string) {
  await db
    .delete(s.pushDevices)
    .where(and(eq(s.pushDevices.token, token), eq(s.pushDevices.userId, actor.user.id)));
}
