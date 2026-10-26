import type { TextStyle } from 'react-native';

/**
 * Schriften der App: Open Sans für Text, Saira Condensed (Variante „Kräftig“) für Überschriften und Zahlen. Sie werden im
 * Wurzel-Layout geladen. Solange (oder falls) das nicht klappt, bleibt die Systemschrift.
 *
 * Eigene Schriftschnitte statt `fontWeight`: native Apps kennen bei eingebundenen Schriften keine
 * Stärken, im Browser würde sonst „fett“ künstlich nachgebaut.
 */
/** Seitentitel und Zwischenüberschriften: Saira Condensed Bold (700). */
export const HEADING_FONT = 'SairaCondensed_700Bold';
/** Große Zahlen („figure“): Saira Condensed ExtraBold (800). */
export const FIGURE_FONT = 'SairaCondensed_800ExtraBold';

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

/** Arabische Schnitte (Open Sans und Saira Condensed haben keine arabischen Zeichen): Noto Sans Arabic. */
const ARABIC = {
  regular: 'NotoSansArabic_400Regular',
  semibold: 'NotoSansArabic_600SemiBold',
  bold: 'NotoSansArabic_700Bold',
  extrabold: 'NotoSansArabic_800ExtraBold',
} as const;

/** Schrift für arabischen Text anhand der bisher gewählten Schrift und Stärke. */
export function arabicFontFor(family: string | undefined, weight: TextStyle['fontWeight']): string {
  if (family === HEADING_FONT) return ARABIC.bold;
  if (family === FIGURE_FONT) return ARABIC.extrabold;
  if (family && !family.startsWith('OpenSans_')) return family;
  const w = family
    ? Number(/_(\d+)/.exec(family)?.[1] ?? 400)
    : weight === 'bold'
      ? 700
      : weight === 'normal' || weight === undefined
        ? 400
        : Number(weight);
  if (w >= 800) return ARABIC.extrabold;
  if (w >= 700) return ARABIC.bold;
  if (w >= 500) return ARABIC.semibold;
  return ARABIC.regular;
}
