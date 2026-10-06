import type { EventSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EventRow } from '@/components/events';
import { Card, ChoiceChips, Empty, ErrorNotice, Loading, Screen, Section } from '@/components/ui';
import { EVENT_KIND_LABELS, kindOf, type EventKind } from '@/lib/event-types';
import { useSignedIn } from '@/lib/session';

const DAY = 24 * 60 * 60 * 1000;

/** Alle eigenen Termine der nächsten Wochen, nach Woche gruppiert und nach Art filterbar. */
export default function AllEventsScreen() {
  const { api, me } = useSignedIn();
  const [filter, setFilter] = useState<EventKind | 'all'>('all');
  const events = useQuery({
    queryKey: ['events', 'mine', 'all'],
    queryFn: () => {
      const from = new Date();
      const to = new Date(from.getTime() + 90 * DAY);
      return api<EventSummary[]>(
        `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
    },
  });
  if (events.isPending) return <Loading />;
  if (events.error)
    return <ErrorNotice message={events.error.message} onRetry={() => events.refetch()} />;
  const list = events.data.filter((e) => filter === 'all' || kindOf(e) === filter);
  const kinds = [...new Set(events.data.map(kindOf))];
  // Nach Kalenderwoche (Montag) gruppieren
  const weekOf = (iso: string) => {
    const d = new Date(iso);
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return monday.toISOString();
  };
  const weeks = [...new Set(list.map((e) => weekOf(e.startsAt)))];
  const label = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: me.club.timezone,
  });
  return (
    <Screen edges={[]} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <ChoiceChips
        options={[
          { value: 'all' as const, label: 'Alle' },
          ...kinds.map((k) => ({ value: k, label: EVENT_KIND_LABELS[k] })),
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />
      {list.length === 0 ? (
        <Card>
          <Empty icon="calendar-outline" text="Keine Termine in den nächsten Wochen." />
        </Card>
      ) : null}
      {weeks.map((w) => {
        const start = new Date(w);
        const end = new Date(start.getTime() + 6 * DAY);
        const inWeek = list.filter((e) => weekOf(e.startsAt) === w);
        return (
          <Section key={w} title={`Woche ${label.format(start)} – ${label.format(end)}`}>
            <Card>
              {inWeek.map((e, i) => (
                <EventRow key={e.id} event={e} first={i === 0} />
              ))}
            </Card>
          </Section>
        );
      })}
    </Screen>
  );
}
