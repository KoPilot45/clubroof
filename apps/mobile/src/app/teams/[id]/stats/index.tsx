import type { TeamStats } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { HighlightsCard } from '@/components/team';
import { ErrorNotice, Loading, Screen, Section, TileGrid, type TileItem } from '@/components/ui';
import { RANKINGS } from '@/components/stats';
import { useSignedIn } from '@/lib/session';

/** Statistik-Übersicht: Saison-Bilanz und Kacheln zu den einzelnen Auswertungen. */
export default function StatsOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const season = useQuery({
    queryKey: ['stats', id, 'season', ''],
    queryFn: () => api<TeamStats>(`/teams/${id}/stats`),
  });
  const d = season.data;
  const leader = (kind: keyof typeof RANKINGS) => {
    if (!d) return undefined;
    const def = RANKINGS[kind];
    const best = [...d.squad].sort((a, b) => def.value(b) - def.value(a))[0];
    return best && def.value(best) > 0 ? best.name.split(' ')[0] : undefined;
  };
  const open = (kind: string) => router.push(`/teams/${id}/stats/${kind}`);
  const tiles: TileItem[] = [
    { key: 'squad', label: 'Kader', icon: 'people', onPress: () => open('squad') },
    { key: 'training', label: 'Training', icon: 'fitness', onPress: () => open('training') },
    { key: 'scorers', label: 'Torschützen', icon: 'football', onPress: () => open('scorers') },
    { key: 'points', label: 'Scorer', icon: 'star', onPress: () => open('points') },
    { key: 'cards', label: 'Karten', icon: 'card', onPress: () => open('cards') },
    { key: 'results', label: 'Ergebnisse', icon: 'list', onPress: () => open('results') },
  ];
  // Kurzinfo unter den Kacheln: wer führt die Liste an
  for (const t of tiles) {
    if (t.key === 'scorers' || t.key === 'points') {
      const name = leader(t.key);
      if (name) t.label = `${t.label} · ${name}`;
    }
  }
  return (
    <Screen edges={[]} refreshing={season.isRefetching} onRefresh={() => season.refetch()}>
      {season.isPending ? <Loading /> : null}
      {season.error ? (
        <ErrorNotice message={season.error.message} onRetry={() => season.refetch()} />
      ) : null}
      {d ? (
        <HighlightsCard h={d.highlights} title="Saison-Bilanz" rateLabel="Trainingsquote" />
      ) : null}
      <Section title="Auswertungen">
        <TileGrid items={tiles} />
      </Section>
    </Screen>
  );
}
