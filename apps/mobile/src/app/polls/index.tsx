import type { PollSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import {
  Card,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  TeamBadge,
} from '@/components/ui';
import { PollStatus } from '@/components/polls';
import { useSignedIn } from '@/lib/session';

export default function PollListScreen() {
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const { api } = useSignedIn();
  const polls = useQuery({
    queryKey: ['polls', teamId ?? 'all'],
    queryFn: () => api<PollSummary[]>(teamId ? `/polls?teamId=${teamId}` : '/polls'),
  });
  return (
    <Screen edges={[]} refreshing={polls.isRefetching} onRefresh={() => polls.refetch()}>
      {polls.isPending ? <Loading /> : null}
      {polls.error ? (
        <ErrorNotice message={polls.error.message} onRetry={() => polls.refetch()} />
      ) : null}
      {polls.data ? (
        <Card>
          {polls.data.length === 0 ? (
            <Empty icon="stats-chart-outline" text="Keine Umfragen." />
          ) : null}
          {polls.data.map((p, i) => (
            <ListRow
              key={p.id}
              first={i === 0}
              onPress={() => router.push(`/polls/${p.id}`)}
              leading={<IconTile name="stats-chart" filled={p.isOpen && !p.myOptionId} />}
              title={p.question}
              subtitle={
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {p.source.type === 'team' ? (
                    <TeamBadge badge={p.source.label} />
                  ) : (
                    <Chip tone="info" label={p.source.label} />
                  )}
                  <PollStatus poll={p} />
                </View>
              }
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
