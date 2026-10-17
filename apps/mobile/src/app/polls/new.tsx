import type { CreatePollInput, PollDetail, UpdatePollInput } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLeaveGuard } from '@/components/edited';
import { Button, Card, ChoiceChips, Chip, Loading, Screen, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

const key = (t: { type: string; id: string | null }) => `${t.type}:${t.id ?? ''}`;
const DURATIONS = [
  { value: 'keep', label: 'Unverändert' },
  { value: '0', label: 'Ohne Ende' },
  { value: '3', label: '3 Tage' },
  { value: '7', label: '1 Woche' },
  { value: '14', label: '2 Wochen' },
];

export default function NewPollScreen() {
  const { teamId, id } = useLocalSearchParams<{ teamId?: string; id?: string }>();
  const editing = !!id;
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const targets = me.create.polls;
  const preset = targets.find((t) => t.type === 'team' && t.id === teamId) ?? targets[0];
  const [scope, setScope] = useState(preset ? key(preset) : '');
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [days, setDays] = useState(editing ? 'keep' : '7');
  const [saved, setSaved] = useState(false);
  const [visibility, setVisibility] = useState<CreatePollInput['resultVisibility']>('after_vote');
  const [error, setError] = useState<string | null>(null);
  // Bearbeiten: das Formular mit der bestehenden Umfrage vorausfüllen (kein zweites Formular)
  const existing = useQuery({
    queryKey: ['poll', id],
    queryFn: () => api<PollDetail>(`/polls/${id}`),
    enabled: editing,
  });
  const [loaded, setLoaded] = useState(!editing);
  useEffect(() => {
    const p = existing.data;
    if (!p || loaded) return;
    setQuestion(p.question);
    setDescription(p.description ?? '');
    setOptions(p.options.map((o) => o.label));
    setVisibility(p.resultVisibility);
    setLoaded(true);
  }, [existing.data, loaded]);
  const locked = editing && !!existing.data?.optionsLocked;
  const target = targets.find((t) => key(t) === scope);
  const filled = options.map((o) => o.trim()).filter(Boolean);

  const closesAtOf = () =>
    days === '0' ? null : new Date(Date.now() + Number(days) * 86_400_000).toISOString();
  const save = useMutation({
    mutationFn: () =>
      editing
        ? api<PollDetail>(`/polls/${id}`, {
            method: 'PATCH',
            body: {
              question: question.trim(),
              description: description.trim() || null,
              ...(locked ? {} : { options: filled }),
              ...(days === 'keep' ? {} : { closesAt: closesAtOf() }),
              resultVisibility: visibility,
            } satisfies UpdatePollInput,
          })
        : api<PollDetail>('/polls', {
            method: 'POST',
            body: {
              question: question.trim(),
              description: description.trim() || null,
              options: filled,
              closesAt: closesAtOf(),
              resultVisibility: visibility,
              scopeType: target!.type,
              scopeId: target!.id,
            } satisfies CreatePollInput,
          }),
    onSuccess: (p) => {
      allowLeave();
      setSaved(true);
      queryClient.setQueryData(['poll', p.id], p);
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
      if (editing) router.back();
      else router.replace(`/polls/${p.id}`);
    },
    onError: (e) =>
      setError(
        e instanceof RequestError
          ? e.message
          : editing
            ? 'Die Änderungen konnten nicht gespeichert werden.'
            : 'Die Umfrage konnte nicht erstellt werden.',
      ),
  });
  const dirty =
    editing &&
    loaded &&
    !saved &&
    (question !== existing.data?.question ||
      description !== (existing.data?.description ?? '') ||
      days !== 'keep' ||
      visibility !== existing.data?.resultVisibility ||
      options.map((o) => o.trim()).join('\n') !==
        existing.data?.options.map((o) => o.label).join('\n'));
  const { guard, allowLeave } = useLeaveGuard(dirty, () => save.mutate());

  return (
    <Screen
      edges={[]}
      footer={
        <>
          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
          <Button
            label={editing ? 'Änderungen speichern' : 'Umfrage starten'}
            icon={editing ? 'checkmark' : 'stats-chart'}
            disabled={
              question.trim().length < 3 || new Set(filled).size < 2 || (!editing && !target)
            }
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </>
      }
    >
      {editing && existing.isPending ? <Loading /> : null}
      {guard}
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
        {locked ? (
          <Chip
            tone="info"
            icon="lock-closed"
            label="Es wurde schon abgestimmt: Die Antworten lassen sich nicht mehr ändern."
          />
        ) : null}
        {options.map((o, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={`Antwort ${i + 1}`}
                value={o}
                onChangeText={(v) => setOptions((cur) => cur.map((x, j) => (j === i ? v : x)))}
                maxLength={100}
                editable={!locked}
              />
            </View>
            {options.length > 2 && !locked ? (
              <Button
                label="Entfernen"
                variant="outline"
                onPress={() => setOptions((cur) => cur.filter((_, j) => j !== i))}
              />
            ) : null}
          </View>
        ))}
        {options.length < 10 && !locked ? (
          <Button
            label="Antwort hinzufügen"
            variant="outline"
            icon="add"
            onPress={() => setOptions((cur) => [...cur, ''])}
          />
        ) : null}
      </Card>
      <Card style={{ gap: 12 }}>
        {editing ? null : (
          <ChoiceChips
            label="Für wen?"
            options={targets.map((t) => ({ value: key(t), label: t.label }))}
            selected={scope ? [scope] : []}
            onToggle={setScope}
          />
        )}
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
    </Screen>
  );
}
