import { beforeEach, describe, expect, it, vi } from 'vitest';

let stored: string | null = null;
vi.mock('./outbox-store', () => ({
  readOutboxStore: async () => stored,
  writeOutboxStore: async (c: string) => void (stored = c),
  clearOutboxStore: async () => void (stored = null),
}));

import { RequestError } from './api';
import {
  clearOutbox,
  enqueueResponse,
  flushOutbox,
  loadOutbox,
  resetOutboxMemory,
  type QueuedResponse,
} from './outbox';

const item = (userId: string, eventId = 'e1'): Omit<QueuedResponse, 'queuedAt' | 'attempts'> => ({
  eventId,
  personId: 'p1',
  status: 'no',
  reason: 'krank',
  userId,
  title: 'Training',
});
const fail = (status: number) => async () => {
  throw new RequestError(status, 'x', 'Fehler');
};
const stats = () => ({ sent: 0, rejected: 0 });
const run = async (userId: string, send: (i: QueuedResponse) => Promise<unknown>) => {
  const result = stats();
  await flushOutbox(
    send,
    (r) => {
      result.sent += r.sent.length;
      result.rejected += r.rejected.length;
    },
    userId,
  );
  return result;
};
const queued = () => (stored ? (JSON.parse(stored) as QueuedResponse[]) : []);

beforeEach(async () => {
  stored = null;
  await clearOutbox();
  resetOutboxMemory();
});

describe('Warteschlange bei Serverfehlern (F06)', () => {
  it.each([429, 500, 503])('behält die Antwort bei HTTP %i', async (status) => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    const r = await run('a', fail(status));
    expect(r.rejected).toBe(0);
    expect(queued()).toHaveLength(1);
  });

  it('behält die Antwort bei Netzfehler und 401', async () => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    for (const status of [0, 401]) {
      expect((await run('a', fail(status))).rejected).toBe(0);
      expect(queued()).toHaveLength(1);
    }
  });

  it('entfernt endgültige fachliche Ablehnungen und meldet sie', async () => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    const r = await run('a', fail(409));
    expect(r.rejected).toBe(1);
    expect(queued()).toHaveLength(0);
  });

  it('gibt nach begrenzten Wiederholungen auf und meldet die Antwort', async () => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    let rejected = 0;
    for (let i = 0; i < 12 && queued().length; i++)
      rejected += (await run('a', fail(503))).rejected;
    expect(queued()).toHaveLength(0);
    expect(rejected).toBe(1);
  });

  it('sendet nach einem vorübergehenden Fehler erfolgreich weiter', async () => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    await run('a', fail(503));
    const r = await run('a', async () => ({}));
    expect(r.sent).toBe(1);
    expect(queued()).toHaveLength(0);
  });
});

describe('Warteschlange gehört genau einem Konto (F02)', () => {
  it('sendet nichts, bevor die Warteschlange des Kontos geladen ist', async () => {
    stored = JSON.stringify([{ ...item('a'), queuedAt: 'x', attempts: 0 }]);
    const send = vi.fn(async () => ({}));
    await run('a', send);
    expect(send).not.toHaveBeenCalled();
    await loadOutbox('a');
    await run('a', send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sendet nie Antworten eines anderen Kontos', async () => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    // Kontowechsel ohne Neuladen: Eintrag von A darf mit dem Kontext von B nicht gesendet werden
    const send = vi.fn(async () => ({}));
    await run('b', send);
    expect(send).not.toHaveBeenCalled();
  });

  it('lädt beim Kontowechsel nur Einträge des neuen Kontos', async () => {
    await loadOutbox('a');
    enqueueResponse(item('a'));
    await loadOutbox('b');
    const send = vi.fn(async () => ({}));
    await run('b', send);
    expect(send).not.toHaveBeenCalled();
  });
});
