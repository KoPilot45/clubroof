/**
 * WCAG-2.x-Kontrastberechnung. Wird für die Prüfung der Farbthemen und später für die
 * Lesbarkeitsprüfung im Vereins-Setup verwendet.
 */

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Ungültiger Hex-Farbwert: ${hex}`);
  }
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mindestkontraste nach WCAG 2.1 AA. */
export const MIN_CONTRAST = {
  /** Fließtext und Beschriftungen */
  text: 4.5,
  /** große Schrift (≥ 18,66 px fett / 24 px normal), Icons und Bedienelemente */
  largeTextOrUi: 3,
} as const;
