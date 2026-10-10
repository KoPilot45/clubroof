import { File, Paths } from 'expo-file-system';

/** Warteschlange für Rückmeldungen ohne Netz: eine Datei im Cache-Ordner der App. */
const file = () => new File(Paths.cache, 'clubroof-outbox.json');

export async function readOutboxStore(): Promise<string | null> {
  try {
    const f = file();
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

export async function writeOutboxStore(content: string): Promise<void> {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(content);
  } catch {
    // Speicher nicht verfügbar – die Warteschlange gilt dann nur, solange die App läuft.
  }
}

export async function clearOutboxStore(): Promise<void> {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    // nichts zu löschen
  }
}
