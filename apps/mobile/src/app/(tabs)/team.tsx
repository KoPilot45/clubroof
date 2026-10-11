import type { MyTeamCard, PollSummary, TeamOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';
import { AreaOverviewScreen } from '@/components/area-overview';
import { AppHeader } from '@/components/app-header';
import { AttendanceBar, ResultRow, TeamBand, UpcomingMatches } from '@/components/team';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateTile,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatDateTile, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS, TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { teamTitle } from '@/lib/team-labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import type { TintKey } from '@clubroof/design-tokens';
import { useTileInfo, withTileInfo } from '@/lib/tile-info';
import { readSetting, writeSetting } from '@/lib/flags';
import { t } from '@/lib/i18n';

const PARTICIPATION_LABELS = {
  auto_accept: 'Automatische Zusage – nur Absagen nötig',
  active_response: 'Aktive Zu- und Absage',
  absences_only: 'Nur Abwesenheiten melden',
} as const;

/**
 * Team-Tab: Wer Sportliche Leitung, Jugendleitung oder Vorstand ist, sieht die Bereichsübersicht (Paket BU);
 * mit eigener Mannschaft schaltet oben „Meine Mannschaft | Übersicht“ um (letzte Wahl wird gemerkt).
 */
export default function TeamScreen() {
  const { me } = useSignedIn();
  const hasTeams = me.teams.length > 0;
  const [mode, setMode] = useState<'team' | 'overview'>('team');
  useEffect(() => {
    void readSetting('teamTabMode').then((v) => {
      if (v === 'overview' || v === 'team') setMode(v);
    });
  }, []);
  const choose = (m: 'team' | 'overview') => {
    setMode(m);
    void writeSetting('teamTabMode', m);
  };
  const switcher =
    me.areaOverview && hasTeams ? (
      <ChoiceChips
        options={[
          { value: 'team', label: 'Meine Mannschaft' },
          { value: 'overview', label: 'Übersicht' },
        ]}
        selected={[mode]}
        onToggle={choose}
      />
    ) : null;
  if (me.areaOverview && (!hasTeams || mode === 'overview'))
    return <AreaOverviewScreen switcher={switcher} />;
  return <MyTeamScreen switcher={switcher} />;
}

function MyTeamScreen({ switcher }: { switcher: ReactNode }) {
  const { me, api } = useSignedIn();
  const teams = useMemo(() => [...new Map(me.teams.map((t) => [t.id, t])).values()], [me.teams]);
  // Trainer starten in einer Mannschaft, die sie betreuen (nicht dort, wo sie selbst spielen)
  const [selected, setSelected] = useState(
    (me.teams.find((t) => t.functions.some((f) => f !== 'player')) ?? teams[0])?.id ?? null,
  );
  // Aufruf mit ?teamId=… (z. B. aus „Mehr → Meine Mannschaften“) wählt die Mannschaft aus
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  // Zuletzt gewählte Mannschaft merken (pro Gerät); ein Aufruf mit ?teamId=… hat Vorrang
  useEffect(() => {
    if (teamId) {
      setSelected(teamId);
      return;
    }
    void readSetting('lastTeam').then((id) => {
      if (id && teams.some((t) => t.id === id)) setSelected(id);
    });
  }, [teamId, teams]);
  const choose = (id: string) => {
    setSelected(id);
    void writeSetting('lastTeam', id);
  };
  const team = teams.find((t) => t.id === selected) ?? teams[0];
  const has = (module: string) => team?.modules.includes(module) ?? false;

  const overview = useQuery({
    queryKey: ['team', team?.id],
    queryFn: () => api<TeamOverview>(`/teams/${team!.id}`),
    enabled: !!team,
  });
  const polls = useQuery({
    queryKey: ['polls', team?.id ?? 'none'],
    queryFn: () => api<PollSummary[]>(`/polls?teamId=${team!.id}`),
    enabled: !!team && has('polls'),
  });
  const myTeams = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => api<MyTeamCard[]>('/my-teams'),
    enabled: teams.length > 1,
  });
  const o = overview.data;
  const tileInfo = useTileInfo('team', team?.id);
  const roles = me.teams.filter((t) => t.id === team?.id);
  const openPolls = (polls.data ?? []).filter((p) => p.isOpen && !p.myOptionId).length;

  // Kacheln in drei Gruppen (Paket MS): Spiel- & Trainingsbetrieb, Organisation, Verwaltung (nur mit Rechten)
  const perm = o?.permissions;
  const play: TileItem[] = team
    ? [
        {
          key: 'events',
          label: 'Termine',
          icon: 'calendar',
          onPress: () => router.push(`/events?teamId=${team.id}`),
        },
        {
          key: 'roster',
          label: 'Kader',
          icon: 'people',
          onPress: () => router.push(`/teams/${team.id}/roster`),
        },
        ...(has('statistics')
          ? [
              {
                key: 'stats',
                label: 'Statistik',
                icon: 'bar-chart' as const,
                onPress: () => router.push(`/teams/${team.id}/stats`),
              },
            ]
          : []),
        ...(has('training_planning') && perm?.manageEvents
          ? [
              {
                key: 'exercises',
                label: 'Übungen',
                icon: 'library' as const,
                onPress: () => router.push('/exercises'),
              },
            ]
          : []),
        ...(perm?.manageDemand && has('guest_players')
          ? [
              {
                key: 'exchange',
                label: 'Gastspieler',
                icon: 'swap-horizontal' as const,
                onPress: () => router.push('/exchange'),
              },
            ]
          : []),
        {
          key: 'absence',
          label: 'Abwesenheit melden',
          icon: 'airplane',
          onPress: () => router.push('/absences/new'),
        },
      ]
    : [];
  const organisation: TileItem[] = team
    ? [
        ...(has('team_cash')
          ? [
              {
                key: 'cash',
                label: 'Kasse',
                icon: 'wallet' as const,
                onPress: () => router.push(`/teams/${team.id}/cash`),
              },
            ]
          : []),
        ...(has('team_tasks')
          ? [
              {
                key: 'tasks',
                label: 'Aufgaben',
                icon: 'checkbox' as const,
                onPress: () => router.push(`/teams/${team.id}/tasks`),
              },
            ]
          : []),
        ...(has('polls')
          ? [
              {
                key: 'polls',
                label: 'Umfragen',
                icon: 'stats-chart' as const,
                badge: openPolls,
                onPress: () => router.push(`/polls?teamId=${team.id}`),
              },
            ]
          : []),
        ...(has('documents')
          ? [
              {
                key: 'docs',
                label: 'Dokumente',
                icon: 'document-text' as const,
                onPress: () => router.push(`/documents?teamId=${team.id}`),
              },
            ]
          : []),
      ]
    : [];
  const admin: TileItem[] = team
    ? [
        ...(perm?.manageEvents
          ? [
              {
                key: 'new',
                label: 'Termin anlegen',
                icon: 'add-circle' as const,
                onPress: () => router.push(`/teams/${team.id}/event-new`),
              },
              {
                key: 'squad',
                label: 'Kader verwalten',
                icon: 'person-add' as const,
                onPress: () => router.push(`/teams/${team.id}/manage`),
              },
              {
                key: 'edit',
                label: 'Mannschaft bearbeiten',
                icon: 'create' as const,
                onPress: () => router.push(`/teams/${team.id}/manage`),
              },
            ]
          : []),
        ...(o?.fines && (perm?.manageFines || perm?.manageCash)
          ? [
              {
                key: 'fines',
                label: 'Strafen & Katalog',
                icon: 'list' as const,
                onPress: () => router.push(`/teams/${team.id}/fines`),
              },
            ]
          : []),
        ...(perm?.manageCash && has('team_cash')
          ? [
              {
                key: 'cash-admin',
                label: 'Kassenverwaltung',
                icon: 'calculator' as const,
                onPress: () => router.push(`/teams/${team.id}/cash-admin`),
              },
            ]
          : []),
        ...(perm?.manageModules
          ? [
              {
                key: 'modules',
                label: 'Funktionen',
                icon: 'options' as const,
                onPress: () => router.push(`/teams/${team.id}/modules`),
              },
            ]
          : []),
        ...(perm?.manageEvents && me.canInvite
          ? [
              {
                key: 'invite',
                label: 'Spieler einladen',
                icon: 'person-add-outline' as const,
                onPress: () => router.push('/admin/invites'),
              },
            ]
          : []),
      ]
    : [];
  const groups: { key: string; title: string; tint: TintKey; tiles: TileItem[] }[] = (
    [
      { key: 'play', title: 'Spiel- & Trainingsbetrieb', tint: 'green', tiles: play },
      { key: 'org', title: 'Organisation', tint: 'blue', tiles: organisation },
      { key: 'admin', title: 'Verwaltung', tint: 'violet', tiles: admin },
    ] as { key: string; title: string; tint: TintKey; tiles: TileItem[] }[]
  ).filter((g) => g.tiles.length > 0);

  return (
    <Screen
      header={
        <AppHeader title={team ? team.name : 'Team'} subtitle={team?.league ?? me.club.shortName} />
      }
      refreshing={overview.isRefetching}
      onRefresh={() => {
        void overview.refetch();
        void polls.refetch();
      }}
    >
      {switcher}
      {teams.length > 1 ? (
        <TeamSwitcher
          teams={teams}
          activeId={team?.id}
          cards={myTeams.data ?? []}
          onSelect={choose}
        />
      ) : null}

      {!team ? (
        <Card style={{ gap: 12 }}>
          <Empty icon="people-outline" text="Du bist noch keiner Mannschaft zugeordnet." />
          <Button
            label="Alle Mannschaften des Vereins"
            variant="outline"
            icon="shirt-outline"
            onPress={() => router.push('/club-teams')}
          />
        </Card>
      ) : null}

      {team ? (
        <>
          {/* Meine Funktion in der Mannschaft – schlicht als Zeile statt eigener Karte */}
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {roles.flatMap((r) =>
              r.functions.map((fn) => {
                const person = me.managedPersons.find((p) => p.id === r.personId);
                const who = person?.relation === 'child' ? ` (${person.firstName})` : '';
                return <Chip key={r.personId + fn} label={TEAM_FUNCTION_LABELS[fn] + who} />;
              }),
            )}
            {team.ageGroup ? <Chip tone="neutral" label={team.ageGroup} /> : null}
          </View>

          {o ? (
            <TeamBand
              highlights={o.highlights}
              squad={o.squad}
              leaguePosition={o.leaguePosition}
              topScorer={o.topScorer}
            />
          ) : null}

          {o?.nextEvent ? (
            <Section title="Nächster Termin">
              <Card style={{ gap: 12 }}>
                <ListRow
                  first
                  onPress={() => router.push(`/events/${o.nextEvent!.id}`)}
                  leading={
                    <DateTile
                      size="lg"
                      muted={o.nextEvent.status === 'cancelled'}
                      {...formatDateTile(o.nextEvent.startsAt)}
                    />
                  }
                  title={o.nextEvent.title}
                  subtitle={[
                    formatTime(o.nextEvent.startsAt),
                    o.nextEvent.location,
                    EVENT_TYPE_LABELS[o.nextEvent.type],
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    o.nextEvent.status === 'cancelled' ? (
                      <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
                    ) : null
                  }
                />
                <T variant="caption">{PARTICIPATION_LABELS[team.participationMode]}</T>
                <AttendanceBar counts={o.nextEvent.counts} absent={o.squad?.absent} />
              </Card>
            </Section>
          ) : null}

          {o && o.upcomingMatches.length > 0 ? (
            <Section title="Nächste Spiele">
              <UpcomingMatches matches={o.upcomingMatches} />
            </Section>
          ) : null}

          {groups.map((g) => (
            <Section key={g.key} title={g.title}>
              <TileGrid
                items={withTileInfo(g.tiles, tileInfo).map((tile) => ({ ...tile, tint: g.tint }))}
              />
            </Section>
          ))}

          {overview.isPending ? <Loading /> : null}
          {overview.error ? (
            <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />
          ) : null}

          {o ? (
            <Section
              title="Trainingswoche"
              action="Alle Termine"
              onAction={() => router.push(`/events?teamId=${team.id}`)}
            >
              <Card>
                {o.trainingWeek.length === 0 ? (
                  <Empty icon="fitness-outline" text="Keine Trainings in den nächsten 7 Tagen." />
                ) : null}
                {o.trainingWeek.map((e, i) => (
                  <ListRow
                    key={e.id}
                    first={i === 0}
                    onPress={() => router.push(`/events/${e.id}`)}
                    leading={
                      <DateTile {...formatDateTile(e.startsAt)} muted={e.status === 'cancelled'} />
                    }
                    title={e.title}
                    subtitle={
                      e.status === 'cancelled'
                        ? e.cancelledReason
                          ? `Grund: ${e.cancelledReason}`
                          : formatTime(e.startsAt)
                        : [
                            formatTime(e.startsAt),
                            e.location,
                            `${e.counts.yes} von ${e.counts.yes + e.counts.no + e.counts.maybe + e.counts.pending} zugesagt`,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                    }
                    trailing={
                      e.status === 'cancelled' ? (
                        <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
                      ) : null
                    }
                  />
                ))}
              </Card>
            </Section>
          ) : null}

          {o && o.lastResults.length > 0 ? (
            <Section
              title="Letzte Ergebnisse"
              action="Statistik"
              onAction={
                has('statistics') ? () => router.push(`/teams/${team.id}/stats`) : undefined
              }
            >
              <Card>
                {o.lastResults.map((r, i) => (
                  <ResultRow
                    key={r.eventId}
                    result={r}
                    clubShortName={me.club.shortName}
                    badge={team.badge}
                    first={i === 0}
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

/**
 * Mannschaftswechsel (Paket KM, Entwurf C1): eine Zeile, seitlich wischbar; je Mannschaft Kürzel, Name und eine Zahl
 * für Offenes (fehlende Rückmeldungen zum nächsten Termin plus offene Aufgaben). Die aktive Mannschaft ist gefüllt.
 */
function TeamSwitcher({
  teams,
  activeId,
  cards,
  onSelect,
}: {
  teams: { id: string; badge: string; name: string }[];
  activeId?: string;
  cards: MyTeamCard[];
  onSelect: (id: string) => void;
}) {
  const { colors, radii } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 4 }}
    >
      {teams.map((tm) => {
        const active = tm.id === activeId;
        const card = cards.find((c) => c.team.id === tm.id);
        const open = card ? (card.nextEvent?.counts.pending ?? 0) + card.openTasks : 0;
        const fg = active ? colors.onPrimary : colors.onSurface;
        return (
          <Pressable
            key={tm.id}
            accessibilityRole="tab"
            accessibilityLabel={open ? t(`${teamTitle(tm)}, ${open} offen`) : teamTitle(tm)}
            aria-selected={active}
            onPress={() => onSelect(tm.id)}
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 14,
              paddingRight: open ? 8 : 14,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : colors.surfaceRaised,
            }}
          >
            <T variant="label" color={fg} style={{ fontWeight: '800' }} verbatim>
              {tm.badge}
            </T>
            <T variant="label" color={fg} numberOfLines={1} style={{ maxWidth: 130 }} verbatim>
              {tm.name}
            </T>
            {open ? (
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  paddingHorizontal: 6,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.onPrimary : colors.status.action.container,
                }}
              >
                <T
                  variant="caption"
                  color={active ? colors.primary : colors.status.action.onContainer}
                  style={{ fontWeight: '800' }}
                  verbatim
                >
                  {open}
                </T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
