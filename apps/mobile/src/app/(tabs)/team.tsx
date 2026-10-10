import type { MyTeamCard, PollSummary, TeamOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { AttendanceBar, ResultRow, TeamBand } from '@/components/team';
import {
  Button,
  Card,
  Chip,
  DateTile,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  shadowStyle,
  TeamBadge,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { formatDateTile, formatTime } from '@/lib/format';
import { EVENT_TYPE_LABELS, TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { teamTitle } from '@/lib/team-labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { dateFormat } from '@/lib/i18n';
import { useTileInfo, withTileInfo } from '@/lib/tile-info';

const PARTICIPATION_LABELS = {
  auto_accept: 'Automatische Zusage – nur Absagen nötig',
  active_response: 'Aktive Zu- und Absage',
  absences_only: 'Nur Abwesenheiten melden',
} as const;

export default function TeamScreen() {
  const { me, api } = useSignedIn();
  const { colors, radii } = useTheme();
  const teams = useMemo(() => [...new Map(me.teams.map((t) => [t.id, t])).values()], [me.teams]);
  // Trainer starten in einer Mannschaft, die sie betreuen (nicht dort, wo sie selbst spielen)
  const [selected, setSelected] = useState(
    (me.teams.find((t) => t.functions.some((f) => f !== 'player')) ?? teams[0])?.id ?? null,
  );
  // Aufruf mit ?teamId=… (z. B. aus „Mehr → Meine Mannschaften“) wählt die Mannschaft aus
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  useEffect(() => {
    if (teamId) setSelected(teamId);
  }, [teamId]);
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

  const tiles: TileItem[] = team
    ? [
        {
          key: 'events',
          tint: 'green' as const,
          label: 'Termine',
          icon: 'calendar',
          onPress: () => router.push(`/events?teamId=${team.id}`),
        },
        ...(o?.permissions.manageEvents
          ? [
              {
                key: 'new',
                tint: 'green' as const,
                label: 'Termin anlegen',
                icon: 'add-circle' as const,
                onPress: () => router.push(`/teams/${team.id}/event-new`),
              },
            ]
          : [
              {
                key: 'absence',
                tint: 'orange' as const,
                label: 'Abwesenheit melden',
                icon: 'airplane' as const,
                onPress: () => router.push('/absences/new'),
              },
            ]),
        {
          key: 'roster',
          tint: 'blue' as const,
          label: 'Kader',
          icon: 'people',
          onPress: () => router.push(`/teams/${team.id}/roster`),
        },
        ...(has('statistics')
          ? [
              {
                key: 'stats',
                tint: 'violet' as const,
                label: 'Statistik',
                icon: 'bar-chart' as const,
                onPress: () => router.push(`/teams/${team.id}/stats`),
              },
            ]
          : []),
        ...(has('team_cash')
          ? [
              {
                key: 'cash',
                tint: 'orange' as const,
                label: 'Kasse',
                icon: 'wallet' as const,
                onPress: () => router.push(`/teams/${team.id}/cash`),
              },
            ]
          : []),
        ...(o?.fines
          ? [
              {
                key: 'fines',
                tint: 'pink' as const,
                label: 'Strafenkatalog',
                icon: 'list' as const,
                onPress: () => router.push(`/teams/${team.id}/fines`),
              },
            ]
          : []),
        ...(has('training_planning') && o?.permissions.manageEvents
          ? [
              {
                key: 'exercises',
                tint: 'violet' as const,
                label: 'Übungen',
                icon: 'library' as const,
                onPress: () => router.push('/exercises'),
              },
            ]
          : []),
        ...(o?.permissions.manageModules
          ? [
              {
                key: 'modules',
                tint: 'blue' as const,
                label: 'Funktionen',
                icon: 'options' as const,
                onPress: () => router.push(`/teams/${team.id}/modules`),
              },
            ]
          : []),
        ...(has('team_tasks')
          ? [
              {
                key: 'tasks',
                tint: 'orange' as const,
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
                tint: 'blue' as const,
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
                tint: 'pink' as const,
                label: 'Dokumente',
                icon: 'document-text' as const,
                onPress: () => router.push(`/documents?teamId=${team.id}`),
              },
            ]
          : []),
        ...(o?.permissions.manageDemand && has('guest_players')
          ? [
              {
                key: 'exchange',
                tint: 'green' as const,
                label: 'Gastspieler',
                icon: 'swap-horizontal' as const,
                onPress: () => router.push('/exchange'),
              },
            ]
          : []),
      ]
    : [];

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
      {teams.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{
            gap: 10,
            alignItems: 'stretch',
            paddingHorizontal: 20,
            paddingVertical: 6,
          }}
        >
          {teams.map((t) => {
            const active = t.id === team?.id;
            const card = (myTeams.data ?? []).find((c) => c.team.id === t.id);
            if (card && (myTeams.data?.length ?? 0) > 1)
              return (
                <MyTeamTile
                  key={t.id}
                  card={card}
                  active={active}
                  onPress={() => setSelected(t.id)}
                />
              );
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(t.id)}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: 16,
                  alignSelf: 'center',
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.surfaceRaised,
                }}
              >
                <T variant="label" color={active ? colors.onPrimary : colors.onSurface}>
                  {teamTitle(t)}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
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

          <TileGrid items={withTileInfo(tiles, tileInfo)} />

          {overview.isPending ? <Loading /> : null}
          {overview.error ? (
            <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />
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
        </>
      ) : null}
    </Screen>
  );
}

const shortWhen = dateFormat({
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Kachel „Meine Teams“ (228 breit): Team, nächster Termin mit Zusagen als Balken, Abwesende, Aufgaben. */
function MyTeamTile({
  card,
  active,
  onPress,
}: {
  card: MyTeamCard;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, isDark, elevation } = useTheme();
  const e = card.nextEvent;
  const total = e ? e.counts.yes + e.counts.no + e.counts.maybe + e.counts.pending : 0;
  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      style={{
        width: 228,
        padding: 14,
        gap: 8,
        borderRadius: 22,
        borderWidth: active ? 2 : isDark ? 1 : 0,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: colors.surfaceRaised,
        ...(isDark ? null : shadowStyle(elevation.card)),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TeamBadge badge={card.team.badge} />
        <T variant="label" style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
          {card.team.name}
        </T>
        {active ? <Chip tone="primary" label="aktiv" /> : null}
      </View>
      {e ? (
        <>
          <T variant="caption" numberOfLines={1}>
            {`${shortWhen.format(new Date(e.startsAt))} · ${e.title}`}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
                backgroundColor: colors.border,
              }}
            >
              <View
                style={{
                  width: `${total ? Math.round((e.counts.yes / total) * 100) : 0}%`,
                  height: '100%',
                  backgroundColor: colors.primaryText,
                }}
              />
            </View>
            <T variant="caption" style={{ fontWeight: '700' }} color={colors.onSurface}>
              {`${e.counts.yes}/${total}`}
            </T>
          </View>
          <T variant="caption">{`${e.counts.yes} von ${total} zugesagt`}</T>
        </>
      ) : (
        <T variant="caption">Kein Termin geplant</T>
      )}
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {card.absentToday ? <Chip tone="info" label={`${card.absentToday} abwesend`} /> : null}
        {card.nextEvent && card.nextEvent.counts.pending ? (
          <Chip tone="action" label={`${card.nextEvent.counts.pending} ohne Rückmeldung`} />
        ) : null}
        {card.openTasks ? (
          <Chip
            tone="action"
            label={`${card.openTasks} ${card.openTasks === 1 ? 'Aufgabe' : 'Aufgaben'}`}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
