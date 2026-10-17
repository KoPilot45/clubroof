/**
 * Farbkonzept von Clubroof.
 *
 * Der Verein wählt bei der Einrichtung eine von zehn Vereinsfarben. Jede Vereinsfarbe ist ein
 * vollständiges, vorab geprüftes Farbthema für hellen und dunklen Modus. Freie Hex-Werte sind
 * bewusst nicht vorgesehen, damit Lesbarkeit und Barrierefreiheit immer gewährleistet sind.
 *
 * Regeln für die Verwendung (siehe docs/FARBKONZEPT.md):
 *  - `primary` nur als Flächenfarbe (Buttons, aktive Chips, Kopfbereiche) mit `onPrimary` darauf.
 *  - Auf Hintergrund/Karten wird für Text, Icons, Links und Markierungen `primaryText` verwendet.
 *  - Statusfarben (dringend, Aktion, Info, erledigt, archiviert) sind für alle Vereine gleich und
 *    werden immer zusammen mit Icon und Beschriftung gezeigt, nie als reine Farbfläche.
 */

import {
  AMBER_URGENT,
  AREA_HEROES,
  ANSTOSS_BANDS,
  ANSTOSS_CATEGORIES,
  ANSTOSS_FIXED,
  blend,
  completeAnstossBase,
  deriveAnstossBase,
  hexToHsl,
  hslToHex,
  type AnstossCategory,
} from './anstoss';
import { contrastRatio, MIN_CONTRAST } from './contrast';
import { prefersDarkText, shade } from './shade';

export const CLUB_COLOR_KEYS = [
  'green',
  'red',
  'blue',
  'yellow',
  'black',
  'orange',
  'purple',
  'burgundy',
  'skyblue',
  'teal',
] as const;
export type ClubColorKey = (typeof CLUB_COLOR_KEYS)[number];

export const CLUB_COLOR_LABELS: Record<ClubColorKey, string> = {
  green: 'Grün',
  red: 'Rot',
  blue: 'Blau',
  yellow: 'Gelb',
  black: 'Schwarz',
  orange: 'Orange',
  purple: 'Lila',
  burgundy: 'Weinrot',
  skyblue: 'Himmelblau',
  teal: 'Türkis',
};

export type ColorScheme = 'light' | 'dark';

/** Farben, die sich je Vereinsfarbe unterscheiden. */
export type ClubColorRoles = {
  primary: string;
  onPrimary: string;
  primaryPressed: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  primaryText: string;
};

/** Neutrale Flächen- und Textfarben – für alle Vereine gleich. */
export type NeutralColorRoles = {
  background: string;
  surface: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceMuted: string;
  border: string;
};

export const STATUS_KEYS = ['urgent', 'action', 'info', 'success', 'archived'] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_LABELS: Record<StatusKey, string> = {
  urgent: 'Dringend',
  action: 'Aktion',
  info: 'Info',
  success: 'Erledigt',
  archived: 'Archiviert',
};

export type StatusColorRoles = {
  solid: string;
  onSolid: string;
  container: string;
  onContainer: string;
};

/** Pastelflächen für Icon-Kacheln, Termintypen und Kennzahlen – für alle Vereine gleich, immer mit Beschriftung. */
export const TINT_KEYS = ['blue', 'orange', 'pink', 'green', 'violet'] as const;
export type TintKey = (typeof TINT_KEYS)[number];
export type TintColorRoles = { container: string; onContainer: string };

/** Verlauf der Blickfangkarte („Hero“): Start- und Endfarbe, Schrift darauf und feine Dekorflächen. */
export type HeroColorRoles = {
  from: string;
  to: string;
  onHero: string;
  /** halbtransparente Wellen und Kreise im Hintergrund */
  decor: string;
};

