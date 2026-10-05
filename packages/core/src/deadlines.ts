import { addMinutes, at, calendarDayOf, DEFAULT_TIMEZONE, previousWeekday } from './time';

/**
 * Absagefrist-Regel je Mannschaft und Terminart (Konzept §9).
 * - `relative`: z. B. Training 120 Minuten vor Beginn
 * - `weekday_time`: z. B. Spiel → letzter Freitag 18:00 Uhr vor dem Anstoß
 */
export type DeadlineRule =
  | { kind: 'relative'; minutesBefore: number }
  | { kind: 'weekday_time'; weekday: number; timeOfDay: string };

/** Berechnet den Zeitpunkt, bis zu dem eine reguläre Zu- oder Absage möglich ist. */
export function responseDeadline(
  eventStart: Date,
  rule: DeadlineRule | null | undefined,
  timeZone = DEFAULT_TIMEZONE,
): Date | null {
  if (!rule) return null;
  if (rule.kind === 'relative') {
    return addMinutes(eventStart, -rule.minutesBefore);
  }
  const eventDay = calendarDayOf(eventStart, timeZone);
  let candidate = at(previousWeekday(eventDay, rule.weekday), rule.timeOfDay, timeZone);
  // Liegt die Frist am Spieltag selbst nach dem Anstoß, gilt die Vorwoche.
  if (candidate >= eventStart) {
    candidate = at(
      previousWeekday(calendarDayOf(addMinutes(candidate, -24 * 60), timeZone), rule.weekday),
      rule.timeOfDay,
      timeZone,
    );
  }
  return candidate;
}

/** Ob eine reguläre Antwort (ohne Trainerrechte) noch möglich ist. */
export function isResponseOpen(now: Date, eventStart: Date, deadline: Date | null): boolean {
  if (now >= eventStart) return false;
  return deadline === null || now < deadline;
}
