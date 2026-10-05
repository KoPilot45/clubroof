import type { RoleCatalog } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Card, Chip, ErrorNotice, ListRow, Loading, Screen, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

const SCOPE_HINT = { club: 'meist vereinsweit', org_unit: 'je Bereich', team: 'je Mannschaft' };

export default function RolesScreen() {
  const { api } = useSignedIn();
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
  });
  if (catalog.isPending) return <Loading />;
  if (catalog.error)
    return <ErrorNotice message={catalog.error.message} onRetry={() => catalog.refetch()} />;
  return (
    <Screen edges={[]} refreshing={catalog.isRefetching} onRefresh={() => catalog.refetch()}>
      <T variant="caption">
        Rollen sind Rechtepakete. Sie werden zusätzlich zur Mannschaft vergeben – z. B. ist ein
        Spieler „Kassenwart“ seiner Mannschaft. Vergeben wird beim Mitglied.
      </T>
      {catalog.data.roles.map((r) => (
        <Card key={r.key} style={{ gap: 6 }}>
          <T variant="heading">{r.name}</T>
          {r.description ? <T variant="caption">{r.description}</T> : null}
          <Chip
            tone="neutral"
            label={`${r.permissions.length} Rechte · ${SCOPE_HINT[r.defaultScope]}`}
          />
          {r.holders.length === 0 ? <T variant="caption">Noch niemand.</T> : null}
          {r.holders.map((h, i) => (
            <ListRow
              key={h.personId + h.scopeLabel}
              first={i === 0}
              title={h.name}
              subtitle={h.scopeLabel}
              onPress={() => router.push(`/admin/member/${h.personId}`)}
            />
          ))}
        </Card>
      ))}
    </Screen>
  );
}
