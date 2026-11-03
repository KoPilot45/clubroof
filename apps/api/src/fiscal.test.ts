import { describe, expect, it } from 'vitest';
import { dayBeforeFiscal, fiscalRange, fiscalYearOf } from './services/club-periods';

describe('Haushaltsjahr', () => {
  const calendar = { startMonth: 1 };
  const season = { startMonth: 7 };

  it('Kalenderjahr: 1. Januar bis 31. Dezember', () => {
    expect(fiscalYearOf(calendar, '2026-03-05')).toBe(2026);
    expect(fiscalRange(calendar, 2026)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(dayBeforeFiscal(calendar, 2026)).toBe('2025-12-31');
  });

  it('Saison ab Juli: Juli bis Juni, benannt nach dem Beginnjahr', () => {
    expect(fiscalYearOf(season, '2026-06-30')).toBe(2025);
    expect(fiscalYearOf(season, '2026-07-01')).toBe(2026);
    expect(fiscalYearOf(season, '2027-01-15')).toBe(2026);
    expect(fiscalRange(season, 2026)).toEqual({ from: '2026-07-01', to: '2027-06-30' });
    expect(dayBeforeFiscal(season, 2026)).toBe('2026-06-30');
  });

  it('Saison ab Februar endet im Schaltjahr am 31. Januar', () => {
    expect(fiscalRange({ startMonth: 2 }, 2027)).toEqual({ from: '2027-02-01', to: '2028-01-31' });
  });
});
