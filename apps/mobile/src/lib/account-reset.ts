import type { QueryClient } from '@tanstack/react-query';
import { clearOfflineCache } from './offline-cache';
import { clearOutbox, resetOutboxMemory } from './outbox';

/**
 * Gemeinsame Bereinigung beim Verlassen eines Kontos – für Abmeldung, abgelaufene Sitzung (401) und Kontowechsel:
 * laufende Abfragen abbrechen (späte Antworten landen nicht im nächsten Konto), Abfrage-Cache und Offline-Speicher
 * leeren, Warteschlange im Speicher verwerfen. Die gespeicherte Warteschlange bleibt nur bei `keepOutbox` erhalten
 * (abgelaufene Sitzung: Antworten desselben Kontos werden nach dem erneuten Anmelden noch gesendet; beim Laden für ein
 * anderes Konto werden sie verworfen).
 */
export async function resetAccountState(
  queryClient: QueryClient,
  options: { keepOutbox: boolean },
) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await clearOfflineCache();
  if (options.keepOutbox) resetOutboxMemory();
  else await clearOutbox();
}
