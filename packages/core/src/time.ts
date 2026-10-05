/**
 * Datums- und Zeitzonenhilfen ohne externe Abhängigkeiten.
 *
 * Kalendertage werden als `Date` um 00:00 UTC dargestellt. Uhrzeiten werden in der Zeitzone des
 * Vereins interpretiert (Standard: Europe/Berlin), damit Fristen wie „Freitag 18:00 Uhr“ auch über
 * die Zeitumstellung hinweg korrekt sind.
 */

export const DEFAULT_TIMEZONE = 'Europe/Berlin';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  return Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Kalendertag (00:00 UTC), auf den `instant` in der Zeitzone fällt. */
export function calendarDayOf(instant: Date, timeZone = DEFAULT_TIMEZONE): Date {
  const p = zonedParts(instant, timeZone);
  return new Date(Date.UTC(p.year!, p.month! - 1, p.day!));
}

/** Kalendertag des aktuellen Tages in der Zeitzone. */
export function todayIn(timeZone = DEFAULT_TIMEZONE, now: Date = new Date()): Date {
  return calendarDayOf(now, timeZone);
}

export function addDays(day: Date, days: number): Date {
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** ISO-Wochentag eines Kalendertags: 1 = Montag … 7 = Sonntag */
export function isoWeekday(day: Date): number {
  return ((day.getUTCDay() + 6) % 7) + 1;
}

/** Montag der Woche, in der `day` liegt. */
export function startOfIsoWeek(day: Date): Date {
  return addDays(day, 1 - isoWeekday(day));
}

/** Nächster Tag (ab `from`, inklusive) mit dem gewünschten ISO-Wochentag. */
export function nextWeekday(from: Date, weekday: number): Date {
  return addDays(from, (weekday - isoWeekday(from) + 7) % 7);
}

/** Letzter Tag (bis `from`, inklusive) mit dem gewünschten ISO-Wochentag. */
export function previousWeekday(from: Date, weekday: number): Date {
  return addDays(from, -((isoWeekday(from) - weekday + 7) % 7));
}

export function toIsoDate(day: Date): string {
  return day.toISOString().slice(0, 10);
}

export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** Zeitpunkt für Kalendertag + Uhrzeit („HH:MM“ oder „HH:MM:SS“) in der Zeitzone. */
export function at(day: Date, time: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m);
  const firstOffset = offsetMs(new Date(guess), timeZone);
  let ts = guess - firstOffset;
  const secondOffset = offsetMs(new Date(ts), timeZone);
  if (secondOffset !== firstOffset) ts = guess - secondOffset;
  return new Date(ts);
}
