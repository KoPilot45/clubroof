/**
 * Zeitbasierte Einmalcodes (TOTP, RFC 6238) für die 2-Faktor-Anmeldung – kompatibel mit
 * Google Authenticator, Microsoft Authenticator, 1Password usw. (SHA-1, 6 Stellen, 30 Sekunden).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Ungültiges Base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateSecret = () => base32Encode(randomBytes(20));

export const stepOf = (time: Date) => Math.floor(time.getTime() / 1000 / STEP);

export function totp(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/**
 * Prüft einen Code mit ±1 Zeitschritt Toleranz (Uhrabweichung). Liefert den verwendeten Schritt,
 * damit derselbe Code nicht zweimal angenommen wird (`lastStep`).
 */
export function verifyTotp(
  secret: string,
  code: string,
  now: Date,
  lastStep: number | null,
): number | null {
  const given = Buffer.from(code.replace(/\s/g, ''));
  if (given.length !== 6) return null;
  const current = stepOf(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totp(secret, step)), given)) return step;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}

/** Zehn Wiederherstellungscodes im Format xxxx-xxxx (Kleinbuchstaben/Ziffern, ohne Verwechsler). */
export function recoveryCodes(): string[] {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => {
    const b = randomBytes(8);
    const s = [...b].map((x) => chars[x % chars.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
