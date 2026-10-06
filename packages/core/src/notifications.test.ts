import { describe, expect, it } from 'vitest';
import { pushSendAfter } from './notifications';

const quiet = { start: '22:00', end: '07:00' };

describe('Ruhezeiten', () => {
  it('sendet tagsüber sofort', () => {
    const now = new Date('2026-10-05T10:00:00Z'); // 12:00 Berlin
    expect(pushSendAfter(now, quiet)).toEqual(now);
  });
  it('verschiebt abends auf den nächsten Morgen', () => {
    // 23:30 Berlin (Sommerzeit, UTC+2) → 07:00 am Folgetag
    expect(pushSendAfter(new Date('2026-10-05T21:30:00Z'), quiet)).toEqual(
      new Date('2026-10-06T05:00:00Z'),
    );
  });
  it('verschiebt nachts auf denselben Morgen', () => {
    expect(pushSendAfter(new Date('2026-10-06T01:00:00Z'), quiet)).toEqual(
      new Date('2026-10-06T05:00:00Z'),
    );
  });
  it('beachtet die Zeitumstellung', () => {
    // 25.10.2026: Ende der Sommerzeit, 07:00 Berlin = 06:00 UTC
    expect(pushSendAfter(new Date('2026-10-24T22:00:00Z'), quiet)).toEqual(
      new Date('2026-10-25T06:00:00Z'),
    );
  });
  it('Ruhezeit am Tag ohne Mitternacht', () => {
    const lunch = { start: '12:00', end: '14:00' };
    expect(pushSendAfter(new Date('2026-10-05T11:00:00Z'), lunch)).toEqual(
      new Date('2026-10-05T12:00:00Z'),
    );
  });
});
