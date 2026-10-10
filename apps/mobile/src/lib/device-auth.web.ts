/** Im Browser gibt es keine Geräte-Sperre für die App. */
export async function deviceAuthAvailable(): Promise<boolean> {
  return false;
}

export async function deviceAuthenticate(): Promise<boolean> {
  return true;
}
