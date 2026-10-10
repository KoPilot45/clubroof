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
  HeroCard,
  type TileItem,
} from '@/components/ui';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { teamTitle } from '@/lib/team-labels';
import { useTileInfo } from '@/lib/tile-info';
import { Text } from '@/components/app-text';
import type { TintKey } from '@clubroof/design-tokens';
import { useTheme } from '@/lib/theme';

export default function MoreScreen() {
  const { me, api, signOut } = useSignedIn();
  const { colors } = useTheme();
  const tileInfo = useTileInfo('more');
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

  type Row = TileItem & { subtitle: string; tint: TintKey };
  const info = tileInfo;
  const withInfo = (rows: Row[]): Row[] =>
    rows.map((r) => {
      const entry = info?.[r.key];
      return entry
        ? { ...r, subtitle: entry.hint ?? r.subtitle, badge: entry.badge ?? r.badge }
        : r;
    });

  const myArea: Row[] = withInfo([
    {
      key: 'profile',
      label: 'Profil & Statistik',
      subtitle: 'Daten, Foto und Auswertung',
      icon: 'person',
      tint: 'blue',
      onPress: () => router.push(`/profile/${me.person.id}`),
    },
    {
      key: 'absences',
      label: 'Abwesenheiten',
      subtitle: 'Urlaub, Verletzung, Prüfung melden',
      icon: 'airplane',
      tint: 'orange',
      badge: absences.data?.length,
      onPress: () => router.push('/absences'),
    },
    {
      key: 'notifications',
      label: 'Benachrichtigungen',
      subtitle: home.data?.unreadNotifications
        ? `${home.data.unreadNotifications} ungelesen`
        : 'Alles gelesen',
      icon: 'notifications',
      tint: 'pink',
      badge: home.data?.unreadNotifications,
      onPress: () => router.push('/notifications'),
    },
    ...(me.clubModules.includes('calendar_export')
      ? [
          {
            key: 'calendar',
            label: 'Kalender-Abo',
            subtitle: 'Termine im Handykalender',
            icon: 'calendar' as const,
            tint: 'green' as const,
            onPress: () => router.push('/calendar'),
          },
        ]
      : []),
  ]);
  const settings: Row[] = withInfo([
    {
      key: 'settings',
      label: 'Konto & Einstellungen',
      subtitle: 'Passwort, 2-Faktor, Darstellung, Sprache',
      icon: 'settings',
      tint: 'violet',
      onPress: () => router.push('/account'),
    },
    {
      key: 'help',
      label: 'Hilfe & Anleitung',
      subtitle: 'Häufige Fragen und Rundgang',
      icon: 'help-circle',
      tint: 'blue',
      onPress: () => router.push('/help'),
    },
    ...(me.canInvite
      ? [
          {
            key: 'invites',
            label: 'Einladen',
            subtitle: 'Link oder QR-Code teilen',
            icon: 'person-add' as const,
            tint: 'green' as const,
            onPress: () => router.push('/admin/invites'),
          },
        ]
      : []),
    ...(Object.values(me.admin).some(Boolean)
      ? [
          {
            key: 'admin',
            label: 'Verwaltung',
            subtitle: 'Mitglieder, Rollen, Einstellungen des Vereins',
            icon: 'shield-checkmark' as const,
            tint: 'orange' as const,
            onPress: () => router.push('/admin'),
          },
        ]
      : []),
  ]);

  return (
    <Screen header={<AppHeader title="Mehr" subtitle="Profil, Einstellungen und Hilfe" />}>
      <HeroCard style={{ marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View
            style={{
              padding: 3,
              borderRadius: 36,
              backgroundColor: colors.hero.onHero,
            }}
          >
            <Avatar name={name} size={64} uri={me.person.avatarUrl} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T
              variant="headline"
              color={colors.hero.onHero}
              numberOfLines={2}
              style={{ fontSize: 22, lineHeight: 26 }}
            >
              {name}
            </T>
            <T variant="caption" color={colors.hero.onHero} numberOfLines={1}>
              {me.user.email}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {roleLabels.map((label, i) => (
            <View
              key={label}
              style={{
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: i === 0 ? colors.hero.onHero : 'rgba(255,255,255,0.22)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: i === 0 ? colors.hero.from : colors.hero.onHero,
                }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      </HeroCard>

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
      {children.length > 0 ? (
        <Section title="Meine Kinder">
          <Card>
            {children.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                leading={<Avatar name={`${c.firstName} ${c.lastName}`} size={40} />}
                title={`${c.firstName} ${c.lastName}`}
                subtitle={[
                  ...new Set(me.teams.filter((t) => t.personId === c.id).map((t) => t.badge)),
                  'Du verwaltest Termine, Zusagen und Abwesenheiten',
                ].join(' · ')}
                onPress={() => router.push(`/profile/${c.id}`)}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Mein Bereich">
        <MenuCard rows={myArea} />
      </Section>

      <Section title="Meine Mannschaften">
        <Card>
          {myTeams.length === 0 ? (
            <ListRow
              first
              leading={<IconTile name="shirt-outline" tone="green" />}
              title="Noch keiner Mannschaft zugeordnet"
              subtitle="Alle Mannschaften des Vereins ansehen"
              onPress={() => router.push('/club-teams')}
            />
          ) : null}
          {myTeams.map((t, i) => (
            <ListRow
              key={t.id}
              first={i === 0}
              leading={<IconTile name="shirt-outline" tone="green" />}
              title={teamTitle(t)}
              subtitle={t.subtitle}
              onPress={() => router.push(`/team?teamId=${t.id}`)}
            />
          ))}
        </Card>
      </Section>

      <Section title="Einstellungen">
        <MenuCard rows={settings} />
      </Section>

      <Button
        label="Abmelden"
        variant="danger"
        icon="log-out-outline"
        onPress={() => void signOut()}
      />
    </Screen>
  );
}

/** Karte mit Menüzeilen: Pastell-Kachel, Titel, Erklärung, Zähler und Pfeil. */
function MenuCard({ rows }: { rows: (TileItem & { subtitle: string; tint: TintKey })[] }) {
  return (
    <Card>
      {rows.map((r, i) => (
        <ListRow
          key={r.key}
          first={i === 0}
          onPress={r.onPress}
          leading={<IconTile name={r.icon} tone={r.tint} />}
          title={r.label}
          subtitle={r.subtitle}
          trailing={
            r.badge !== undefined && r.badge !== 0 ? (
              <Chip tone="action" label={String(r.badge)} size="md" />
            ) : null
          }
        />
      ))}
    </Card>
  );
}
