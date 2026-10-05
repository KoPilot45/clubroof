import type { EventSummary, PollSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow } from '@/components/events';
import {
  Card,
  Chip,
  Empty,
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

  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const polls = useQuery({
    queryKey: ['polls', team?.id ?? 'none'],
    queryFn: () => api<PollSummary[]>(`/polls?teamId=${team!.id}`),
    enabled: !!team && has('polls'),
  });
  const teamEvents = (events.data ?? []).filter((e) => e.team?.id === team?.id);
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
        {
          key: 'absence',
          label: 'Abwesenheit melden',
          icon: 'airplane',
          onPress: () => router.push('/absences/new'),
        },
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
        ...(has('squad')
          ? [{ key: 'squad', label: 'Kader', icon: 'people' as const, soon: true }]
          : []),
        ...(has('statistics')
          ? [{ key: 'stats', label: 'Statistik', icon: 'bar-chart' as const, soon: true }]
          : []),
        ...(has('team_cash')
          ? [{ key: 'cash', label: 'Kasse', icon: 'wallet' as const, soon: true }]
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
      refreshing={events.isRefetching}
      onRefresh={() => {
        void events.refetch();
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

          <Section
            title="Nächste Termine"
            action="Alle anzeigen"
            onAction={() => router.push(`/teams/${team.id}/events`)}
          >
            {events.isPending ? <Loading /> : null}
            {events.data ? (
              <Card>
                {teamEvents.length === 0 ? (
                  <Empty icon="calendar-outline" text="Keine Termine." />
                ) : null}
                {teamEvents.slice(0, 4).map((e, i) => (
                  <EventRow key={e.id} event={e} first={i === 0} />
                ))}
              </Card>
            ) : null}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
