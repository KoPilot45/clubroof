import type { TeamModule } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Card, ChoiceChips, Chip, ErrorNotice, Loading, Screen, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

type Choice = 'inherit' | 'on' | 'off';

/** Module für einen Bereich: Vorgabe für alle Mannschaften darin (Konzept §8). */
export default function UnitModulesScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { api, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const key = ['admin', 'unit-modules', id];
  const modules = useQuery({
    queryKey: key,
    queryFn: () => api<TeamModule[]>(`/admin/org-units/${id}/modules`),
  });
  const set = useMutation({
    mutationFn: (v: { key: string; enabled: boolean | null }) =>
      api<TeamModule[]>(`/admin/org-units/${id}/modules/${v.key}`, {
        method: 'PUT',
        body: { enabled: v.enabled },
      }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(key, data);
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });
    },
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });

  if (modules.isPending) return <Loading />;
  if (modules.error) return <ErrorNotice error={modules.error} onRetry={() => modules.refetch()} />;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 6 }}>
        <T variant="heading">{name ?? 'Bereich'}</T>
        <T variant="caption">
          Die Einstellung gilt für alle Mannschaften des Bereichs. Ist ein Modul hier aus, kann es
          keine Mannschaft darin einschalten. „Wie Verein“ übernimmt die Vereinseinstellung.
        </T>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {modules.data.map((m) => {
        const current: Choice = m.inherited ? 'inherit' : m.enabled ? 'on' : 'off';
        return (
          <Card key={m.key} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {m.name}
                </T>
                <T variant="caption">{m.description}</T>
              </View>
              {!m.clubEnabled ? <Chip tone="neutral" label="Im Verein aus" /> : null}
            </View>
            <ChoiceChips
              options={[
                { value: 'inherit', label: `Wie Verein (${m.clubEnabled ? 'an' : 'aus'})` },
                { value: 'on', label: 'An' },
                { value: 'off', label: 'Aus' },
              ]}
              selected={[current]}
              onToggle={(c: Choice) =>
                set.mutate({ key: m.key, enabled: c === 'inherit' ? null : c === 'on' })
              }
            />
          </Card>
        );
      })}
    </Screen>
  );
}
