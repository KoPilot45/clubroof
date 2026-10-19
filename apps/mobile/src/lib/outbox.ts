import { useSyncExternalStore } from 'react';
import { RequestError } from './api';
import { clearOutboxStore, readOutboxStore, writeOutboxStore } from './outbox-store';

/**
 * Warteschlange für Zu- und Absagen: Scheitert die Rückmeldung nur, weil keine Verbindung besteht, wird sie auf dem
 * Gerät gemerkt und gesendet, sobald die App wieder online ist. Je Termin und Person gilt die letzte Antwort.
 * Vom Server endgültig abgelehnte Rückmeldungen (z. B. Frist abgelaufen) werden nicht wiederholt, sondern gemeldet.
 * Vorübergehende Fehler (keine Verbindung, 408/429/5xx, abgelaufene Sitzung) behalten die Rückmeldung; bei Serverfehlern
 * wird begrenzt oft wiederholt. Die Warteschlange gehört genau einem Konto: gesendet wird erst nach dem Laden für dieses
 * Konto, und nie ein Eintrag eines anderen Kontos.
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
  /** Fehlgeschlagene Versuche wegen vorübergehender Serverfehler */
  attempts: number;
};

/** Nach so vielen Serverfehlern wird die Rückmeldung gemeldet statt weiter wiederholt. */
export const MAX_ATTEMPTS = 10;
const TRANSIENT = (status: number) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

let items: QueuedResponse[] = [];
/** Konto, für das `items` geladen wurden (sonst wird nichts gesendet) */
let loadedFor: string | null = null;
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

export function enqueueResponse(item: Omit<QueuedResponse, 'queuedAt' | 'attempts'>) {
  items = [
    ...items.filter((i) => !(i.eventId === item.eventId && i.personId === item.personId)),
    { ...item, queuedAt: new Date().toISOString(), attempts: 0 },
  ];
  persist();
  emit();
}

/** Arbeitsspeicher leeren (Kontowechsel, Abmeldung); die gespeicherte Datei bleibt unberührt. */
export function resetOutboxMemory() {
  items = [];
  loadedFor = null;
  emit();
}

/** Beim Anmelden: gemerkte Rückmeldungen dieses Kontos laden, fremde verwerfen. */
export async function loadOutbox(userId: string) {
  resetOutboxMemory();
  try {
    const raw = await readOutboxStore();
    const stored = raw ? (JSON.parse(raw) as QueuedResponse[]) : [];
    items = stored
      .filter((i) => i.userId === userId)
      .map((i) => ({ ...i, attempts: i.attempts ?? 0 }));
  } catch {
    items = [];
  }
  loadedFor = userId;
  emit();
}

export async function clearOutbox() {
  resetOutboxMemory();
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
  userId: string,
) {
  if (flushing || items.length === 0 || loadedFor !== userId) return;
  flushing = true;
  const sent: QueuedResponse[] = [];
  const rejected: { item: QueuedResponse; message: string }[] = [];
  const remove = (item: QueuedResponse) => {
    // Nur entfernen, wenn zwischenzeitlich keine neuere Antwort eingereiht wurde
    items = items.filter(
      (i) =>
        !(
          i.eventId === item.eventId &&
          i.personId === item.personId &&
          i.queuedAt === item.queuedAt
        ),
    );
  };
  try {
    for (const item of [...items]) {
      if (item.userId !== userId || loadedFor !== userId) continue; // nie mit dem Kontext eines anderen Kontos
      try {
        await send(item);
        sent.push(item);
        remove(item);
      } catch (e) {
        const status = e instanceof RequestError ? e.status : -1;
        if (status === 0 || status === 401) break; // offline bzw. neu anmelden: Eintrag bleibt
        if (TRANSIENT(status)) {
          const attempts = item.attempts + 1;
          if (attempts < MAX_ATTEMPTS) {
            items = items.map((i) =>
              i.eventId === item.eventId &&
              i.personId === item.personId &&
              i.queuedAt === item.queuedAt
                ? { ...i, attempts }
                : i,
            );
            break; // Server gerade nicht erreichbar genug: später erneut versuchen
          }
        }
        rejected.push({
          item,
          message: e instanceof RequestError ? e.message : 'Unbekannter Fehler',
        });
        remove(item);
      }
    }
  } finally {
    flushing = false;
    persist();
    emit();
  }
  if (sent.length || rejected.length) done({ sent, rejected });
}
