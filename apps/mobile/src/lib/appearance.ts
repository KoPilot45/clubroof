import { useSyncExternalStore } from 'react';
import { readSetting, writeSetting } from './flags';

/**
 * Darstellung „Hell“, „Dunkel“ oder „Wie Gerät“ (Standard: Hell) – gilt je Gerät und wird dort gespeichert.
 */
export type Appearance = 'light' | 'dark' | 'system';
const isAppearance = (v: unknown): v is Appearance =>
  v === 'light' || v === 'dark' || v === 'system';

let current: Appearance = 'light';
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export async function loadAppearance() {
  const stored = await readSetting('appearance');
  if (isAppearance(stored) && stored !== current) {
    current = stored;
    listeners.forEach((l) => l());
  }
}

export function setAppearance(value: Appearance) {
  current = value;
  listeners.forEach((l) => l());
  void writeSetting('appearance', value);
}

export const useAppearance = (): Appearance =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => 'light',
  );
