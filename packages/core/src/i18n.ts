/**
 * Mehrsprachigkeit. Quelltexte sind Deutsch; das Deutsche ist zugleich der Schlüssel.
 * Übersetzt wird erst bei der Anzeige (App) bzw. beim Versand (Push, E-Mail) über `translate`.
 *
 * Neue Sprache: Datei `locales/<code>.ts` anlegen, in `DICTIONARIES` und `LOCALES` eintragen.
 * Texte mit Platzhaltern stehen als Muster („Konto {0}“) im Wörterbuch; fertig zusammengesetzte
 * Texte („Konto Max“) werden über das Muster wiedererkannt, die Einsetzwerte einzeln übersetzt.
 */
import { en } from './locales/en';

export const LOCALES = [
  { code: 'de', name: 'Deutsch', intl: 'de-DE' },
  { code: 'en', name: 'English', intl: 'en-GB' },
] as const;

export type Locale = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: Locale = 'de';

export const isLocale = (value: unknown): value is Locale => LOCALES.some((l) => l.code === value);

/** Sprache aus einer Geräte- oder Browsersprache wie „en-US“; sonst Deutsch. */
export function localeFromTag(tag: string | null | undefined): Locale {
  const code = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

export const intlLocale = (locale: Locale): string =>
  LOCALES.find((l) => l.code === locale)?.intl ?? 'de-DE';

type Dictionary = Record<string, string>;
const DICTIONARIES: Partial<Record<Locale, Dictionary>> = { en };

type Pattern = { regex: RegExp; target: string };
const patternCache = new Map<Locale, Pattern[]>();
const resultCache = new Map<Locale, Map<string, string>>();

const PLACEHOLDER = /\{(\d+)\}/g;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patternsFor(locale: Locale): Pattern[] {
  let list = patternCache.get(locale);
  if (list) return list;
  const dict = DICTIONARIES[locale] ?? {};
  list = [];
  for (const [key, target] of Object.entries(dict)) {
    if (!/\{\d+\}/.test(key)) continue;
    // Zu allgemeine Muster („{0} am {1}“) würden fremde Texte (Namen, Titel) verfälschen
    const literal = key.replace(PLACEHOLDER, '').replace(/\s/g, '').length;
    if (literal < 3 || (literal < 4 && key.startsWith('{') && !key.startsWith('{0} '))) continue;
    // „{0} Tor“: kurze Zählwörter greifen nur bei Zahlen, nicht bei beliebigem Text davor
    const countOnly = key.startsWith('{0} ') && literal < 7;
    const source = key
      .split(PLACEHOLDER)
      .map((part, i) =>
        i % 2 === 1 ? (i === 1 && countOnly ? '(\\d+)' : '(.+?)') : escapeRegex(part),
      )
      .join('');
    list.push({ regex: new RegExp(`^${source}$`, 's'), target });
  }
  // Längere (genauere) Muster zuerst
  list.sort((a, b) => b.regex.source.length - a.regex.source.length);
  patternCache.set(locale, list);
  return list;
}

/** Trenner zusammengesetzter Texte; bei `strict` wird nur geteilt, wenn jeder Teil übersetzt wird. */
const SEPARATORS: { sep: string; strict: boolean }[] = [
  { sep: '\n', strict: false },
  { sep: ', ', strict: true },
  { sep: ' – ', strict: true },
  { sep: ' / ', strict: true },
];

function lookup(text: string, locale: Locale, dict: Dictionary, depth: number): string | null {
  if (text in dict) return dict[text]!;
  if (depth > 3) return null;
  for (const { regex, target } of patternsFor(locale)) {
    const m = regex.exec(text);
    if (!m) continue;
    const args = m.slice(1).map((a) => translateInner(a, locale, depth + 1));
    return target.replace(PLACEHOLDER, (_, i: string) => args[Number(i)] ?? '');
  }
  return null;
}

function translateInner(text: string, locale: Locale, depth: number): string {
  const dict = DICTIONARIES[locale];
  if (!dict || !text.trim()) return text;
  const lead = /^\s*/.exec(text)![0];
  const trail = /\s*$/.exec(text)![0];
  const core = text.slice(lead.length, text.length - trail.length);
  let out: string | null = core in dict ? dict[core]! : null;
  // Aufzählungen („A · B · C“) zuerst teilen: jeder Teil wird für sich nachgeschlagen
  if (out === null && core.includes(' · ')) {
    const source = core.split(' · ');
    const parts = source.map((p) => translateInner(p, locale, depth + 1));
    if (parts.some((p, i) => p !== source[i])) out = parts.join(' · ');
  }
  if (out === null) out = lookup(core, locale, dict, depth);
  if (out === null) {
    // Zusammengesetzte Texte („Bar · vor 2 Std.“) teilweise übersetzen
    for (const { sep, strict } of SEPARATORS) {
      if (!core.includes(sep)) continue;
      const source = core.split(sep);
      const parts = source.map((p) => translateInner(p, locale, depth + 1));
      if (strict && parts.some((p, i) => p === source[i] && /[A-Za-zÄÖÜäöüß]{3}/.test(p))) continue;
      out = parts.join(sep);
      break;
    }
  }
  if (out === null && /[.!?] \S/.test(core)) {
    // Mehrere Sätze: nur übersetzen, wenn jeder Satz bekannt ist
    const source = core.split(/(?<=[.!?]) +/);
    const parts = source.map((p) => translateInner(p, locale, depth + 1));
    if (!parts.some((p, i) => p === source[i])) out = parts.join(' ');
  }
  return out === null || out === core ? text : `${lead}${out}${trail}`;
}

/** Übersetzt einen deutschen Text; ohne Eintrag bleibt er unverändert (Deutsch ist Rückfall). */
export function translate(text: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !text) return text;
  let cache = resultCache.get(locale);
  if (!cache) resultCache.set(locale, (cache = new Map()));
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const out = translateInner(text, locale, 0);
  if (cache.size > 5000) cache.clear();
  cache.set(text, out);
  return out;
}

/** Ist der Text (ohne Muster-Treffer) im Wörterbuch? Für Prüfungen. */
export const hasTranslation = (text: string, locale: Locale): boolean =>
  locale === DEFAULT_LOCALE || text in (DICTIONARIES[locale] ?? {});

/** Liste der Wörterbuchschlüssel einer Sprache (für Prüfskripte). */
export const dictionaryKeys = (locale: Locale): string[] => Object.keys(DICTIONARIES[locale] ?? {});
