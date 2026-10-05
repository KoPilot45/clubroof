/**
 * Farbkonzept von Clubroof.
 *
 * Der Verein wählt bei der Einrichtung eine von fünf Vereinsfarben. Jede Vereinsfarbe ist ein
 * vollständiges, vorab geprüftes Farbthema für hellen und dunklen Modus. Freie Hex-Werte sind
 * bewusst nicht vorgesehen, damit Lesbarkeit und Barrierefreiheit immer gewährleistet sind.
 *
 * Regeln für die Verwendung (siehe docs/FARBKONZEPT.md):
 *  - `primary` nur als Flächenfarbe (Buttons, aktive Chips, Kopfbereiche) mit `onPrimary` darauf.
 *  - Auf Hintergrund/Karten wird für Text, Icons, Links und Markierungen `primaryText` verwendet.
 *  - Statusfarben (dringend, Aktion, Info, erledigt, archiviert) sind für alle Vereine gleich und
 *    werden immer zusammen mit Icon und Beschriftung gezeigt, nie als reine Farbfläche.
 */

export const CLUB_COLOR_KEYS = ['green', 'red', 'blue', 'yellow', 'black'] as const;
export type ClubColorKey = (typeof CLUB_COLOR_KEYS)[number];

export const CLUB_COLOR_LABELS: Record<ClubColorKey, string> = {
  green: 'Grün',
  red: 'Rot',
  blue: 'Blau',
  yellow: 'Gelb',
  black: 'Schwarz',
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

export type ThemeColors = ClubColorRoles &
  NeutralColorRoles & {
    status: Record<StatusKey, StatusColorRoles>;
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

/** Liefert das vollständige Farbthema für eine Vereinsfarbe und einen Modus. */
export function getThemeColors(clubColor: ClubColorKey, scheme: ColorScheme): ThemeColors {
  return {
    ...neutralColors[scheme],
    ...clubColors[clubColor][scheme],
    status: statusColors[scheme],
  };
}

export function isClubColorKey(value: string): value is ClubColorKey {
  return (CLUB_COLOR_KEYS as readonly string[]).includes(value);
}