/** Zusätzliche Rollen des Stils „Anstoß“ (docs/DESIGN-ANSTOSS.md). */
export type AnstossRoles = {
  /** Neutrale Füllung für Segmente, runde Knöpfe und Chips ohne Farbe (dunkel: Weiß, hell: dunkles Grün) */
  overlay: string;
  overlayStrong: string;
  /** Akzent auf dem farbigen Plakat (hell wie im dunklen Stil, auch im hellen Thema) */
  posterAccent: string;
  /** Fläche für Karten, Kacheln und Felder (dunkel: Weiß bei 6 %) */
  card: string;
  cardBorder: string;
  fieldBorder: string;
  /** Trennlinie in Listen */
  divider: string;
  textTertiary: string;
  placeholder: string;
  /** Fenster von unten und Dialog */
  sheet: string;
  sheetBorder: string;
  scrim: string;
  scrimDialog: string;
  tabBar: string;
  tabBarBorder: string;
  /** Plakat: Verlauf p1 → p2 → Hintergrund */
  poster: { from: string; to: string };
  categories: Record<AnstossCategory, string>;
  bands: { admin: readonly [string, string]; cash: readonly [string, string] };
  /** rote Vereinsfarbe: „Dringend“ erscheint in Bernstein */
  amberUrgent: boolean;
  /** Verlauf der Dringend-Fläche in Bernstein */
  amberGradient: readonly [string, string];
  /** Hero in den eigenen Bereichen (Verwaltung, Vereinskasse) */
  areaHeroes: Record<'admin' | 'cash', { from: string; to: string }>;
  /** Diagrammfarben (Paket ST): Einnahmen Blau, Ausgaben Orange, weitere Reihen Aqua und Gelb – feste Reihenfolge */
  chart: { income: string; expense: string; aqua: string; yellow: string };
  /** Spielfeld des Aufstellungsplaners (Paket AUF): zwei Rasenstreifen, Linien (in beiden Darstellungen gleich) */
  pitch: { grass: string; grassAlt: string; line: string };
};

/** Rasen und Linien des Spielfelds im Aufstellungsplaner; weiße Linien bei 20 % Deckkraft */
const PITCH = { grass: '#12391F', grassAlt: '#0F3219', line: 'rgba(255,255,255,0.2)' };

export type ThemeColors = ClubColorRoles &
  NeutralColorRoles & {
    /** Karten, die sich vom Hintergrund abheben (hell: weiß mit Schatten, dunkel: eine Stufe heller) */
    surfaceRaised: string;
    status: Record<StatusKey, StatusColorRoles>;
    tints: Record<TintKey, TintColorRoles>;
    hero: HeroColorRoles;
    anstoss: AnstossRoles;
  };

