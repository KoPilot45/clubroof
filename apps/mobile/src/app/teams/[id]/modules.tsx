import type { TeamModule } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Card, Chip, ErrorNotice, Loading, Screen, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Trainerteam schaltet die Funktionen der eigenen Mannschaft ein und aus. */
export default function TeamModulesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, refresh } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const key = ['team-modules', id];
  const modules = useQuery({
    queryKey: key,
    queryFn: () => api<TeamModule[]>(`/teams/${id}/modules`),
  });
  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) =>
      api<TeamModule[]>(`/teams/${id}/modules/${v.key}`, {
        method: 'PUT',
        body: { enabled: v.enabled },
      }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(key, data);
      // Kacheln im Team-Bereich hängen an den Modulen
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['team', id] });
    },
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });
  if (modules.isPending) return <Loading />;
  if (modules.error)
    return <ErrorNotice message={modules.error.message} onRetry={() => modules.refetch()} />;
  return (
    <Screen edges={[]}>
      <Card>
        <T variant="caption">
          Schalte ein, was deine Mannschaft nutzt. Ausgeschaltete Funktionen verschwinden für alle
          in der Mannschaft. Was der Verein oder der Bereich ausgeschaltet hat, bleibt aus.
        </T>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Card>
        {modules.data.map((m, i) => (
          <View
            key={m.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="label" style={{ fontWeight: '700' }}>
                {m.name}
              </T>
              <T variant="caption">{m.description}</T>
              {m.lockedBy ? (
                <T variant="caption">
                  {m.lockedBy === 'club' ? 'Im Verein ausgeschaltet' : 'Im Bereich ausgeschaltet'}
                </T>
              ) : null}
            </View>
            <Switch
              accessibilityLabel={m.name}
              value={m.enabled}
              disabled={!!m.lockedBy || (toggle.isPending && toggle.variables?.key === m.key)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              {...({ activeThumbColor: colors.surface } as object)}
              onValueChange={(enabled) => toggle.mutate({ key: m.key, enabled })}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
