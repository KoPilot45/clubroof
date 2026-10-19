import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

let offline: string | null = null;
let outbox: string | null = null;
vi.mock('./offline-store', () => ({
  readOfflineStore: async () => offline,
  writeOfflineStore: async (c: string) => void (offline = c),
  clearOfflineStore: async () => void (offline = null),
}));
vi.mock('./outbox-store', () => ({
  readOutboxStore: async () => outbox,
  writeOutboxStore: async (c: string) => void (outbox = c),
  clearOutboxStore: async () => void (outbox = null),
}));

import { resetAccountState } from './account-reset';
import { persistOfflineCache, restoreOfflineCache } from './offline-cache';
import { enqueueResponse, loadOutbox } from './outbox';

const me = (id: string) => ({ user: { id } }) as never;

describe('Bereinigung bei Abmeldung, 401 und Kontowechsel (F02)', () => {
  it('Trainerdaten sind nach dem Wechsel zum Spieler weder online noch offline sichtbar', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    client.setQueryData(['event', '1'], { cancelReason: 'vertraulich' });
    const stop = persistOfflineCache(client, me('trainer'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(offline).toContain('vertraulich');

    await resetAccountState(client, { keepOutbox: true });
    stop();
    expect(client.getQueryData(['event', '1'])).toBeUndefined();
    expect(offline).toBeNull();

    // Spieler meldet sich an derselben App-Instanz an
    await restoreOfflineCache(client, 'spieler');
    expect(client.getQueryData(['event', '1'])).toBeUndefined();
    vi.useRealTimers();
  });

  it('Abmeldung räumt auch die Warteschlange, 401 behält sie für dasselbe Konto', async () => {
    const client = new QueryClient();
    await loadOutbox('trainer');
    enqueueResponse({
      eventId: 'e',
      personId: 'p',
      status: 'no',
      reason: null,
      userId: 'trainer',
      title: 'T',
    });
    await resetAccountState(client, { keepOutbox: true });
    expect(outbox).toContain('trainer');
    await resetAccountState(client, { keepOutbox: false });
    expect(outbox).toBeNull();
  });

  it('bricht laufende Abfragen ab, damit späte Antworten nicht ins neue Konto gelangen', async () => {
    const client = new QueryClient();
    let release!: (v: unknown) => void;
    const pending = client.fetchQuery({
      queryKey: ['event', '2'],
      queryFn: () => new Promise((r) => (release = r)),
    });
    pending.catch(() => undefined);
    await resetAccountState(client, { keepOutbox: true });
    release({ cancelReason: 'spät' });
    await new Promise((r) => setTimeout(r, 10));
    expect(client.getQueryData(['event', '2'])).toBeUndefined();
  });
});
