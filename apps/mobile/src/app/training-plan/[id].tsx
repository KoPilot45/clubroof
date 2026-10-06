import type { Exercise, SaveTrainingPlanInput, TrainingPlan } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { CATEGORY_LABELS } from '@/lib/training';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

type Item = SaveTrainingPlanInput['items'][number];

export default function TrainingPlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: ['training-plan', id],
    queryFn: () => api<TrainingPlan>(`/events/${id}/training-plan`),
  });
  const library = useQuery({
    queryKey: ['exercises'],
    queryFn: () => api<Exercise[]>('/exercises'),
  });
  const [focus, setFocus] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [picking, setPicking] = useState(false);
  const [free, setFree] = useState('');

  useEffect(() => {
    if (!plan.data) return;
    setFocus(plan.data.focus ?? '');
    setNotes(plan.data.notes ?? '');
    setItems(
      (plan.data.items ?? []).map(({ exerciseId, title, minutes, note }) => ({
        exerciseId,
        title,
        minutes,
        note,
      })),
    );
  }, [plan.data]);

  const save = useMutation({
    mutationFn: () =>
      api<TrainingPlan>(`/events/${id}/training-plan`, {
        method: 'PUT',
        body: { focus, notes, items } satisfies SaveTrainingPlanInput,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['training-plan', id], data);
      router.back();
    },
  });
  const copyPrevious = async () => {
    const prev = await api<TrainingPlan>(`/events/${plan.data!.previous!.eventId}/training-plan`);
    setFocus(prev.focus ?? '');
    setItems(
      (prev.items ?? []).map(({ exerciseId, title, minutes, note }) => ({
        exerciseId,
        title,
        minutes,
        note,
      })),
    );
  };

  if (plan.isPending) return <Loading />;
  if (plan.error) return <ErrorNotice error={plan.error} onRetry={() => plan.refetch()} />;
  const p = plan.data;
  const total = items.reduce((a, i) => a + i.minutes, 0);
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(Math.min(Math.max(i + d, 0), next.length), 0, x!);
    setItems(next);
  };

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Schwerpunkt"
          value={focus}
          onChangeText={setFocus}
          maxLength={120}
          placeholder="z. B. Gegenpressing"
        />
        {p.previous && items.length === 0 ? (
          <Button
            label={`Plan vom ${new Date(p.previous.startsAt).toLocaleDateString('de-DE')} übernehmen`}
            icon="copy-outline"
            variant="outline"
            onPress={() => void copyPrevious()}
          />
        ) : null}
      </Card>

      <Section title={`Ablauf · ${total} von ${p.eventMinutes} min`}>
        <Card>
          {items.length === 0 ? <T variant="caption">Noch keine Programmpunkte.</T> : null}
          {items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {item.title}
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Stepper
                    icon="remove"
                    label="Kürzer"
                    onPress={() =>
                      setItems(
                        items.map((x, j) =>
                          j === i ? { ...x, minutes: Math.max(1, x.minutes - 5) } : x,
                        ),
                      )
                    }
                  />
                  <T variant="label">{`${item.minutes} min`}</T>
                  <Stepper
                    icon="add"
                    label="Länger"
                    onPress={() =>
                      setItems(
                        items.map((x, j) =>
                          j === i ? { ...x, minutes: Math.min(120, x.minutes + 5) } : x,
                        ),
                      )
                    }
                  />
                </View>
              </View>
              <Stepper icon="arrow-up" label="Nach oben" onPress={() => move(i, -1)} />
              <Stepper icon="arrow-down" label="Nach unten" onPress={() => move(i, 1)} />
              <Stepper
                icon="trash-outline"
                label="Entfernen"
                onPress={() => setItems(items.filter((_, j) => j !== i))}
              />
            </View>
          ))}
        </Card>
        {picking ? (
          <Card>
            {(library.data ?? []).map((e, i) => (
              <ListRow
                key={e.id}
                first={i === 0}
                title={e.title}
                subtitle={`${CATEGORY_LABELS[e.category]} · ${e.durationMinutes} min${e.material ? ` · ${e.material}` : ''}`}
                onPress={() => {
                  setItems([
                    ...items,
                    { exerciseId: e.id, title: e.title, minutes: e.durationMinutes, note: null },
                  ]);
                  setPicking(false);
                }}
              />
            ))}
            <Button label="Schließen" variant="outline" onPress={() => setPicking(false)} />
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            <Button
              label="Übung aus der Bibliothek"
              icon="library-outline"
              variant="outline"
              onPress={() => setPicking(true)}
            />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Eigener Programmpunkt"
                  value={free}
                  onChangeText={setFree}
                  maxLength={80}
                />
              </View>
              <Button
                label="Hinzufügen"
                variant="outline"
                disabled={!free.trim()}
                onPress={() => {
                  setItems([
                    ...items,
                    { exerciseId: null, title: free.trim(), minutes: 10, note: null },
                  ]);
                  setFree('');
                }}
              />
            </View>
          </View>
        )}
      </Section>

      <Card style={{ gap: 8 }}>
        <TextField
          label="Notizen fürs Trainerteam"
          value={notes}
          onChangeText={setNotes}
          maxLength={2000}
          multiline
        />
        {total > p.eventMinutes ? (
          <Chip
            tone="action"
            icon="time-outline"
            label={`${total - p.eventMinutes} min länger als das Training`}
          />
        ) : null}
      </Card>
      {save.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={save.error instanceof RequestError ? save.error.message : 'Nicht gespeichert.'}
        />
      ) : null}
      <Button
        label="Plan speichern"
        icon="checkmark"
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      <T variant="caption">Spieler sehen den Schwerpunkt und das benötigte Material.</T>
    </Screen>
  );
}

function Stepper({
  icon,
  label,
  onPress,
}: {
  icon: 'add' | 'remove' | 'arrow-up' | 'arrow-down' | 'trash-outline';
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{ padding: 4 }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={icon === 'trash-outline' ? colors.onSurfaceMuted : colors.primaryText}
      />
    </Pressable>
  );
}
