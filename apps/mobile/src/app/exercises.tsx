import {
  EXERCISE_CATEGORIES,
  type CreateExerciseInput,
  type Exercise,
  type EventSummary,
  type ExerciseCategory,
  type TrainingPlan,
} from '@clubroof/core';
import { router } from 'expo-router';
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
import { dateFormat, t } from '@/lib/i18n';

const categories = EXERCISE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

const when = dateFormat({
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** Übung ans Ende des Ablaufs eines der nächsten Trainings meiner Mannschaften hängen. */
function AddToTraining({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const coached = new Set(
    me.teams
      .filter((t) => t.personId === me.person.id && t.functions.some((f) => f !== 'player'))
      .map((t) => t.id),
  );
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const trainings = (events.data ?? [])
    .filter((ev) => ev.type === 'training' && ev.status === 'scheduled')
    .filter((ev) => ev.team && coached.has(ev.team.id))
    .slice(0, 5);
  const add = useMutation({
    mutationFn: async (eventId: string) => {
      const plan = await api<TrainingPlan>(`/events/${eventId}/training-plan`);
      const items = (plan.items ?? []).map((i) => ({
        exerciseId: i.exerciseId,
        title: i.title,
        minutes: i.minutes,
        note: i.note,
      }));
      items.push({
        exerciseId: exercise.id,
        title: exercise.title,
        minutes: exercise.durationMinutes,
        note: null,
      });
      return api<TrainingPlan>(`/events/${eventId}/training-plan`, {
        method: 'PUT',
        body: { focus: plan.focus, notes: plan.notes, items },
      });
    },
    onSuccess: (plan) => {
      queryClient.setQueryData(['training-plan', plan.eventId], plan);
    },
  });
  return (
    <View style={{ gap: 8, paddingTop: 4 }}>
      {add.isSuccess ? (
        <View style={{ gap: 8 }}>
          <Chip tone="success" icon="checkmark" label="Zum Trainingsplan hinzugefügt" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label="Plan öffnen"
              size="sm"
              variant="tonal"
              onPress={() => router.push(`/training-plan/${add.data.eventId}`)}
            />
            <Button label="Fertig" size="sm" variant="outline" onPress={onDone} />
          </View>
        </View>
      ) : (
        <>
          <T variant="overline">Zu welchem Training?</T>
          {events.isPending ? <Loading /> : null}
          {events.data && trainings.length === 0 ? (
            <T variant="caption">Keine Trainings deiner Mannschaften in den nächsten Wochen.</T>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {trainings.map((ev) => (
              <Button
                key={ev.id}
                label={`${ev.team!.badge} · ${when.format(new Date(ev.startsAt))}`}
                size="sm"
                variant="outline"
                loading={add.isPending && add.variables === ev.id}
                onPress={() => add.mutate(ev.id)}
              />
            ))}
          </View>
          {add.error ? <Chip tone="urgent" icon="alert-circle" label={add.error.message} /> : null}
        </>
      )}
    </View>
  );
}

/** Übungsbibliothek des Vereins (Trainingsplanung). */
export default function ExercisesScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all');
  const [creating, setCreating] = useState(false);
  /** Übung, die gerade einem Training hinzugefügt wird */
  const [adding, setAdding] = useState<string | null>(null);
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
  if (list.error) return <ErrorNotice error={list.error} onRetry={() => list.refetch()} />;
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
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Button
                label="Zum Training"
                icon="add"
                variant="tonal"
                size="sm"
                onPress={() => setAdding(adding === e.id ? null : e.id)}
              />
              {e.canDelete ? (
                <Button
                  label="Löschen"
                  icon="trash-outline"
                  variant="danger"
                  size="sm"
                  onPress={() => change.mutate({ method: 'DELETE', id: e.id })}
                />
              ) : null}
            </View>
          </View>
          {adding === e.id ? <AddToTraining exercise={e} onDone={() => setAdding(null)} /> : null}
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
      <T variant="section">Neue Übung</T>
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
        placeholder={t('z. B. 8–12')}
      />
      <TextField
        label="Material (mit Komma trennen)"
        value={material}
        onChangeText={setMaterial}
        maxLength={200}
        placeholder={t('Hütchen, Bälle')}
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
