import {
  fontSizes,
  fontWeights,
  getThemeColors,
  isClubColorKey,
  radii,
  spacing,
  type ClubColorKey,
  type ColorScheme,
  type ThemeColors,
} from '@clubroof/design-tokens';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type Theme = {
  scheme: ColorScheme;
  clubColor: ClubColorKey;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSizes: typeof fontSizes;
  fontWeights: typeof fontWeights;
};

const ThemeContext = createContext<Theme | null>(null);

/**
 * Stellt das Farbthema bereit. Vor der Anmeldung gilt Grün (Clubroof), danach die
 * Vereinsfarbe. Hell ist Standard; jede Person kann dunkel oder „wie Gerät“ wählen.
 */
export function ThemeProvider({
  clubColor,
  mode = 'light',
  children,
}: {
  clubColor?: string | null;
  mode?: 'light' | 'dark' | 'system';
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme: ColorScheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const key: ClubColorKey = clubColor && isClubColorKey(clubColor) ? clubColor : 'green';

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      clubColor: key,
      colors: getThemeColors(key, scheme),
      spacing,
      radii,
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
