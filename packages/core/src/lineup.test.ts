import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  LINEUP_SIZES,
  attendanceLevel,
  attendancePercent,
  defaultLineupSize,
  findFormation,
  formationLabels,
  formationSlotCount,
} from './lineup';

describe('Formationen', () => {
  it('haben je Spielform die richtige Spielerzahl und Anzahl', () => {
    const counts = { 7: 8, 9: 9, 11: 14 } as const;
    for (const size of LINEUP_SIZES) {
      expect(FORMATIONS[size]).toHaveLength(counts[size]);
      for (const f of FORMATIONS[size]) {
        expect(formationSlotCount(f), `${size}er ${f.key}`).toBe(size);
        expect(f.rows[0]).toEqual(['TW']);
        expect(formationLabels(f)).toHaveLength(size);
      }
      // Schlüssel je Spielform eindeutig
      expect(new Set(FORMATIONS[size].map((f) => f.key)).size).toBe(FORMATIONS[size].length);
    }
  });

  it('findet Formationen nur zur passenden Spielform', () => {
    expect(findFormation(11, '4-4-2')?.rows.map((r) => r.length)).toEqual([1, 4, 4, 2]);
    expect(findFormation(7, '4-4-2')).toBeNull();
    expect(findFormation(5, '2-3-1')).toBeNull();
    expect(findFormation(9, '3-1-3-1')?.rows.map((r) => r[0])).toEqual([
      'TW',
      'IV',
      'DM',
      'LM',
      'ST',
    ]);
  });

  it('wählt die Spielform nach Altersklasse', () => {
    expect(defaultLineupSize('U7')).toBe(7);
    expect(defaultLineupSize('U11')).toBe(7);
    expect(defaultLineupSize('U13')).toBe(9);
    expect(defaultLineupSize('U15')).toBe(11);
    expect(defaultLineupSize('U19')).toBe(11);
    expect(defaultLineupSize('Ü32')).toBe(11);
    expect(defaultLineupSize(null)).toBe(11);
  });
});

describe('Beteiligung', () => {
  it('rechnet über vier Wochen und kennt „kein Training“', () => {
    expect(
      attendancePercent([
        { attended: 3, total: 3 },
        { attended: 2, total: 3 },
        { attended: 1, total: 2 },
        { attended: 2, total: 3 },
      ]),
    ).toBe(73);
    expect(attendancePercent([{ attended: 0, total: 0 }])).toBeNull();
    expect(attendanceLevel(75)).toBe('good');
    expect(attendanceLevel(74)).toBe('medium');
    expect(attendanceLevel(50)).toBe('medium');
    expect(attendanceLevel(49)).toBe('low');
    expect(attendanceLevel(null)).toBe('none');
  });
});
