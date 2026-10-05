import { describe, expect, it } from 'vitest';
import { can, scopesWith, type Grant } from './access';
import { isResponseOpen, responseDeadline } from './deadlines';
import { resolveModule, type ModuleSetting } from './module-resolution';
import { at, fromIsoDate } from './time';

const day = (iso: string) => fromIsoDate(iso);

describe('responseDeadline', () => {
  it('relative Frist: Training 2 Stunden vorher', () => {
    const start = at(day('2026-10-06'), '18:00');
    expect(responseDeadline(start, { kind: 'relative', minutesBefore: 120 })).toEqual(
      at(day('2026-10-06'), '16:00'),
    );
  });

  it('Wochentag-Frist: Spiel am Samstag → Freitag 18:00 davor', () => {
    const start = at(day('2026-10-10'), '15:00');
    expect(
      responseDeadline(start, { kind: 'weekday_time', weekday: 5, timeOfDay: '18:00' }),
    ).toEqual(at(day('2026-10-09'), '18:00'));
  });

  it('Wochentag-Frist am Spieltag selbst, wenn sie vor dem Anstoß liegt', () => {
    const start = at(day('2026-10-09'), '19:00'); // Freitag 19:00
    expect(
      responseDeadline(start, { kind: 'weekday_time', weekday: 5, timeOfDay: '18:00' }),
    ).toEqual(at(day('2026-10-09'), '18:00'));
  });

  it('Wochentag-Frist springt in die Vorwoche, wenn sie nach dem Anstoß läge', () => {
    const start = at(day('2026-10-09'), '17:00'); // Freitag 17:00
    expect(
      responseDeadline(start, { kind: 'weekday_time', weekday: 5, timeOfDay: '18:00' }),
    ).toEqual(at(day('2026-10-02'), '18:00'));
  });

  it('berücksichtigt die Zeitumstellung (Ende Oktober)', () => {
    const start = at(day('2026-10-25'), '15:00'); // Sonntag nach Umstellung auf Winterzeit
    const deadline = responseDeadline(start, {
      kind: 'weekday_time',
      weekday: 5,
      timeOfDay: '18:00',
    });
    expect(deadline?.toISOString()).toBe('2026-10-23T16:00:00.000Z'); // 18:00 Sommerzeit
    expect(start.toISOString()).toBe('2026-10-25T14:00:00.000Z'); // 15:00 Winterzeit
  });

  it('ohne Regel gibt es keine Frist', () => {
    expect(responseDeadline(new Date(), null)).toBeNull();
  });
});

describe('isResponseOpen', () => {
  const start = new Date('2026-10-10T13:00:00Z');
  it('offen vor der Frist, geschlossen danach und nach Beginn', () => {
    const deadline = new Date('2026-10-09T16:00:00Z');
    expect(isResponseOpen(new Date('2026-10-09T10:00:00Z'), start, deadline)).toBe(true);
    expect(isResponseOpen(new Date('2026-10-09T17:00:00Z'), start, deadline)).toBe(false);
    expect(isResponseOpen(new Date('2026-10-10T14:00:00Z'), start, null)).toBe(false);
  });
});

describe('can', () => {
  const grants: Grant[] = [
    { permissions: ['attendance.override'], scopeType: 'team', scopeId: 'team-b1' },
    { permissions: ['news.publish'], scopeType: 'org_unit', scopeId: 'unit-youth' },
    { permissions: ['club.overview.read'], scopeType: 'club', scopeId: null },
  ];

  it('Mannschaftsrechte gelten nur in der eigenen Mannschaft', () => {
    expect(can(grants, 'attendance.override', { teamId: 'team-b1' })).toBe(true);
    expect(can(grants, 'attendance.override', { teamId: 'team-c1' })).toBe(false);
  });

  it('Bereichsrechte gelten für Mannschaften des Bereichs', () => {
    expect(can(grants, 'news.publish', { teamId: 'x', orgUnitId: 'unit-youth' })).toBe(true);
    expect(can(grants, 'news.publish', { orgUnitId: 'unit-seniors' })).toBe(false);
  });

  it('Vereinsrechte gelten überall', () => {
    expect(can(grants, 'club.overview.read')).toBe(true);
    expect(can(grants, 'club.overview.read', { teamId: 'beliebig' })).toBe(true);
  });

  it('scopesWith sammelt die Geltungsbereiche', () => {
    expect(scopesWith(grants, 'attendance.override')).toEqual({
      all: false,
      orgUnitIds: [],
      teamIds: ['team-b1'],
    });
  });
});

describe('resolveModule', () => {
  const settings: ModuleSetting[] = [
    {
      moduleKey: 'team_cash',
      scopeType: 'club',
      scopeId: null,
      state: 'enabled',
      level: 'basic',
      config: { fines: true },
    },
    {
      moduleKey: 'team_cash',
      scopeType: 'team',
      scopeId: 'h1',
      state: 'enabled',
      level: 'basic',
      config: { drinks: true },
    },
    {
      moduleKey: 'team_cash',
      scopeType: 'team',
      scopeId: 'fj',
      state: 'available',
      level: 'basic',
      config: {},
    },
    {
      moduleKey: 'forum',
      scopeType: 'club',
      scopeId: null,
      state: 'available',
      level: 'basic',
      config: {},
    },
    {
      moduleKey: 'forum',
      scopeType: 'team',
      scopeId: 'h1',
      state: 'enabled',
      level: 'basic',
      config: {},
    },
  ];

  it('spezifischste Ebene gewinnt und erbt Konfiguration', () => {
    expect(resolveModule(settings, 'team_cash', { teamId: 'h1' })).toEqual({
      enabled: true,
      state: 'enabled',
      level: 'basic',
      config: { fines: true, drinks: true },
    });
  });

  it('auf Mannschaftsebene deaktiviert', () => {
    expect(resolveModule(settings, 'team_cash', { teamId: 'fj' }).enabled).toBe(false);
  });

  it('nicht aktiviertes Vereinsmodul kann darunter nicht eingeschaltet werden', () => {
    expect(resolveModule(settings, 'forum', { teamId: 'h1' }).enabled).toBe(false);
  });

  it('unbekanntes Modul ist aus', () => {
    expect(resolveModule(settings, 'gibt_es_nicht').enabled).toBe(false);
  });
});
