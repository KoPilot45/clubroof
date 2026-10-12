/**
 * Farbsystem „Anstoß“ (dunkel) – verbindliche Vorgabe: docs/DESIGN-ANSTOSS.md.
 *
 * Für Grün, Blau, Rot, Gelb und Schwarz stehen die Werte fest in der Doku; für die übrigen Vereinsfarben werden sie
 * nach der dortigen Ableitungsregel berechnet (Akzent aufgehellt, Plakat abgedunkelt bis weiße Schrift ≥ 4,5 : 1,
 * Hintergrund fast Schwarz mit Farbton) und im Test je Vereinsfarbe auf Kontrast geprüft.
 */
import { contrastRatio, hexToRgb, MIN_CONTRAST } from './contrast';

type Hsl = { h: number; s: number; l: number };

const toHex = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${toHex((r + m) * 255)}${toHex((g + m) * 255)}${toHex((b + m) * 255)}`.toUpperCase();
}

/** Legt `fg` mit Deckkraft `alpha` über `bg` und liefert die fertige Farbe (für Flächen ohne Transparenz). */
export function blend(fg: string, bg: string, alpha: number): string {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  const mix = (x: number, y: number) => x * alpha + y * (1 - alpha);
  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`.toUpperCase();
}

/** Grundfarben der Vereinsfarbe im Stil „Anstoß“ (dunkel). */
export type AnstossBase = {
  accent: string;
  onAccent: string;
  background: string;
  posterFrom: string;
  posterTo: string;
  textTertiary: string;
  /** Text, Text sekundär, Platzhalter, Fenster, untere Leiste (aus Farbton abgeleitet, wenn nicht vorgegeben) */
  text?: string;
  textSecondary?: string;
  placeholder?: string;
  sheet?: string;
  tabBar?: string;
};

/** Festgelegte Werte aus docs/DESIGN-ANSTOSS.md. */
export const ANSTOSS_FIXED: Record<string, AnstossBase> = {
  green: {
    accent: '#2EDB6B',
    onAccent: '#06210F',
    background: '#0B120E',
    posterFrom: '#1E7A44',
    posterTo: '#0F3D24',
    textTertiary: '#9FB5A6',
    text: '#F2F7F3',
    textSecondary: '#C5D6CB',
    placeholder: '#6F8277',
    sheet: '#16211A',
    tabBar: '#1E2A22',
  },
  blue: {
    accent: '#5AB0FF',
    onAccent: '#04162E',
    background: '#080E1A',
    posterFrom: '#1F55D6',
    posterTo: '#0B2A6B',
    textTertiary: '#9DB0CC',
  },
  red: {
    accent: '#FF5A5F',
    onAccent: '#2B0507',
    background: '#140A0B',
    posterFrom: '#B3202B',
    posterTo: '#5C0F16',
    textTertiary: '#C7A9AB',
  },
  yellow: {
    accent: '#FFD54F',
    onAccent: '#2B2100',
    background: '#0F0D06',
    posterFrom: '#8A6A00',
    posterTo: '#3F3000',
    textTertiary: '#C9BF98',
  },
  /** Schwarz: neutrales Grau statt Farbton */
  black: {
    accent: '#F2F2F2',
    onAccent: '#111111',
    background: '#0A0A0B',
    posterFrom: '#4A4A50',
    posterTo: '#232326',
    textTertiary: '#A8A8AE',
    text: '#F5F5F6',
    textSecondary: '#CFCFD3',
    placeholder: '#77777D',
    sheet: '#1A1A1D',
    tabBar: '#26262A',
  },
  /** Anmeldung ohne Verein und Einrichtung: Clubroof-Farben */
  clubroof: {
    accent: '#4DC3FF',
    onAccent: '#04162E',
    background: '#070B14',
    posterFrom: '#002AFA',
    posterTo: '#001A9E',
    textTertiary: '#9DB0CC',
    text: '#F2F6FB',
    textSecondary: '#C3D0E3',
    placeholder: '#6B7C95',
    sheet: '#101A2C',
    tabBar: '#1A2640',
  },
};

