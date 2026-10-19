import { useWindowDimensions } from 'react-native';

/**
 * Breitenstufen (Paket DT): unter 640 px wie auf dem Handy (schwebende Leiste), 640–1100 px wie bisher mit
 * zentriertem Inhalt, ab 1100 px die Desktop-Ansicht mit fester Seitenleiste und breiterem Inhalt.
 */
export const TABLET_MIN = 640;
export const DESKTOP_MIN = 1100;
export const SIDEBAR_WIDTH = 248;
export const SIDEBAR_WIDTH_COMPACT = 208;
/** Desktop-Stufen (Paket DT3): kompakt 1100–1399 px, normal 1400–1799 px, weit ab 1800 px */
export const DESKTOP_NORMAL_MIN = 1400;
export const DESKTOP_WIDE_MIN = 1800;
export const CONTENT_MAX = 960;
export const DESKTOP_CONTENT_MAX = 1440;

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN ? 'desktop' : width >= TABLET_MIN ? 'tablet' : 'phone';
}

export const useIsDesktop = () => useBreakpoint() === 'desktop';

export type DesktopStage = 'compact' | 'normal' | 'wide';

/** Stufe der Desktop-Ansicht; unter 1100 px `null`. */
export function useDesktopStage(): DesktopStage | null {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_MIN) return null;
  return width >= DESKTOP_WIDE_MIN ? 'wide' : width >= DESKTOP_NORMAL_MIN ? 'normal' : 'compact';
}

export const useIsCompactDesktop = () => useDesktopStage() === 'compact';
