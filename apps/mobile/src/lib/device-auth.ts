import * as LocalAuthentication from 'expo-local-authentication';

/** Gibt es Face ID, Fingerabdruck oder Gerätecode, und ist etwas eingerichtet? */
export async function deviceAuthAvailable(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

/** Fragt das Gerät nach Face ID, Fingerabdruck oder Code. */
export async function deviceAuthenticate(message: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: 'Abbrechen',
    });
    return result.success;
  } catch {
    return false;
  }
}
