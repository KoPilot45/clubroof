import { useEffect, type ReactNode } from 'react';
import { Alert, I18nManager, Platform, View, type ViewProps } from 'react-native';
import { getLocale, t, useRtl } from '@/lib/i18n';

/** `dir` kennt nur react-native-web (im Browser setzt es die Richtung für alles darunter); die Typen von React Native nicht. */
const dirProps = (dir: 'ltr' | 'rtl') => ({ dir }) as object;

/**
 * Schreibrichtung der App (Arabisch: rechts nach links). Im Browser spiegelt `dir` das ganze Layout
 * (inkl. links/rechts-Abstände); auf dem Gerät schaltet `I18nManager` um, das greift erst nach einem Neustart.
 */
export function DirectionProvider({ children }: { children: ReactNode }) {
  const rtl = useRtl();
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = getLocale();
      return;
    }
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
      Alert.alert(
        t('Neustart nötig'),
        t(
          'Bitte beende die App und öffne sie neu, damit die Schreibrichtung der Sprache übernommen wird.',
        ),
      );
    }
  }, [rtl]);
  return (
    <View {...dirProps(rtl ? 'rtl' : 'ltr')} style={{ flex: 1 }}>
      {children}
    </View>
  );
}

/** Attribute für Inhalt, der nie gespiegelt wird (zusammen mit `direction: 'ltr'` im Stil): `<View {...LTR} style={{ direction: 'ltr', … }}>`. */
export const LTR = dirProps('ltr');

/**
 * Inhalt, der nie gespiegelt wird: Spielfeld, Diagramme, Zeitachsen. Auch bei Arabisch bleiben
 * Aufstellung und Zahlenachsen links-nach-rechts.
 */
export function Ltr({ style, ...props }: ViewProps) {
  return <View {...props} {...dirProps('ltr')} style={[{ direction: 'ltr' }, style]} />;
}
