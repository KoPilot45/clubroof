import type { AdminOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Card,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

function Stat({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T variant="title" color={colors.primaryText}>
        {value}
      </T>
      <T variant="caption" style={{ textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

export default function AdminScreen() {
  const { api, me } = useSignedIn();
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api<AdminOverview>('/admin/overview'),
  });
  const o = overview.data;
  const tiles: TileItem[] = o
    ? [
        ...(o.can.readMembers
          ? [
              {
                key: 'members',
                label: 'Mitglieder',
                icon: 'people' as const,
                onPress: () => router.push('/admin/members'),
              },
            ]
          : []),
        ...(o.can.manageMembers
          ? [
              {
                key: 'new',
                label: 'Mitglied anlegen',
                icon: 'person-add' as const,
                onPress: () => router.push('/admin/member-new'),
              },
            ]
          : []),
        ...(o.can.manageRoles || o.can.readMembers
          ? [
              {
                key: 'roles',
                label: 'Rollen & Aufgaben',
                icon: 'key' as const,
                onPress: () => router.push('/admin/roles'),
              },
            ]
          : []),
        ...(o.can.readAudit
          ? [
              {
                key: 'audit',
                label: 'Änderungsprotokoll',
                icon: 'list' as const,
                onPress: () => router.push('/admin/audit'),
              },
            ]
          : []),
        ...(me.news.write || me.news.publish
          ? [
              {
                key: 'news',
                label: 'News-Redaktion',
                icon: 'newspaper' as const,
                onPress: () => router.push('/admin/news'),
              },
            ]
          : []),
        ...(me.canManageClub
          ? [
              {
                key: 'club',
                label: 'Verein & Design',
                icon: 'shield' as const,
                onPress: () => router.push('/admin/club'),
              },
            ]
          : []),
        ...(o.can.manageTeams || o.can.planSeason
          ? [
              {
                key: 'teams',
                label: 'Mannschaften & Saison',
                icon: 'shirt' as const,
                onPress: () => router.push('/admin/teams'),
              },
            ]
          : []),
        ...(o.can.manageTransfers
          ? [
              {
                key: 'transfers',
                label: 'Spielerbewegungen',
                icon: 'swap-horizontal' as const,
                onPress: () => router.push('/admin/transfers'),
              },
            ]
          : []),
        ...(o.can.manageModules
          ? [
              {
                key: 'modules',
                label: 'Module',
                icon: 'apps' as const,
                onPress: () => router.push('/admin/modules'),
              },
            ]
          : []),
      ]
    : [];

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {overview.isPending ? <Loading /> : null}
      {overview.error ? (
        <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : null}
      {o ? (
        <>
          <Card style={{ flexDirection: 'row' }}>
            <Stat value={o.members.active} label="Aktive Mitglieder" />
            <Stat value={o.members.inactive} label="Passiv" />
            <Stat value={o.teams} label="Mannschaften" />
            <Stat value={o.accounts} label="Mit App-Zugang" />
          </Card>
          {o.members.withoutTeam > 0 && o.can.readMembers ? (
            <Card>
              <ListRow
                first
                title={`${o.members.withoutTeam} aktive Mitglieder ohne Mannschaft oder Aufgabe`}
                subtitle="Zuordnung prüfen – oder als passiv führen"
                onPress={() => router.push('/admin/members?withoutTeam=true')}
              />
            </Card>
          ) : null}
          <TileGrid items={tiles} />
          {o.recentActivity.length ? (
            <Section
              title="Letzte Änderungen"
              action="Alle"
              onAction={() => router.push('/admin/audit')}
            >
              <Card>
                {o.recentActivity.map((a, i) => (
                  <ListRow
                    key={a.id}
                    first={i === 0}
                    title={a.label}
                    subtitle={`${a.actor ?? 'System'} · ${formatAgo(a.at)}`}
                  />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
