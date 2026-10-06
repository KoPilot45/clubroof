/**
 * Benachrichtigungen (Konzept §10): Themen mit Voreinstellung, Ruhezeiten und Erinnerungen.
 * Dringendes kommt immer an – unabhängig von Thema, stummgeschalteter Mannschaft oder Ruhezeit.
 */
import { addDays, at, calendarDayOf, DEFAULT_TIMEZONE } from './time';

/** push = Benachrichtigung + Push · app = nur in der App · off = gar nicht */
export const NOTIFICATION_MODES = ['push', 'app', 'off'] as const;
export type NotificationMode = (typeof NOTIFICATION_MODES)[number];

/** Filterbereiche im Notification-Center */
export type NotificationCategory = 'team' | 'verein' | 'verwaltung';

export const NOTIFICATION_TOPICS = [
  {
    key: 'events',
    label: 'Termine',
    description: 'Neue, geänderte und abgesagte Termine',
    category: 'team',
    defaultMode: 'push',
  },
  {
    key: 'reminders',
    label: 'Erinnerungen',
    description: 'Wenn eine Zu- oder Absage noch fehlt',
    category: 'team',
    defaultMode: 'push',
  },
  {
    key: 'matches',
    label: 'Spiele',
    description: 'Nominierung, Aufstellung und Spielbericht',
    category: 'team',
    defaultMode: 'push',
  },
  {
    key: 'exchange',
    label: 'Gastspieler',
    description: 'Einsätze als Gastspieler und Spielerbedarf',
    category: 'team',
    defaultMode: 'push',
  },
  {
    key: 'tasks',
    label: 'Aufgaben',
    description: 'Dir zugeteilte Mannschaftsaufgaben',
    category: 'team',
    defaultMode: 'push',
  },
  {
    key: 'team',
    label: 'Mannschaft',
    description: 'Wechsel, Leihe und neue Mannschaft',
    category: 'team',
    defaultMode: 'push',
  },
  {
    key: 'responses',
    label: 'Rückmeldungen (Trainer)',
    description: 'Sammelhinweis zur Frist und kurzfristige Absagen',
    category: 'team',
    defaultMode: 'app',
  },
  {
    key: 'news',
    label: 'News',
    description: 'Neue Nachrichten aus Verein und Mannschaft',
    category: 'verein',
    defaultMode: 'app',
  },
  {
    key: 'polls',
    label: 'Umfragen',
    description: 'Neue Umfragen',
    category: 'verein',
    defaultMode: 'app',
  },
  {
    key: 'admin',
    label: 'Verwaltung',
    description: 'Freigaben und Beitrittsanfragen',
    category: 'verwaltung',
    defaultMode: 'app',
  },
] as const satisfies readonly {
  key: string;
  label: string;
  description: string;
  category: NotificationCategory;
  defaultMode: NotificationMode;
}[];

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number]['key'];

export const topicInfo = (key: NotificationTopic) =>
  NOTIFICATION_TOPICS.find((t) => t.key === key)!;

/** Erinnerung so viele Stunden vor Frist bzw. Terminbeginn (0 = aus) */
export const REMINDER_HOURS = [0, 2, 6, 24, 48] as const;
export const DEFAULT_REMINDER_HOURS = 24;
export const DEFAULT_QUIET_HOURS = { start: '22:00', end: '07:00' } as const;

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/**
 * Frühester Zeitpunkt für einen Push unter Berücksichtigung der Ruhezeit (Vereinszeitzone).
 * Ruhezeiten dürfen über Mitternacht gehen (22:00–07:00).
 */
export function pushSendAfter(
  now: Date,
  quiet: { start: string; end: string } | null,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  if (!quiet || quiet.start === quiet.end) return now;
  const today = calendarDayOf(now, timeZone);
  const startToday = at(today, quiet.start, timeZone);
  const endToday = at(today, quiet.end, timeZone);
  const wraps = minutesOf(quiet.start) > minutesOf(quiet.end);
  if (!wraps) return now >= startToday && now < endToday ? endToday : now;
  if (now >= startToday) return at(addDays(today, 1), quiet.end, timeZone);
  if (now < endToday) return endToday;
  return now;
}
