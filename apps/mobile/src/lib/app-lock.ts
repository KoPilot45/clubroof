import { useSyncExternalStore } from 'react';
import { readSetting, writeSetting } from './flags';

/** App-Sperre: Beim Start und nach längerer Pause fragt die App nach Face ID, Fingerabdruck oder Gerätecode. */
let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export async function loadAppLock() {
  enabled = (await readSetting('appLock')) === '1';
  loaded = true;
  emit();
}

export async function setAppLockEnabled(value: boolean) {
  enabled = value;
  emit();
  await writeSetting('appLock', value ? '1' : null);
}

export const useAppLockEnabled = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => enabled,
    () => false,
  );

export const useAppLockLoaded = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
