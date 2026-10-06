import type { EventSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EventRow } from '@/components/events';
import { MonthCalendar, dayKey } from '@/components/month-calendar';
import {
  Card,
  ChoiceChips,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { dateFormat } from '@/lib/i18n';

const dayTitle = dateFormat({
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default function ClubEventsScreen() {
  const { api } = useSignedIn();
  const [view, setView] = useState<'list' | 'month'>('list');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(dayKey(new Date()));

  // Liste: Vereinstermine weit im Voraus (z. B. Weihnachtsfeier); Monat: ganzer Kalendermonat
  const monthKey = dayKey(month);
  const events = useQuery({
    queryKey: ['events', 'club', view === 'list' ? 'list' : monthKey],
    queryFn: () => {
      const from = view === 'list' ? new Date() : month;
      const to =
        view === 'list'
          ? new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
          : new Date(month.getFullYear(), month.getMonth() + 1, 1);
      return api<EventSummary[]>(
        `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
    },
  });
  const all = events.data ?? [];
  const list = all.filter((e) => e.team === null);
  const ofDay = list.filter((e) => day && dayKey(new Date(e.startsAt)) === day);

  return (
    <Screen edges={[]} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <ChoiceChips
        options={[
          { value: 'list', label: 'Liste', icon: 'list' },
          { value: 'month', label: 'Monat', icon: 'calendar' },
        ]}
        selected={[view]}
        onToggle={setView}
      />
      <T variant="caption">
        Veranstaltungen und Sitzungen des Vereins. Deine Trainings und Spiele findest du unter
        „Termine“.
      </T>
      {events.isPending ? <Loading /> : null}
      {events.error ? <ErrorNotice error={events.error} onRetry={() => events.refetch()} /> : null}
      {events.data && view === 'list' ? (
        <Card>
          {list.length === 0 ? (
            <Empty icon="calendar-outline" text="Keine Vereinstermine in den nächsten Wochen." />
          ) : null}
          {list.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} />
          ))}
        </Card>
      ) : null}
      {view === 'month' ? (
        <>
          <Card>
            <MonthCalendar
              month={month}
              events={list}
              selected={day}
              onSelect={setDay}
              onMonth={(delta) => {
                setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
                setDay(null);
              }}
            />
          </Card>
          {day ? (
            <Section title={dayTitle.format(new Date(`${day}T12:00:00`))}>
              <Card>
                {ofDay.length === 0 ? <T variant="caption">Keine Termine an diesem Tag.</T> : null}
                {ofDay.map((e, i) => (
                  <EventRow key={e.id} event={e} first={i === 0} />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
