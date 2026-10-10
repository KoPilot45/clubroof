const KEY = 'clubroof.outbox';

/** Warteschlange für Rückmeldungen ohne Netz im Browser (localStorage). */
export async function readOutboxStore(): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export async function writeOutboxStore(content: string): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, content);
  } catch {
    // gesperrt oder voll – die Warteschlange gilt dann nur, solange die Seite offen ist.
  }
}

export async function clearOutboxStore(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // nichts zu löschen
  }
}
