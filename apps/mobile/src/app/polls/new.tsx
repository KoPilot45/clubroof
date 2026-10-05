import type { CreatePollInput, PollDetail } from '@clubroof/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ChoiceChips, Chip, Screen, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

const key = (t: { type: string; id: string | null }) => `${t.type}:${t.id ?? ''}`;
const DURATIONS = [
  { value: '0', label: 'Ohne Ende' },
  { value: '3', label: '3 Tage' },
  { value: '7', label: '1 Woche' },
  { value: '14', label: '2 Wochen' },
];

export default function NewPollScreen() {
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const targets = me.create.polls;
  const preset = targets.find((t) => t.type === 'team' && t.id === teamId) ?? targets[0];
  const [scope, setScope] = useState(preset ? key(preset) : '');
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [days, setDays] = useState('7');
  const [visibility, setVisibility] = useState<CreatePollInput['resultVisibility']>('after_vote');
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((t) => key(t) === scope);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  const save = useMutation({
    mutationFn: () =>
      api<PollDetail>('/polls', {
        method: 'POST',
        body: {
          question: question.trim(),
          description: description.trim() || null,
          options: filled,
          closesAt:
            days === '0' ? null : new Date(Date.now() + Number(days) * 86_400_000).toISOString(),
          resultVisibility: visibility,
          scopeType: target!.type,
          scopeId: target!.id,
        } satisfies CreatePollInput,
      }),
    onSuccess: (p) => {
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
      router.replace(`/polls/${p.id}`);
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Die Umfrage konnte nicht erstellt werden.'),
  });

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <TextField label="Frage" value={question} onChangeText={setQuestion} maxLength={200} />
        <TextField
          label="Erläuterung (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
        />
      </Card>
      <Card style={{ gap: 10 }}>
        <T variant="label">Antworten</T>
        {options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={`Antwort ${i + 1}`}
                value={o}
                onChangeText={(v) => setOptions((cur) => cur.map((x, j) => (j === i ? v : x)))}
                maxLength={100}
              />
            </View>
            {options.length > 2 ? (
              <Button
                label="Entfernen"
                variant="outline"
                onPress={() => setOptions((cur) => cur.filter((_, j) => j !== i))}
              />
            ) : null}
          </View>
        ))}
        {options.length < 10 ? (
          <Button
            label="Antwort hinzufügen"
            variant="outline"
            icon="add"
            onPress={() => setOptions((cur) => [...cur, ''])}
          />
        ) : null}
      </Card>
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Für wen?"
          options={targets.map((t) => ({ value: key(t), label: t.label }))}
          selected={scope ? [scope] : []}
          onToggle={setScope}
        />
        <ChoiceChips
          label="Abstimmen bis"
          options={DURATIONS}
          selected={[days]}
          onToggle={setDays}
        />
        <ChoiceChips
          label="Ergebnisse sichtbar"
          options={[
            { value: 'always', label: 'Immer' },
            { value: 'after_vote', label: 'Nach eigener Stimme' },
            { value: 'after_close', label: 'Nach dem Ende' },
          ]}
          selected={[visibility]}
          onToggle={setVisibility}
        />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Umfrage starten"
        icon="stats-chart"
        disabled={question.trim().length < 3 || new Set(filled).size < 2 || !target}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
