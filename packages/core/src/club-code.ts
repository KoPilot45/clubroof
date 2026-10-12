/**
 * Vereinskürzel (Paket AL): 2–4 Zeichen, Großbuchstaben und Ziffern, z. B. „SGW“, „TSV“, „FC1“.
 * Es steht als Wasserzeichen im Plakat der Startseite und ersetzt das Wappen, solange kein Logo
 * hochgeladen ist. Ohne eigene Angabe gilt die Vorgabe aus den Initialen des Kurznamens.
 */
export const CLUB_CODE_PATTERN = /^[A-Z0-9]{2,4}$/;

/** Wandelt Eingaben in ein gültiges Kürzel um: Großbuchstaben und Ziffern, höchstens 4 Zeichen. */
export function normalizeClubCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[ÄÖÜ]/g, (c) => ({ Ä: 'A', Ö: 'O', Ü: 'U' })[c] ?? c)
    .replace(/ß/g, 'SS')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

/** Vorgabe aus den Initialen des Kurznamens („SV Grün-Weiß“ → „SGW“); mindestens 2 Zeichen. */
export function defaultClubCode(shortName: string): string {
  const words = shortName.split(/[\s\-–/.]+/).filter(Boolean);
  const initials = normalizeClubCode(words.map((w) => w.charAt(0)).join(''));
  if (initials.length >= 2) return initials;
  const letters = normalizeClubCode(shortName);
  return (letters.length >= 2 ? letters : `${letters}X`.padEnd(2, 'X')).slice(0, 3);
}

/** Gespeichertes Kürzel oder die Vorgabe. */
export function effectiveClubCode(stored: string | null | undefined, shortName: string): string {
  return stored && CLUB_CODE_PATTERN.test(stored) ? stored : defaultClubCode(shortName);
}
