import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useOffline } from '@/lib/connection';
import { flushOutbox, loadOutbox } from '@/lib/outbox';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';

/**
 * Sendet gemerkte Zu- und Absagen, sobald die App angemeldet und wieder online ist, und meldet das Ergebnis:
 * „n Rückmeldungen gesendet“ bzw. eine Ablehnung des Servers (z. B. Frist abgelaufen) mit Termin und Grund.
 */
export function OutboxSync() {
  const session = useSession();
  const offline = useOffline();
  const queryClient = useQueryClient();
  const toast = useToast();
  const userId = session.status === 'signedIn' ? session.me.user.id : null;
  const { api } = session;

  const flush = () =>
    flushOutbox(
      (item) =>
        api(`/events/${item.eventId}/responses/${item.personId}`, {
          method: 'PUT',
          body: { status: item.status, reason: item.reason },
        }),
      ({ sent, rejected }) => {
        for (const key of ['home', 'events', 'event', 'team', 'my-teams'])
          void queryClient.invalidateQueries({ queryKey: [key] });
        const first = rejected[0];
        if (first) {
          toast({ message: `${first.item.title}: ${first.message}` });
        } else if (sent.length === 1) {
          toast({ message: `Rückmeldung gesendet: ${sent[0]!.title}` });
        } else {
          toast({ message: `${sent.length} Rückmeldungen gesendet` });
        }
      },
    );

  // Beim Anmelden gemerkte Rückmeldungen laden und, wenn möglich, senden
  useEffect(() => {
    if (!userId) return;
    void loadOutbox(userId).then(() => {
      if (!offline) void flush();
    });
    // nur beim Anmelden
  }, [userId]);
  // Verbindung ist zurück
  useEffect(() => {
    if (userId && !offline) void flush();
  }, [offline, userId]);
  return null;
}
