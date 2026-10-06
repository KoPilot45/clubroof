import type { EventPlanning } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';

const TYPE = {
  club_event: 'Veranstaltung',
  meeting: 'Versammlung',
  work_assignment: 'Arbeitseinsatz',
};
const when = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function ClubEventsPlanningScreen() {
  const { api } = useSignedIn();
  const planning = useQuery({
    queryKey: ['admin', 'club-events'],
    queryFn: () => api<EventPlanning>('/admin/club-events'),
  });
  if (planning.isPending) return <Loading />;
  if (planning.error)
    return <ErrorNotice message={planning.error.message} onRetry={() => planning.refetch()} />;
  const p = planning.data;
  return (
    <Screen edges={[]} refreshing={planning.isRefetching} onRefresh={() => planning.refetch()}>
      <Button
        label="Veranstaltung planen"
        icon="add"
        onPress={() => router.push('/admin/club-event-new')}
      />
      <Section title="Geplant">
        <Card>
          {p.upcoming.length === 0 ? (
            <Empty icon="calendar-outline" text="Noch keine Veranstaltungen geplant." />
          ) : null}
          {p.upcoming.map((e, i) => {
            const open = e.shifts.reduce((a, x) => a + Math.max(0, x.capacity - x.filled), 0);
            return (
              <ListRow
                key={e.id}
                first={i === 0}
                onPress={() => router.push(`/events/${e.id}`)}
                title={e.title}
                subtitle={
                  <View style={{ gap: 4 }}>
                    <T variant="caption">
                      {`${TYPE[e.type]} · ${when.format(new Date(e.startsAt))} Uhr${e.location ? ` · ${e.location}` : ''}`}
                    </T>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <Chip tone="neutral" label={e.scopeLabel} />
                      {e.status === 'cancelled' ? <Chip tone="urgent" label="Abgesagt" /> : null}
                      {e.shifts.length ? (
                        <Chip
                          tone={open ? 'action' : 'success'}
                          label={open ? `${open} Helfer fehlen` : 'Helfer komplett'}
                        />
                      ) : null}
                    </View>
                  </View>
                }
              />
            );
          })}
        </Card>
      </Section>
    </Screen>
  );
}
