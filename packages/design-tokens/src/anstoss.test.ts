import { describe, expect, it } from 'vitest';
import { anstossLightTheme, anstossTheme, CLUB_COLOR_KEYS, getThemeColors } from './colors';
import { blend } from './anstoss';
import { MIN_CONTRAST, contrastRatio } from './contrast';

const KEYS = [...CLUB_COLOR_KEYS, 'clubroof'] as const;

describe('Anstoß: festgelegte Werte', () => {
  it('Grün entspricht der Doku', () => {
    const t = anstossTheme('green');
    expect(t.background).toBe('#0B120E');
    expect(t.primary).toBe('#2EDB6B');
    expect(t.onPrimary).toBe('#06210F');
    expect(t.hero.from).toBe('#1E7A44');
    expect(t.hero.to).toBe('#0F3D24');
    expect(t.onSurface).toBe('#F2F7F3');
    expect(t.onSurfaceMuted).toBe('#C5D6CB');
    expect(t.anstoss.textTertiary).toBe('#9FB5A6');
    expect(t.anstoss.placeholder).toBe('#6F8277');
    expect(t.anstoss.sheet).toBe('#16211A');
  });

  it('Blau, Rot, Gelb entsprechen der Tabelle', () => {
    expect(anstossTheme('blue')).toMatchObject({ primary: '#5AB0FF', background: '#080E1A' });
    expect(anstossTheme('red')).toMatchObject({ primary: '#FF5A5F', background: '#140A0B' });
    expect(anstossTheme('yellow')).toMatchObject({ primary: '#FFD54F', background: '#0F0D06' });
    expect(anstossTheme('yellow').hero.from).toBe('#8A6A00');
  });

  it('dunkel ist der Stil „Anstoß“', () => {
    expect(getThemeColors('green', 'dark')).toEqual(anstossTheme('green'));
  });
});

