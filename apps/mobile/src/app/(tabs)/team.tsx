import type { PollSummary, TeamOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow } from '@/components/events';
import { HighlightsCard, ResultRow, SquadStatusCard } from '@/components/team';
import {
  Card,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TileGrid,
  type TileItem,
} from '@/components/ui';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const PARTICIPATION_LABELS = {
  auto_accept: 'Automatische Zusage – nur Absagen nötig',
  active_response: 'Aktive Zu- und Absage',
  absences_only: 'Nur Abwesenheiten melden',
} as const;

export default function TeamScreen() {
  const { me, api } = useSignedIn();
  const { colors, radii } = useTheme();
  const teams = useMemo(() => [...new Map(me.teams.map((t) => [t.id, t])).values()], [me.teams]);
  const [selected, setSelected] = useState(teams[0]?.id ?? null);
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
  const o = overview.data;
  const roles = me.teams.filter((t) => t.id === team?.id);
  const openPolls = (polls.data ?? []).filter((p) => p.isOpen && !p.myOptionId).length;

  const tiles: TileItem[] = team
    ? [
        {
          key: 'events',
          label: 'Termine',
          icon: 'calendar',
          onPress: () => router.push(`/teams/${team.id}/events`),
        },
        ...(o?.permissions.manageEvents
          ? [
              {
                key: 'new',
                label: 'Termin anlegen',
                icon: 'add-circle' as const,
                onPress: () => router.push(`/teams/${team.id}/event-new`),
              },
            ]
          : [
              {
                key: 'absence',
                label: 'Abwesenheit melden',
                icon: 'airplane' as const,
                onPress: () => router.push('/absences/new'),
              },
            ]),
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
          ? [{ key: 'docs', label: 'Dokumente', icon: 'document-text' as const, soon: true }]
          : []),
        ...(has('training_planning')
          ? [{ key: 'training', label: 'Trainingsplanung', icon: 'clipboard' as const, soon: true }]
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
          contentContainerStyle={{ gap: 8 }}
        >
          {teams.map((t) => {
            const active = t.id === team?.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(t.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.surface,
                }}
              >
                <T variant="label" color={active ? colors.onPrimary : colors.onSurface}>
                  {t.badge} · {t.name}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {!team ? (
        <Empty icon="people-outline" text="Du bist noch keiner Mannschaft zugeordnet." />
      ) : null}

      {team ? (
        <>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {roles.flatMap((r) =>
                r.functions.map((fn) => {
                  const person = me.managedPersons.find((p) => p.id === r.personId);
                  const who = person?.relation === 'child' ? ` (${person.firstName})` : '';
                  return <Chip key={r.personId + fn} label={TEAM_FUNCTION_LABELS[fn] + who} />;
                }),
              )}
              {team.ageGroup ? <Chip tone="neutral" label={team.ageGroup} /> : null}
            </View>
            <T variant="caption">{PARTICIPATION_LABELS[team.participationMode]}</T>
          </Card>

          <TileGrid items={tiles} />

          {overview.isPending ? <Loading /> : null}
          {overview.error ? (
            <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />
          ) : null}

          {o?.nextEvent ? (
            <Section title="Nächster Termin">
              <Card style={{ gap: 12 }}>
                <EventRow event={o.nextEvent} first />
                {o.squad ? (
                  <>
                    <T variant="overline">Kaderstatus</T>
                    <SquadStatusCard squad={o.squad} />
                  </>
                ) : null}
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
              onAction={() => router.push(`/teams/${team.id}/events`)}
            >
              <Card>
                {o.trainingWeek.length === 0 ? (
                  <Empty icon="fitness-outline" text="Keine Trainings in den nächsten 7 Tagen." />
                ) : null}
                {o.trainingWeek.map((e, i) => (
                  <View key={e.id}>
                    <EventRow event={e} first={i === 0} />
                    {e.status === 'scheduled' ? (
                      <T
                        variant="caption"
                        style={{ marginTop: -6, marginBottom: 6, marginLeft: 64 }}
                      >
                        {e.counts.yes} von{' '}
                        {e.counts.yes + e.counts.no + e.counts.maybe + e.counts.pending} zugesagt
                      </T>
                    ) : null}
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          {o && (o.highlights.played > 0 || o.highlights.trainingRate !== null) ? (
            <HighlightsCard h={o.highlights} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