export const clubColors: Record<ClubColorKey, Record<ColorScheme, ClubColorRoles>> = {
  green: {
    light: {
      primary: '#11882E',
      onPrimary: '#FFFFFF',
      primaryPressed: '#0D6B24',
      primaryContainer: '#E3F4E7',
      onPrimaryContainer: '#0B5A1F',
      primaryText: '#0F7A29',
    },
    dark: {
      primary: '#4CC46B',
      onPrimary: '#04210C',
      primaryPressed: '#3BAE59',
      primaryContainer: '#12301B',
      onPrimaryContainer: '#9BE3AE',
      primaryText: '#5FD17D',
    },
  },
  red: {
    light: {
      primary: '#C8102E',
      onPrimary: '#FFFFFF',
      primaryPressed: '#A10C24',
      primaryContainer: '#FBE7EA',
      onPrimaryContainer: '#8A0B20',
      primaryText: '#B30E29',
    },
    dark: {
      primary: '#FF6B7D',
      onPrimary: '#2B0007',
      primaryPressed: '#F2546A',
      primaryContainer: '#3D1219',
      onPrimaryContainer: '#FFB3BD',
      primaryText: '#FF8796',
    },
  },
  blue: {
    light: {
      primary: '#0B4EA2',
      onPrimary: '#FFFFFF',
      primaryPressed: '#083D80',
      primaryContainer: '#E5EEFA',
      onPrimaryContainer: '#0A3A78',
      primaryText: '#0B4EA2',
    },
    dark: {
      primary: '#6EA8FF',
      onPrimary: '#021430',
      primaryPressed: '#5594F2',
      primaryContainer: '#11264A',
      onPrimaryContainer: '#B5D2FF',
      primaryText: '#82B4FF',
    },
  },
  yellow: {
    light: {
      primary: '#F5C400',
      onPrimary: '#1A1A1A',
      primaryPressed: '#D9AD00',
      primaryContainer: '#FFF6CC',
      onPrimaryContainer: '#5C4700',
      primaryText: '#7A5E00',
    },
    dark: {
      primary: '#FFD43B',
      onPrimary: '#1A1400',
      primaryPressed: '#F0C419',
      primaryContainer: '#3A3000',
      onPrimaryContainer: '#FFE58A',
      primaryText: '#FFD43B',
    },
  },
  black: {
    light: {
      primary: '#1C1C1E',
      onPrimary: '#FFFFFF',
      primaryPressed: '#000000',
      primaryContainer: '#ECECEE',
      onPrimaryContainer: '#1C1C1E',
      primaryText: '#1C1C1E',
    },
    dark: {
      primary: '#F2F2F2',
      onPrimary: '#111111',
      primaryPressed: '#D9D9D9',
      primaryContainer: '#2A2A2D',
      onPrimaryContainer: '#EDEDED',
      primaryText: '#F2F2F2',
    },
  },
  orange: {
    light: {
      primary: '#FF8A00',
      onPrimary: '#1A0F00',
      primaryPressed: '#E67A00',
      primaryContainer: '#FFEBD2',
      onPrimaryContainer: '#6B3300',
      primaryText: '#9A4A00',
    },
    dark: {
      primary: '#FFA033',
      onPrimary: '#1F0F00',
      primaryPressed: '#F28F1F',
      primaryContainer: '#3B2209',
      onPrimaryContainer: '#FFD3A0',
      primaryText: '#FFB254',
    },
  },
  purple: {
    light: {
      primary: '#6D28D9',
      onPrimary: '#FFFFFF',
      primaryPressed: '#5B21B6',
      primaryContainer: '#EFE7FB',
      onPrimaryContainer: '#4C1D95',
      primaryText: '#6D28D9',
    },
    dark: {
      primary: '#B794F6',
      onPrimary: '#1E0A3C',
      primaryPressed: '#A07BEF',
      primaryContainer: '#2A1A47',
      onPrimaryContainer: '#DCC9FA',
      primaryText: '#C4A8F8',
    },
  },
  burgundy: {
    light: {
      primary: '#7B1E3A',
      onPrimary: '#FFFFFF',
      primaryPressed: '#621730',
      primaryContainer: '#F6E6EB',
      onPrimaryContainer: '#5A1229',
      primaryText: '#7B1E3A',
    },
    dark: {
      primary: '#E07A96',
      onPrimary: '#2B0713',
      primaryPressed: '#D0667F',
      primaryContainer: '#3A1522',
      onPrimaryContainer: '#F3B8C8',
      primaryText: '#EE93AB',
    },
  },
  skyblue: {
    light: {
      primary: '#0EA5E9',
      onPrimary: '#04202E',
      primaryPressed: '#0B93D0',
      primaryContainer: '#E0F4FD',
      onPrimaryContainer: '#065A86',
      primaryText: '#0369A1',
    },
    dark: {
      primary: '#7DD3FC',
      onPrimary: '#04202E',
      primaryPressed: '#5EC4F5',
      primaryContainer: '#0F2E40',
      onPrimaryContainer: '#BAE6FD',
      primaryText: '#7DD3FC',
    },
  },
  teal: {
    light: {
      primary: '#0F766E',
      onPrimary: '#FFFFFF',
      primaryPressed: '#0B5F58',
      primaryContainer: '#DDF4F1',
      onPrimaryContainer: '#0A4F49',
      primaryText: '#0F766E',
    },
    dark: {
      primary: '#2DD4BF',
      onPrimary: '#02201C',
      primaryPressed: '#20BFAB',
      primaryContainer: '#0F2E2B',
      onPrimaryContainer: '#99F0E3',
      primaryText: '#5EEAD4',
    },
  },
};

