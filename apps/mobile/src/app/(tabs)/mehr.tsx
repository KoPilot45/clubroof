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
import { teamTitle } from '@/lib/team-labels';

export default function MoreScreen() {
  const { me, api, signOut } = useSignedIn();
  const name = `${me.person.firstName} ${me.person.lastName}`;
  const children = me.managedPersons.filter((p) => p.relation === 'child');
  const home = useQuery({ queryKey: ['home'], queryFn: () => api<HomeResponse>('/home') });
  const absences = useQuery({ queryKey: ['absences'], queryFn: () => api<Absence[]>('/absences') });

  // Eine Zeile je Mannschaft – auch wenn ich dort z. B. Co-Trainer bin und mein Kind spielt
  const myTeams = [...new Set(me.teams.map((t) => t.id))].map((id) => {
    const entries = me.teams.filter((t) => t.id === id);
    const subtitle = entries
      .map((t) => {
        const person = me.managedPersons.find((p) => p.id === t.personId);
        const fns = t.functions.map((f) => TEAM_FUNCTION_LABELS[f]).join(', ');
        return person?.relation === 'child' ? `${fns} (${person.firstName})` : fns;
      })
      .join(' · ');
    return { ...entries[0]!, subtitle };
  });
  // Mannschaftsaufgaben zeigen die Funktion samt Mannschaft („Co-Trainer E1“), Vereinsrollen ihren Namen
  const ownTeamFunctions = me.teams.filter((t) => t.personId === me.person.id);
  const roleLabels = [
    ...new Set([
      ...me.roles.filter((r) => r.scopeType !== 'team').map((r) => r.name),
      ...ownTeamFunctions.flatMap((t) =>
        t.functions
          .filter((f) => f !== 'player')
          .map((f) => `${TEAM_FUNCTION_LABELS[f]} ${t.badge}`),
      ),
      ...me.roles
        .filter(
          (r) =>
            r.scopeType === 'team' &&
            !ownTeamFunctions.some(
              (t) => t.id === r.scopeId && t.functions.some((f) => f !== 'player'),
            ),
        )
        .map((r) => {
          const team = me.teams.find((t) => t.id === r.scopeId);
          return team ? `${r.name} ${team.badge}` : r.name;
        }),
    ]),
  ];

  const tiles: TileItem[] = [
    {
      key: 'profile',
      label: 'Profil & Statistik',
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
      key: 'settings',
      label: 'Konto & Einstellungen',
      icon: 'settings',
      onPress: () => router.push('/account'),
    },
    {
      key: 'help',
      label: 'Hilfe & Anleitung',
      icon: 'help-circle',
      onPress: () => router.push('/help'),
    },
    ...(me.clubModules.includes('calendar_export')
      ? [
          {
            key: 'calendar',
            label: 'Kalender-Abo',
            icon: 'calendar' as const,
            onPress: () => router.push('/calendar'),
          },
        ]
      : []),
    ...(me.canInvite
      ? [
          {
            key: 'invites',
            label: 'Einladen',
            icon: 'person-add' as const,
            onPress: () => router.push('/admin/invites'),
          },
        ]
      : []),
    ...(Object.values(me.admin).some(Boolean)
      ? [
          {
            key: 'admin',
            label: 'Verwaltung',
            icon: 'shield-checkmark' as const,
            onPress: () => router.push('/admin'),
          },
        ]
      : []),
  ];

  return (
    <Screen header={<AppHeader title="Mehr" />}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={name} size={56} uri={me.person.avatarUrl} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading">{name}</T>
          <T variant="caption">{me.user.email}</T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {roleLabels.map((label) => (
              <Chip key={label} label={label} />
            ))}
          </View>
        </View>
      </Card>

      {me.security.twoFactorRequired ? (
        <Card style={{ gap: 8 }}>
          <Chip tone="urgent" icon="shield-outline" label="2-Faktor-Anmeldung erforderlich" />
          <T variant="caption">
            Der Verein verlangt sie für deine Verwaltungsrechte. Bis dahin ist die Verwaltung
            gesperrt.
          </T>
          <Button label="Jetzt einrichten" onPress={() => router.push('/account')} />
        </Card>
      ) : null}
      <TileGrid items={tiles} />

      <Section title="Meine Mannschaften">
        <Card>
          {myTeams.length === 0 ? (
            <ListRow
              first
              leading={<IconTile name="shirt-outline" />}
              title="Noch keiner Mannschaft zugeordnet"
              subtitle="Alle Mannschaften des Vereins ansehen"
              onPress={() => router.push('/club-teams')}
            />
          ) : null}
          {myTeams.map((t, i) => (
            <ListRow
              key={t.id}
              first={i === 0}
              leading={<IconTile name="shirt-outline" />}
              title={teamTitle(t)}
              subtitle={t.subtitle}
              onPress={() => router.push(`/team?teamId=${t.id}`)}
            />
          ))}
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
