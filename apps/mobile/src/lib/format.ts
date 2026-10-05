/** Datums- und Zahlenformatierung auf Deutsch in der Zeitzone des Vereins. */

const TZ = 'Europe/Berlin';

const weekdayDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: TZ,
});
const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const longDate = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const formatDay = (iso: string) => weekdayDate.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatLongDate = (iso: string) => longDate.format(new Date(iso));
export const formatEuro = (cents: number) => euro.format(cents / 100);

/** „vor 2 Std.“, „vor 3 Tagen“ */
export function formatAgo(iso: string, now = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `vor ${Math.max(1, minutes)} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
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