export const neutralColors: Record<ColorScheme, NeutralColorRoles> = {
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F3F5',
    onSurface: '#111827',
    onSurfaceMuted: '#5B6472',
    border: '#E2E5EA',
  },
  dark: {
    background: '#0E1013',
    surface: '#171A1F',
    surfaceVariant: '#1F242B',
    onSurface: '#F3F4F6',
    onSurfaceMuted: '#A3ABB8',
    border: '#2C323B',
  },
};

export const statusColors: Record<ColorScheme, Record<StatusKey, StatusColorRoles>> = {
  light: {
    urgent: { solid: '#C62828', onSolid: '#FFFFFF', container: '#FDECEC', onContainer: '#8E1B1B' },
    action: { solid: '#C2410C', onSolid: '#FFFFFF', container: '#FFF1E6', onContainer: '#8A2E06' },
    info: { solid: '#1D5FD1', onSolid: '#FFFFFF', container: '#E8F0FE', onContainer: '#1846A3' },
    success: { solid: '#1E7F3B', onSolid: '#FFFFFF', container: '#E6F5EA', onContainer: '#165C2B' },
    archived: {
      solid: '#6B7280',
      onSolid: '#FFFFFF',
      container: '#F0F1F3',
      onContainer: '#4B5260',
    },
  },
  dark: {
    urgent: { solid: '#F87171', onSolid: '#1A0505', container: '#3A1416', onContainer: '#FCA5A5' },
    action: { solid: '#FB923C', onSolid: '#1F0D02', container: '#3A2010', onContainer: '#FDBA74' },
    info: { solid: '#60A5FA', onSolid: '#04122B', container: '#10243F', onContainer: '#93C5FD' },
    success: { solid: '#4ADE80', onSolid: '#03200D', container: '#0F2A18', onContainer: '#86EFAC' },
    archived: {
      solid: '#9CA3AF',
      onSolid: '#111317',
      container: '#24282F',
      onContainer: '#C4C9D1',
    },
  },
};

export const tintColors: Record<ColorScheme, Record<TintKey, TintColorRoles>> = {
  light: {
    blue: { container: '#CFE3FF', onContainer: '#123B73' },
    orange: { container: '#FFE0B8', onContainer: '#7A4B00' },
    pink: { container: '#F6D3F0', onContainer: '#6B1E62' },
    green: { container: '#D6EFE0', onContainer: '#14532D' },
    violet: { container: '#E5E1FA', onContainer: '#3B2A86' },
  },
  dark: {
    blue: { container: '#17304F', onContainer: '#9CC4FF' },
    orange: { container: '#3A2B0A', onContainer: '#F2C46A' },
    pink: { container: '#3F1B3A', onContainer: '#F0A8E6' },
    green: { container: '#17391F', onContainer: '#8FE0AB' },
    violet: { container: '#2A2450', onContainer: '#C4B8FF' },
  },
};

/**
 * Verlauf der Blickfangkarte aus der Vereinsfarbe.
 *  - Hell: Vereinsfarben mit weißer Schrift laufen von dunkel nach `primary`; helle Vereinsfarben
 *    (Gelb, Orange, Himmelblau) mit dunkler Schrift von `primary` nach heller.
 *  - Dunkel: tief eingefärbte Fläche mit weißer Schrift – so bleibt der Dunkelmodus ruhig.
 * Die Schrift erreicht auf beiden Verlaufsfarben mindestens 4,5 : 1 (siehe Test).
 */
