/**
 * Zustand des Aufstellungsplaners (Paket AUF), ohne Oberfläche: Startelf als Slots der Formation, Bank mit immer
 * einem freien Platz am Ende. Ein Spieler steht höchstens einmal (Slot oder Bank); Tausch, Zurücknehmen und
 * Formationswechsel folgen den Festlegungen des Vorstands.
 */
import { FORMATIONS, findFormation, formationSlotCount, type LineupSize } from './lineup';

/** Ort eines Spielers: Platz der Startelf, Bankplatz oder (als Quelle) die Kaderleiste. */
export type BoardPlace =
  { kind: 'slot'; index: number } | { kind: 'bench'; index: number } | { kind: 'pool' };

export type Board = {
  size: LineupSize;
  /** Schlüssel der Formation */
  formation: string;
  /** Spieler je Slot (hinten nach vorn), null = frei */
  slots: (string | null)[];
  /** Bank: Spieler, am Ende immer ein freier Platz (null) */
  bench: (string | null)[];
};

const withFreeBench = (bench: (string | null)[]) => [...bench.filter((p) => p !== null), null];

export function emptyBoard(size: LineupSize, formation?: string): Board {
  const f = findFormation(size, formation) ?? FORMATIONS[size][0]!;
  return {
    size,
    formation: f.key,
    slots: Array<string | null>(formationSlotCount(f)).fill(null),
    bench: [null],
  };
}

/** Alle eingeplanten Spieler (Startelf und Bank). */
export const placedIds = (b: Board): Set<string> =>
  new Set([...b.slots, ...b.bench].filter((p): p is string => p !== null));

const read = (b: Board, place: BoardPlace): string | null =>
  place.kind === 'slot'
    ? (b.slots[place.index] ?? null)
    : place.kind === 'bench'
      ? (b.bench[place.index] ?? null)
      : null;

function write(b: Board, place: BoardPlace, id: string | null): Board {
  if (place.kind === 'slot') {
    const slots = [...b.slots];
    slots[place.index] = id;
    return { ...b, slots };
  }
  if (place.kind === 'bench') {
    const bench = [...b.bench];
    bench[place.index] = id;
    return { ...b, bench };
  }
  return b;
}

/**
 * Spieler verschieben. `from`: Platz oder Kaderleiste (dann ist `personId` der Gezogene). Ziel besetzt = Tausch
 * (aus der Kaderleiste verdrängt: der andere kehrt in den Kader zurück); Ziel Kaderleiste = aus der Aufstellung
 * nehmen. Ungültige Plätze lassen das Brett unverändert.
 */
export function movePlayer(b: Board, from: BoardPlace, to: BoardPlace, personId?: string): Board {
  const here = from.kind === 'pool' ? (personId ?? null) : read(b, from);
  if (!here) return b;
  const valid = (p: BoardPlace) =>
    p.kind === 'pool' ||
    (p.kind === 'slot'
      ? p.index >= 0 && p.index < b.slots.length
      : p.index >= 0 && p.index < b.bench.length);
  if (!valid(from) || !valid(to)) return b;
  if (
    from.kind === to.kind &&
    (from.kind === 'pool' || (from as { index: number }).index === (to as { index: number }).index)
  )
    return b;
  if (to.kind === 'pool') {
    if (from.kind === 'pool') return b;
    return { ...write(b, from, null), bench: withFreeBench(write(b, from, null).bench) };
  }
  const other = read(b, to);
  let next = write(b, to, here);
  if (from.kind !== 'pool') next = write(next, from, other);
  return { ...next, bench: withFreeBench(next.bench) };
}

/**
 * Formation oder Spielform wechseln: die Spieler bleiben in der Reihenfolge der Positionen erhalten; wer nicht
 * mehr aufs Feld passt, geht auf die Bank. Bei neuer Spielform ohne Angabe gilt deren erste Formation.
 */
export function changeFormation(b: Board, size: LineupSize, formation?: string): Board {
  const f = findFormation(size, formation) ?? FORMATIONS[size][0]!;
  const count = formationSlotCount(f);
  const carried = b.slots.filter((p): p is string => p !== null);
  const slots = Array<string | null>(count).fill(null);
  carried.slice(0, count).forEach((id, i) => {
    slots[i] = id;
  });
  const overflow = carried.slice(count);
  return {
    size,
    formation: f.key,
    slots,
    bench: withFreeBench([...overflow, ...b.bench]),
  };
}

/** Gespeicherte Aufstellung als Brett. Ohne Formation (ältere Aufstellung): Startelf der Reihe nach auf die Plätze. */
export function boardFromEntries(
  entries: { personId: string; role: 'starter' | 'substitute'; slot: number | null }[],
  size: LineupSize | null,
  formation: string | null,
  suggestedSize: LineupSize,
): Board {
  const useSize = size ?? suggestedSize;
  const base = emptyBoard(useSize, size ? (formation ?? undefined) : undefined);
  const starters = entries.filter((e) => e.role === 'starter');
  const bench: string[] = entries.filter((e) => e.role !== 'starter').map((e) => e.personId);
  const slots = [...base.slots];
  const known = size !== null && formation !== null;
  const overflow: string[] = [];
  starters.forEach((e, i) => {
    const index = known && e.slot !== null ? e.slot : i;
    if (index >= 0 && index < slots.length && slots[index] === null) slots[index] = e.personId;
    else overflow.push(e.personId);
  });
  return { ...base, slots, bench: withFreeBench([...overflow, ...bench]) };
}

/** Brett als Einträge für das Speichern (Startelf mit Slot, Bank ohne). */
export function boardToEntries(b: Board): {
  personId: string;
  role: 'starter' | 'substitute';
  slot?: number;
}[] {
  return [
    ...b.slots.flatMap((id, slot) =>
      id ? [{ personId: id, role: 'starter' as const, slot }] : [],
    ),
    ...b.bench.flatMap((id) => (id ? [{ personId: id, role: 'substitute' as const }] : [])),
  ];
}
