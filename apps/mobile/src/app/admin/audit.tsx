import type { AuditEntry } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Card, Empty, ErrorNotice, ListRow, Loading, Screen, T } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

export default function AuditScreen() {
  const { api } = useSignedIn();
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
      {audit.data?.length ? (
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
