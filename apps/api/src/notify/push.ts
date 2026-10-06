/**
 * Push-Versand über den Expo Push Service (APNs/FCM). Ohne Konfiguration werden Push-Nachrichten
 * nur protokolliert; Tests übergeben einen Sender im Speicher.
 */
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** Deep Link, den die App beim Antippen öffnet */
  data: { link: string | null; notificationId: string };
  priority: 'high' | 'normal';
};

/** Ergebnis je Nachricht: ok, ungültiges Gerät (Token löschen) oder sonstiger Fehler */
export type PushResult = { ok: true } | { ok: false; deviceGone: boolean; error: string };

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

export function createPushSender(
  options: { provider: 'expo' | 'log'; accessToken: string | undefined },
  log: (msg: string) => void,
): PushSender {
  if (options.provider === 'log') {
    return {
      async send(messages) {
        for (const m of messages)
          log(`Push (nicht versendet) an ${m.to.slice(0, 24)}…: ${m.title}`);
        return messages.map(() => ({ ok: true }));
      },
    };
  }
  return {
    async send(messages) {
      const results: PushResult[] = [];
      // Expo nimmt höchstens 100 Nachrichten je Anfrage an
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const res = await fetch(EXPO_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
          },
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: 'default' }))),
        });
        if (!res.ok) {
          const error = `Expo antwortet mit ${res.status}`;
          results.push(...chunk.map(() => ({ ok: false as const, deviceGone: false, error })));
          continue;
        }
        const body = (await res.json()) as {
          data: { status: 'ok' | 'error'; message?: string; details?: { error?: string } }[];
        };
        for (const ticket of body.data) {
          results.push(
            ticket.status === 'ok'
              ? { ok: true }
              : {
                  ok: false,
                  deviceGone: ticket.details?.error === 'DeviceNotRegistered',
                  error: ticket.message ?? 'Unbekannter Fehler',
                },
          );
        }
      }
      return results;
    },
  };
}

/** Sammelt Push-Nachrichten im Speicher (für Tests). */
export function memoryPushSender(): PushSender & { sent: PushMessage[]; gone: Set<string> } {
  const sent: PushMessage[] = [];
  const gone = new Set<string>();
  return {
    sent,
    gone,
    async send(messages) {
      return messages.map((m) => {
        if (gone.has(m.to)) return { ok: false, deviceGone: true, error: 'DeviceNotRegistered' };
        sent.push(m);
        return { ok: true };
      });
    },
  };
}
