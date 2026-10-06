import {
  EXERCISE_CATEGORIES,
  type CreateExerciseInput,
  type Exercise,
  type ExerciseCategory,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { CATEGORY_LABELS } from '@/lib/training';

const categories = EXERCISE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

/** Übungsbibliothek des Vereins (Trainingsplanung). */
export default function ExercisesScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['exercises'], queryFn: () => api<Exercise[]>('/exercises') });
  const change = useMutation({
    mutationFn: (v: { method: 'POST' | 'DELETE'; id?: string; body?: CreateExerciseInput }) =>
      api<Exercise[]>(v.id ? `/exercises/${v.id}` : '/exercises', {
        method: v.method,
        body: v.body,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['exercises'], data);
      setCreating(false);
    },
  });
  if (list.isPending) return <Loading />;
  if (list.error)
    return <ErrorNotice message={list.error.message} onRetry={() => list.refetch()} />;
  const shown = list.data.filter((e) => filter === 'all' || e.category === filter);
  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      {creating ? (
        <NewExercise
          busy={change.isPending}
          onCancel={() => setCreating(false)}
          onSave={(body) => change.mutate({ method: 'POST', body })}
        />
      ) : (
        <Button label="Übung anlegen" icon="add" onPress={() => setCreating(true)} />
      )}
      {change.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={
            change.error instanceof RequestError ? change.error.message : 'Das hat nicht geklappt.'
          }
        />
      ) : null}
      <ChoiceChips
        options={[{ value: 'all' as const, label: 'Alle' }, ...categories]}
        selected={[filter]}
        onToggle={setFilter}
      />
      {shown.length === 0 ? (
        <Card>
          <Empty icon="library-outline" text="Keine Übungen in dieser Kategorie." />
        </Card>
      ) : null}
      {shown.map((e) => (
        <Card key={e.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
              {e.title}
            </T>
            <Chip tone="neutral" label={`${e.durationMinutes} min`} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Chip tone="info" label={CATEGORY_LABELS[e.category]} />
            {e.players ? <Chip tone="neutral" icon="people-outline" label={e.players} /> : null}
            {e.material ? <Chip tone="neutral" icon="cube-outline" label={e.material} /> : null}
          </View>
          {e.description ? <T variant="caption">{e.description}</T> : null}
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <T variant="caption">{e.createdBy ? `von ${e.createdBy}` : ''}</T>
            {e.canDelete ? (
              <Button
                label="Löschen"
                variant="outline"
                onPress={() => change.mutate({ method: 'DELETE', id: e.id })}
              />
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function NewExercise({
  busy,
  onSave,
  onCancel,
}: {
  busy: boolean;
  onSave: (body: CreateExerciseInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('technique');
  const [minutes, setMinutes] = useState('15');
  const [players, setPlayers] = useState('');
  const [material, setMaterial] = useState('');
  const [description, setDescription] = useState('');
  return (
    <Card style={{ gap: 12 }}>
      <T variant="heading">Neue Übung</T>
      <TextField label="Name" value={title} onChangeText={setTitle} maxLength={80} />
      <ChoiceChips options={categories} selected={[category]} onToggle={setCategory} />
      <ChoiceChips
        label="Dauer"
        options={['5', '10', '15', '20', '25', '30'].map((m) => ({ value: m, label: `${m} min` }))}
        selected={[minutes]}
        onToggle={setMinutes}
      />
      <TextField
        label="Spieler (optional)"
        value={players}
        onChangeText={setPlayers}
        maxLength={40}
        placeholder="z. B. 8–12"
      />
      <TextField
        label="Material (mit Komma trennen)"
        value={material}
        onChangeText={setMaterial}
        maxLength={200}
        placeholder="Hütchen, Bälle"
      />
      <TextField
        label="Ablauf"
        value={description}
        onChangeText={setDescription}
        maxLength={2000}
        multiline
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Abbrechen" variant="outline" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label="Speichern"
          style={{ flex: 1 }}
          loading={busy}
          disabled={title.trim().length < 2}
          onPress={() =>
            onSave({
              title: title.trim(),
              category,
              durationMinutes: Number(minutes),
              players: players.trim() || null,
              material: material.trim() || null,
              description: description.trim() || null,
            })
          }
        />
      </View>
    </Card>
  );
}
