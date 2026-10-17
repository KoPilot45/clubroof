import type { Absence, HomeResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, View } from 'react-native';
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
  Notice,
  type IconName,
  type TileItem,
} from '@/components/ui';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { teamTitle } from '@/lib/team-labels';
import { useTileInfo } from '@/lib/tile-info';
import { Text } from '@/components/app-text';
import type { TintKey } from '@clubroof/design-tokens';
import { useTheme } from '@/lib/theme';
import { ABOUT_LINKS } from '@/lib/about-content';
import { canOpenAdmin, canOpenClubCash } from '@/lib/areas';

/** Hervorgehobener Zugang zu einem eigenen Bereich (Verwaltung violett, Vereinskasse blau). */
function AreaButton({
  tone,
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  tone: 'violet' | 'blue';
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const c = colors.tints[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 96,
        padding: 14,
        gap: 6,
        borderRadius: 22,
        backgroundColor: c.container,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Ionicons name={icon} size={26} color={c.onContainer} />
        {badge ? (
          <View
            style={{
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.status.action.container,
            }}
          >
            <Text
              verbatim
              style={{ fontSize: 12, fontWeight: '800', color: colors.status.action.onContainer }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <View>
        <Text style={{ fontSize: 16, fontWeight: '800', color: c.onContainer }}>{title}</Text>
        <Text style={{ fontSize: 12, color: c.onContainer }} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

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
    ...(me.referees.manage || me.referees.active
      ? [
          {
            key: 'referees',
            label: 'Schiedsrichter',
            subtitle: 'Meine Einsätze und Vereins-Soll',
            icon: 'flag' as const,
            tint: 'green' as const,
            onPress: () => router.push('/referees'),
          },
        ]
      : []),
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
    ...(me.clubModules.includes('sponsors')
      ? [
          {
            key: 'sponsors',
            label: 'Unsere Sponsoren',
            subtitle: 'Wer unseren Verein unterstützt',
            icon: 'heart' as const,
            tint: 'pink' as const,
            onPress: () => router.push('/sponsors'),
          },
        ]
      : []),
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
  ]);

  const about: Row[] = [
    {
      key: 'terms',
      label: 'AGB',
      subtitle: 'Allgemeine Geschäftsbedingungen',
      icon: 'document-text',
      tint: 'blue',
      onPress: () => router.push('/about/agb'),
    },
    {
      key: 'privacy-policy',
      label: 'Datenschutz',
      subtitle: 'Welche Daten wir verarbeiten',
      icon: 'shield-checkmark',
      tint: 'green',
      onPress: () => router.push('/about/datenschutz'),
    },
    {
      key: 'privacy-settings',
      label: 'Privatsphäre-Einstellungen',
      subtitle: 'Wer sieht was von dir',
      icon: 'eye',
      tint: 'violet',
      onPress: () => router.push('/about/privacy'),
    },
    {
      key: 'imprint',
      label: 'Impressum',
      subtitle: 'Anbieter und Kontakt',
      icon: 'business',
      tint: 'orange',
      onPress: () => router.push('/about/impressum'),
    },
    {
      key: 'changelog',
      label: 'Changelog',
      subtitle: 'Neuigkeiten in Clubroof',
      icon: 'sparkles',
      tint: 'pink',
      onPress: () => router.push('/about/changelog'),
    },
    {
      key: 'support',
      label: 'Support',
      subtitle: 'Hilfe auf der Webseite',
      icon: 'chatbubble-ellipses',
      tint: 'blue',
      onPress: () => void Linking.openURL(ABOUT_LINKS.support),
    },
    {
      key: 'feature-request',
      label: 'Funktion anfragen',
      subtitle: 'Wünsche und Ideen auf der Webseite',
      icon: 'bulb',
      tint: 'green',
      onPress: () => void Linking.openURL(ABOUT_LINKS.featureRequest),
    },
  ];

  return (
    <Screen header={<AppHeader title="Mehr" subtitle="Profil, Einstellungen und Hilfe" />}>
      <HeroCard style={{ marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {me.person.avatarUrl ? (
            <View style={{ padding: 3, borderRadius: 37, backgroundColor: colors.hero.onHero }}>
              <Avatar name={name} size={62} uri={me.person.avatarUrl} />
            </View>
          ) : (
            <View
              accessibilityLabel={name}
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <T
                variant="figure"
                color={colors.hero.to}
                style={{ fontSize: 30, lineHeight: 34 }}
                verbatim
              >
                {name
                  .split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </T>
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <T
              variant="figure"
              color={colors.hero.onHero}
              numberOfLines={2}
              style={{ fontSize: 30, lineHeight: 32 }}
              verbatim
            >
              {name}
            </T>
            <T
              variant="caption"
              color="rgba(255,255,255,0.8)"
              numberOfLines={1}
              style={{ fontSize: 12.5 }}
              verbatim
            >
              {me.user.email}
            </T>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {roleLabels.map((label) => (
                <View
                  key={label}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.hero.onHero }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </HeroCard>

      {/* Eigene Bereiche (Paket AV): Admin-Verwaltung (violett) und Vereinskasse (blau) */}
      {canOpenAdmin(me) || canOpenClubCash(me) ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {canOpenAdmin(me) ? (
            <AreaButton
              tone="violet"
              icon="shield-checkmark"
              title="Admin-Verwaltung"
              subtitle="Mitglieder, Sport, Inhalte, Verein"
              badge={tileInfo?.admin?.figure}
              onPress={() => router.push('/admin')}
            />
          ) : null}
          {canOpenClubCash(me) ? (
            <AreaButton
              tone="blue"
              icon="wallet"
              title="Vereinskasse"
              subtitle="Buchung, Beiträge, Planung, Prüfung"
              onPress={() => router.push('/club-cash')}
            />
          ) : null}
        </View>
      ) : null}

      {me.security.twoFactorRequired ? (
        <Notice
          tone="action"
          icon="shield-outline"
          title="2-Faktor-Anmeldung erforderlich"
          text="Der Verein verlangt sie für deine Verwaltungsrechte. Bis dahin ist die Verwaltung gesperrt."
          action={{ label: 'Jetzt einrichten', onPress: () => router.push('/account') }}
        />
      ) : null}

      {children.length > 0 ? (
        <Section title="Meine Kinder">
          <Card>
            {children.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                leading={
                  <Avatar name={`${c.firstName} ${c.lastName}`} size={40} uri={c.avatarUrl} />
                }
                title={`${c.firstName} ${c.lastName}`}
                subtitle={[
                  'Spieler',
                  ...new Set(me.teams.filter((t) => t.personId === c.id).map((t) => t.badge)),
                ].join(' · ')}
                onPress={() => router.push(`/profile/${c.id}`)}
              />
            ))}
          </Card>
          <T variant="caption" style={{ marginTop: 10 }}>
            Du verwaltest Termine, Zusagen und Abwesenheiten deiner Kinder.
          </T>
        </Section>
      ) : null}

      <Section title="Mein Bereich">
        <MenuCard rows={myArea} />
      </Section>

      {myTeams.length > 0 ? (
        <Section title="Meine Mannschaften">
          <Card>
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
      ) : null}

      <Section title="Einstellungen">
        <MenuCard rows={settings} />
      </Section>

      <Section title="Über Clubroof">
        <MenuCard rows={about} />
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
