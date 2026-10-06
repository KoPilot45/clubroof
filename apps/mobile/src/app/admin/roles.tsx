import type { RoleCatalog } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, Card, Chip, ErrorNotice, ListRow, Loading, Screen, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

const SCOPE_HINT = { club: 'meist vereinsweit', org_unit: 'je Bereich', team: 'je Mannschaft' };
/** So viele Personen zeigt die Übersicht je Rolle; der Rest steht hinter „Alle anzeigen“ */
const PREVIEW = 3;

export default function RolesScreen() {
  const { api, me } = useSignedIn();
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
  });
  if (catalog.isPending) return <Loading />;
  if (catalog.error) return <ErrorNotice error={catalog.error} onRetry={() => catalog.refetch()} />;
  const open = (key: string, add?: boolean) =>
    router.push(add ? `/admin/role/${key}?add=1` : `/admin/role/${key}`);
  return (
    <Screen edges={[]} refreshing={catalog.isRefetching} onRefresh={() => catalog.refetch()}>
      <T variant="caption">
        Rollen sind Rechtepakete. Sie werden zusätzlich zur Mannschaft vergeben – z. B. ist ein
        Spieler „Kassenwart“ seiner Mannschaft. Jede Rolle kann mehrere Personen haben.
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
          {r.holders.slice(0, PREVIEW).map((h, i) => (
            <ListRow
              key={h.assignmentId}
              first={i === 0}
              title={h.name}
              subtitle={h.scopeLabel}
              onPress={() => router.push(`/admin/member/${h.personId}`)}
            />
          ))}
          <Button
            label={
              r.holders.length > PREVIEW
                ? `Alle anzeigen (${r.holders.length})`
                : r.holders.length
                  ? 'Rolle öffnen'
                  : 'Rolle ansehen'
            }
            icon="people-outline"
            variant="outline"
            size="sm"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => open(r.key)}
          />
          {me.admin.manageRoles ? (
            <Button
              label={`${r.name} hinzufügen`}
              icon="person-add-outline"
              variant="tonal"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => open(r.key, true)}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
