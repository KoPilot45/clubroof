import { useSyncExternalStore } from 'react';

/** Verbindungszustand: offline, sobald eine Anfrage ohne Netz scheitert; online bei der nächsten Antwort. */
let offline = false;
const listeners = new Set<() => void>();

export function setOffline(next: boolean) {
  if (next === offline) return;
  offline = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useOffline = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => offline,
    () => false,
  );

// Im Browser meldet das System den Verlust der Verbindung selbst
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => setOffline(false));
}
