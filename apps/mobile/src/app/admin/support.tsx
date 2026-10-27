import type { SupportAccess } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

const DURATIONS = [
  { hours: 1, label: '1 Stunde' },
  { hours: 24, label: '1 Tag' },
  { hours: 168, label: '7 Tage' },
];

/**
 * Support-Zugriff (Mandantenbetrieb): Der Betreiber sieht Einstellungen und Protokoll des Vereins nur, solange ein
 * Admin das freigibt. Hier auch: Widerspruch gegen eine vom Betreiber angekündigte Admin-Wiederherstellung.
 */
export default function SupportScreen() {
  const { api } = useSignedIn();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const access = useQuery({
    queryKey: ['admin', 'support'],
    queryFn: () => api<SupportAccess>('/admin/support'),
  });
  const done = (a: SupportAccess) => {
    setError(null);
    client.setQueryData(['admin', 'support'], a);
  };
  const onError = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : t('Das hat nicht geklappt.'));
  const grant = useMutation({
    mutationFn: (hours: number) =>
      api<SupportAccess>('/admin/support', { method: 'PUT', body: { hours } }),
    onSuccess: done,
    onError,
  });
  const revoke = useMutation({
    mutationFn: () => api<SupportAccess>('/admin/support', { method: 'DELETE' }),
    onSuccess: done,
    onError,
  });
  const object = useMutation({
    mutationFn: (id: string) =>
      api<SupportAccess>(`/admin/support/recoveries/${id}/object`, { method: 'POST' }),
    onSuccess: done,
    onError,
  });

  if (access.isPending) return <Loading />;
  if (access.error) return <ErrorNotice error={access.error} onRetry={() => access.refetch()} />;
  const a = access.data;
  return (
    <Screen edges={[]} refreshing={access.isRefetching} onRefresh={() => access.refetch()}>
      <T variant="caption">
        Der Betreiber von Clubroof sieht deine Vereinsdaten nie von sich aus. Für Hilfe kannst du
        ihm für kurze Zeit eine schreibgeschützte Ansicht auf Einstellungen und Änderungsprotokoll
        freigeben – ohne Personen-, Kassen- oder Termindaten. Jeder Abruf steht im
        Änderungsprotokoll.
      </T>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <Section title="Support-Zugriff">
        <Card style={{ gap: 10 }}>
          {a.active && a.expiresAt ? (
            <>
              <Chip
                tone="info"
                icon="time-outline"
                label={t(
                  `Freigegeben bis ${formatDay(a.expiresAt)}, ${formatTime(a.expiresAt)} Uhr`,
                )}
              />
              <Button
                label="Freigabe beenden"
                variant="outline"
                loading={revoke.isPending}
                onPress={() => revoke.mutate()}
              />
            </>
          ) : (
            <>
              <T variant="caption">Aktuell ist nichts freigegeben. Freigabe für:</T>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {DURATIONS.map((d) => (
                  <Button
                    key={d.hours}
                    label={d.label}
                    variant="outline"
                    loading={grant.isPending && grant.variables === d.hours}
                    onPress={() => grant.mutate(d.hours)}
                  />
                ))}
              </View>
            </>
          )}
        </Card>
      </Section>

      {a.recoveries.length ? (
        <Section title="Angekündigte Admin-Wiederherstellung">
          <Card>
            {a.recoveries.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                title={r.name}
                subtitle={`${r.email} · ${
                  r.status === 'objected'
                    ? t('Widerspruch eingelegt')
                    : r.status === 'ready'
                      ? t('Frist abgelaufen')
                      : t(
                          `Start frühestens ${formatDay(r.notBefore)}, ${formatTime(r.notBefore)} Uhr`,
                        )
                }`}
                trailing={
                  r.status !== 'objected' ? (
                    <Button
                      label="Widersprechen"
                      variant="outline"
                      loading={object.isPending}
                      onPress={() => object.mutate(r.id)}
                    />
                  ) : undefined
                }
              />
            ))}
          </Card>
          <T variant="caption">
            Der Betreiber kündigt das nur an, wenn kein Admin mehr erreichbar ist. Stimmt das nicht,
            widersprich hier.
          </T>
        </Section>
      ) : null}
    </Screen>
  );
}