describe.each(KEYS)('Anstoß-Kontrast %s', (key) => {
  const t = anstossTheme(key);
  const bg = t.background;
  const card = blend('#FFFFFF', bg, 0.06);

  it.each([
    ['Text auf Akzent', t.onPrimary, t.primary],
    ['weißer Text auf Plakat (p1)', t.hero.onHero, t.hero.from],
    ['weißer Text auf Plakat (p2)', t.hero.onHero, t.hero.to],
    ['Text auf Hintergrund', t.onSurface, bg],
    ['Text auf Fläche', t.onSurface, card],
    ['Text sekundär auf Fläche', t.onSurfaceMuted, card],
    ['Text tertiär auf Fläche', t.anstoss.textTertiary, card],
    ['Akzent als Text auf Fläche', t.primaryText, card],
    ['Akzent als Text auf Fenster', t.primaryText, t.anstoss.sheet],
    ['Text auf Fenster', t.onSurface, t.anstoss.sheet],
  ])('%s ≥ 4,5 : 1', (_label, fg, back) => {
    expect(contrastRatio(fg, back)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
  });

  it('Platzhalter bleibt als Bedienelement erkennbar (≥ 3 : 1)', () => {
    expect(contrastRatio(t.anstoss.placeholder, bg)).toBeGreaterThanOrEqual(
      MIN_CONTRAST.largeTextOrUi,
    );
  });

  it('Statusfarben: Text auf Fläche und Knopf lesbar', () => {
    for (const s of Object.values(t.status)) {
      expect(contrastRatio(s.onContainer, s.container)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
      expect(contrastRatio(s.onSolid, s.solid)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
    }
  });

  it('Kategorien: Symbol in voller Farbe auf der 15-%-Fläche lesbar', () => {
    for (const tint of Object.values(t.tints))
      expect(contrastRatio(tint.onContainer, tint.container)).toBeGreaterThanOrEqual(
        MIN_CONTRAST.text,
      );
  });
});

describe('Dringend bei roter Vereinsfarbe', () => {
  it('erscheint in Bernstein, sonst in Rot', () => {
    expect(anstossTheme('red').status.urgent.solid).toBe('#FFC94D');
    expect(anstossTheme('red').anstoss.amberUrgent).toBe(true);
    expect(anstossTheme('green').status.urgent.solid).toBe('#FF5A5F');
    expect(anstossTheme('green').anstoss.amberUrgent).toBe(false);
  });
});

describe.each(CLUB_COLOR_KEYS)('Anstoß hell, Kontrast %s', (key) => {
  const t = anstossLightTheme(key);
  const bg = t.background;

  const cases: [string, string, string][] = [
    ['Text auf Hintergrund', t.onSurface, bg],
    ['Text auf Fläche', t.onSurface, t.surface],
    ['Text sekundär auf Fläche', t.onSurfaceMuted, t.surface],
    ['Text tertiär auf Fläche', t.anstoss.textTertiary, t.surface],
    ['Text tertiär auf Hintergrund', t.anstoss.textTertiary, bg],
    ['Text tertiär auf grauer Fläche', t.anstoss.textTertiary, t.surfaceVariant],
    ['Text tertiär auf dringender Fläche', t.anstoss.textTertiary, t.status.urgent.container],
    ['Text tertiär auf Primärfläche', t.anstoss.textTertiary, t.primaryContainer],
    ['Akzent als Text auf Fläche', t.primaryText, t.surface],
    ['Akzent als Text auf Hintergrund', t.primaryText, bg],
    ['Text auf Akzent', t.onPrimary, t.primary],
    ['Akzent auf Akzent-Fläche', t.onPrimaryContainer, t.primaryContainer],
    ['weißer Text auf Plakat (p1)', t.hero.onHero, t.hero.from],
    ['weißer Text auf Plakat (p2)', t.hero.onHero, t.hero.to],
    ['dringend auf Fläche', t.status.urgent.onContainer, t.status.urgent.container],
    ['Aktion auf Fläche', t.status.action.onContainer, t.status.action.container],
    ['Info auf Fläche', t.status.info.onContainer, t.status.info.container],
    ['erledigt auf Fläche', t.status.success.onContainer, t.status.success.container],
    ['archiviert auf Fläche', t.status.archived.onContainer, t.status.archived.container],
    ['Text auf dringender Fläche', t.status.urgent.onSolid, t.status.urgent.solid],
    ...(['blue', 'orange', 'pink', 'green', 'violet'] as const).map(
      (k): [string, string, string] => [
        `Kategorie ${k}`,
        t.tints[k].onContainer,
        t.tints[k].container,
      ],
    ),
    // Datumskachel: Wochentag in der Kategoriefarbe auf 15 % Deckkraft
    ...(Object.entries(t.anstoss.categories) as [string, string][]).map(
      ([k, c]): [string, string, string] => [`Datumskachel ${k}`, c, blend(c, '#FFFFFF', 0.15)],
    ),
  ];
  it.each(cases)('%s ≥ 4,5 : 1', (_label, fg, back) => {
    expect(contrastRatio(fg, back)).toBeGreaterThanOrEqual(MIN_CONTRAST.text);
  });

  it('Platzhalter bleibt als Bedienelement erkennbar (≥ 3 : 1)', () => {
    expect(contrastRatio(t.anstoss.placeholder, t.surface)).toBeGreaterThanOrEqual(
      MIN_CONTRAST.largeTextOrUi,
    );
  });

  it('Feldrand ist erkennbar genug (Fläche weiß, Rand sichtbar)', () => {
    expect(t.anstoss.fieldBorder).not.toBe(t.surface);
  });
});

describe('Anstoß hell: festgelegte Werte', () => {
  it('Grün und Blau', () => {
    const g = anstossLightTheme('green');
    expect(g.background).toBe('#F2F5F3');
    expect(g.onSurface).toBe('#0F1A14');
    expect(g.hero.from).toBe('#1E7A44');
    expect(getThemeColors('green', 'light')).toEqual(g);
  });
  it('rote Vereinsfarbe: „Dringend“ in Bernstein', () => {
    expect(anstossLightTheme('red').status.urgent.solid).toBe('#B45309');
    expect(anstossLightTheme('red').anstoss.amberUrgent).toBe(true);
  });
});
