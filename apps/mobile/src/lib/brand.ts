import { useSyncExternalStore } from 'react';

/**
 * Zuletzt bekannter Verein dieses Geräts (Farbe, Kürzel): Ladebildschirm und Anmeldeseite erscheinen damit schon
 * in der Vereinsfarbe, bevor die Sitzung geladen ist. Der native Startbildschirm kann nicht je Verein wechseln.
 */
export type Brand = { colorTheme: string; shortName: string } | null;

let brand: Brand = null;
const listeners = new Set<() => void>();

export function setBrand(next: Brand) {
  if (next?.colorTheme === brand?.colorTheme && next?.shortName === brand?.shortName) return;
  brand = next;
  listeners.forEach((l) => l());
}

export const useBrand = (): Brand =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => brand,
    () => null,
  );
