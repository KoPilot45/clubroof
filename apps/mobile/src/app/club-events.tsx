import type { EventSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { EventRow } from '@/components/events';
import { Card, Empty, ErrorNotice, Loading, Screen } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

export default function ClubEventsScreen() {
  const { api } = useSignedIn();
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const list = (events.data ?? []).filter((e) => e.team === null);
  return (
    <Screen edges={[]} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      {events.isPending ? <Loading /> : null}
      {events.error ? (
        <ErrorNotice message={events.error.message} onRetry={() => events.refetch()} />
      ) : null}
      {events.data ? (
        <Card>
          {list.length === 0 ? (
            <Empty icon="calendar-outline" text="Keine Vereinstermine in den nächsten Wochen." />
          ) : null}
          {list.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
