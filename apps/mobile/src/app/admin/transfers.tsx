import type { TransferItem, TransferOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  T,
} from '@/components/ui';
import { toGermanDate } from '@/lib/dates';
import { useSignedIn } from '@/lib/session';

const KIND = {
  internal: { label: 'Wechsel', tone: 'info' },
  loan: { label: 'Leihe', tone: 'action' },
  join: { label: 'Zugang', tone: 'success' },
  leave: { label: 'Abgang', tone: 'neutral' },
} as const;

function route(t: TransferItem) {
  const from = t.fromTeam?.badge ?? (t.kind === 'join' ? t.externalClub : null);
  const to = t.toTeam?.badge ?? (t.kind === 'leave' ? t.externalClub : null);
  return [from, to].filter(Boolean).join(' → ');
}

export default function TransfersScreen() {
  const { api } = useSignedIn();
  const overview = useQuery({
    queryKey: ['admin', 'transfers'],
    queryFn: () => api<TransferOverview>('/admin/transfers'),
  });
  const o = overview.data;
  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {overview.isPending ? <Loading /> : null}
      {overview.error ? (
        <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : null}
      {o?.teams.length ? (
        <Button
          label="Bewegung erfassen"
          icon="swap-horizontal"
          onPress={() => router.push('/admin/transfer-new')}
        />
      ) : null}
      {o && o.items.length === 0 ? (
        <Empty icon="swap-horizontal-outline" text="Noch keine Spielerbewegungen." />
      ) : null}
      {o?.items.length ? (
        <Card>
          {o.items.map((t, i) => (
            <ListRow
              key={t.id}
              first={i === 0}
              title={t.person.name}
              subtitle={
                <>
                  <Chip tone={KIND[t.kind].tone} label={`${KIND[t.kind].label} · ${route(t)}`} />
                  <T variant="caption">
                    ab {toGermanDate(t.startsOn)}
                    {t.endsOn ? ` bis ${toGermanDate(t.endsOn)}` : ''}
                    {t.note ? ` · ${t.note}` : ''}
                  </T>
                </>
              }
              onPress={() => router.push(`/admin/member/${t.person.id}`)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
