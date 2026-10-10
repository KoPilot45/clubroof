/** Kleine Merker pro Browser (z. B. „Willkommens-Tour gesehen“). */
export async function readFlag(key: string): Promise<boolean> {
  try {
    return globalThis.localStorage?.getItem(`clubroof.flag.${key}`) === '1';
  } catch {
    return false;
  }
}

export async function writeFlag(key: string, value: boolean): Promise<void> {
  try {
    if (value) globalThis.localStorage?.setItem(`clubroof.flag.${key}`, '1');
    else globalThis.localStorage?.removeItem(`clubroof.flag.${key}`);
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus)
  }
}
