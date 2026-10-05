import type { ModuleDecision, ModuleEntry, ModuleOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

function stateChip(m: ModuleEntry) {
  if (m.core) return <Chip tone="neutral" icon="lock-closed" label="Immer aktiv" />;
  if (m.state === 'enabled')
    return (
      <Chip
        tone="success"
        icon="checkmark-circle"
        label={m.enabledTeams !== null ? `Aktiv · in ${m.enabledTeams} Mannschaften` : 'Aktiv'}
      />
    );
  if (m.declined) return <Chip tone="neutral" label="Nicht verwendet" />;
  if (m.snoozedUntil) return <Chip tone="neutral" icon="time-outline" label="Später" />;
  return <Chip tone="action" label={m.state === 'new' ? 'Neu' : 'Aus'} />;
}

export default function ModulesScreen() {
  const { api, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ['admin', 'modules'],
    queryFn: () => api<ModuleOverview>('/admin/modules'),
  });
  const decide = useMutation({
    mutationFn: (v: { key: string; decision: ModuleDecision }) =>
      api<ModuleOverview>(`/admin/modules/${v.key}`, {
        method: 'POST',
        body: { decision: v.decision },
      }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['admin', 'modules'], data);
      // Kacheln in Team, Verein und Mehr hängen an den Modulen
      void refresh();
      void queryClient.invalidateQueries();
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Die Änderung hat nicht geklappt.'),
  });

  if (overview.isPending) return <Loading />;
  if (overview.error)
    return <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />;
  const o = overview.data;
  const busy = (key: string) => decide.isPending && decide.variables?.key === key;

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {o.updates.length ? (
        <Section title={`Update-Center (${o.updates.length})`}>
          <T variant="caption">
            Neue Funktionen sind zunächst aus. Richte sie ein, wenn der Verein sie braucht.
          </T>
          {o.updates.map((m) => (
            <Card key={m.key} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T variant="heading" style={{ flex: 1 }}>
                  {m.name}
                </T>
                {stateChip(m)}
              </View>
              <T variant="caption">{m.description}</T>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  label="Einrichten"
                  icon="checkmark"
                  loading={busy(m.key) && decide.variables?.decision === 'enable'}
                  onPress={() => decide.mutate({ key: m.key, decision: 'enable' })}
                />
                <Button
                  label="Später"
                  variant="outline"
                  onPress={() => decide.mutate({ key: m.key, decision: 'later' })}
                />
                <Button
                  label="Nicht verwenden"
                  variant="outline"
                  onPress={() => decide.mutate({ key: m.key, decision: 'decline' })}
                />
              </View>
            </Card>
          ))}
        </Section>
      ) : null}
      <Section title="Alle Module">
        <T variant="caption">
          Ausgeschaltete Module verschwinden aus der App; Daten bleiben erhalten. Mannschaftsmodule
          lassen sich zusätzlich je Mannschaft einstellen (Verwaltung → Mannschaften).
        </T>
        <Card style={{ gap: 14 }}>
          {o.modules.map((m) => (
            <View key={m.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="body" style={{ fontWeight: '700' }}>
                    {m.name}
                  </T>
                  <T variant="caption">{m.description}</T>
                </View>
                {!m.core ? (
                  <Button
                    label={m.state === 'enabled' ? 'Ausschalten' : 'Einschalten'}
                    variant="outline"
                    loading={busy(m.key)}
                    onPress={() =>
                      decide.mutate({
                        key: m.key,
                        decision: m.state === 'enabled' ? 'disable' : 'enable',
                      })
                    }
                  />
                ) : null}
              </View>
              {stateChip(m)}
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
