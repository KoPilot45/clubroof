import { Children, forwardRef, type ReactNode } from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { bodyFontFor, fontState } from '@/lib/fonts';
import { useFontScale } from '@/lib/font-scale';
import { t, useLocale } from '@/lib/i18n';

/** Texte in der aktiven Sprache; zusammengesetzte Teile werden als Ganzes nachgeschlagen. */
function translateChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') return t(children);
  if (!Array.isArray(children)) return children;
  const parts = Children.toArray(children);
  if (parts.every((c) => typeof c === 'string' || typeof c === 'number')) {
    return t(parts.join(''));
  }
  return parts.map((c) => (typeof c === 'string' ? t(c) : c));
}

/**
 * Text in der App-Schrift (Open Sans): übersetzt `fontWeight` in den passenden Schriftschnitt.
 * Gesetzte `fontFamily` (z. B. Oswald) bleibt unberührt.
 */
/** `verbatim`: Text nicht übersetzen (z. B. feste Spaltennamen einer CSV-Vorlage). */
export const Text = forwardRef<RNText, TextProps & { verbatim?: boolean }>(function Text(
  { style, children, verbatim, ...props },
  ref,
) {
  useLocale();
  const scale = useFontScale();
  const content = verbatim ? children : translateChildren(children);
  const flat = StyleSheet.flatten(style) ?? {};
  // Schriftgröße der App (Einstellung im Konto) auf Größe und Zeilenhöhe anwenden
  const sized =
    scale === 1
      ? flat
      : {
          ...flat,
          fontSize: Math.round((flat.fontSize ?? 14) * scale),
          ...(flat.lineHeight ? { lineHeight: Math.round(flat.lineHeight * scale) } : {}),
        };
  if (!fontState.ready)
    return (
      <RNText ref={ref} style={sized} {...props}>
        {content}
      </RNText>
    );
  const resolved = sized.fontFamily
    ? sized
    : { ...sized, fontFamily: bodyFontFor(sized.fontWeight), fontWeight: '400' as const };
  return (
    <RNText ref={ref} style={resolved} {...props}>
      {content}
    </RNText>
  );
});
