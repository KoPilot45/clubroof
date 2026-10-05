import type { EventSummary, HelperEvent, NewsItem, PollSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow } from '@/components/events';
import { NewsCard } from '@/components/news';
import {
  Button,
  Card,
  Empty,
  IconTile,
  Loading,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatLongDate, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';

export default function ClubScreen() {
  const { api, me } = useSignedIn();
  const has = (module: string) => me.clubModules.includes(module);
  const news = useQuery({ queryKey: ['news'], queryFn: () => api<NewsItem[]>('/news') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const polls = useQuery({
    queryKey: ['polls', 'all'],
    queryFn: () => api<PollSummary[]>('/polls'),
  });

  // Für den Hinweis auf den nächsten Vereinstermin weiter vorausschauen (wie „Termine & Veranstaltungen“)
  const upcomingClub = useQuery({
    queryKey: ['events', 'club'],
    queryFn: () => {
      const from = new Date();
      const to = new Date(from.getTime() + 100 * 24 * 60 * 60 * 1000);
      return api<EventSummary[]>(
        `/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
    },
  });
  const clubEvents = (upcomingClub.data ?? []).filter(
    (e) => e.team === null && e.status === 'scheduled',
  );
  const highlight = clubEvents.find((e) => e.type === 'club_event') ?? clubEvents[0];
  const openPolls = (polls.data ?? []).filter((p) => p.isOpen && !p.myOptionId).length;
  const helpers = useQuery({
    queryKey: ['helpers'],
    queryFn: () => api<HelperEvent[]>('/helpers'),
  });
  const openSpots = (helpers.data ?? []).reduce((sum, h) => sum + h.openSpots, 0);
  const today = useQuery({
    queryKey: ['club-today'],
    queryFn: () => api<EventSummary[]>('/club/today'),
  });

  const tiles: TileItem[] = [
    { key: 'news', label: 'News', icon: 'newspaper', onPress: () => router.push('/news') },
    ...(me.news.write || me.news.publish
      ? [
          {
            key: 'editorial',
            label: 'News schreiben',
            icon: 'create' as const,
            onPress: () => router.push('/admin/news'),
          },
        ]
      : []),
    {
      key: 'events',
      label: 'Termine & Veranstaltungen',
      icon: 'calendar',
      onPress: () => router.push('/club-events'),
    },
    ...(has('polls')
      ? [
          {
            key: 'polls',
            label: 'Umfragen',
            icon: 'stats-chart' as const,
            badge: openPolls,
            onPress: () => router.push('/polls'),
          },
        ]
      : []),
    ...(has('helpers')
      ? [
          {
            key: 'helpers',
            label: 'Helfer gesucht',
            icon: 'hand-left' as const,
            badge: openSpots || undefined,
            onPress: () => router.push('/helpers'),
          },
        ]
      : []),
    ...(has('documents')
      ? [
          {
            key: 'docs',
            label: 'Dokumente',
            icon: 'folder-open' as const,
            onPress: () => router.push('/documents'),
          },
        ]
      : []),
    {
      key: 'teams',
      label: 'Mannschaften',
      icon: 'shirt',
      onPress: () => router.push('/club-teams'),
    },
    {
      key: 'contacts',
      label: 'Ansprechpartner',
      icon: 'call',
      onPress: () => router.push('/contacts'),
    },
    ...(has('facility_booking') &&
    (me.canAdminister ||
      me.teams.some((t) => t.functions.some((f) => f === 'coach' || f === 'assistant_coach')))
      ? [
          {
            key: 'pitch',
            label: 'Platzbelegung',
            icon: 'grid' as const,
            onPress: () => router.push('/facilities'),
          },
        ]
      : []),
    ...(has('forum')
      ? [{ key: 'forum', label: 'Austausch', icon: 'chatbubbles' as const, soon: true }]
      : []),
  ];

  return (
    <Screen
      header={<AppHeader title="Verein" subtitle="Das Vereinsleben auf einen Blick" />}
      refreshing={news.isRefetching}
      onRefresh={() => {
        void news.refetch();
        void events.refetch();
        void polls.refetch();
        void helpers.refetch();
        void today.refetch();
      }}
    >
      {highlight ? (
        <Card style={{ gap: 10 }}>
          <T variant="overline">Nächster Vereinstermin</T>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <IconTile name="calendar" filled />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="title">{highlight.title}</T>
              <T variant="caption">
                {EVENT_TYPE_LABELS[highlight.type]} · {formatLongDate(highlight.startsAt)},{' '}
                {formatTime(highlight.startsAt)} Uhr
                {highlight.location ? ` · ${highlight.location}` : ''}
              </T>
            </View>
          </View>
          <Button
            label="Mehr erfahren"
            variant="outline"
            onPress={() => router.push(`/events/${highlight.id}`)}
          />
        </Card>
      ) : null}

      <TileGrid items={tiles} />

      <Section title="Heute auf der Anlage">
        <Card>
          {today.isPending ? <Loading /> : null}
          {today.data?.length === 0 ? (
            <Empty icon="sunny-outline" text="Heute ist auf der Anlage nichts geplant." />
          ) : null}
          {today.data?.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} />
          ))}
        </Card>
      </Section>

      <Section title="Vereinsnews" action="Alle anzeigen" onAction={() => router.push('/news')}>
        {news.isPending ? <Loading /> : null}
        {news.data?.slice(0, 3).map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </Section>
    </Screen>
  );
}
