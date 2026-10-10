/** Abstände, Radien und Typografie – für App und Web-Verwaltung gemeinsam. */

/** 4-px-Raster */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  /** Blickfangkarte (Hero) */
  xxl: 28,
  pill: 999,
} as const;

/** Feste Größen: Bedienelemente erreichen mindestens 44 pt (Apple Human Interface Guidelines). */
export const sizes = {
  touchTarget: 44,
  button: 48,
  buttonSmall: 44,
  chipHeight: 32,
  input: 48,
  iconTile: 40,
  iconTileLarge: 52,
  avatar: 48,
  logo: 48,
  headerButton: 46,
  tabBar: 68,
  tabItem: 48,
} as const;

/** Weiche Schatten im hellen Modus; im dunklen Modus tragen Rahmen und Flächenstufen die Tiefe. */
export const elevation = {
  card: { color: '#142818', opacity: 0.06, radius: 18, offsetY: 6 },
  control: { color: '#142818', opacity: 0.08, radius: 14, offsetY: 4 },
  floating: { color: '#142818', opacity: 0.16, radius: 30, offsetY: 12 },
  hero: { color: '#0B3D1B', opacity: 0.26, radius: 30, offsetY: 14 },
} as const;

/** Bewegung: kurz und sanft; „Bewegung reduzieren“ des Geräts schaltet sie ab. */
export const motion = {
  fast: 150,
  normal: 250,
  skeletonPulse: 1400,
} as const;

export const fontSizes = {
  chip: 11,
  caption: 12,
  label: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  section: 22,
  headline: 26,
  display: 32,
  hero: 46,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;