export function heroColors(roles: ClubColorRoles, scheme: ColorScheme): HeroColorRoles {
  const decor = scheme === 'light' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.08)';
  if (scheme === 'light') {
    // Schrift der Vereinsfarbe ist dunkel (onPrimary ist dunkel) → helle Fläche, Verlauf nach heller
    if (!prefersDarkText(roles.onPrimary)) {
      return {
        from: roles.primary,
        to: shade(roles.primary, 0.25),
        onHero: roles.onPrimary,
        decor,
      };
    }
    return { from: shade(roles.primary, -0.3), to: roles.primary, onHero: '#FFFFFF', decor };
  }
  let factor = 0.35;
  while (
    factor < 0.9 &&
    contrastRatio('#FFFFFF', shade(roles.primary, -factor)) < MIN_CONTRAST.text
  )
    factor += 0.05;
  return {
    from: shade(roles.primary, -Math.min(factor + 0.25, 0.9)),
    to: shade(roles.primary, -factor),
    onHero: '#FFFFFF',
    decor,
  };
}

/** Rollen des Stils „Anstoß“ für den hellen Modus (noch nicht gestaltet; Näherung aus dem bisherigen Thema). */
/**
 * Dunkles Thema im Stil „Anstoß“. `key` ist eine Vereinsfarbe oder `clubroof` (Anmeldung ohne Verein, Einrichtung).
 */
export function anstossTheme(key: ClubColorKey | 'clubroof'): ThemeColors {
  const base = completeAnstossBase(
    ANSTOSS_FIXED[key] ?? deriveAnstossBase(clubColors[key as ClubColorKey].light.primary),
  );
  const bg = base.background;
  const WHITE = '#FFFFFF';
  const category = ANSTOSS_CATEGORIES;
  const amber = key === 'red';
  const status: Record<StatusKey, StatusColorRoles> = {
    urgent: amber
      ? {
          solid: AMBER_URGENT.text,
          onSolid: '#2B1A00',
          container: blend('#FFB020', bg, 0.16),
          onContainer: AMBER_URGENT.text,
        }
      : {
          solid: '#FF5A5F',
          onSolid: '#2B0507',
          container: blend('#FF5A5A', bg, 0.16),
          onContainer: '#FF8A8A',
        },
    action: {
      solid: '#FFB020',
      onSolid: '#2B1A00',
      container: blend('#FFB020', bg, 0.16),
      onContainer: '#FFB020',
    },
    info: {
      solid: category.club,
      onSolid: '#04162E',
      container: blend(category.club, bg, 0.16),
      onContainer: category.club,
    },
    success: {
      solid: '#2EDB6B',
      onSolid: '#06210F',
      container: blend('#2EDB6B', bg, 0.16),
      onContainer: '#2EDB6B',
    },
    archived: {
      solid: '#9AA6A0',
      onSolid: '#101412',
      container: blend(WHITE, bg, 0.08),
      onContainer: base.textSecondary,
    },
  };
  const tints = Object.fromEntries(
    (
      [
        ['blue', category.club],
        ['orange', category.events],
        ['pink', category.news],
        ['green', category.team],
        ['violet', category.admin],
      ] as const
    ).map(([name, color]) => [name, { container: blend(color, bg, 0.15), onContainer: color }]),
  ) as Record<TintKey, TintColorRoles>;
  const roles: ClubColorRoles = {
    primary: base.accent,
    onPrimary: base.onAccent,
    primaryPressed: shade(base.accent, -0.1),
    primaryContainer: blend(base.accent, bg, 0.15),
    onPrimaryContainer: base.accent,
    primaryText: base.accent,
  };
  return {
    ...roles,
    background: bg,
    surface: blend(WHITE, bg, 0.06),
    surfaceVariant: blend(WHITE, bg, 0.1),
    onSurface: base.text,
    onSurfaceMuted: base.textSecondary,
    border: blend(WHITE, bg, 0.09),
    surfaceRaised: base.sheet,
    status,
    tints,
    hero: {
      from: base.posterFrom,
      to: base.posterTo,
      onHero: '#FFFFFF',
      decor: 'rgba(255,255,255,0.08)',
    },
    anstoss: {
      posterAccent: base.accent,
      overlay: 'rgba(255,255,255,0.08)',
      overlayStrong: 'rgba(255,255,255,0.14)',
      card: 'rgba(255,255,255,0.06)',
      cardBorder: 'rgba(255,255,255,0.09)',
      fieldBorder: 'rgba(255,255,255,0.12)',
      divider: 'rgba(255,255,255,0.08)',
      textTertiary: base.textTertiary,
      placeholder: base.placeholder,
      sheet: base.sheet,
      sheetBorder: 'rgba(255,255,255,0.12)',
      scrim: 'rgba(0,0,0,0.6)',
      scrimDialog: 'rgba(0,0,0,0.7)',
      tabBar: hexAlpha(base.tabBar, 0.86),
      tabBarBorder: 'rgba(255,255,255,0.1)',
      poster: { from: base.posterFrom, to: base.posterTo },
      categories: { ...ANSTOSS_CATEGORIES },
      bands: { ...ANSTOSS_BANDS },
      amberUrgent: amber,
      amberGradient: AMBER_URGENT.gradient,
      areaHeroes: AREA_HEROES,
      chart: ANSTOSS_CHART_DARK,
      pitch: PITCH,
    },
  };
}

