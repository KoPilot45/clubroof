import { describe, expect, it } from 'vitest';
import { dueDates } from './services/club-fees';

describe('Fälligkeit je Beitragsart', () => {
  it('jährlich: Tag und Monat der Beitragsart', () => {
    expect(
      dueDates('yearly', '2026-01-01', null, '2027-12-31', '2020-01-01', {
        day: 15,
        month: 3,
        on: null,
      }),
    ).toEqual([
      { dueOn: '2026-03-15', label: '2026' },
      { dueOn: '2027-03-15', label: '2027' },
    ]);
  });

  it('Standard ohne Angabe: 1. Januar bzw. 1. des Monats wie bisher', () => {
    expect(dueDates('yearly', '2026-01-01', null, '2026-12-31', '2020-01-01')).toEqual([
      { dueOn: '2026-01-01', label: '2026' },
    ]);
    expect(
      dueDates('quarterly', '2026-07-01', null, '2026-12-31', '2020-01-01').map((d) => d.dueOn),
    ).toEqual(['2026-07-01', '2026-10-01']);
  });

  it('monatlich: Tag im Monat, kurze Monate kürzen auf den letzten Tag', () => {
    expect(
      dueDates('monthly', '2026-01-01', null, '2026-03-31', '2020-01-01', {
        day: 31,
        month: 1,
        on: null,
      }).map((d) => d.dueOn),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('vierteljährlich ab dem ersten Fälligkeitsmonat', () => {
    expect(
      dueDates('quarterly', '2026-01-01', null, '2026-12-31', '2020-01-01', {
        day: 10,
        month: 2,
        on: null,
      }).map((d) => d.dueOn),
    ).toEqual(['2026-02-10', '2026-05-10', '2026-08-10', '2026-11-10']);
  });

  it('halbjährlich ab dem ersten Fälligkeitsmonat', () => {
    expect(
      dueDates('halfyearly', '2026-01-01', null, '2026-12-31', '2020-01-01', {
        day: 15,
        month: 4,
        on: null,
      }),
    ).toEqual([
      { dueOn: '2026-04-15', label: '1. Halbjahr 2026' },
      { dueOn: '2026-10-15', label: '2. Halbjahr 2026' },
    ]);
  });

  it('einmalig: gewähltes Datum, sonst Beginn der Zuordnung; nicht vor Beginn', () => {
    expect(
      dueDates('once', '2026-01-01', null, '2026-12-31', '2020-01-01', {
        day: 1,
        month: 1,
        on: '2026-05-01',
      }),
    ).toEqual([{ dueOn: '2026-05-01', label: '' }]);
    expect(dueDates('once', '2026-06-01', null, '2026-12-31', '2020-01-01')).toEqual([
      { dueOn: '2026-06-01', label: '' },
    ]);
    expect(
      dueDates('once', '2026-06-01', null, '2026-12-31', '2020-01-01', {
        day: 1,
        month: 1,
        on: '2026-01-01',
      }),
    ).toEqual([]);
  });
});
