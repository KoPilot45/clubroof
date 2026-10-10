/**
 * Spielort auf der Karte: Maps-Link oder Koordinaten statt Google-Maps-Auswahl im Formular (kein API-Schlüssel,
 * keine Daten an Google beim Speichern). Der Button „Route“ öffnet die Karten-App des Geräts.
 */

// `URL` gibt es in Node und im Browser; das Paket bindet dafür keine Typbibliothek ein
declare const URL: new (input: string) => {
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  toString(): string;
};

/** Anbieter, deren geteilte Links wir annehmen (nur https). */
const MAP_HOSTS = [
  /(^|\.)google\.[a-z.]+$/,
  /^maps\.app\.goo\.gl$/,
  /^goo\.gl$/,
  /^maps\.apple\.com$/,
  /(^|\.)openstreetmap\.org$/,
  /^osm\.org$/,
  /(^|\.)bing\.com$/,
  /(^|\.)here\.com$/,
];

const COORDS = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/;

/**
 * Prüft und vereinheitlicht die Eingabe. `null` = leer, `undefined` = ungültig,
 * sonst Koordinaten („50.1234,8.5678“) oder ein https-Link eines Kartenanbieters.
 */
export function normalizeMapLocation(raw: string | null | undefined): string | null | undefined {
  const value = raw?.trim();
  if (!value) return null;
  const coords = COORDS.exec(value);
  if (coords) {
    const lat = Number(coords[1]);
    const lng = Number(coords[2]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
    return `${lat},${lng}`;
  }
  if (value.length > 400) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    if (!MAP_HOSTS.some((h) => h.test(url.hostname))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Adresse für „Route“: Link oder Koordinaten des Termins, sonst die eingetragene Adresse. */
export function buildRouteUrl(
  locationUrl: string | null,
  locationText: string | null,
): string | null {
  if (locationUrl) {
    return COORDS.test(locationUrl)
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationUrl)}`
      : locationUrl;
  }
  const text = locationText?.trim();
  return text
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}`
    : null;
}
