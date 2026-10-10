import { File, Paths } from 'expo-file-system';

/** Zwischenspeicher für Offline-Lesen: eine Datei im Cache-Ordner der App. */
const file = () => new File(Paths.cache, 'clubroof-offline.json');

export async function readOfflineStore(): Promise<string | null> {
  try {
    const f = file();
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

export async function writeOfflineStore(content: string): Promise<void> {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(content);
  } catch {
    // Speicher voll oder nicht verfügbar – Offline-Lesen entfällt dann einfach.
  }
}

export async function clearOfflineStore(): Promise<void> {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    // nichts zu löschen
  }
}
