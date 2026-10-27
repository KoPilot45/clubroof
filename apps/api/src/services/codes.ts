/**
 * Kurze Codes zum Eintippen (Einrichtung, Beitritt). Alphabet ohne verwechselbare Zeichen (0/O, 1/I/L);
 * gespeichert wird nur der Hash. Gleiche Normalisierung beim Erzeugen und Prüfen.
 */
import { randomInt } from 'node:crypto';
import { hashToken } from '../auth/session';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `length` Zeichen, in Vierergruppen mit Bindestrich (z. B. `K7M2-QX4P`). */
export function generateCode(length: number): string {
  const chars = Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]!);
  return (chars.join('').match(/.{1,4}/g) ?? []).join('-');
}

/** Groß, ohne Leer- und Trennzeichen (so wird getippt, kopiert oder diktiert). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]+/g, '');
}

export const codeHash = (code: string) => hashToken(`code:${normalizeCode(code)}`);
