const KEY = 'clubroof.session';

/** Im Browser (Entwicklung und Web-Vorschau) wird das Token im localStorage gehalten. */
export async function readToken(): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) globalThis.localStorage?.setItem(KEY, token);
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus) – Sitzung gilt dann nur bis zum Neuladen.
  }
}
