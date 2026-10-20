import { dateFormat, getLocale, numberFormat, t } from '@/lib/i18n';
/** Datums- und Zahlenformatierung in der Sprache der App und der Zeitzone des Vereins. */

const TZ = 'Europe/Berlin';

const weekdayDate = dateFormat({
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: TZ,
});
const time = dateFormat({ hour: '2-digit', minute: '2-digit', timeZone: TZ });
const longDate = dateFormat({
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const euro = numberFormat({ style: 'currency', currency: 'EUR' });
const thousands = numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percent = numberFormat({ maximumFractionDigits: 0 });

const tileWeekday = dateFormat({ weekday: 'short', timeZone: TZ });
const tileDay = dateFormat({ day: 'numeric', timeZone: TZ });
/** Datumskachel: „Sa.“ und „10“ */
export const formatDateTile = (iso: string) => ({
  weekday: tileWeekday.format(new Date(iso)),
  day: tileDay.format(new Date(iso)),
});
export const formatDay = (iso: string) => weekdayDate.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatLongDate = (iso: string) => longDate.format(new Date(iso));
export const formatEuro = (cents: number) => euro.format(cents / 100);
/** Kurzform für Diagrammachsen: ab 1.000 € „2,0 T€“, sonst ganze Euro („850 €“). */
export const formatEuroShort = (cents: number) =>
  Math.abs(cents) >= 100_000
    ? `${thousands.format(cents / 100_000)} T€`
    : `${percent.format(cents / 100)} €`;
export const formatPercent = (value: number) => `${percent.format(value)} %`;

/** „vor 2 Std.“, „vor 3 Tagen“ */
export function formatAgo(iso: string, now = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `vor ${Math.max(1, minutes)} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`; // wird bei der Anzeige übersetzt
}

/** Restzeit bis zu einem Zeitpunkt, aufgeteilt für den Countdown */
export function countdown(iso: string, now = new Date()) {
  const ms = Math.max(0, new Date(iso).getTime() - now.getTime());
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  };
}

/** „Noch 2 Tage“, „Noch 5 Std.“, „Heute“ */
export function formatRemaining(iso: string, now = new Date()): string {
  const { days, hours, minutes } = countdown(iso, now);
  if (days >= 1) return days === 1 ? 'Noch 1 Tag' : `Noch ${days} Tage`;
  if (hours >= 1) return `Noch ${hours} Std.`;
  return `Noch ${Math.max(1, minutes)} Min.`;
}

/** „Antwort bis heute 12:00“, „… bis morgen 12:00“ bzw. „… bis Do., 22.10. 12:00“ (Ende der Antwortfrist, Vereinszeitzone). */
export function formatAnswerBy(iso: string, now = new Date()): string {
  const target = clubDayMinutes(iso).day;
  const today = clubDayMinutes(now.toISOString()).day;
  const diff = Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  const clock = formatTime(iso);
  if (diff === 0) return t(`Antwort bis heute ${clock}`);
  if (diff === 1) return t(`Antwort bis morgen ${clock}`);
  return t(`Antwort bis ${formatDay(iso)} ${clock}`);
}

/** Kürzel für das Wappen, z. B. „SV Grün-Weiß“ → „SGW“ */
export function clubInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

/** Heutiges Datum (JJJJ-MM-TT) in der Zeitzone des Vereins. */
export function todayIso(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const clubParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Kalendertag (JJJJ-MM-TT) und Minuten seit Mitternacht eines Zeitpunkts in der Vereinszeitzone. */
export function clubDayMinutes(iso: string): { day: string; minutes: number } {
  const p = Object.fromEntries(
    clubParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const shortDate = dateFormat({
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

/** „05.10.“ für ein ISO-Datum (JJJJ-MM-TT) */
export const formatShortDate = (isoDate: string) =>
  shortDate.format(new Date(`${isoDate}T00:00:00Z`));

const dayMonth = dateFormat({ day: 'numeric', month: 'long', timeZone: 'UTC' });
const dayOnly = dateFormat({ day: 'numeric', timeZone: 'UTC' });

/** „20.–22. Oktober“ bzw. „29. Oktober – 2. November“ für zwei ISO-Daten (JJJJ-MM-TT) */
export function formatDateRange(fromIso: string, toIso: string): string {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  if (fromIso === toIso) return dayMonth.format(a);
  if (fromIso.slice(0, 7) === toIso.slice(0, 7))
    return `${dayOnly.format(a)}.–${dayMonth.format(b)}`;
  return `${dayMonth.format(a)} – ${dayMonth.format(b)}`;
}

/** Euro-Eingabe („12,50“, „12.5“, „12“) in Cent; null bei ungültiger Eingabe */
export function parseEuro(input: string): number | null {
  const normalized = input.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 ? cents : null;
}

/** Dateigröße, z. B. „245 KB“ */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${getLocale() === 'de' ? mb.replace('.', ',') : mb} MB`;
}

/** „1 Spiel“ / „3 Spiele“ */
export const plural = (n: number, one: string, many: string) => `${n} ${t(n === 1 ? one : many)}`;
