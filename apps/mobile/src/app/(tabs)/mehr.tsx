import type { Absence, HomeResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import {
  Avatar,
  Button,
  Card,
  Chip,
  IconTile,
  ListRow,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';

export default function MoreScreen() {
  const { me, api, signOut } = useSignedIn();
  const name = `${me.person.firstName} ${me.person.lastName}`;
  const children = me.managedPersons.filter((p) => p.relation === 'child');
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const absences = useQuery({ queryKey: ['absences'], queryFn: () => api<Absence[]>('/absences') });

  const tiles: TileItem[] = [
    {
      key: 'profile',
      label: 'Mein Profil',
      icon: 'person',
      onPress: () => router.push(`/profile/${me.person.id}`),
    },
    {
      key: 'absences',
      label: 'Abwesenheiten',
      icon: 'airplane',
      badge: absences.data?.length,
      onPress: () => router.push('/absences'),
    },
    {
      key: 'notifications',
      label: 'Benachrichtigungen',
      icon: 'notifications',
      badge: home.data?.unreadNotifications,
      onPress: () => router.push('/notifications'),
    },
    {
      key: 'stats',
      label: 'Meine Statistik',
      icon: 'bar-chart',
      onPress: () => router.push('/stats'),
    },
    { key: 'settings', label: 'Einstellungen', icon: 'settings', soon: true },
    ...(me.canAdminister
      ? [{ key: 'admin', label: 'Verwaltung', icon: 'shield-checkmark' as const, soon: true }]
      : []),
  ];

  return (
    <Screen header={<AppHeader title="Mehr" />}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={name} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading">{name}</T>
          <T variant="caption">{me.user.email}</T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {me.roles.map((r) => (
              <Chip key={r.key + (r.scopeId ?? '')} label={r.name} />
            ))}
          </View>
        </View>
      </Card>

      <TileGrid items={tiles} />

      <Section title="Meine Mannschaften">
        <Card>
          {me.teams.map((t, i) => {
            const person = me.managedPersons.find((p) => p.id === t.personId);
            return (
              <ListRow
                key={t.id + t.personId}
                first={i === 0}
                leading={<IconTile name="shirt-outline" />}
                title={`${t.badge} · ${t.name}`}
                subtitle={
                  t.functions.map((f) => TEAM_FUNCTION_LABELS[f]).join(', ') +
                  (person?.relation === 'child' ? ` (${person.firstName})` : '')
                }
              />
            );
          })}
        </Card>
      </Section>

      {children.length > 0 ? (
        <Section title="Meine Kinder">
          <Card>
            {children.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                leading={<Avatar name={`${c.firstName} ${c.lastName}`} />}
                title={`${c.firstName} ${c.lastName}`}
                subtitle="Du verwaltest Termine, Zusagen und Abwesenheiten"
                onPress={() => router.push(`/profile/${c.id}`)}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Button
        label="Abmelden"
        variant="danger"
        icon="log-out-outline"
        onPress={() => void signOut()}
      />
    </Screen>
  );
}
