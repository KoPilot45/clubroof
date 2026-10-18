/**
 * Tabellendateien für Import und Vorlagen (Paket IM): CSV (UTF-8 oder Windows-1252, Trennzeichen automatisch) und
 * Excel (.xlsx, mehrere Blätter). Excel-Dateien sind ZIP-Archive mit XML; gelesen werden Blätter, gemeinsame Texte
 * und Datumsformate, geschrieben wird eine schlichte Arbeitsmappe mit Kopfzeile. Keine weiteren Abhängigkeiten
 * außer `fflate` für das Archiv.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { HttpError } from '../errors';
import { decodeText, parseCsv } from './csv';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_LINES = 5000;

export type TableFile = {
  /** Namen aller Blätter (bei CSV leer) */
  sheets: string[];
  /** gelesenes Blatt */
  sheet: string | null;
  /** Zeilen einschließlich Kopfzeile, leere Zeilen am Ende entfernt */
  rows: string[][];
};

const decodeXml = (v: string) =>
  v
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** Steuerzeichen sind in XML 1.0 nicht erlaubt (außer Tabulator, Zeilenumbruch, Wagenrücklauf) */
const stripControl = (v: string) =>
  [...v]
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 || c === 9 || c === 10 || c === 13;
    })
    .join('');

const escapeXml = (v: string) =>
  stripControl(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isXlsx = (data: Uint8Array) => data[0] === 0x50 && data[1] === 0x4b;

/** Text aller `<t>`-Elemente (ohne Aussprachehilfen `<rPh>`) */
function textOf(xml: string): string {
  const clean = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
  return [...clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => decodeXml(m[1]!))
    .join('');
}

const attr = (tag: string, name: string) =>
  new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/** Spalte aus einem Zellbezug („C7“ → 2) */
function columnOf(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Formatcodes, die ein Datum meinen (Jahr/Tag, ohne Textteile in Anführungszeichen) */
const isDateCode = (code: string) => {
  const plain = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  return /[dy]/i.test(plain) && !/[#0]/.test(plain.replace(/[hms]/gi, ''));
};

/** Excel-Seriennummer (1900-Datumssystem) → TT.MM.JJJJ */
function serialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

function readXlsx(data: Uint8Array, wanted?: string): TableFile {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      // Nur lesen, was gebraucht wird – schützt vor Archiven mit riesigem Inhalt
      filter: (f) =>
        /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(
          f.name,
        ) && f.originalSize <= 40_000_000,
    });
  } catch {
    throw new HttpError(400, 'import_file', 'Die Excel-Datei lässt sich nicht lesen.');
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]!) : '');
  const workbook = text('xl/workbook.xml');
  if (!workbook) throw new HttpError(400, 'import_file', 'Die Datei ist keine Excel-Arbeitsmappe.');
  const rels = new Map<string, string>();
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id');
    const target = attr(m[0], 'Target');
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/g)].flatMap((m) => {
    const name = attr(m[0], 'name');
    const rid = /r:id="([^"]*)"/.exec(m[0])?.[1];
    const path = rid ? rels.get(rid) : undefined;
    return name && path ? [{ name: decodeXml(name), path }] : [];
  });
  if (sheets.length === 0) throw new HttpError(400, 'import_file', 'Die Datei enthält kein Blatt.');
  const chosen = (wanted && sheets.find((s) => s.name === wanted)) || sheets[0]!;

  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(
    (m) => textOf(m[1]!),
  );
  // Datumsformate: je Zellformat (`s`) merken, ob es ein Datum ist
  const styles = text('xl/styles.xml');
  const customDates = new Set<number>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId'));
    const code = decodeXml(attr(m[0], 'formatCode') ?? '');
    if (isDateCode(code)) customDates.add(id);
  }
  const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? '';
  const dateStyle = [...cellXfs.matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const id = Number(attr(m[0], 'numFmtId') ?? 0);
    return BUILTIN_DATE_FORMATS.has(id) || customDates.has(id);
  });

  const sheetXml = text(chosen.path);
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    const rowIndex =
      Number(attr(rowMatch[0].slice(0, rowMatch[0].indexOf('>')), 'r') ?? rows.length + 1) - 1;
    for (const c of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = c[1]!;
      const body = c[2] ?? '';
      const col = columnOf(attr(head, 'r') ?? '');
      const type = attr(head, 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'b') value = raw === '1' ? 'Ja' : 'Nein';
      else if (raw !== undefined) {
        value = decodeXml(raw);
        const n = Number(value);
        if (type !== 'str' && type !== 'e' && Number.isFinite(n)) {
          const style = Number(attr(head, 's') ?? 0);
          value = dateStyle[style] && n >= 1 ? serialToDate(n) : String(n);
        }
      }
      row[col] = value.trim();
    }
    for (let i = 0; i < row.length; i++) row[i] ??= '';
    while (rows.length < rowIndex) rows.push([]);
    rows[rowIndex] = row;
    if (rows.length > MAX_IMPORT_LINES + 50) break;
  }
  while (rows.length && rows[rows.length - 1]!.every((c) => c === '')) rows.pop();
  return { sheets: sheets.map((s) => s.name), sheet: chosen.name, rows };
}

/** Datei lesen (CSV oder Excel); `sheet` wählt bei Excel das Blatt. */
export function readTableFile(dataBase64: string, sheet?: string | null): TableFile {
  const data = Buffer.from(dataBase64, 'base64');
  if (data.length === 0) throw new HttpError(400, 'import_empty', 'Die Datei ist leer.');
  if (data.length > MAX_FILE_BYTES)
    throw new HttpError(400, 'import_too_large', 'Die Datei ist größer als 5 MB.');
  if (isXlsx(data)) return readXlsx(new Uint8Array(data), sheet ?? undefined);
  const rows = parseCsv(decodeText(data));
  while (rows.length && rows[rows.length - 1]!.every((c) => c === '')) rows.pop();
  return { sheets: [], sheet: null, rows };
}

const columnName = (i: number) => {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Schlichte Arbeitsmappe: je Blatt eine fett gesetzte Kopfzeile, Texte als Text, Spaltenbreite nach Inhalt. */
export function writeXlsx(sheets: { name: string; rows: string[][] }[]): Uint8Array {
  const sheetXml = (rows: string[][]) => {
    const width = (c: number) =>
      Math.min(60, Math.max(10, ...rows.map((r) => (r[c] ?? '').length + 2)));
    const cols = Math.max(0, ...rows.map((r) => r.length));
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<cols>${Array.from({ length: cols }, (_, c) => `<col min="${c + 1}" max="${c + 1}" width="${width(c)}" customWidth="1"/>`).join('')}</cols>` +
      `<sheetData>${rows
        .map(
          (r, i) =>
            `<row r="${i + 1}">${r
              .map(
                (v, c) =>
                  `<c r="${columnName(c)}${i + 1}" t="inlineStr"${i === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`,
              )
              .join('')}</row>`,
        )
        .join('')}</sheetData></worksheet>`
    );
  };
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets
          .map(
            (s, i) =>
              `<sheet name="${escapeXml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
          )
          .join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '</styleSheet>',
    ),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows));
  });
  return zipSync(files);
}

/** CSV für Excel in Deutschland: Semikolon, UTF-8 mit Kennzeichen am Anfang. */
export function writeCsv(rows: string[][]): string {
  const cell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
