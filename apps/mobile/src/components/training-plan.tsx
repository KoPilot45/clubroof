import type { EventDetail, TrainingPlan } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Chip, Section, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

/** Trainingsplan im Termin: Trainerteam sieht den Ablauf, Spieler Schwerpunkt und Material. */
export function TrainingPlanSection({ event }: { event: EventDetail }) {
  const { api, me } = useSignedIn();
  const enabled =
    event.type === 'training' &&
    !!event.team &&
    me.teams.some((t) => t.id === event.team!.id && t.modules.includes('training_planning'));
  const plan = useQuery({
    queryKey: ['training-plan', event.id],
    queryFn: () => api<TrainingPlan>(`/events/${event.id}/training-plan`),
    enabled,
  });
  const p = plan.data;
  if (!enabled || !p) return null;
  if (!p.canEdit && !p.focus && p.material.length === 0) return null;
  return (
    <Section title="Trainingsplan">
      <Card style={{ gap: 8 }}>
        {p.focus ? (
          <View style={{ gap: 2 }}>
            <T variant="overline">Schwerpunkt</T>
            <T variant="heading">{p.focus}</T>
          </View>
        ) : (
          <T variant="caption">Noch kein Plan für dieses Training.</T>
        )}
        {p.items?.length ? (
          <View style={{ gap: 4 }}>
            {p.items.map((i, n) => (
              <View key={n} style={{ flexDirection: 'row', gap: 8 }}>
                <T variant="label" style={{ width: 52 }}>{`${i.minutes} min`}</T>
                <T style={{ flex: 1 }}>{i.title}</T>
              </View>
            ))}
            <T variant="caption">{`${p.totalMinutes} von ${p.eventMinutes} Minuten verplant`}</T>
          </View>
        ) : null}
        {p.material.length ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {p.material.map((m) => (
              <Chip key={m} tone="neutral" icon="cube-outline" label={m} />
            ))}
          </View>
        ) : null}
        {p.canEdit ? (
          <Button
            label={p.updatedAt ? 'Plan bearbeiten' : 'Plan erstellen'}
            icon="create-outline"
            variant="outline"
            onPress={() => router.push(`/training-plan/${event.id}`)}
          />
        ) : null}
      </Card>
    </Section>
  );
}