/** Clubroof-Marke für Anmeldung und Einrichtung: Verlauf für Knöpfe und Balken. */
export const CLUBROOF_BRAND = {
  gradient: ['#002AFA', '#00C3FF'] as const,
  accent: '#4DC3FF',
  background: '#070B14',
} as const;

const WHITE = '#FFFFFF';

/**
 * Berechnet die Werte für eine Vereinsfarbe, deren Grundwerte nicht festgelegt sind.
 * `primary` ist die Vereinsfarbe aus dem hellen Thema (Farbton und Sättigung).
 */
export function deriveAnstossBase(primary: string): AnstossBase {
  const { h, s } = hexToHsl(primary);
  const sat = Math.min(1, Math.max(0.55, s));
  const accent = hslToHex({ h, s: Math.min(1, sat + 0.1), l: 0.72 });
  const onAccent = hslToHex({ h, s: 0.7, l: 0.08 });
  // Plakat: Vereinsfarbe abgedunkelt, bis weiße Schrift mindestens 4,5 : 1 erreicht
  let l = 0.46;
  let posterFrom = hslToHex({ h, s: sat * 0.85, l });
  while (l > 0.12 && contrastRatio(WHITE, posterFrom) < MIN_CONTRAST.text + 0.3) {
    l -= 0.02;
    posterFrom = hslToHex({ h, s: sat * 0.85, l });
  }
  return {
    accent,
    onAccent,
    background: hslToHex({ h, s: 0.22, l: 0.06 }),
    posterFrom,
    posterTo: hslToHex({ h, s: sat * 0.85, l: l * 0.52 }),
    textTertiary: hslToHex({ h, s: 0.14, l: 0.68 }),
    text: hslToHex({ h, s: 0.2, l: 0.96 }),
    textSecondary: hslToHex({ h, s: 0.17, l: 0.81 }),
    placeholder: hslToHex({ h, s: 0.08, l: 0.47 }),
    sheet: hslToHex({ h, s: 0.2, l: 0.11 }),
    tabBar: hslToHex({ h, s: 0.17, l: 0.14 }),
  };
}

/** Vollständige Werte (Lücken aus dem Farbton der Hintergrundfarbe gefüllt). */
export function completeAnstossBase(base: AnstossBase) {
  const { h } = hexToHsl(base.background);
  return {
    ...base,
    text: base.text ?? hslToHex({ h, s: 0.2, l: 0.96 }),
    textSecondary: base.textSecondary ?? hslToHex({ h, s: 0.17, l: 0.81 }),
    placeholder: base.placeholder ?? hslToHex({ h, s: 0.08, l: 0.47 }),
    sheet: base.sheet ?? hslToHex({ h, s: 0.2, l: 0.11 }),
    tabBar: base.tabBar ?? hslToHex({ h, s: 0.17, l: 0.14 }),
  };
}

/** Kategoriefarben (Symbolfläche = 15 % Deckkraft, Symbol in voller Farbe). */
export const ANSTOSS_CATEGORIES = {
  team: '#2EDB6B',
  club: '#5AA9FF',
  admin: '#B28CFF',
  events: '#FFB020',
  news: '#FF7AB8',
} as const;
export type AnstossCategory = keyof typeof ANSTOSS_CATEGORIES;

/** Kopfbänder der eigenen Bereiche. */
export const ANSTOSS_BANDS = {
  admin: ['#3B2A78', '#2A1E58'],
  cash: ['#1C4FA3', '#143A7A'],
} as const;

/** „Dringend“ bei roter Vereinsfarbe: Bernstein, damit Vereins- und Warnfarbe nicht verwechselt werden. */
export const AMBER_URGENT = {
  text: '#FFC94D',
  gradient: ['#8A5A00', '#3A2500'] as const,
};
