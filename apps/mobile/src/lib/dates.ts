/** „TT.MM.JJJJ“ → „JJJJ-MM-TT“; leere Eingabe → null; ungültig → undefined. */
export function parseGermanDate(input: string): string | null | undefined {
  const v = input.trim();
  if (!v) return null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** „JJJJ-MM-TT“ → „TT.MM.JJJJ“ */
export const toGermanDate = (iso: string | null) =>
  iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '';
