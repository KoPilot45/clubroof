import type { AuditEntry } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Card, Empty, ErrorNotice, ListRow, Loading, Screen, T } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/format';
import { Cell, DataTable } from '@/components/data-table';
import { useIsDesktop } from '@/lib/layout';
import { useSignedIn } from '@/lib/session';

export default function AuditScreen() {
  const { api } = useSignedIn();
  const desktop = useIsDesktop();
  const audit = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => api<AuditEntry[]>('/admin/audit'),
  });
  return (
    <Screen edges={[]} refreshing={audit.isRefetching} onRefresh={() => audit.refetch()}>
      <T variant="caption">Wer hat wann was geändert – die letzten 200 Einträge.</T>
      {audit.isPending ? <Loading /> : null}
      {audit.error ? <ErrorNotice error={audit.error} onRetry={() => audit.refetch()} /> : null}
      {audit.data?.length === 0 ? (
        <Empty icon="list-outline" text="Noch keine Änderungen." />
      ) : null}
      {audit.data?.length && desktop ? (
        <DataTable
          rows={audit.data}
          rowKey={(a) => a.id}
          exportName="aenderungsprotokoll"
          defaultSort={{ key: 'at', dir: 'desc' }}
          columns={[
            {
              key: 'at',
              label: 'Zeit',
              width: 190,
              sort: (x, y) => x.at.localeCompare(y.at),
              csv: (r) => r.at,
              render: (r) => <Cell muted>{`${formatDay(r.at)}, ${formatTime(r.at)} Uhr`}</Cell>,
            },
            {
              key: 'actor',
              label: 'Wer',
              width: 220,
              sort: (x, y) => (x.actor ?? '').localeCompare(y.actor ?? ''),
              csv: (r) => r.actor ?? 'System',
              render: (r) => <Cell>{r.actor ?? 'System'}</Cell>,
            },
            {
              key: 'label',
              label: 'Was',
              flex: 3,
              sort: (x, y) => x.label.localeCompare(y.label),
              csv: (r) => r.label,
              render: (r) => <Cell>{r.label}</Cell>,
            },
          ]}
        />
      ) : audit.data?.length ? (
        <Card>
          {audit.data.map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              title={a.label}
              subtitle={`${formatDay(a.at)}, ${formatTime(a.at)} Uhr · ${a.actor ?? 'System'}`}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
