import { describe, expect, it } from 'vitest';
import {
  boardFromEntries,
  boardToEntries,
  changeFormation,
  emptyBoard,
  movePlayer,
  placedIds,
  type Board,
} from './lineup-board';

const slot = (index: number) => ({ kind: 'slot', index }) as const;
const bench = (index: number) => ({ kind: 'bench', index }) as const;
const pool = { kind: 'pool' } as const;

describe('Aufstellungsbrett', () => {
  it('legt Spieler aus der Kaderleiste auf Plätze und tauscht bei besetztem Ziel', () => {
    let b = emptyBoard(11, '4-4-2');
    expect(b.slots).toHaveLength(11);
    b = movePlayer(b, pool, slot(0), 'a');
    b = movePlayer(b, pool, slot(1), 'b');
    expect(b.slots.slice(0, 2)).toEqual(['a', 'b']);
    // Position ↔ Position tauschen
    b = movePlayer(b, slot(0), slot(1));
    expect(b.slots.slice(0, 2)).toEqual(['b', 'a']);
    // aus der Kaderleiste auf besetzten Platz: der Verdrängte kehrt in den Kader zurück
    b = movePlayer(b, pool, slot(0), 'c');
    expect(b.slots[0]).toBe('c');
    expect(placedIds(b).has('b')).toBe(false);
    // nie doppelt
    expect([...b.slots, ...b.bench].filter((p) => p === 'c')).toHaveLength(1);
  });

  it('Bank wächst und hat immer genau einen freien Platz am Ende', () => {
    let b = emptyBoard(7);
    expect(b.bench).toEqual([null]);
    for (const id of ['a', 'b', 'c', 'd']) b = movePlayer(b, pool, bench(b.bench.length - 1), id);
    expect(b.bench).toEqual(['a', 'b', 'c', 'd', null]);
    // Zurücknehmen
    b = movePlayer(b, bench(1), pool);
    expect(b.bench).toEqual(['a', 'c', 'd', null]);
    // von Bank auf Spielfeld und zurück
    b = movePlayer(b, bench(0), slot(2));
    expect(b.slots[2]).toBe('a');
    expect(b.bench).toEqual(['c', 'd', null]);
    b = movePlayer(b, slot(2), pool);
    expect(b.slots[2]).toBeNull();
  });

  it('ignoriert ungültige Ziele', () => {
    const b = emptyBoard(9);
    expect(movePlayer(b, pool, slot(99), 'a')).toBe(b);
    expect(movePlayer(b, slot(0), slot(1))).toBe(b);
  });

  it('behält Spieler beim Wechsel der Formation; Überzählige gehen auf die Bank', () => {
    let b: Board = emptyBoard(11, '4-4-2');
    for (let i = 0; i < 11; i++) b = movePlayer(b, pool, slot(i), `p${i}`);
    b = movePlayer(b, pool, bench(0), 'x');
    const same = changeFormation(b, 11, '4-3-3');
    expect(same.slots.filter(Boolean)).toHaveLength(11);
    expect(same.slots[0]).toBe('p0');
    // 11er → 7er: vier Spieler wandern auf die Bank, die Reihenfolge der Positionen bleibt
    const small = changeFormation(b, 7);
    expect(small.formation).toBe('2-3-1');
    expect(small.slots).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(small.bench).toEqual(['p7', 'p8', 'p9', 'p10', 'x', null]);
    // 7er → 11er: freie Plätze bleiben leer
    const big = changeFormation(small, 11);
    expect(big.slots.filter(Boolean)).toHaveLength(7);
    expect(big.slots[7]).toBeNull();
  });

  it('wandelt zwischen Einträgen und Brett um (auch ältere Aufstellungen ohne Formation)', () => {
    const entries = [
      { personId: 'a', role: 'starter' as const, slot: 0 },
      { personId: 'b', role: 'starter' as const, slot: 5 },
      { personId: 'c', role: 'substitute' as const, slot: null },
    ];
    const b = boardFromEntries(entries, 11, '4-4-2', 11);
    expect(b.slots[0]).toBe('a');
    expect(b.slots[5]).toBe('b');
    expect(b.bench).toEqual(['c', null]);
    expect(boardToEntries(b)).toEqual([
      { personId: 'a', role: 'starter', slot: 0 },
      { personId: 'b', role: 'starter', slot: 5 },
      { personId: 'c', role: 'substitute' },
    ]);
    // ohne Formation: der Reihe nach, Standardform nach Altersklasse
    const legacy = boardFromEntries(
      entries.map((e) => ({ ...e, slot: null })),
      null,
      null,
      9,
    );
    expect(legacy.size).toBe(9);
    expect(legacy.slots.slice(0, 2)).toEqual(['a', 'b']);
  });
});
