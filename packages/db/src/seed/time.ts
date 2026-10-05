/**
 * Datumshilfen für die Demodaten. Kalendertage werden als `Date` um 00:00 UTC dargestellt;
 * Uhrzeiten werden in der Zeitzone des Vereins (Europe/Berlin) interpretiert.
 */

export const CLUB_TIMEZONE = 'Europe/Berlin';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CLUB_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(date: Date): Record<string, number> {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
}

function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Kalendertag (00:00 UTC) des aktuellen Tages in Berlin. */
export function todayInClubTz(now: Date = new Date()): Date {
  const p = zonedParts(now);
  return new Date(Date.UTC(p.year!, p.month! - 1, p.day!));
}

export function addDays(day: Date, days: number): Date {
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
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

export function toIsoDate(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** Zeitpunkt für Kalendertag + Uhrzeit („HH:MM“) in Berliner Ortszeit. */
export function at(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m);
  const firstOffset = offsetMs(new Date(guess));
  let ts = guess - firstOffset;
  const secondOffset = offsetMs(new Date(ts));
  if (secondOffset !== firstOffset) ts = guess - secondOffset;
  return new Date(ts);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
