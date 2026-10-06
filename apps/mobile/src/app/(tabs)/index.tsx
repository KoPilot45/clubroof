import type { ActionItem, HomeResponse, NewsItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow, NextMatchCard } from '@/components/events';
import {
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
  type IconName,
} from '@/components/ui';
import { formatAgo, formatEuro, formatRemaining } from '@/lib/format';
import { openLink } from '@/lib/links';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const NEWS_TONE = { urgent: 'urgent', important: 'action', info: 'info' } as const;
const NEWS_ICON: Record<NewsItem['priority'], IconName> = {
  urgent: 'warning',
  important: 'megaphone',
  info: 'newspaper',
};
const ACTION_ICON: Record<ActionItem['kind'], IconName> = {
  attendance: 'calendar',
  poll: 'stats-chart',
  approval: 'checkmark-done',
  task: 'clipboard',
};

export default function HomeScreen() {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const data = home.data;

  return (
    <Screen header={<AppHeader />} refreshing={home.isRefetching} onRefresh={() => home.refetch()}>
      {home.isPending ? <Loading /> : null}
      {home.error ? <ErrorNotice error={home.error} onRetry={() => home.refetch()} /> : null}

      {data?.clubOverview ? (
        <Card style={{ gap: 12 }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <T variant="overline">Verein im Überblick</T>
            <Chip label="Vorstand" tone="primary" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              ['Mannschaften', data.clubOverview.teams],
              ['Mitglieder', data.clubOverview.members],
              ['Freigaben', data.clubOverview.pendingApprovals],
            ].map(([label, value]) => (
              <View key={label} style={{ alignItems: 'center' }}>
                <T variant="title" color={colors.primaryText}>
                  {value}
                </T>
                <T variant="caption">{label}</T>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {data?.nextMatch ? (
        <NextMatchCard event={data.nextMatch} clubShortName={me.club.shortName} />
      ) : null}

      {data ? (
        <Section
          title="Neuigkeiten für dich"
          action="Alle anzeigen"
          onAction={() => router.push('/news')}
        >
          <Card>
            {data.news.length === 0 ? (
              <Empty icon="newspaper-outline" text="Keine Neuigkeiten." />
            ) : null}
            {data.news.map((n, i) => (
              <ListRow
                key={n.id}
                first={i === 0}
                onPress={() => router.push(`/news/${n.id}`)}
                leading={<IconTile name={NEWS_ICON[n.priority]} tone={NEWS_TONE[n.priority]} />}
                title={n.title}
                subtitle={
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    {n.source.type === 'team' ? (
                      <TeamBadge badge={n.source.label} />
                    ) : (
                      <Chip tone="info" label={n.source.label} />
                    )}
                    {n.priority !== 'info' ? (
                      <Chip
                        tone={NEWS_TONE[n.priority]}
                        label={n.priority === 'urgent' ? 'Dringend' : 'Wichtig'}
                      />
                    ) : null}
                  </View>
                }
                trailing={<T variant="caption">{formatAgo(n.publishedAt)}</T>}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {data && data.actions.length > 0 ? (
        <Section title="Offene Aktionen">
          <Card>
            {data.actions.map((a, i) => (
              <View key={a.id}>
                <ListRow
                  first={i === 0}
                  onPress={() => openLink(a.link)}
                  leading={<IconTile name={ACTION_ICON[a.kind]} filled />}
                  title={a.title}
                  subtitle={a.subtitle}
                  trailing={
                    a.dueAt ? <Chip tone="action" label={formatRemaining(a.dueAt)} /> : null
                  }
                />
                {a.options?.length ? <QuickVote action={a} /> : null}
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {data ? (
        <Section
          title="Nächste Termine"
          action="Alle anzeigen"
          onAction={() => router.push('/termine')}
        >
          <Card>
            {data.upcoming.length === 0 ? (
              <Empty icon="calendar-outline" text="Keine anstehenden Termine." />
            ) : null}
            {data.upcoming.map((e, i) => (
              <EventRow key={e.id} event={e} first={i === 0} />
            ))}
          </Card>
        </Section>
      ) : null}

      {data && data.birthdays.length > 0 ? (
        <Section title="Geburtstage">
          <Card>
            {data.birthdays.map((b, i) => (
              <ListRow
                key={b.personId}
                first={i === 0}
                leading={
                  <IconTile name="gift-outline" tone={b.inDays === 0 ? 'success' : undefined} />
                }
                title={b.name}
                subtitle={
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TeamBadge badge={b.teamBadge} />
                    <T variant="caption">{b.day}</T>
                  </View>
                }
                trailing={
                  <Chip
                    tone={b.inDays === 0 ? 'success' : 'neutral'}
                    label={
                      b.inDays === 0
                        ? 'Heute 🎉'
                        : b.inDays === 1
                          ? 'Morgen'
                          : `in ${b.inDays} Tagen`
                    }
                  />
                }
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {data?.cash.map((c) => (
        <Pressable
          key={c.teamId}
          accessibilityRole="button"
          onPress={() => router.push(`/teams/${c.teamId}/cash`)}
        >
          <Card style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <IconTile name="wallet-outline" />
                <T variant="heading">Teamkasse {c.badge}</T>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              {c.balanceCents !== null ? (
                <View>
                  <T variant="caption">Aktueller Stand</T>
                  <T variant="display" color={colors.primaryText}>
                    {formatEuro(c.balanceCents)}
                  </T>
                </View>
              ) : null}
              {c.personalBalanceCents !== null ? (
                <View style={{ alignItems: c.balanceCents !== null ? 'flex-end' : 'flex-start' }}>
                  <T variant="caption">Mein Konto</T>
                  <T
                    variant="heading"
                    color={
                      c.personalBalanceCents < 0
                        ? colors.status.urgent.onContainer
                        : colors.onSurface
                    }
                  >
                    {formatEuro(c.personalBalanceCents)}
                  </T>
                </View>
              ) : null}
            </View>
            {c.incomeCents !== null && c.expenseCents !== null ? (
              <T variant="caption">
                Einnahmen {formatEuro(c.incomeCents)} · Ausgaben {formatEuro(c.expenseCents)}
              </T>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

/** Umfrage direkt auf der Startseite beantworten (Konzept §3). */
function QuickVote({ action }: { action: ActionItem }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api(`/polls/${action.id}/vote`, { method: 'PUT', body: { optionId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
      router.push(`/polls/${action.id}`);
    },
  });
  return (
    <View style={{ gap: 6, paddingBottom: 10, paddingLeft: 52, paddingRight: 4 }}>
      <ChoiceChips
        options={action.options!.map((o) => ({ value: o.id, label: o.label }))}
        selected={vote.variables ? [vote.variables] : []}
        onToggle={(id) => !vote.isPending && vote.mutate(id)}
      />
      {vote.error ? <Chip tone="urgent" icon="alert-circle" label={vote.error.message} /> : null}
    </View>
  );
}
