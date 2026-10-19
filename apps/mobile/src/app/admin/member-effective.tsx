/** „Was darf diese Person?“ (Paket ROLLEN-VERWALTUNG): alle Rechte nach Bereich, je Recht die Quelle. */
import { type EffectivePermissions } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Card, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { ROLE_AREAS, areaOf } from '@/lib/role-areas';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

export default function MemberEffectiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const data = useQuery({
    queryKey: ['admin', 'effective', id],
    queryFn: () => api<EffectivePermissions>(`/admin/members/${id}/effective-permissions`),
  });
  if (data.isPending) return <Loading />;
  if (data.error) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const e = data.data;
  return (
    <Screen edges={[]}>
      <T variant="heading" verbatim>
        {e.personName}
      </T>
      <T variant="caption">
        {e.permissions.length === 0
          ? 'Diese Person hat keine besonderen Rechte.'
          : `${e.permissions.length} Rechte – jeweils mit der Rolle, aus der sie kommen.`}
      </T>
      {ROLE_AREAS.map((a) => {
        const list = e.permissions.filter((p) => areaOf(p.key) === a.key);
        if (list.length === 0) return null;
        return (
          <Section key={a.key} title={a.label}>
            <Card style={{ gap: 12 }}>
              {list.map((p) => (
                <T key={p.key} verbatim>
                  {`${t(p.label)}\n`}
                  <T variant="caption" verbatim>
                    {p.sources.map((s) => t(s)).join(' · ')}
                  </T>
                </T>
              ))}
            </Card>
          </Section>
        );
      })}
    </Screen>
  );
}
