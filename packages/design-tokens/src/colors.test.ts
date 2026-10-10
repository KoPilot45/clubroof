import { describe, expect, it } from 'vitest';
import {
  CLUB_COLOR_KEYS,
  STATUS_KEYS,
  getThemeColors,
  isClubColorKey,
  type ColorScheme,
} from './colors';
import { MIN_CONTRAST, contrastRatio } from './contrast';

const SCHEMES: ColorScheme[] = ['light', 'dark'];

describe('contrastRatio', () => {
  it('berechnet bekannte Referenzwerte', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('lehnt ungültige Farbwerte ab', () => {
    expect(() => contrastRatio('rot', '#FFFFFF')).toThrow();
  });
});

describe.each(CLUB_COLOR_KEYS)('Vereinsfarbe %s', (clubColor) => {
  describe.each(SCHEMES)('Modus %s', (scheme) => {
    const t = getThemeColors(clubColor, scheme);

    it.each([
      ['onPrimary auf primary', t.onPrimary, t.primary],
      ['onPrimary auf primaryPressed', t.onPrimary, t.primaryPressed],
      ['onPrimaryContainer auf primaryContainer', t.onPrimaryContainer, t.primaryContainer],
      ['primaryText auf surface', t.primaryText, t.surface],
      ['primaryText auf background', t.primaryText, t.background],
      ['onSurface auf surface', t.onSurface, t.surface],
      ['onSurfaceMuted auf surface', t.onSurfaceMuted, t.surface],
      ['onSurfaceMuted auf background', t.onSurfaceMuted, t.background],
      ['onSurface auf surfaceVariant', t.onSurface, t.surfaceVariant],
    ])('%s erfüllt WCAG AA für Text', (_label, fg, bg) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
    });

    it.each(STATUS_KEYS)('Statusfarbe %s ist lesbar', (key) => {
      const s = t.status[key];
      expect(contrastRatio(s.onSolid, s.solid)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
      expect(contrastRatio(s.onContainer, s.container)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
      expect(contrastRatio(s.solid, t.surface)).toBeGreaterThanOrEqual(MIN_CONTRAST.largeTextOrUi);
    });
  });
});

describe('isClubColorKey', () => {
  it('erkennt gültige und ungültige Schlüssel', () => {
    expect(isClubColorKey('green')).toBe(true);
    expect(isClubColorKey('neonpink')).toBe(false);
  });
});