function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Kategoriefarben im hellen Stil: dunkel genug für Symbol und Zahl auf Pastellgrund (≥ 4,5 : 1). */
export const ANSTOSS_CATEGORIES_LIGHT: Record<AnstossCategory, string> = {
  team: '#1A7237',
  club: '#1F5FB8',
  admin: '#6B46C1',
  events: '#A84B00',
  news: '#B4156B',
};

/** Diagrammfarben dunkel (gegen die Kartenfläche `#171F1A` geprüft: Kontrast ≥ 4 : 1, Farbfehlsichtigkeit). */
export const ANSTOSS_CHART_DARK = {
  income: '#3987E5',
  expense: '#D95926',
  aqua: '#199E70',
  yellow: '#C98500',
} as const;

/** Diagrammfarben hell: Referenzwerte, wo nötig abgedunkelt, damit Flächen auf Weiß mindestens 3 : 1 erreichen. */
function anstossChartLight() {
  const WHITE = '#FFFFFF';
  return {
    income: darkenFor('#2A78D6', WHITE, 3),
    expense: darkenFor('#EB6834', WHITE, 3),
    aqua: darkenFor('#1BAF7A', WHITE, 3),
    yellow: darkenFor('#EDA100', WHITE, 3),
  };
}

/** Dunkelt eine Farbe ab, bis sie auf `on` mindestens `min` : 1 erreicht. */
function darkenFor(hex: string, on: string, min: number): string {
  const { h, s, l } = hexToHsl(hex);
  let out = hex;
  let light = l;
  while (light > 0.08 && contrastRatio(out, on) < min) {
    light -= 0.02;
    out = hslToHex({ h, s, l: light });
  }
  return out;
}

/**
 * Helles Thema im Stil „Anstoß“ (docs/DESIGN-ANSTOSS.md, „Heller Stil“): Hintergrund `#F2F5F3`, weiße Flächen mit
 * Rand, Akzent = Vereinsfarbe (bei hellen Farben abgedunkelt, damit Text und Knöpfe ≥ 4,5 : 1 erreichen).
 * Hero und Plakat bleiben farbig (gleiche Verläufe wie dunkel).
 */
