import * as SecureStore from 'expo-secure-store';

/** Kleine Merker pro Gerät (z. B. „Willkommens-Tour gesehen“). */
export async function readFlag(key: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(`flag.${key}`)) === '1';
  } catch {
    return false;
  }
}

export async function writeFlag(key: string, value: boolean): Promise<void> {
  try {
    if (value) await SecureStore.setItemAsync(`flag.${key}`, '1');
    else await SecureStore.deleteItemAsync(`flag.${key}`);
  } catch {
    // Speicher nicht verfügbar – der Merker gilt dann nur bis zum nächsten Start.
  }
}

/** Einstellung pro Gerät als Text (z. B. Schriftgröße); `null` löscht sie. */
export async function readSetting(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`setting.${key}`);
  } catch {
    return null;
  }
}

export async function writeSetting(key: string, value: string | null): Promise<void> {
  try {
    if (value !== null) await SecureStore.setItemAsync(`setting.${key}`, value);
    else await SecureStore.deleteItemAsync(`setting.${key}`);
  } catch {
    // Speicher nicht verfügbar – die Einstellung gilt dann nur bis zum nächsten Start.
  }
}
