import * as SecureStore from 'expo-secure-store';

const KEY = 'clubroof.session';

/** Speichert das Sitzungs-Token im sicheren Schlüsselbund des Geräts (iOS Keychain / Android Keystore). */
export async function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function writeToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
