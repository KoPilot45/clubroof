import { forwardRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { bodyFontFor, fontState } from '@/lib/fonts';

/**
 * Text in der App-Schrift (Open Sans): übersetzt `fontWeight` in den passenden Schriftschnitt.
 * Gesetzte `fontFamily` (z. B. Oswald) bleibt unberührt.
 */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
  if (!fontState.ready) return <RNText ref={ref} style={style} {...props} />;
  const flat = StyleSheet.flatten(style) ?? {};
  const resolved = flat.fontFamily
    ? flat
    : { ...flat, fontFamily: bodyFontFor(flat.fontWeight), fontWeight: '400' as const };
  return <RNText ref={ref} style={resolved} {...props} />;
});
