import type { TextStyle } from 'react-native';

/**
 * Schriften der App: Open Sans für Text, Oswald für Überschriften und Zahlen. Sie werden im
 * Wurzel-Layout geladen. Solange (oder falls) das nicht klappt, bleibt die Systemschrift.
 *
 * Eigene Schriftschnitte statt `fontWeight`: native Apps kennen bei eingebundenen Schriften keine
 * Stärken, im Browser würde sonst „fett“ künstlich nachgebaut.
 */
export const HEADING_FONT = 'Oswald_600SemiBold';

const BODY = {
  regular: 'OpenSans_400Regular',
  semibold: 'OpenSans_600SemiBold',
  bold: 'OpenSans_700Bold',
  extrabold: 'OpenSans_800ExtraBold',
} as const;

export const fontState = { ready: false };

/** Schriftschnitt zur gewünschten Stärke (leichte Stärken → Regular, 500/600 → SemiBold …). */
export function bodyFontFor(weight: TextStyle['fontWeight']): string {
  const w =
    weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  if (w >= 800) return BODY.extrabold;
  if (w >= 700) return BODY.bold;
  if (w >= 500) return BODY.semibold;
  return BODY.regular;
}

/** Stil für Eingabefelder und alles, was kein `AppText` ist. */
export function inputFont(): TextStyle {
  return fontState.ready ? { fontFamily: BODY.regular, fontWeight: '400' } : {};
}
