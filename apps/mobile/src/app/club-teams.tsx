import type { ClubTeamGroup } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import {
  Card,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';

export default function ClubTeamsScreen() {
  const { api } = useSignedIn();
  const groups = useQuery({
    queryKey: ['club-teams'],
    queryFn: () => api<ClubTeamGroup[]>('/club/teams'),
  });
  return (
    <Screen edges={[]} refreshing={groups.isRefetching} onRefresh={() => groups.refetch()}>
      {groups.isPending ? <Loading /> : null}
      {groups.error ? (
        <ErrorNotice message={groups.error.message} onRetry={() => groups.refetch()} />
      ) : null}
      {groups.data?.map((g) => (
        <Section key={g.orgUnit.id} title={g.orgUnit.name}>
          <Card>
            {g.teams.map((t, i) => (
              <ListRow
                key={t.id}
                first={i === 0}
                leading={<TeamBadge badge={t.badge} />}
                title={t.name}
                subtitle={
                  <View style={{ gap: 2 }}>
                    <T variant="caption">
                      {[t.ageGroup, t.league, `${t.players} Spieler`].filter(Boolean).join(' · ')}
                    </T>
                    {t.coaches.length > 0 ? (
                      <T variant="caption">Trainer: {t.coaches.join(', ')}</T>
                    ) : null}
                  </View>
                }
                trailing={t.isMine ? <Chip label="Meine" /> : null}
              />
            ))}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
