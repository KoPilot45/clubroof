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
