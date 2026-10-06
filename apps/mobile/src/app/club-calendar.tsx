import type { ClubCalendarEvent } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EventRow } from '@/components/events';
import { KindLegend } from '@/components/kind-legend';
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
import { EVENT_KIND_LABELS, kindColor, kindOf, type EventKind } from '@/lib/event-types';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const DAY = 24 * 60 * 60 * 1000;
const dayTitle = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Vereinskalender: alle Termine des Vereins – Trainings und Spiele aller Mannschaften,
 * Veranstaltungen, Sitzungen. Fremde Mannschaftstermine sind nur zur Ansicht (ohne Zusagen).
 */
export default function ClubCalendarScreen() {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [kind, setKind] = useState<EventKind | 'all'>('all');
  const [teamId, setTeamId] = useState<string>('all');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(dayKey(new Date()));

  // Monat: ganzer Kalendermonat; Liste: die nächsten 60 Tage
  const key = view === 'list' ? 'list' : dayKey(month);
  const events = useQuery({
    queryKey: ['club-calendar', key],
    queryFn: () => {
      const from = view === 'list' ? new Date(new Date().setHours(0, 0, 0, 0)) : month;
      const to =
        view === 'list'
          ? new Date(from.getTime() + 60 * DAY)
          : new Date(month.getFullYear(), month.getMonth() + 1, 1);
      return api<ClubCalendarEvent[]>(
        `/club/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
    },
  });
  const all = events.data ?? [];
  const teams = [
    ...new Map(
      all.filter((c) => c.event.team).map((c) => [c.event.team!.id, c.event.team!]),
    ).values(),
  ].sort((a, b) => a.badge.localeCompare(b.badge, 'de', { numeric: true }));
  const list = all.filter(
    (c) =>
      (kind === 'all' || kindOf(c.event) === kind) &&
      (teamId === 'all' || c.event.team?.id === teamId),
  );
  const kinds = [...new Set(all.map((c) => kindOf(c.event)))];
  const ofDay = list.filter((c) => day && dayKey(new Date(c.event.startsAt)) === day);
  const openable = new Map(all.map((c) => [c.event.id, c.canOpen]));

  // Liste: nach Tagen gruppieren
  const days = [...new Set(list.map((c) => dayKey(new Date(c.event.startsAt))))];

  return (
    <Screen edges={[]} refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      <ChoiceChips
        options={[
          { value: 'month', label: 'Monat', icon: 'calendar' },
          { value: 'list', label: 'Liste', icon: 'list' },
        ]}
        selected={[view]}
        onToggle={setView}
      />
      <ChoiceChips
        options={[
          { value: 'all' as const, label: 'Alle Arten' },
          ...kinds.map((k) => ({ value: k, label: EVENT_KIND_LABELS[k] })),
        ]}
        selected={[kind]}
        onToggle={setKind}
      />
      {teams.length > 1 ? (
        <ChoiceChips
          options={[
            { value: 'all', label: 'Alle Mannschaften' },
            ...teams.map((t) => ({ value: t.id, label: t.badge })),
          ]}
          selected={[teamId]}
          onToggle={setTeamId}
        />
      ) : null}
      {events.isPending ? <Loading /> : null}
      {events.error ? <ErrorNotice error={events.error} onRetry={() => events.refetch()} /> : null}

      {events.data && view === 'month' ? (
        <>
          <Card style={{ gap: 12 }}>
            <MonthCalendar
              month={month}
              events={list.map((c) => c.event)}
              selected={day}
              onSelect={setDay}
              onMonth={(delta) => {
                setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
                setDay(null);
              }}
              colorOf={(e) => kindColor(kindOf(e), colors)}
            />
            {kinds.length ? <KindLegend kinds={kinds} /> : null}
          </Card>
          {day ? (
            <Section title={dayTitle.format(new Date(`${day}T12:00:00`))}>
              <Card>
                {ofDay.length === 0 ? <T variant="caption">Keine Termine an diesem Tag.</T> : null}
                {ofDay.map((c, i) => (
                  <EventRow key={c.event.id} event={c.event} first={i === 0} openable={c.canOpen} />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}

      {events.data && view === 'list' ? (
        <>
          {list.length === 0 ? (
            <Card>
              <Empty icon="calendar-outline" text="Keine Termine in den nächsten 60 Tagen." />
            </Card>
          ) : null}
          {days.map((d) => (
            <Section key={d} title={dayTitle.format(new Date(`${d}T12:00:00`))}>
              <Card>
                {list
                  .filter((c) => dayKey(new Date(c.event.startsAt)) === d)
                  .map((c, i) => (
                    <EventRow
                      key={c.event.id}
                      event={c.event}
                      first={i === 0}
                      openable={openable.get(c.event.id)}
                    />
                  ))}
              </Card>
            </Section>
          ))}
        </>
      ) : null}
      <T variant="caption">
        {me.club.shortName}: Alle Termine des Vereins. Zu- und Absagen anderer Mannschaften siehst
        du nicht; Termine deiner eigenen Mannschaften öffnest du mit einem Tipp.
      </T>
    </Screen>
  );
}
