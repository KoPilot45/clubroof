import type { JerseyMode, JerseySettings } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

type Mode = JerseyMode | 'off';

export default function JerseysScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const settings = useQuery({
    queryKey: ['jerseys', id],
    queryFn: () => api<JerseySettings>(`/teams/${id}/jerseys`),
  });
  if (settings.isPending) return <Loading />;
  if (settings.error)
    return <ErrorNotice error={settings.error} onRetry={() => settings.refetch()} />;
  return <Editor teamId={id} settings={settings.data} />;
}

function Editor({ teamId, settings }: { teamId: string; settings: JerseySettings }) {
  const { api, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(settings.mode ?? 'off');
  const [numbers, setNumbers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      settings.numbers.map((n) => [
        n.personId,
        n.jerseyNumber != null ? String(n.jerseyNumber) : '',
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const used = Object.values(numbers).filter(Boolean);
  const duplicates = new Set(used.filter((n, i) => used.indexOf(n) !== i));

  const save = useMutation({
    mutationFn: () =>
      api<JerseySettings>(`/teams/${teamId}/jerseys`, {
        method: 'PUT',
        body: {
          mode,
          numbers:
            mode === 'off'
              ? undefined
              : settings.numbers.map((n) => ({
                  personId: n.personId,
                  jerseyNumber: numbers[n.personId] ? Number(numbers[n.personId]) : null,
                })),
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['jerseys', teamId], data);
      void queryClient.invalidateQueries({ queryKey: ['roster', teamId] });
      void refresh();
      router.back();
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Das Speichern hat nicht geklappt.'),
  });

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 10 }}>
        <ChoiceChips
          label="Rückennummern"
          options={[
            { value: 'season', label: 'Fest für die Saison' },
            { value: 'match', label: 'Je Spiel in der Aufstellung' },
            { value: 'off', label: 'Keine' },
          ]}
          selected={[mode]}
          onToggle={setMode}
        />
        <T variant="caption">
          {mode === 'season'
            ? 'Jeder Spieler behält seine Nummer; sie erscheint im Kader und in der Aufstellung.'
            : mode === 'match'
              ? 'Die Nummern unten sind Vorschläge; in der Aufstellung kannst du sie je Spiel ändern.'
              : 'Es werden keine Rückennummern angezeigt.'}
        </T>
      </Card>
      {mode !== 'off' ? (
        <Card style={{ gap: 8 }}>
          {settings.numbers.map((n) => (
            <View
              key={n.personId}
              style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}
            >
              <T variant="body" style={{ flex: 1, paddingBottom: 12 }}>
                {n.name}
              </T>
              <View style={{ width: 72 }}>
                <TextField
                  label={duplicates.has(numbers[n.personId] ?? '') ? 'doppelt' : 'Nr.'}
                  value={numbers[n.personId] ?? ''}
                  onChangeText={(v) =>
                    setNumbers((cur) => ({ ...cur, [n.personId]: v.replace(/\D/g, '') }))
                  }
                  maxLength={2}
                />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {duplicates.size ? (
        <Chip tone="action" label={`Doppelt vergeben: ${[...duplicates].join(', ')}`} />
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Speichern"
        icon="checkmark"
        disabled={duplicates.size > 0}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
