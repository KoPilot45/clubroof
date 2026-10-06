import type { JerseySettings, RosterEntry } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  HEADING_FONT,
} from '@/components/ui';
import { formatShortDate } from '@/lib/format';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const FOOT = { left: 'links', right: 'rechts', both: 'beidfüßig' } as const;

function JerseyNumber({ value }: { value: number | null }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: colors.onPrimary,
          fontFamily: HEADING_FONT,
          fontWeight: '400',
          fontSize: 16,
        }}
      >
        {value ?? '–'}
      </Text>
    </View>
  );
}

function Row({ entry, first }: { entry: RosterEntry; first: boolean }) {
  const details = [entry.position, entry.preferredFoot ? `Fuß: ${FOOT[entry.preferredFoot]}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      first={first}
      onPress={() => router.push(`/profile/${entry.personId}`)}
      leading={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {entry.function === 'player' ? (
            <JerseyNumber value={entry.jerseyNumber} />
          ) : (
            <Avatar name={entry.name} uri={entry.avatarUrl} size={36} />
          )}
          {entry.function === 'player' && entry.avatarUrl ? (
            <Avatar name={entry.name} uri={entry.avatarUrl} size={32} />
          ) : null}
        </View>
      }
      title={entry.name}
      subtitle={
        entry.function === 'player' ? details || undefined : TEAM_FUNCTION_LABELS[entry.function]
      }
      trailing={
        entry.unavailable ? (
          <Chip
            tone="info"
            label={
              entry.unavailableReason
                ? `${entry.unavailableReason}${entry.unavailableUntil ? ` bis ${formatShortDate(entry.unavailableUntil)}` : ''}`
                : 'Nicht verfügbar'
            }
          />
        ) : null
      }
    />
  );
}

export default function RosterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const roster = useQuery({
    queryKey: ['roster', id],
    queryFn: () => api<RosterEntry[]>(`/teams/${id}/roster`),
  });
  const jerseys = useQuery({
    queryKey: ['jerseys', id],
    queryFn: () => api<JerseySettings>(`/teams/${id}/jerseys`),
  });
  const staff = (roster.data ?? []).filter((r) => r.function !== 'player');
  const players = (roster.data ?? []).filter((r) => r.function === 'player');
  const available = players.filter((p) => !p.unavailable).length;

  return (
    <Screen edges={[]} refreshing={roster.isRefetching} onRefresh={() => roster.refetch()}>
      {roster.isPending ? <Loading /> : null}
      {roster.error ? <ErrorNotice error={roster.error} onRetry={() => roster.refetch()} /> : null}
      {roster.data ? (
        <>
          <T variant="caption">
            {players.length} Spieler, davon heute {available} verfügbar.
          </T>
          {jerseys.data?.canEdit ? (
            <Button
              label="Rückennummern verwalten"
              variant="outline"
              icon="shirt-outline"
              onPress={() => router.push(`/teams/${id}/jerseys`)}
            />
          ) : null}
          <Section title="Trainerteam">
            <Card>
              {staff.map((r, i) => (
                <Row key={r.personId + r.function} entry={r} first={i === 0} />
              ))}
            </Card>
          </Section>
          <Section title="Spieler">
            <Card>
              {players.map((r, i) => (
                <Row key={r.personId} entry={r} first={i === 0} />
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
