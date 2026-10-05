import type { EventSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { EventRow } from '@/components/events';
import { Card, Empty, ErrorNotice, Loading, Screen } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

export default function TeamEventsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, me } = useSignedIn();
  const team = me.teams.find((t) => t.id === id);
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const list = (events.data ?? []).filter((e) => e.team?.id === id);
  return (
    <Screen edges={[]} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <Stack.Screen options={{ title: team ? `Termine ${team.badge}` : 'Termine' }} />
      {events.isPending ? <Loading /> : null}
      {events.error ? (
        <ErrorNotice message={events.error.message} onRetry={() => events.refetch()} />
      ) : null}
      {events.data ? (
        <Card>
          {list.length === 0 ? (
            <Empty icon="calendar-outline" text="Keine Termine in den nächsten 4 Wochen." />
          ) : null}
          {list.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
