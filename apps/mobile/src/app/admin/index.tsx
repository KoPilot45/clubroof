import type { AdminOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Card, ErrorNotice, HeroCard, ListRow, Loading, Screen, Section, T } from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useTileInfo } from '@/lib/tile-info';

/** Wohin eine Aufgabe in „Für dich“ führt (Schlüssel der Kachel-Infos der Verwaltung). */
const TASK_TARGETS: Record<string, Href> = {
  members: '/admin/members?withoutTeam=true',
  news: '/admin/news',
  invites: '/admin/invites',
  modules: '/admin/modules',
  club: '/admin/club',
};
const TASK_LABELS: Record<string, string> = {
  members: 'Mitglieder',
  news: 'News',
  invites: 'Einladungen',
  modules: 'Funktionen',
  club: 'Verein & Design',
};

/** Übersicht der Verwaltung (Paket AV): Blickfläche Mitglieder, „Für dich“-Aufgaben, letzte Änderungen. */
export default function AdminOverviewScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const tileInfo = useTileInfo('admin');
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api<AdminOverview>('/admin/overview'),
  });
  const o = overview.data;
  const on = colors.hero.onHero;
  const tasks = Object.entries(tileInfo ?? {}).filter(
    ([key, e]) => (e.tone === 'action' || e.tone === 'urgent') && !!e.hint && key in TASK_TARGETS,
  );

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {overview.isPending ? <Loading /> : null}
      {overview.error ? (
        <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />
      ) : null}
      {o ? (
        <>
          <HeroCard>
            <T variant="overline" color={on}>
              Aktive Mitglieder
            </T>
            <T variant="figure" color={on} style={{ fontSize: 72, lineHeight: 74 }}>
              {o.members.active}
            </T>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
              {[
                [o.members.inactive, 'Passiv'],
                [o.teams, 'Mannschaften'],
                [o.accounts, 'Mit App-Zugang'],
              ].map(([value, label]) => (
                <View key={String(label)} style={{ flex: 1 }}>
                  <T variant="figure" color={on} style={{ fontSize: 28, lineHeight: 32 }}>
                    {value as number}
                  </T>
                  <T variant="caption" color={on}>
                    {label as string}
                  </T>
                </View>
              ))}
            </View>
          </HeroCard>

          <Section title="Für dich">
            <Card>
              {tasks.length === 0 ? (
                <T variant="caption">Nichts zu tun – alles erledigt.</T>
              ) : (
                tasks.map(([key, e], i) => (
                  <ListRow
                    key={key}
                    first={i === 0}
                    title={e.hint!}
                    subtitle={TASK_LABELS[key]}
                    onPress={() => router.push(TASK_TARGETS[key]!)}
                  />
                ))
              )}
            </Card>
          </Section>

          {o.recentActivity.length ? (
            <Section
              title="Letzte Änderungen"
              action="Alle"
              onAction={() => router.push('/admin/audit')}
            >
              <Card>
                {o.recentActivity.map((a, i) => (
                  <ListRow
                    key={a.id}
                    first={i === 0}
                    title={a.label}
                    subtitle={`${a.actor ?? 'System'} · ${formatAgo(a.at)}`}
                  />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
