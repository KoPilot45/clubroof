import type { EventSummary, RefereeDuty } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow, FeaturedEventCard } from '@/components/events';
import { Columns } from '@/components/columns';
import { MonthCalendar, dayKey } from '@/components/month-calendar';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateTile,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { GridLegend } from '@/components/kind-legend';
import { formatDateTile, formatShortDate, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { dateFormat } from '@/lib/i18n';

const DAY = 24 * 60 * 60 * 1000;

/** Meine Termine: die nächsten drei und ein Monatskalender nach Terminart. */
export default function EventsTab() {
  const { api, me } = useSignedIn();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(dayKey(new Date()));
  // Kommend oder Vergangen (Paket VT): „Vergangen“ zeigt die letzten Termine, das Archiv alle
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
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

  const kindParam =
    filter === 'match'
      ? 'match'
      : filter === 'training'
        ? 'training'
        : filter === 'club'
          ? 'club'
          : '';
  const past = useQuery({
    queryKey: ['events', 'mine', 'past', kindParam],
    queryFn: () =>
      api<EventSummary[]>(
        `/events?before=${encodeURIComponent(new Date().toISOString())}&limit=40${kindParam ? `&kind=${kindParam}` : ''}`,
      ),
    enabled: when === 'past',
  });
  const monthEvents = useQuery({
    queryKey: ['events', 'mine', 'month', dayKey(month)],
    queryFn: () =>
      api<EventSummary[]>(
        `/events?from=${encodeURIComponent(month.toISOString())}&to=${encodeURIComponent(new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString())}`,
      ),
  });
  // Eigene Schiedsrichter-Einsätze (Verbandsspiele) stehen im Kalender der Person
  const duties = useQuery({
    queryKey: ['referee-duties', 'upcoming'],
    queryFn: () => {
      const from = new Date();
      const to = new Date(from.getTime() + 60 * DAY);
      return api<RefereeDuty[]>(
        `/referees/duties?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
    },
    enabled: me.referees.active,
  });
  const filtered = (upcoming.data ?? []).filter(matches);
  const pastList = (past.data ?? []).filter(matches).slice(0, 8);
  const hero = filtered.find((e) => e.status === 'scheduled');
  // Woche (Montag bis Sonntag) des nächsten Termins: Titel „Woche 12.10. – 18.10.“, Liste ohne Blickfang
  const weekStart = hero ? new Date(hero.startsAt) : null;
  if (weekStart) {
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  }
  const weekEnd = weekStart ? new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000) : null;
  const rest = filtered
    .filter((e) => e !== hero)
    .filter((e) => !weekEnd || new Date(e.startsAt) < weekEnd)
    .slice(0, 8);
  const weekTitle = weekStart
    ? `Woche ${formatShortDate(dayKey(weekStart))} – ${formatShortDate(dayKey(new Date(weekEnd!.getTime() - 1)))}`
    : 'Als Nächstes';
  const all = (monthEvents.data ?? []).filter(matches);
  const ofDay = all.filter((e) => day && dayKey(new Date(e.startsAt)) === day);
  const dutiesOfDay = (duties.data ?? []).filter(
    (d) => day && dayKey(new Date(d.startsAt)) === day,
  );
  const dayTitle = dateFormat({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: me.club.timezone,
  });

  const filters = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ChoiceChips
            options={[
              { value: 'upcoming', label: 'Kommend' },
              { value: 'past', label: 'Vergangen' },
            ]}
            selected={[when]}
            onToggle={setWhen}
          />
        </View>
        <Button
          label="Archiv"
          icon="archive-outline"
          variant="outline"
          size="sm"
          onPress={() => router.push('/events/archive')}
        />
      </View>
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
        tone="light"
        scroll
      />
    </>
  );
  const listBlock = (
    <>
      {when === 'upcoming' ? (
        <>
          {hero ? <FeaturedEventCard event={hero} /> : null}
          <Section title={weekTitle} action="Alle anzeigen" onAction={() => router.push('/events')}>
            {upcoming.isPending ? <Loading /> : null}
            {upcoming.error ? (
              <ErrorNotice error={upcoming.error} onRetry={() => upcoming.refetch()} />
            ) : null}
            {upcoming.data && filtered.length === 0 ? (
              <Empty icon="calendar-outline" text="Keine anstehenden Termine." />
            ) : null}
            {rest.length > 0 ? (
              <Card list>
                {rest.map((e, i) => (
                  <EventRow key={e.id} event={e} first={i === 0} />
                ))}
              </Card>
            ) : null}
          </Section>
        </>
      ) : (
        <Section title="Zuletzt" action="Archiv" onAction={() => router.push('/events/archive')}>
          {past.isPending ? <Loading /> : null}
          {past.error ? <ErrorNotice error={past.error} onRetry={() => past.refetch()} /> : null}
          {past.data && pastList.length === 0 ? (
            <Empty icon="time-outline" text="Keine vergangenen Termine." />
          ) : null}
          {pastList.length > 0 ? (
            <Card>
              {pastList.map((e, i) => (
                <EventRow key={e.id} event={e} first={i === 0} />
              ))}
            </Card>
          ) : null}
        </Section>
      )}

      {(duties.data ?? []).length > 0 ? (
        <Section title="Schiedsrichter" action="Alle" onAction={() => router.push('/referees')}>
          <Card>
            {duties.data!.slice(0, 3).map((d, i) => (
              <DutyRow key={d.id} duty={d} first={i === 0} />
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
  const calendarBlock = (
    <>
      <Section title="Kalender">
        <Card style={{ gap: 10 }}>
          <MonthCalendar
            variant="grid"
            month={month}
            events={all}
            selected={day}
            onSelect={setDay}
            onMonth={(delta) => {
              setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
              setDay(null);
            }}
            onToday={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setDay(dayKey(now));
            }}
          />
          <GridLegend cancelled={all.some((e) => e.status === 'cancelled')} />
        </Card>
      </Section>

      {day ? (
        <Section title={dayTitle.format(new Date(`${day}T12:00:00`))}>
          <Card>
            {ofDay.length === 0 && dutiesOfDay.length === 0 ? (
              <T variant="caption">Keine Termine an diesem Tag.</T>
            ) : null}
            {ofDay.map((e, i) => (
              <EventRow key={e.id} event={e} first={i === 0} />
            ))}
            {dutiesOfDay.map((d, i) => (
              <DutyRow key={d.id} duty={d} first={ofDay.length === 0 && i === 0} />
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
  const refresh = () => {
    void upcoming.refetch();
    void monthEvents.refetch();
    if (when === 'past') void past.refetch();
  };
  const header = <AppHeader title="Termine" subtitle="Alles auf einen Blick" />;

  return (
    <Screen
      header={header}
      refreshing={upcoming.isRefetching || monthEvents.isRefetching}
      onRefresh={refresh}
    >
      {filters}
      {/* Desktop (Paket DT): ein Scrollbereich; Liste links, Kalender und Tag rechts */}
      <Columns min={460} weights={[1.15, 1]}>
        <View style={{ gap: 18 }}>{listBlock}</View>
        <View style={{ gap: 18 }}>{calendarBlock}</View>
      </Columns>
    </Screen>
  );
}

/** Schiedsrichter-Einsatz in der Terminliste (öffnet „Schiedsrichter“). */
function DutyRow({ duty, first }: { duty: RefereeDuty; first?: boolean }) {
  return (
    <ListRow
      first={first}
      onPress={() => router.push('/referees')}
      leading={<DateTile {...formatDateTile(duty.startsAt)} />}
      title={duty.title}
      subtitle={[formatTime(duty.startsAt), duty.location].filter(Boolean).join(' · ')}
      trailing={<Chip tone="info" icon="flag" label="Schiedsrichter" />}
    />
  );
}
