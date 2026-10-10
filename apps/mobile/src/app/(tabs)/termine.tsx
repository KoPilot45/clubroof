import type { EventSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { EventRow, FeaturedEventCard } from '@/components/events';
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
import { KindLegend } from '@/components/kind-legend';
import { kindColor, kindOf } from '@/lib/event-types';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { dateFormat } from '@/lib/i18n';

const DAY = 24 * 60 * 60 * 1000;

/** Meine Termine: die nächsten drei und ein Monatskalender nach Terminart. */
export default function EventsTab() {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  const upcoming = useQuery({
    queryKey: ['events', 'mine', 'upcoming'],
    queryFn: () => {
      const from = new Date();
      const to = new Date(from.getTime() + 60 * DAY);
      return api<EventSummary[]>(
        `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
    },
  });
  const monthEvents = useQuery({
    queryKey: ['events', 'mine', 'month', dayKey(month)],
    queryFn: () =>
      api<EventSummary[]>(
        `/events?from=${encodeURIComponent(month.toISOString())}&to=${encodeURIComponent(new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString())}`,
      ),
  });
  // Filter: Alle, je Kind, Spiele, Training, Verein
  const children = me.managedPersons.filter((p) => p.relation === 'child');
  const [filter, setFilter] = useState('all');
  const matches = (e: EventSummary) =>
    filter === 'all'
      ? true
      : filter === 'match'
        ? e.type === 'match' || e.type === 'tournament'
        : filter === 'training'
          ? e.type === 'training'
          : filter === 'club'
            ? e.team === null
            : e.myResponses.some((r) => r.personId === filter.slice(2));
  const filtered = (upcoming.data ?? []).filter(matches);
  const hero = filtered.find((e) => e.status === 'scheduled');
  const rest = filtered.filter((e) => e !== hero).slice(0, 5);
  const all = (monthEvents.data ?? []).filter(matches);
  const ofDay = all.filter((e) => day && dayKey(new Date(e.startsAt)) === day);
  const kinds = [...new Set(all.filter((e) => e.status !== 'cancelled').map(kindOf))];
  const dayTitle = dateFormat({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: me.club.timezone,
  });

  return (
    <Screen
      header={<AppHeader title="Termine" subtitle="Alles auf einen Blick" />}
      refreshing={upcoming.isRefetching || monthEvents.isRefetching}
      onRefresh={() => {
        void upcoming.refetch();
        void monthEvents.refetch();
      }}
    >
      <ChoiceChips
        options={[
          { value: 'all', label: 'Alle' },
          ...children.map((c) => ({ value: 'p:' + c.id, label: c.firstName })),
          { value: 'match', label: 'Spiele' },
          { value: 'training', label: 'Training' },
          { value: 'club', label: 'Verein' },
        ]}
        selected={[filter]}
        onToggle={setFilter}
      />

      <Section title="Als Nächstes" action="Alle anzeigen" onAction={() => router.push('/events')}>
        {hero ? <FeaturedEventCard event={hero} /> : null}
        {upcoming.isPending ? <Loading /> : null}
        {upcoming.error ? (
          <ErrorNotice error={upcoming.error} onRetry={() => upcoming.refetch()} />
        ) : null}
        {upcoming.data && filtered.length === 0 ? (
          <Empty icon="calendar-outline" text="Keine anstehenden Termine." />
        ) : null}
        {rest.length > 0 ? (
          <Card>
            {rest.map((e, i) => (
              <EventRow key={e.id} event={e} first={i === 0} />
            ))}
          </Card>
        ) : null}
      </Section>

      <Section title="Kalender">
        <Card style={{ gap: 10 }}>
          <MonthCalendar
            month={month}
            events={all}
            selected={day}
            onSelect={setDay}
            colorOf={(e) => kindColor(kindOf(e), colors)}
            onMonth={(delta) => {
              setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
              setDay(null);
            }}
          />
          {kinds.length || all.some((e) => e.status === 'cancelled') ? (
            <KindLegend kinds={kinds} cancelled={all.some((e) => e.status === 'cancelled')} />
          ) : null}
        </Card>
      </Section>

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
    </Screen>
  );
}
