import type { HomeResponse, TileInfo } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { MatchCarousel, OpenBand, QuickAccess, WeekCard } from '@/components/home';
import { Card, ChoiceChips, Chip, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { NewsList } from '@/components/news';
import { WelcomeTour } from '@/components/welcome-tour';
import { readFlag, writeFlag } from '@/lib/flags';
import { cashTeamId } from '@/lib/quick-links';
import { useSignedIn } from '@/lib/session';
import { useTileInfo } from '@/lib/tile-info';
import { useTheme } from '@/lib/theme';
import type { TintKey } from '@clubroof/design-tokens';

type NewsFilter = 'all' | 'club' | 'team' | 'important';
const NEWS_FILTERS: { value: NewsFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'club', label: 'Verein' },
  { value: 'team', label: 'Mannschaft' },
  { value: 'important', label: 'Wichtig' },
];

export default function HomeScreen() {
  const { api, me, refresh } = useSignedIn();
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const data = home.data;
  // Willkommens-Tour beim ersten Start auf diesem Gerät
  const tourKey = `tour.${me.user.id}`;
  const [tour, setTour] = useState(false);
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('all');
  useEffect(() => {
    void readFlag(tourKey).then((seen) => setTour(!seen));
  }, [tourKey]);

  const news = (data?.news ?? [])
    .filter((n) =>
      newsFilter === 'club'
        ? n.source.type !== 'team'
        : newsFilter === 'team'
          ? n.source.type === 'team'
          : newsFilter === 'important'
            ? n.priority !== 'info'
            : true,
    )
    .slice(0, 4);

  // Hinweise der Schnellzugriff-Chips aus den Kachel-Infos der Bereiche (Verein, Mehr, Mannschaftskasse)
  const clubInfo = useTileInfo('club');
  const moreInfo = useTileInfo('more');
  const cashTeam = cashTeamId(me);
  const teamInfo = useTileInfo('team', cashTeam);
  const quickInfo: TileInfo = {
    ...clubInfo,
    ...moreInfo,
    ...(clubInfo?.docs ? { documents: clubInfo.docs } : {}),
    ...(cashTeam && teamInfo?.cash ? { cash: teamInfo.cash } : {}),
  };
  const overview = data?.clubOverview;
  const figures: [string, number, TintKey][] = overview
    ? [
        ['Mannschaften', overview.teams, 'blue'],
        ['Mitglieder', overview.members, 'green'],
        ...(overview.pendingApprovals === null
          ? []
          : ([['Freigaben', overview.pendingApprovals, 'orange']] as [string, number, TintKey][])),
      ]
    : [];

  return (
    <Screen header={<AppHeader />} refreshing={home.isRefetching} onRefresh={() => home.refetch()}>
      <WelcomeTour
        me={me}
        visible={tour}
        onClose={() => {
          setTour(false);
          void writeFlag(tourKey, true);
        }}
      />
      {home.isPending ? <Loading variant="page" /> : null}
      {home.error ? <ErrorNotice error={home.error} onRetry={() => home.refetch()} /> : null}

      {data ? (
        <MatchCarousel
          matches={data.matches}
          club={me.club.shortName}
          hasTeam={me.teams.length > 0}
        />
      ) : null}
      {data ? <OpenBand actions={data.actions} /> : null}
      {data ? <WeekCard week={data.week} birthdays={data.birthdays} /> : null}

      {data ? (
        <Section
          title="Neuigkeiten für dich"
          action="Alle anzeigen"
          onAction={() => router.push('/news')}
        >
          <ChoiceChips
            options={NEWS_FILTERS}
            selected={[newsFilter]}
            onToggle={(v) => setNewsFilter(v)}
          />
          <NewsList items={news} />
        </Section>
      ) : null}

      <QuickAccess me={me} info={quickInfo} onSaved={refresh} />

      {data?.clubOverview ? (
        <Section title="Verein im Überblick">
          <Card style={{ gap: 12 }}>
            <View style={{ alignItems: 'flex-start' }}>
              <Chip label={me.canAdminister ? 'Vorstand' : 'Vereinsmitglied'} tone="primary" />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {figures.map(([label, value, tint]) => (
                <KeyFigure key={label} label={label} value={value} tint={tint} />
              ))}
            </View>
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

/** Kennzahl auf Pastellfläche (immer mit Beschriftung, dunkle Schrift). */
function KeyFigure({ label, value, tint }: { label: string; value: number; tint: TintKey }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        marginHorizontal: 4,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: colors.tints[tint].container,
      }}
    >
      <T variant="figure" color={colors.tints[tint].onContainer}>
        {value}
      </T>
      <T variant="caption" color={colors.tints[tint].onContainer}>
        {label}
      </T>
    </View>
  );
}
