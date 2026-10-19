/**
 * Gemeinsame Bausteine der Import-Bereiche (Paket IM): Feldbeschreibung, Normalisierung, Datum und Uhrzeit sowie die
 * Schnittstelle, die jeder einfache Bereich (Sponsoren, Plätze, Ausrüstung, Termine) erfüllt.
 */
import type {
  ImportAreaInfo,
  ImportDuplicateMode,
  ImportField,
  ImportRequest,
  ImportRow,
} from '@clubroof/core';
import type { Db, schema } from '@clubroof/db';
import type { Actor } from '../actor';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const field = (
  key: string,
  label: string,
  hint: string,
  example: string,
  required = false,
): ImportField => ({ key, label, required, hint, example });

export const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

/** TT.MM.JJJJ, TT.MM.JJ oder JJJJ-MM-TT → JJJJ-MM-TT; `null` leer, `undefined` ungültig */
export function parseDate(value: string): string | null | undefined {
  const v = value.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (de) {
    [d, m, y] = [Number(de[1]), Number(de[2]), Number(de[3])];
    if (de[3]!.length === 2) y += y <= 30 ? 2000 : 1900;
  } else if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** „18:00“, „18.00“, „18:00:00“ oder Excel-Tagesbruchteil („0,75“) → „HH:MM“; `null` leer, `undefined` ungültig */
export function parseTime(value: string): string | null | undefined {
  const v = value.trim().replace(',', '.');
  if (!v) return null;
  const fraction = /^0?\.\d+$/.exec(v) || v === '0' || v === '1' ? Number(v) : null;
  if (fraction !== null && fraction >= 0 && fraction <= 1) {
    const minutes = Math.round(fraction * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?(?:\s*Uhr)?$/i.exec(v);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export const germanDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ja/Nein in Tabellen: ja, j, x, 1, true, wahr → true; nein, n, 0, false, falsch, leer → false; sonst `undefined` */
export function parseYesNo(value: string): boolean | undefined {
  const v = norm(value);
  if (['', 'nein', 'n', '0', 'false', 'falsch', 'no'].includes(v)) return false;
  if (['ja', 'j', 'x', '1', 'true', 'wahr', 'yes'].includes(v)) return true;
  return undefined;
}

export type AreaCtx = {
  db: Db;
  actor: Actor;
  req: ImportRequest;
  now: Date;
  /** heutiger Tag in der Vereinszeitzone (JJJJ-MM-TT) */
  today: string;
  mode: ImportDuplicateMode;
  teams: (typeof schema.teams.$inferSelect)[];
  /** gewählte Mannschaft bei Bereichen mit `needsTeam` */
  team: typeof schema.teams.$inferSelect | null;
};

export type InputRow = { line: number; get: (key: string) => string };

export type CheckedRow<D> = {
  status: ImportRow['status'];
  errors: string[];
  warnings: string[];
  match: string | null;
  data: D;
};

export type CommitResult = { created: number; updated: number; payload: Record<string, unknown> };

/** Ein einfacher Bereich: prüft alle Zeilen, übernimmt sie und nimmt sie zurück. */
export type AreaHandler<D = unknown> = {
  info: Omit<ImportAreaInfo, 'area'>;
  /** Bereich steht dem Nutzer überhaupt zur Verfügung */
  allowed(actor: Actor, teams: AreaCtx['teams']): boolean;
  /** nur Bereiche mit `needsTeam`: darf der Nutzer für diese Mannschaft importieren? */
  allowedForTeam?(actor: Actor, team: AreaCtx['teams'][number]): boolean;
  check(ctx: AreaCtx, rows: InputRow[]): Promise<CheckedRow<D>[]>;
  commit(
    ctx: AreaCtx,
    rows: { line: number; status: ImportRow['status']; data: D }[],
    runId: string,
  ): Promise<CommitResult>;
  undo(ctx: Pick<AreaCtx, 'db' | 'actor' | 'now'>, payload: Record<string, unknown>): Promise<void>;
};
