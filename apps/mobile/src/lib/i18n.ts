/**
 * Aktive Sprache der App. Quelltexte sind Deutsch und werden bei der Anzeige übersetzt
 * (`t`, automatisch in `Text`). Die Sprache kommt aus dem Profil, sonst vom Gerät.
 */
import { intlLocale, localeFromTag, translate, type Locale } from '@clubroof/core';
import { useSyncExternalStore } from 'react';

export function deviceLocale(): Locale {
  try {
    return localeFromTag(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'de';
  }
}

let current: Locale = deviceLocale();
const listeners = new Set<() => void>();

export const getLocale = () => current;

export function setLocale(next: Locale) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Aktive Sprache; rendert die Komponente bei einem Wechsel neu. */
export const useLocale = (): Locale => useSyncExternalStore(subscribe, getLocale, getLocale);

/** Deutschen Text in die aktive Sprache übersetzen (ohne Eintrag bleibt er Deutsch). */
export const t = (text: string): string => translate(text, current);

/** Locale-Kennung für `Intl` (z. B. „en-GB“) in der aktiven Sprache. */
export const activeIntl = () => intlLocale(current);

/** Datumsformat, das bei jedem Aufruf die aktive Sprache nutzt (auch als Konstante auf Modulebene). */
export function dateFormat(options: Intl.DateTimeFormatOptions) {
  const cache = new Map<string, Intl.DateTimeFormat>();
  const get = () => {
    const loc = activeIntl();
    let f = cache.get(loc);
    if (!f) cache.set(loc, (f = new Intl.DateTimeFormat(loc, options)));
    return f;
  };
  return {
    format: (d?: Date | number) => get().format(d),
    formatToParts: (d?: Date | number) => get().formatToParts(d),
  };
}

/** Zahlenformat, das bei jedem Aufruf die aktive Sprache nutzt. */
export function numberFormat(options: Intl.NumberFormatOptions) {
  const cache = new Map<string, Intl.NumberFormat>();
  return {
    format: (n: number) => {
      const loc = activeIntl();
      let f = cache.get(loc);
      if (!f) cache.set(loc, (f = new Intl.NumberFormat(loc, options)));
      return f.format(n);
    },
  };
}
