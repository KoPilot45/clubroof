/**
 * Signierte Links für Bilder (News-Bilder, Vereinslogo). Bilder werden in Listen angezeigt, daher
 * sind die Links länger gültig als Dokumentlinks (12–24 Stunden) und bleiben innerhalb eines
 * 12-Stunden-Fensters gleich, damit Geräte sie zwischenspeichern können.
 */
import type { LinkSigner } from './files';

const WINDOW_MS = 12 * 60 * 60 * 1000;
const MEDIA_PREFIX = 'media:';

/** In der Datenbank steht für hochgeladene Bilder `media:<id>`; daraus wird ein Link. */
export const mediaRef = (id: string) => `${MEDIA_PREFIX}${id}`;

export function mediaIdOf(stored: string | null): string | null {
  return stored?.startsWith(MEDIA_PREFIX) ? stored.slice(MEDIA_PREFIX.length) : null;
}

/** Relativer, signierter Pfad (`/files/…`); die App setzt die API-Adresse davor. */
export function resolveMediaUrl(
  signer: LinkSigner,
  stored: string | null,
  now: Date = new Date(),
): string | null {
  const id = mediaIdOf(stored);
  if (!id) return stored;
  const expires = new Date((Math.floor(now.getTime() / WINDOW_MS) + 2) * WINDOW_MS);
  return `/files/${signer.create(`m:${id}`, expires)}`;
}
