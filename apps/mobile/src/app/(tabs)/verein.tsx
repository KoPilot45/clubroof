import type { EventSummary, HelperEvent, NewsItem, PollSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { ClubNewsTicker } from '@/components/club-news-ticker';
import {
  SponsorAdContainer,
  useHasSponsorAds,
  useRefreshSponsorAds,
} from '@/components/sponsor-ads';
import type { TintKey } from '@clubroof/design-tokens';
import { adminFunctionTiles } from '@/lib/admin-tiles';
import { canSeeCashOverview } from '@/lib/areas';
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
  const { api, me } = useSignedIn();
  const tileInfo = useTileInfo('club');
  const has = (module: string) => me.clubModules.includes(module);
  const hasAds = useHasSponsorAds();
  const refreshAds = useRefreshSponsorAds();
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

  // Kacheln in Kategorien (Paket MS): Veranstaltungen, Neuigkeiten, Vereinsleben, Verwaltung
  type Group = { key: string; title: string; tint: TintKey; tiles: TileItem[] };
  const eventTiles: TileItem[] = [
    {
      key: 'events',
      label: 'Veranstaltungen',
      icon: 'calendar',
      onPress: () => router.push('/club-events'),
    },
    {
      key: 'schedule',
      label: 'Spielplan',
      icon: 'football',
      onPress: () => router.push('/club-schedule'),
    },
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
  ];
  const newsTiles: TileItem[] = [
    {
      key: 'news',
      label: 'News',
      icon: 'newspaper',
      onPress: () => router.push('/news'),
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
    ...(has('forum')
      ? [
          {
            key: 'forum',
            label: 'Forum',
            icon: 'chatbubbles' as const,
            onPress: () => router.push('/forum'),
          },
        ]
      : []),
  ];
  const life: TileItem[] = [
    {
      key: 'teams',
      label: 'Mannschaften',
      icon: 'shirt',
      onPress: () => router.push('/club-teams'),
    },
    ...(has('club_cash')
      ? [
          {
            key: 'expense-claims',
            label: 'Auslage einreichen',
            icon: 'receipt' as const,
            onPress: () => router.push('/expense-claims'),
          },
        ]
      : []),
    ...(canSeeCashOverview(me)
      ? [
          {
            key: 'cash-overview',
            label: 'Kassenübersicht',
            icon: 'analytics' as const,
            onPress: () => router.push('/club-cash-overview'),
          },
        ]
      : []),
    {
      key: 'contacts',
      label: 'Ansprechpartner',
      icon: 'call',
      onPress: () => router.push('/contacts'),
    },
    ...(has('wiki')
      ? [
          {
            key: 'wiki',
            label: 'Vereinswissen',
            icon: 'book' as const,
            onPress: () => router.push('/wiki'),
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
    ...(has('equipment')
      ? [
          {
            key: 'equipment',
            label: 'Anlage & Material',
            icon: 'construct' as const,
            onPress: () => router.push('/equipment'),
          },
        ]
      : []),
    ...(has('lost_and_found') || has('marketplace')
      ? [
          {
            key: 'board',
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
    ...(has('sponsors')
      ? [
          {
            key: 'sponsors',
            label: 'Sponsoren',
            icon: 'heart' as const,
            onPress: () => router.push('/sponsors'),
          },
        ]
      : []),
  ];
  const groups: Group[] = [
    { key: 'events', title: 'Veranstaltungen', tint: 'orange', tiles: eventTiles },
    { key: 'news', title: 'Neuigkeiten', tint: 'pink', tiles: newsTiles },
    { key: 'life', title: 'Vereinsleben', tint: 'blue', tiles: life },
    // Verwaltung: alle ausführbaren Funktionen der Rolle, ohne Einklappen; ohne Rechte entfällt sie
    { key: 'admin', title: 'Verwaltung', tint: 'violet', tiles: adminFunctionTiles(me) },
  ];
  // „Kacheln anpassen“ entfällt (Paket PO): alle Kacheln der Rolle stehen in ihren Kategorien
  const shown = withTileInfo(
    groups.flatMap((g) => g.tiles),
    tileInfo,
  );

  return (
    <Screen
      header={<AppHeader title="Verein" subtitle="Dein Vereinsleben" />}
      refreshing={news.isRefetching}
      onRefresh={() => {
        refreshAds();
        void news.refetch();
        void events.refetch();
        void polls.refetch();
        void helpers.refetch();
        void today.refetch();
      }}
    >
      {highlight ? <ClubEventHero event={highlight} /> : null}

      {news.data && news.data.length > 0 ? <ClubNewsTicker items={news.data} /> : null}
      {news.isPending ? <Loading /> : null}
      {hasAds ? <SponsorAdContainer /> : null}

      {groups.map((g) => {
        const items = shown
          .filter((t) => g.tiles.some((x) => x.key === t.key))
          .map((t) => ({ ...t, tint: g.tint }));
        if (items.length === 0) return null;
        return (
          <Section key={g.key} title={g.title}>
            <TileGrid items={items} />
          </Section>
        );
      })}

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
            width: 62,
            borderRadius: 16,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.2)',
          }}
        >
          <T variant="caption" color={on} style={{ fontSize: 11, fontWeight: '800' }}>
            {tile.weekday}
          </T>
          <T variant="figure" color={on} style={{ fontSize: 34, lineHeight: 34 }}>
            {tile.day}
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T
            variant="headline"
            color={on}
            numberOfLines={2}
            style={{ fontSize: 32, lineHeight: 34 }}
          >
            {event.title}
          </T>
          <T variant="caption" color="rgba(255,255,255,0.85)" style={{ fontSize: 13 }}>
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
