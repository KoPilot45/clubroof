/**
 * Sehr einfacher PDF-Erzeuger für Berichte (A4 hoch, Helvetica, WinAnsi-Zeichensatz).
 * Reicht für Tabellen und Text – ohne zusätzliche Bibliothek. Seitenumbruch automatisch.
 */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;

/** Unicode → WinAnsi (CP1252); unbekannte Zeichen werden „?“ */
const CP1252: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '–': 0x96,
  '—': 0x97,
};

function encode(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = CP1252[ch] ?? (ch.charCodeAt(0) <= 0xff ? ch.charCodeAt(0) : 0x3f);
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(code);
  }
  return out;
}

/** Ungefähre Textbreite (Helvetica): schmal genug für Ausrichtung und Kürzen. */
function width(text: string, size: number, bold: boolean): number {
  let w = 0;
  for (const ch of text) {
    if ("il.,:;|!'ı".includes(ch)) w += 0.28;
    else if ('fjtrI() '.includes(ch)) w += 0.33;
    else if (/[0-9]/.test(ch)) w += 0.556;
    else if ('mwMW'.includes(ch)) w += 0.83;
    else if (/[A-ZÄÖÜ]/.test(ch)) w += 0.67;
    else w += 0.53;
  }
  return w * size * (bold ? 1.06 : 1);
}

function fit(text: string, max: number, size: number, bold: boolean): string {
  if (width(text, size, bold) <= max) return text;
  let t = text;
  while (t.length > 1 && width(`${t}…`, size, bold) > max) t = t.slice(0, -1);
  return `${t}…`;
}

export class SimplePdf {
  private pages: string[][] = [[]];
  private y = PAGE_H - MARGIN;

  private get ops() {
    return this.pages[this.pages.length - 1]!;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) {
      this.pages.push([]);
      this.y = PAGE_H - MARGIN;
    }
  }

  private put(x: number, text: string, size: number, bold: boolean) {
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${this.y.toFixed(1)} Td (${encode(text)}) Tj ET`,
    );
  }

  text(text: string, opts: { size?: number; bold?: boolean } = {}) {
    const size = opts.size ?? 10;
    this.ensure(size * 1.5);
    this.y -= size * 1.35;
    this.put(MARGIN, fit(text, PAGE_W - 2 * MARGIN, size, !!opts.bold), size, !!opts.bold);
  }

  gap(points: number) {
    this.y -= points;
  }

  /** Tabellenzeile: `xs` sind die linken Spaltenkanten, die letzte Kante ist das Zeilenende. */
  row(cells: string[], xs: number[], opts: { bold?: boolean; alignRight?: number[] } = {}) {
    const size = 8.5;
    const bold = !!opts.bold;
    this.ensure(size * 1.6);
    this.y -= size * 1.5;
    cells.forEach((cell, i) => {
      const left = xs[i]!;
      const right = (xs[i + 1] ?? PAGE_W - MARGIN) - 4;
      const text = fit(cell, right - left, size, bold);
      const x = opts.alignRight?.includes(i) ? right - width(text, size, bold) : left;
      this.put(x, text, size, bold);
    });
    if (bold) {
      this.ops.push(
        `0.6 w ${MARGIN} ${(this.y - 3).toFixed(1)} m ${PAGE_W - MARGIN} ${(this.y - 3).toFixed(1)} l S`,
      );
    }
  }

  build(): Buffer {
    const count = this.pages.length;
    // 1 Katalog, 2 Seitenbaum, 3/4 Schriften, danach je Seite: Seite + Inhalt
    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${count} >>`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    this.pages.forEach((ops, i) => {
      const footer = `BT /F1 8 Tf ${PAGE_W - MARGIN - 50} 30 Td (Seite ${i + 1} von ${count}) Tj ET`;
      const content = [...ops, footer].join('\n');
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      );
      objects.push(
        `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
      );
    });
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
  }
}
