import { View } from 'react-native';
import type { ClubSeason, EventSummary } from '@clubroof/core';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { EventRow } from '@/components/events';
import {
  Button,
  Card,
  ChoiceChips,
  DateStepper,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { clubDayMinutes, formatShortDate, todayIso } from '@/lib/format';
import { dateFormat, t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

const PAGE = 30;
const DAY = 86_400_000;
type Period = 'all' | 'week' | 'month' | 'season' | 'lastSeason' | 'custom';

const monthName = dateFormat({ month: 'long', year: 'numeric', timeZone: 'UTC' });
const addDays = (iso: string, days: number) =>
  new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);

/** Überschrift des Blocks: Wochen bis acht Wochen zurück („05.10. – 11.10.“), davor Monate. */
function blockOf(startsAt: string, now: Date): { key: string; title: string } {
  const day = clubDayMinutes(startsAt).day;
  const date = new Date(`${day}T12:00:00Z`);
  if (now.getTime() - date.getTime() < 56 * DAY) {
    const monday = addDays(day, -((date.getUTCDay() + 6) % 7));
    return {
      key: `w${monday}`,
      title: `Woche ${formatShortDate(monday)} – ${formatShortDate(addDays(monday, 6))}`,
    };
  }
  return { key: `m${day.slice(0, 7)}`, title: monthName.format(date) };
}

/** Archiv: alle vergangenen Termine, neueste zuerst, mit Filtern; lädt beim Scrollen nach. */
export default function ArchiveScreen() {
  const { api, me } = useSignedIn();
  const [period, setPeriod] = useState<Period>('all');
  const [teamId, setTeamId] = useState('all');
  const [kind, setKind] = useState<'all' | 'match' | 'training' | 'club'>('all');
  const [from, setFrom] = useState(() => addDays(todayIso(), -30));
  const [to, setTo] = useState(() => todayIso());

  const seasons = useQuery({
    queryKey: ['events', 'seasons'],
    queryFn: () => api<ClubSeason[]>('/events/seasons'),
  });
  const current = seasons.data?.find((s) => s.isCurrent) ?? seasons.data?.[0];
  const last = seasons.data?.find((s) => s.id !== current?.id);
  const teams = useMemo(() => [...new Map(me.teams.map((x) => [x.id, x])).values()], [me.teams]);

  // Zeitraum als Grenzen: `after` inklusive, `before` exklusiv
  const range = useMemo<{ after?: string; before?: string }>(() => {
    const today = todayIso();
    switch (period) {
      case 'week':
        return { after: `${addDays(today, -7)}T00:00:00Z` };
      case 'month':
        return { after: `${addDays(today, -30)}T00:00:00Z` };
      case 'season':
        return current ? { after: `${current.startsOn}T00:00:00Z` } : {};
      case 'lastSeason':
        return last
          ? { after: `${last.startsOn}T00:00:00Z`, before: `${addDays(last.endsOn, 1)}T00:00:00Z` }
          : {};
      case 'custom':
        return { after: `${from}T00:00:00Z`, before: `${addDays(to, 1)}T00:00:00Z` };
      default:
        return {};
    }
  }, [period, current, last, from, to]);

  const query = useInfiniteQuery({
    queryKey: ['events', 'archive', range, teamId, kind],
    initialPageParam: range.before ?? new Date().toISOString(),
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ before: pageParam, limit: String(PAGE) });
      if (range.after) q.set('after', range.after);
      if (teamId !== 'all') q.set('teamId', teamId);
      if (kind !== 'all') q.set('kind', kind);
      return api<EventSummary[]>(`/events?${q.toString()}`);
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE ? lastPage[lastPage.length - 1]!.startsAt : undefined,
  });
  const events = (query.data?.pages ?? []).flat();
  const now = new Date();
  const blocks: { key: string; title: string; items: EventSummary[] }[] = [];
  for (const e of events) {
    const b = blockOf(e.startsAt, now);
    const block = blocks.find((x) => x.key === b.key);
    if (block) block.items.push(e);
    else blocks.push({ ...b, items: [e] });
  }
  const more = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };

  return (
    <Screen
      edges={[]}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReached={more}
    >
      <Card style={{ gap: 12 }}>
        <T variant="overline">Zeitraum</T>
        <ChoiceChips
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'week', label: 'Letzte 7 Tage' },
            { value: 'month', label: 'Letzter Monat' },
            { value: 'season', label: 'Diese Saison' },
            ...(last ? [{ value: 'lastSeason' as const, label: 'Letzte Saison' }] : []),
            { value: 'custom', label: 'Eigener Zeitraum' },
          ]}
          selected={[period]}
          onToggle={setPeriod}
        />
        {period === 'custom' ? (
          <>
            <DateStepper label="Von" value={from} onChange={setFrom} max={to} />
            <DateStepper label="Bis" value={to} onChange={setTo} min={from} max={todayIso()} />
          </>
        ) : null}
        {teams.length > 1 ? (
          <>
            <T variant="overline">Mannschaft</T>
            <ChoiceChips
              options={[
                { value: 'all', label: 'Alle' },
                ...teams.map((x) => ({ value: x.id, label: x.badge })),
              ]}
              selected={[teamId]}
              onToggle={setTeamId}
            />
          </>
        ) : null}
        <T variant="overline">Art</T>
        <ChoiceChips
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'match', label: 'Spiele' },
            { value: 'training', label: 'Training' },
            { value: 'club', label: 'Verein' },
          ]}
          selected={[kind]}
          onToggle={setKind}
        />
      </Card>

      {query.isPending ? <Loading /> : null}
      {query.error ? <ErrorNotice error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data && events.length === 0 ? (
        <Empty icon="archive-outline" text="Keine vergangenen Termine für diese Auswahl." />
      ) : null}
      {blocks.map((b) => (
        <Section key={b.key} title={b.title}>
          <View style={{ gap: 10 }}>
            {b.items.map((e, i) => (
              <EventRow key={e.id} event={e} first={i === 0} />
            ))}
          </View>
        </Section>
      ))}
      {query.isFetchingNextPage ? <Loading /> : null}
      {query.hasNextPage && !query.isFetchingNextPage ? (
        <Button label="Ältere Termine laden" variant="outline" icon="chevron-down" onPress={more} />
      ) : null}
      {events.length > 0 && !query.hasNextPage ? (
        <T variant="caption" style={{ textAlign: 'center' }}>
          {t('Das sind alle Termine.')}
        </T>
      ) : null}
    </Screen>
  );
}
