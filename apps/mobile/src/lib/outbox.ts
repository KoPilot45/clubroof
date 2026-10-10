import { useSyncExternalStore } from 'react';
import { RequestError } from './api';
import { clearOutboxStore, readOutboxStore, writeOutboxStore } from './outbox-store';

/**
 * Warteschlange für Zu- und Absagen: Scheitert die Rückmeldung nur, weil keine Verbindung besteht, wird sie auf dem
 * Gerät gemerkt und gesendet, sobald die App wieder online ist. Je Termin und Person gilt die letzte Antwort.
 * Vom Server abgelehnte Rückmeldungen (z. B. Frist abgelaufen) werden nicht wiederholt, sondern gemeldet.
 */
export type QueuedResponse = {
  eventId: string;
  personId: string;
  status: 'yes' | 'no' | 'maybe' | 'pending';
  reason: string | null;
  /** Konto, dem die Rückmeldung gehört */
  userId: string;
  /** Titel des Termins für Meldungen */
  title: string;
  queuedAt: string;
};

let items: QueuedResponse[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const persist = () => void writeOutboxStore(JSON.stringify(items));

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useOutbox = (): QueuedResponse[] =>
  useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );

export const queuedFor = (list: QueuedResponse[], eventId: string, personId: string) =>
  list.find((i) => i.eventId === eventId && i.personId === personId);

export function enqueueResponse(item: Omit<QueuedResponse, 'queuedAt'>) {
  items = [
    ...items.filter((i) => !(i.eventId === item.eventId && i.personId === item.personId)),
    { ...item, queuedAt: new Date().toISOString() },
  ];
  persist();
  emit();
}

/** Beim Anmelden: gemerkte Rückmeldungen dieses Kontos laden, fremde verwerfen. */
export async function loadOutbox(userId: string) {
  try {
    const raw = await readOutboxStore();
    const stored = raw ? (JSON.parse(raw) as QueuedResponse[]) : [];
    items = stored.filter((i) => i.userId === userId);
  } catch {
    items = [];
  }
  emit();
}

export async function clearOutbox() {
  items = [];
  emit();
  await clearOutboxStore();
}

let flushing = false;

/**
 * Wartende Rückmeldungen senden. Bricht bei fehlender Verbindung ab (Versuch später). `done` bekommt je Ergebnis
 * den Termin und – bei Ablehnung durch den Server – die Fehlermeldung.
 */
export async function flushOutbox(
  send: (item: QueuedResponse) => Promise<unknown>,
  done: (result: {
    sent: QueuedResponse[];
    rejected: { item: QueuedResponse; message: string }[];
  }) => void,
) {
  if (flushing || items.length === 0) return;
  flushing = true;
  const sent: QueuedResponse[] = [];
  const rejected: { item: QueuedResponse; message: string }[] = [];
  try {
    for (const item of [...items]) {
      try {
        await send(item);
        sent.push(item);
      } catch (e) {
        if (e instanceof RequestError && e.status === 0) break; // weiterhin offline
        rejected.push({
          item,
          message: e instanceof RequestError ? e.message : 'Unbekannter Fehler',
        });
      }
      // Nur entfernen, wenn zwischenzeitlich keine neuere Antwort eingereiht wurde
      items = items.filter(
        (i) =>
          !(
            i.eventId === item.eventId &&
            i.personId === item.personId &&
            i.queuedAt === item.queuedAt
          ),
      );
    }
  } finally {
    flushing = false;
    persist();
    emit();
  }
  if (sent.length || rejected.length) done({ sent, rejected });
}
