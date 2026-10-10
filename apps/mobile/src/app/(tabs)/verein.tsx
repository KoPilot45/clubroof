import type { EventSummary, HelperEvent, NewsItem, PollSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { NewsList } from '@/components/news';
import { TileCustomizeSheet, applyTilePrefs } from '@/components/tile-customizer';
import {
  Button,
  Card,
  Chip,
  Empty,
  HeroCard,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatDateTile, formatLongDate, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTileInfo, withTileInfo } from '@/lib/tile-info';
import { useTheme } from '@/lib/theme';

export default function ClubScreen() {
  const { api, me, refresh } = useSignedIn();
  const [customizing, setCustomizing] = useState(false);
  const tileInfo = useTileInfo('club');
  const has = (module: string) => me.clubModules.includes(module);
  const news = useQuery({ queryKey: ['news'], queryFn: () => api<NewsItem[]>('/news') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const polls = useQuery({
    queryKey: ['polls', 'all'],
    queryFn: () => api<PollSummary[]>('/polls'),
  });

  // Für den Hinweis auf den nächsten Vereinstermin weiter vorausschauen (wie „Veranstaltungen“)
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
    {
      key: 'news',
      tint: 'blue' as const,
      label: 'News',
      icon: 'newspaper',
      onPress: () => router.push('/news'),
    },
    ...(me.news.write || me.news.publish
      ? [
          {
            key: 'editorial',
            tint: 'violet' as const,
            label: 'News schreiben',
            icon: 'create' as const,
            onPress: () => router.push('/admin/news'),
          },
        ]
      : []),
    {
      key: 'events',
      tint: 'pink' as const,
      label: 'Veranstaltungen',
      icon: 'calendar',
      onPress: () => router.push('/club-events'),
    },
    ...(has('polls')
      ? [
          {
            key: 'polls',
            tint: 'blue' as const,
            label: 'Umfragen',
            icon: 'stats-chart' as const,
            badge: openPolls,
            onPress: () => router.push('/polls'),
          },
        ]
      : []),
    ...(has('forum')
      ? [
          {
            key: 'forum',
            tint: 'violet' as const,
            label: 'Forum',
            icon: 'chatbubbles' as const,
            onPress: () => router.push('/forum'),
          },
        ]
      : []),
    ...(has('lost_and_found') || has('marketplace')
      ? [
          {
            key: 'board',
            tint: 'orange' as const,
            label:
              has('lost_and_found') && has('marketplace')
                ? 'Fundbüro & Marktplatz'
                : has('marketplace')
                  ? 'Marktplatz'
                  : 'Fundbüro',
            icon: 'pricetags' as const,
            onPress: () => router.push('/board'),
          },
        ]
      : []),
    ...(has('equipment')
      ? [
          {
            key: 'equipment',
            tint: 'orange' as const,
            label: 'Anlage & Material',
            icon: 'construct' as const,
            onPress: () => router.push('/equipment'),
          },
        ]
      : []),
    ...(me.referees.manage || me.referees.active
      ? [
          {
            key: 'referees',
            tint: 'green' as const,
            label: 'Schiedsrichter',
            icon: 'flag' as const,
            onPress: () => router.push('/referees'),
          },
        ]
      : []),
    ...(has('wiki')
      ? [
          {
            key: 'wiki',
            tint: 'pink' as const,
            label: 'Vereinswissen',
            icon: 'book' as const,
            onPress: () => router.push('/wiki'),
          },
        ]
      : []),
    ...(has('helpers')
      ? [
          {
            key: 'helpers',
            tint: 'green' as const,
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
            tint: 'pink' as const,
            label: 'Dokumente',
            icon: 'folder-open' as const,
            onPress: () => router.push('/documents'),
          },
        ]
      : []),
    {
      key: 'teams',
      tint: 'green' as const,
      label: 'Mannschaften',
      icon: 'shirt',
      onPress: () => router.push('/club-teams'),
    },
    {
      key: 'contacts',
      tint: 'violet' as const,
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
            tint: 'blue' as const,
            label: 'Platzbelegung',
            icon: 'grid' as const,
            onPress: () => router.push('/facilities'),
          },
        ]
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
      {highlight ? <ClubEventHero event={highlight} /> : null}

      <Section title="Vereinsleben">
        <TileGrid
          items={[
            ...applyTilePrefs(withTileInfo(tiles, tileInfo), me.user.clubTiles),
            {
              key: 'customize',
              label: 'Anpassen',
              icon: 'options',
              tint: 'violet',
              onPress: () => setCustomizing(true),
            },
          ]}
        />
        <TileCustomizeSheet
          visible={customizing}
          onClose={() => setCustomizing(false)}
          tiles={withTileInfo(tiles, tileInfo)}
          prefs={me.user.clubTiles}
          onSaved={refresh}
        />
      </Section>

      <Section
        title="Heute auf der Anlage"
        action="Kalender anzeigen"
        onAction={() => router.push('/club-calendar')}
      >
        <Card>
          {today.isPending ? <Loading /> : null}
          {today.data?.length === 0 ? (
            <Empty icon="sunny-outline" text="Heute ist auf der Anlage nichts geplant." />
          ) : null}
          {today.data?.map((e, i) => (
            <ListRow
              key={e.id}
              first={i === 0}
              onPress={() => router.push(`/events/${e.id}`)}
              leading={
                <View style={{ width: 56 }}>
                  <T variant="figure" style={{ fontSize: 20 }}>
                    {formatTime(e.startsAt)}
                  </T>
                </View>
              }
              title={e.title}
              strike={e.status === 'cancelled'}
              subtitle={e.location ?? EVENT_TYPE_LABELS[e.type]}
              trailing={
                e.status === 'cancelled' ? (
                  <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
                ) : null
              }
            />
          ))}
        </Card>
      </Section>

      <Section title="Vereinsnews" action="Alle anzeigen" onAction={() => router.push('/news')}>
        {news.isPending ? <Loading /> : null}
        {news.data ? <NewsList items={news.data.slice(0, 3)} /> : null}
      </Section>
    </Screen>
  );
}

/** Blickfang „Nächster Vereinstermin“: Datumskachel, Titel, Zeit und Ort, „Mehr erfahren“. */
function ClubEventHero({ event }: { event: EventSummary }) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const tile = formatDateTile(event.startsAt);
  return (
    <HeroCard>
      <T variant="overline" color={on}>
        Nächster Vereinstermin
      </T>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View
          style={{
            width: 58,
            height: 62,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: on,
          }}
        >
          <T variant="caption" color={colors.hero.from} style={{ fontSize: 11, fontWeight: '700' }}>
            {tile.weekday}
          </T>
          <T variant="figure" color={colors.hero.from} style={{ fontSize: 26, lineHeight: 30 }}>
            {tile.day}
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T
            variant="headline"
            color={on}
            numberOfLines={2}
            style={{ fontSize: 22, lineHeight: 26 }}
          >
            {event.title}
          </T>
          <T variant="caption" color={on}>
            {[
              EVENT_TYPE_LABELS[event.type],
              `${formatLongDate(event.startsAt)}, ${formatTime(event.startsAt)} Uhr`,
              event.location,
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>
      </View>
      <Button
        label="Mehr erfahren"
        variant="hero"
        onPress={() => router.push(`/events/${event.id}`)}
      />
    </HeroCard>
  );
}
