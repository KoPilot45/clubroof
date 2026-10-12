import { useSyncExternalStore } from 'react';

/** Gewählte Kasse der Vereinskasse (Paket K6); `null` = alle sichtbaren Kassen zusammen. */
let selected: string | null = null;
const listeners = new Set<() => void>();

export function setFundFilter(id: string | null) {
  if (id === selected) return;
  selected = id;
  listeners.forEach((l) => l());
}

export function useFundFilter(): [string | null, (id: string | null) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selected,
    () => null,
  );
  return [value, setFundFilter];
}