export function anstossLightTheme(key: ClubColorKey): ThemeColors {
  const base = completeAnstossBase(
    ANSTOSS_FIXED[key] ?? deriveAnstossBase(clubColors[key].light.primary),
  );
  const BG = '#F2F5F3';
  const WHITE = '#FFFFFF';
  const INK = '#0F1A14';
  const amber = key === 'red';
  const accent = darkenFor(clubColors[key].light.primary, BG, MIN_CONTRAST.text + 0.2);
  const onAccent = contrastRatio(WHITE, accent) >= MIN_CONTRAST.text ? WHITE : INK;
  const status: Record<StatusKey, StatusColorRoles> = {
    urgent: amber
      ? { solid: '#B45309', onSolid: WHITE, container: '#FFF0DB', onContainer: '#8F4200' }
      : { solid: '#B3261E', onSolid: WHITE, container: '#FDE8E6', onContainer: '#B3261E' },
    action: { solid: '#B45309', onSolid: WHITE, container: '#FFF0DB', onContainer: '#8F4200' },
    info: { solid: '#1F5FB8', onSolid: WHITE, container: '#E6EFFB', onContainer: '#1F5FB8' },
    success: { solid: '#1B7F3F', onSolid: WHITE, container: '#E3F4E7', onContainer: '#17692F' },
    archived: { solid: '#5F6D65', onSolid: WHITE, container: '#E8EDEA', onContainer: '#4B5A52' },
  };
  const cat = ANSTOSS_CATEGORIES_LIGHT;
  const tints = Object.fromEntries(
    (
      [
        ['blue', cat.club],
        ['orange', cat.events],
        ['pink', cat.news],
        ['green', cat.team],
        ['violet', cat.admin],
      ] as const
    ).map(([name, color]) => [name, { container: blend(color, WHITE, 0.12), onContainer: color }]),
  ) as Record<TintKey, TintColorRoles>;
  const roles: ClubColorRoles = {
    primary: accent,
    onPrimary: onAccent,
    primaryPressed: shade(accent, -0.1),
    primaryContainer: blend(accent, WHITE, 0.12),
    onPrimaryContainer: darkenFor(accent, blend(accent, WHITE, 0.12), MIN_CONTRAST.text),
    primaryText: accent,
  };
  return {
    ...roles,
    background: BG,
    surface: WHITE,
    surfaceVariant: '#E8EDEA',
    onSurface: INK,
    onSurfaceMuted: '#3E4F45',
    border: '#E2E8E4',
    surfaceRaised: WHITE,
    status,
    tints,
    hero: {
      from: base.posterFrom,
      to: base.posterTo,
      onHero: WHITE,
      decor: 'rgba(255,255,255,0.08)',
    },
    anstoss: {
      posterAccent: base.accent,
      overlay: 'rgba(15,26,20,0.06)',
      overlayStrong: 'rgba(15,26,20,0.12)',
      card: WHITE,
      cardBorder: '#E2E8E4',
      fieldBorder: '#D5DDD7',
      divider: '#E8EDEA',
      textTertiary: '#566759',
      placeholder: '#7C8A81',
      sheet: WHITE,
      sheetBorder: '#E2E8E4',
      scrim: 'rgba(15,26,20,0.45)',
      scrimDialog: 'rgba(15,26,20,0.5)',
      tabBar: 'rgba(255,255,255,0.94)',
      tabBarBorder: '#E2E8E4',
      poster: { from: base.posterFrom, to: base.posterTo },
      categories: { ...cat },
      bands: { ...ANSTOSS_BANDS },
      amberUrgent: amber,
      amberGradient: AMBER_URGENT.gradient,
      areaHeroes: AREA_HEROES,
      chart: anstossChartLight(),
      pitch: PITCH,
    },
  };
}

/**
 * Liefert das vollständige Farbthema für eine Vereinsfarbe und einen Modus (Stil „Anstoß“, hell und dunkel).
 */
export function getThemeColors(clubColor: ClubColorKey, scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? anstossTheme(clubColor) : anstossLightTheme(clubColor);
}

export function isClubColorKey(value: string): value is ClubColorKey {
  return (CLUB_COLOR_KEYS as readonly string[]).includes(value);
}
