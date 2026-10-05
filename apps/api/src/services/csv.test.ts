import { describe, expect, it } from 'vitest';
import { decodeText, parseCsv } from './csv';
import { parseDate } from './member-import';

describe('CSV-Leser', () => {
  it('erkennt Semikolon, Anführungszeichen und BOM', () => {
    expect(parseCsv('﻿Vorname;Nachname\r\n"Anna; Lena";"Müller ""Mü"""\n\n')).toEqual([
      ['Vorname', 'Nachname'],
      ['Anna; Lena', 'Müller "Mü"'],
      [''],
    ]);
  });
  it('liest UTF-8 und Windows-1252', () => {
    expect(decodeText(Buffer.from('Jürgen;Weiß', 'utf8'))).toBe('Jürgen;Weiß');
    expect(decodeText(Buffer.from([0x4a, 0xfc, 0x72, 0x67, 0x65, 0x6e]))).toBe('Jürgen');
  });
  it('erkennt Komma als Trennzeichen', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('liest deutsche und ISO-Daten', () => {
    expect(parseDate('3.4.2012')).toBe('2012-04-03');
    expect(parseDate('03.04.12')).toBe('2012-04-03');
    expect(parseDate('2012-04-03')).toBe('2012-04-03');
    expect(parseDate('31.02.2012')).toBeUndefined();
    expect(parseDate('')).toBeNull();
  });
});
