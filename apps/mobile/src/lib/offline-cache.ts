import type { MeResponse } from '@clubroof/core';
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { clearOfflineStore, readOfflineStore, writeOfflineStore } from './offline-store';

/**
 * Offline-Lesen: die zuletzt geladenen Daten (Home, Termine, Kader, News …) bleiben auf dem Gerät, damit die App ohne
 * Netz nicht leer ist. Bewusst nur harmlose Bereiche – nie Kasse, Mitgliederverwaltung oder Einstellungen. Beim
 * Abmelden wird alles gelöscht; ein Zwischenspeicher gehört immer genau einem Konto.
 */
const ALLOWED = new Set([
  'home',
  'events',
  'event',
  'team',
  'my-teams',
  'roster',
  'news',
  'polls',
  'absences',
  'notifications',
  'tile-info',
]);
const MAX_BYTES = 1_500_000;

type Stored = { userId: string; me: MeResponse; queries: DehydratedState };

async function read(): Promise<Stored | null> {
  try {
    const raw = await readOfflineStore();
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Zuletzt bekannte Nutzerdaten, wenn der Start ohne Verbindung erfolgt. */
export async function readOfflineMe(): Promise<MeResponse | null> {
  return (await read())?.me ?? null;
}

/** Gespeicherte Daten dieses Kontos zurück in den Zwischenspeicher der App laden. */
export async function restoreOfflineCache(queryClient: QueryClient, userId: string) {
  const stored = await read();
  if (stored && stored.userId === userId) hydrate(queryClient, stored.queries);
}

/** Daten laufend (gedrosselt) speichern; liefert die Funktion zum Beenden. */
export function persistOfflineCache(queryClient: QueryClient, me: MeResponse): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (q) =>
        q.state.status === 'success' && ALLOWED.has(String(q.queryKey[0])),
    });
    const content = JSON.stringify({ userId: me.user.id, me, queries: state } satisfies Stored);
    if (content.length <= MAX_BYTES) void writeOfflineStore(content);
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(save, 2500);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe(schedule);
  schedule();
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}

export const clearOfflineCache = clearOfflineStore;
