import { describe, expect, it } from 'vitest';
import { euroInWords } from './club-donations';

describe('Betrag in Buchstaben', () => {
  it.each([
    [100, 'ein Euro'],
    [150, 'ein Euro fünfzig Cent'],
    [2100, 'einundzwanzig Euro'],
    [10100, 'einhundertein Euro'],
    [200000, 'zweitausend Euro'],
    [1200000, 'zwölftausend Euro'],
    [10000000, 'einhunderttausend Euro'],
    [123456, 'eintausendzweihundertvierunddreißig Euro sechsundfünfzig Cent'],
    [5, 'null Euro fünf Cent'],
    [100000, 'eintausend Euro'],
  ])('%i Cent', (cents, words) => {
    expect(euroInWords(cents)).toBe(words);
  });
});
