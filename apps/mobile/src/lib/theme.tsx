import {
  anstossTheme,
  fontSizes,
  fontWeights,
  getThemeColors,
  isClubColorKey,
  elevation,
  motion,
  radii,
  sizes,
  spacing,
  type ClubColorKey,
  type ColorScheme,
  type ThemeColors,
} from '@clubroof/design-tokens';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type Theme = {
  scheme: ColorScheme;
  /** Vereinsfarbe oder `clubroof` (Anmeldung ohne Verein, Einrichtung) */
  clubColor: ClubColorKey | 'clubroof';
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  elevation: typeof elevation;
  motion: typeof motion;
  /** Dunkelmodus: Rahmen und Flächenstufen statt Schatten */
  isDark: boolean;
  fontSizes: typeof fontSizes;
  fontWeights: typeof fontWeights;
};

const ThemeContext = createContext<Theme | null>(null);

/**
 * Der Stil „Anstoß“ ist zunächst nur dunkel (docs/DESIGN-ANSTOSS.md). Die Einstellung „Darstellung“
 * (hell, dunkel, wie Gerät) bleibt gespeichert und vorbereitet; solange es kein helles Thema im neuen
 * Stil gibt, gilt immer dunkel.
 */
const DARK_ONLY = true;

/**
 * Stellt das Farbthema bereit. Vor der Anmeldung gelten die Clubroof-Farben, danach die Vereinsfarbe.
 */
export function ThemeProvider({
  clubColor,
  mode = 'dark',
  children,
}: {
  clubColor?: string | null;
  mode?: 'light' | 'dark' | 'system';
  children: ReactNode;
}) {
  const system = useColorScheme();
  const wanted: ColorScheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const scheme: ColorScheme = DARK_ONLY ? 'dark' : wanted;
  const key: ClubColorKey | 'clubroof' =
    clubColor === 'clubroof' ? 'clubroof' : clubColor && isClubColorKey(clubColor) ? clubColor : 'clubroof';

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      clubColor: key,
      colors: key === 'clubroof' ? anstossTheme('clubroof') : getThemeColors(key, scheme),
      spacing,
      radii,
      sizes,
      elevation,
      motion,
      isDark: scheme === 'dark',
      fontSizes,
      fontWeights,
    }),
    [scheme, key],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme muss innerhalb von ThemeProvider verwendet werden.');
  return theme;
}
