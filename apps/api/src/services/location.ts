import { normalizeMapLocation } from '@clubroof/core';
import { HttpError } from '../errors';

/** Maps-Link oder Koordinaten prüfen; leer = kein Eintrag. */
export function locationUrlFrom(raw: string | null | undefined): string | null {
  const value = normalizeMapLocation(raw);
  if (value === undefined)
    throw new HttpError(
      400,
      'invalid_location_url',
      'Bitte füge einen Maps-Link (https://…) oder Koordinaten wie 50.1234, 8.5678 ein.',
    );
  return value;
}
