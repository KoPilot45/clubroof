/**
 * Aufstellungsplaner (Paket AUF): Spielformen (7er, 9er, 11er) und Formationen. Die Liste liegt einmal hier,
 * damit App und Server dasselbe prüfen. Reihen stehen von hinten nach vorn; der Torwart ist immer Reihe 1.
 * Ein Platz der Startelf heißt „Slot“ (Index der Position in dieser Reihenfolge, 0 = Torwart).
 */

export const LINEUP_SIZES = [7, 9, 11] as const;
export type LineupSize = (typeof LINEUP_SIZES)[number];

/** Reihenart: D Abwehr, DM defensives Mittelfeld, M Mittelfeld, OM offensives Mittelfeld, A Angriff. */
type RowKind = 'D' | 'DM' | 'M' | 'OM' | 'A';

const LABELS: Record<RowKind, Record<number, string[]>> = {
  D: {
    5: ['LV', 'IV', 'IV', 'IV', 'RV'],
    4: ['LV', 'IV', 'IV', 'RV'],
    3: ['IV', 'IV', 'IV'],
    2: ['IV', 'IV'],
    1: ['IV'],
  },
  DM: { 1: ['DM'], 2: ['DM', 'DM'], 3: ['DM', 'DM', 'DM'] },
  M: {
    5: ['LM', 'ZM', 'ZM', 'ZM', 'RM'],
    4: ['LM', 'ZM', 'ZM', 'RM'],
    3: ['LM', 'ZM', 'RM'],
    2: ['ZM', 'ZM'],
    1: ['ZM'],
  },
  OM: { 1: ['OM'], 2: ['OM', 'OM'], 3: ['LA', 'OM', 'RA'] },
  A: { 3: ['LA', 'ST', 'RA'], 2: ['ST', 'ST'], 1: ['ST'] },
};

export type Formation = {
  /** Anzeigename, z. B. „4-4-2 Raute“; zugleich der gespeicherte Schlüssel */
  key: string;
  /** Positionskürzel je Reihe, von hinten nach vorn (erste Reihe = Torwart) */
  rows: string[][];
};

function formation(key: string, spec: string): Formation {
  const rows = spec.split(' ').map((token) => {
    const kind = token.replace(/\d/g, '') as RowKind;
    const count = Number(token.replace(/\D/g, ''));
    const labels = LABELS[kind]?.[count];
    if (!labels) throw new Error(`Unbekannte Reihe ${token} in ${key}`);
    return labels;
  });
  return { key, rows: [['TW'], ...rows] };
}

/** Formationen je Spielform; die erste ist der Standard der Spielform. */
export const FORMATIONS: Record<LineupSize, Formation[]> = {
  7: [
    formation('2-3-1', 'D2 M3 A1'),
    formation('3-2-1', 'D3 M2 A1'),
    formation('2-2-2', 'D2 M2 A2'),
    formation('1-3-2', 'D1 M3 A2'),
    formation('3-1-2', 'D3 DM1 A2'),
    formation('2-1-2-1', 'D2 DM1 OM2 A1'),
    formation('1-2-3', 'D1 M2 A3'),
    formation('2-3-1 Raute', 'D2 DM1 OM1 A2'),
  ],
  9: [
    formation('3-3-2', 'D3 M3 A2'),
    formation('3-2-3', 'D3 M2 A3'),
    formation('2-4-2', 'D2 M4 A2'),
    formation('2-3-3', 'D2 M3 A3'),
    formation('4-3-1', 'D4 M3 A1'),
    formation('3-4-1', 'D3 M4 A1'),
    formation('4-2-2', 'D4 M2 A2'),
    formation('3-1-3-1', 'D3 DM1 M3 A1'),
    formation('2-2-3-1', 'D2 M2 OM3 A1'),
  ],
  11: [
    formation('4-4-2', 'D4 M4 A2'),
    formation('4-3-3', 'D4 M3 A3'),
    formation('3-5-2', 'D3 M5 A2'),
    formation('4-2-3-1', 'D4 DM2 OM3 A1'),
    formation('4-1-4-1', 'D4 DM1 M4 A1'),
    formation('5-3-2', 'D5 M3 A2'),
    formation('5-4-1', 'D5 M4 A1'),
    formation('3-4-3', 'D3 M4 A3'),
    formation('4-5-1', 'D4 M5 A1'),
    formation('4-3-2-1', 'D4 M3 OM2 A1'),
    formation('4-4-2 Raute', 'D4 DM1 M2 OM1 A2'),
    formation('3-4-1-2', 'D3 M4 OM1 A2'),
    formation('3-4-2-1', 'D3 M4 OM2 A1'),
    formation('3-1-4-2', 'D3 DM1 M4 A2'),
  ],
};

/** Plätze der Startelf in einer Formation (Torwart eingerechnet). */
export const formationSlotCount = (f: Formation) => f.rows.reduce((n, r) => n + r.length, 0);

/** Positionskürzel je Slot, von hinten nach vorn. */
export const formationLabels = (f: Formation): string[] => f.rows.flat();

export function findFormation(size: number, key: string | null | undefined): Formation | null {
  if (!isLineupSize(size)) return null;
  return FORMATIONS[size].find((f) => f.key === key) ?? null;
}

export const isLineupSize = (n: unknown): n is LineupSize =>
  (LINEUP_SIZES as readonly unknown[]).includes(n);

/**
 * Standard-Spielform nach Altersklasse (Bambini bis E-Jugend 7er, D-Jugend 9er, C-Jugend aufwärts und Senioren
 * 11er); im Planer änderbar. `ageGroup` wie „U11“ oder „U13“.
 */
export function defaultLineupSize(ageGroup: string | null | undefined): LineupSize {
  const m = /^U(\d{1,2})$/i.exec((ageGroup ?? '').trim());
  if (!m) return 11;
  const age = Number(m[1]);
  return age <= 11 ? 7 : age <= 13 ? 9 : 11;
}

/** Ausgeschriebene Positionen für Listen („LV“ → „Linker Verteidiger“). */
export const POSITION_NAMES: Record<string, string> = {
  TW: 'Torwart',
  LV: 'Linker Verteidiger',
  RV: 'Rechter Verteidiger',
  IV: 'Innenverteidiger',
  DM: 'Defensives Mittelfeld',
  LM: 'Linkes Mittelfeld',
  RM: 'Rechtes Mittelfeld',
  ZM: 'Zentrales Mittelfeld',
  OM: 'Offensives Mittelfeld',
  LA: 'Linksaußen',
  RA: 'Rechtsaußen',
  ST: 'Stürmer',
};

/** Beteiligung (Trainingsbesuch der letzten vier Wochen): Stufe für die Farbe, immer zusätzlich als Prozentwert. */
export type AttendanceLevel = 'good' | 'medium' | 'low' | 'none';
export const attendanceLevel = (percent: number | null): AttendanceLevel =>
  percent === null ? 'none' : percent >= 75 ? 'good' : percent >= 50 ? 'medium' : 'low';

/**
 * Beteiligung aus vier Wochen: je Woche besuchte und stattgefundene Trainings. `null`, wenn es im Fenster
 * kein Training gab.
 */
export function attendancePercent(weeks: { attended: number; total: number }[]): number | null {
  const total = weeks.reduce((n, w) => n + w.total, 0);
  if (total === 0) return null;
  return Math.round((weeks.reduce((n, w) => n + w.attended, 0) / total) * 100);
}
