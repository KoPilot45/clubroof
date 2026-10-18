import { useWindowDimensions } from 'react-native';

/**
 * Breitenstufen (Paket DT): unter 640 px wie auf dem Handy (schwebende Leiste), 640–1100 px wie bisher mit
 * zentriertem Inhalt, ab 1100 px die Desktop-Ansicht mit fester Seitenleiste und breiterem Inhalt.
 */
export const TABLET_MIN = 640;
export const DESKTOP_MIN = 1100;
export const SIDEBAR_WIDTH = 248;
export const CONTENT_MAX = 960;
export const DESKTOP_CONTENT_MAX = 1440;

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN ? 'desktop' : width >= TABLET_MIN ? 'tablet' : 'phone';
}

export const useIsDesktop = () => useBreakpoint() === 'desktop';
