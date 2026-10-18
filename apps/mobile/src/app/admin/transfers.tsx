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
import { Cell, DataTable } from '@/components/data-table';
import { useIsDesktop } from '@/lib/layout';
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
  const desktop = useIsDesktop();
  const overview = useQuery({
    queryKey: ['admin', 'transfers'],
    queryFn: () => api<TransferOverview>('/admin/transfers'),
  });
  const o = overview.data;
  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {overview.isPending ? <Loading /> : null}
      {overview.error ? (
        <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />
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
      {o?.items.length && desktop ? (
        <DataTable
          rows={o.items}
          rowKey={(t) => t.id}
          exportName="spielerbewegungen"
          onRowPress={(t) => router.push(`/admin/member/${t.person.id}`)}
          defaultSort={{ key: 'from', dir: 'desc' }}
          columns={[
            {
              key: 'person',
              label: 'Person',
              flex: 2,
              sort: (a, b) => a.person.name.localeCompare(b.person.name),
              csv: (t) => t.person.name,
              render: (t) => <Cell>{t.person.name}</Cell>,
            },
            {
              key: 'kind',
              label: 'Art',
              width: 130,
              sort: (a, b) => KIND[a.kind].label.localeCompare(KIND[b.kind].label),
              csv: (t) => KIND[t.kind].label,
              render: (t) => <Chip tone={KIND[t.kind].tone} label={KIND[t.kind].label} />,
            },
            {
              key: 'route',
              label: 'Von → nach',
              flex: 1.5,
              csv: (t) => route(t),
              render: (t) => <Cell>{route(t) || '–'}</Cell>,
            },
            {
              key: 'from',
              label: 'Ab',
              width: 110,
              sort: (a, b) => a.startsOn.localeCompare(b.startsOn),
              csv: (t) => toGermanDate(t.startsOn),
              render: (t) => <Cell muted>{toGermanDate(t.startsOn)}</Cell>,
            },
            {
              key: 'to',
              label: 'Bis',
              width: 110,
              sort: (a, b) => (a.endsOn ?? '9999').localeCompare(b.endsOn ?? '9999'),
              csv: (t) => (t.endsOn ? toGermanDate(t.endsOn) : ''),
              render: (t) => <Cell muted>{t.endsOn ? toGermanDate(t.endsOn) : '–'}</Cell>,
            },
            {
              key: 'note',
              label: 'Hinweis',
              flex: 1.5,
              csv: (t) => t.note ?? '',
              render: (t) => <Cell muted>{t.note ?? '–'}</Cell>,
            },
          ]}
        />
      ) : o?.items.length ? (
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
