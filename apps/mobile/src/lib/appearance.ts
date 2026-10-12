import { useSyncExternalStore } from 'react';
import { readSetting, writeSetting } from './flags';

/**
 * Darstellung „Hell“, „Dunkel“ oder „Wie Gerät“ (Standard) – gilt je Gerät und wird dort gespeichert.
 */
export type Appearance = 'light' | 'dark' | 'system';
const isAppearance = (v: unknown): v is Appearance =>
  v === 'light' || v === 'dark' || v === 'system';

let current: Appearance = 'system';
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
  void writeSetting('appearance', value === 'system' ? null : value);
}

export const useAppearance = (): Appearance =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => 'system',
  );
