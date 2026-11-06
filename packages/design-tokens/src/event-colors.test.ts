import { describe, expect, it } from 'vitest';
import { MIN_CONTRAST, contrastRatio } from './contrast';
import { EVENT_TYPE_COLORS, eventTypeColor } from './event-colors';

describe('Terminartfarben', () => {
  for (const [type, c] of Object.entries(EVENT_TYPE_COLORS)) {
    it(`${type}: weißer Text ≥ 4,5 : 1 (hell und dunkel)`, () => {
      expect(contrastRatio('#FFFFFF', c.light)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
      expect(contrastRatio('#FFFFFF', c.dark)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
    });
  }
  it('jede Art hat eine eigene Farbe', () => {
    const all = Object.values(EVENT_TYPE_COLORS).map((c) => c.light);
    expect(new Set(all).size).toBe(all.length);
  });
  it('unbekannte Art fällt auf die Sitzungsfarbe zurück', () => {
    expect(eventTypeColor('x', 'light')).toBe(EVENT_TYPE_COLORS.meeting.light);
  });
});
