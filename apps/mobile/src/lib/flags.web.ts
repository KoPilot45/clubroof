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

/** Einstellung pro Browser als Text (z. B. Schriftgröße); `null` löscht sie. */
export async function readSetting(key: string): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(`clubroof.setting.${key}`) ?? null;
  } catch {
    return null;
  }
}

export async function writeSetting(key: string, value: string | null): Promise<void> {
  try {
    if (value !== null) globalThis.localStorage?.setItem(`clubroof.setting.${key}`, value);
    else globalThis.localStorage?.removeItem(`clubroof.setting.${key}`);
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus)
  }
}
