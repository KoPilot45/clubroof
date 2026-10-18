import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readTableFile, writeCsv, writeXlsx } from './table-file';

const b64 = (data: Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? data : data).toString('base64');

describe('Tabellendateien', () => {
  it('liest CSV mit Semikolon und Windows-1252', () => {
    const latin1 = Buffer.from('Vorname;Nachname\nJürgen;Müller\n', 'latin1');
    const t = readTableFile(latin1.toString('base64'));
    expect(t.rows).toEqual([
      ['Vorname', 'Nachname'],
      ['Jürgen', 'Müller'],
    ]);
    expect(t.sheets).toEqual([]);
  });

  it('schreibt und liest Excel mit mehreren Blättern', () => {
    const file = writeXlsx([
      {
        name: 'Vorlage',
        rows: [
          ['Vorname', 'Name'],
          ['Max & Moritz', '<b>"x"</b>'],
        ],
      },
      {
        name: 'Erklärung',
        rows: [
          ['Spalte', 'Bedeutung'],
          ['Vorname', 'Rufname'],
        ],
      },
    ]);
    const first = readTableFile(b64(file));
    expect(first.sheets).toEqual(['Vorlage', 'Erklärung']);
    expect(first.rows[1]).toEqual(['Max & Moritz', '<b>"x"</b>']);
    const second = readTableFile(b64(file), 'Erklärung');
    expect(second.sheet).toBe('Erklärung');
    expect(second.rows[1]).toEqual(['Vorname', 'Rufname']);
  });

  it('versteht gemeinsame Texte, Zahlen und Datumsformate aus Excel', () => {
    const files = {
      'xl/workbook.xml': strToU8(
        '<workbook xmlns:r="x"><sheets><sheet name="Mitglieder" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      'xl/sharedStrings.xml': strToU8(
        '<sst><si><t>Vorname</t></si><si><r><t>Max</t></r><r><t> A.</t></r></si><si><t>Geburtsdatum</t></si></sst>',
      ),
      'xl/styles.xml': strToU8(
        '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData>' +
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row>' +
          '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3"><v>7</v></c><c r="C3" s="1"><v>40909</v></c><c r="D3" s="2"><v>45000</v></c></row>' +
          '</sheetData></worksheet>',
      ),
    };
    const t = readTableFile(b64(zipSync(files)));
    expect(t.rows[0]).toEqual(['Vorname', '', 'Geburtsdatum']);
    expect(t.rows[1]).toEqual([]);
    expect(t.rows[2]).toEqual(['Max A.', '7', '01.01.2012', '15.03.2023']);
  });

  it('weist kaputte und zu große Dateien ab', () => {
    expect(() => readTableFile(b64('PK-kaputt'))).toThrow();
    expect(() => readTableFile('')).toThrow();
    expect(() => readTableFile(Buffer.alloc(6 * 1024 * 1024, 65).toString('base64'))).toThrow(
      /5 MB/,
    );
  });

  it('schreibt CSV für Excel mit Semikolon und Anführungszeichen', () => {
    const csv = writeCsv([
      ['a', 'b;c'],
      ['"x"', 'y'],
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(readTableFile(Buffer.from(csv, 'utf8').toString('base64')).rows).toEqual([
      ['a', 'b;c'],
      ['"x"', 'y'],
    ]);
  });
});
