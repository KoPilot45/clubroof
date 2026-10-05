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
  pill: 999,
} as const;

export const fontSizes = {
  caption: 12,
  label: 13,
  body: 15,
  bodyLarge: 17,
  title: 20,
  headline: 24,
  display: 32,
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
