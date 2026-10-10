import { useSyncExternalStore } from 'react';
import { readSetting, writeSetting } from './flags';

/** Schriftgröße der App (pro Gerät): wirkt auf alle Texte, zusätzlich zur Systemeinstellung des Geräts. */
export const FONT_SCALES = { normal: 1, large: 1.15, xlarge: 1.3 } as const;
export type FontScaleKey = keyof typeof FONT_SCALES;

const isKey = (v: unknown): v is FontScaleKey => typeof v === 'string' && v in FONT_SCALES;

let current: FontScaleKey = 'normal';
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export async function loadFontScale() {
  const stored = await readSetting('fontScale');
  if (isKey(stored) && stored !== current) {
    current = stored;
    listeners.forEach((l) => l());
  }
}

export function setFontScale(key: FontScaleKey) {
  current = key;
  listeners.forEach((l) => l());
  void writeSetting('fontScale', key === 'normal' ? null : key);
}

export const useFontScaleKey = (): FontScaleKey =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => 'normal',
  );

export const useFontScale = (): number => FONT_SCALES[useFontScaleKey()];
