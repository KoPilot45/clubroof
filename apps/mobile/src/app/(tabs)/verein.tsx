import type { EventSummary, NewsItem, PollSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { NewsCard } from '@/components/news';
import {
  Button,
  Card,
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

  const clubEvents = (events.data ?? []).filter((e) => e.team === null && e.status === 'scheduled');
  const highlight = clubEvents.find((e) => e.type === 'club_event') ?? clubEvents[0];
  const openPolls = (polls.data ?? []).filter((p) => p.isOpen && !p.myOptionId).length;

  const tiles: TileItem[] = [
    { key: 'news', label: 'News', icon: 'newspaper', onPress: () => router.push('/news') },
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
      ? [{ key: 'helpers', label: 'Helfer gesucht', icon: 'hand-left' as const, soon: true }]
      : []),
    ...(has('documents')
      ? [{ key: 'docs', label: 'Dokumente', icon: 'folder-open' as const, soon: true }]
      : []),
    { key: 'teams', label: 'Mannschaften', icon: 'shirt', soon: true },
    { key: 'contacts', label: 'Ansprechpartner', icon: 'call', soon: true },
    ...(has('facility_booking')
      ? [{ key: 'pitch', label: 'Platzbelegung', icon: 'grid' as const, soon: true }]
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

      <Section title="Vereinsnews" action="Alle anzeigen" onAction={() => router.push('/news')}>
        {news.isPending ? <Loading /> : null}
        {news.data?.slice(0, 3).map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </Section>
    </Screen>
  );
}
