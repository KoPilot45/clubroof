const KEY = 'clubroof.offline';

/** Zwischenspeicher für Offline-Lesen im Browser (localStorage). */
export async function readOfflineStore(): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export async function writeOfflineStore(content: string): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, content);
  } catch {
    // Speicher voll oder gesperrt – Offline-Lesen entfällt dann einfach.
  }
}

export async function clearOfflineStore(): Promise<void> {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // nichts zu löschen
  }
}
