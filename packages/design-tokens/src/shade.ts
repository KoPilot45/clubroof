import { hexToRgb, contrastRatio, relativeLuminance } from './contrast';

const toHex = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');

/** Mischt eine Farbe mit Schwarz (`amount` < 0) oder Weiß (`amount` > 0); Betrag 0…1. */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => (amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `#${toHex(f(r))}${toHex(f(g))}${toHex(f(b))}`.toUpperCase();
}

/** Ist die Farbe so hell, dass dunkle Schrift darauf besser lesbar ist als weiße? */
export function prefersDarkText(hex: string): boolean {
  return contrastRatio('#000000', hex) > contrastRatio('#FFFFFF', hex);
}

export { relativeLuminance };
