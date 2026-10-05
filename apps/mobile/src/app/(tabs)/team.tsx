import type { EventSummary } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow } from '@/components/events';
import { Card, Chip, Empty, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
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

  const events = useQuery({
    queryKey: ['events'],
    queryFn: () => api<EventSummary[]>('/events'),
  });
  const teamEvents = (events.data ?? []).filter((e) => e.team?.id === team?.id);
  const functions = me.teams.filter((t) => t.id === team?.id);

  return (
    <Screen
      header={
        <AppHeader title={team ? team.name : 'Team'} subtitle={team?.league ?? me.club.shortName} />
      }
      refreshing={events.isRefetching}
      onRefresh={() => events.refetch()}
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
        <Card style={{ gap: 8 }}>
          <T variant="overline">Meine Rolle</T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {functions.flatMap((f) =>
              f.functions.map((fn) => {
                const person = me.managedPersons.find((p) => p.id === f.personId);
                const who = person?.relation === 'child' ? ` (${person.firstName})` : '';
                return <Chip key={f.personId + fn} label={TEAM_FUNCTION_LABELS[fn] + who} />;
              }),
            )}
          </View>
          <T variant="caption">{PARTICIPATION_LABELS[team.participationMode]}</T>
        </Card>
      ) : null}

      {team ? (
        <Section title="Termine der nächsten 4 Wochen">
          {events.isPending ? <Loading /> : null}
          {events.error ? (
            <ErrorNotice message={events.error.message} onRetry={() => events.refetch()} />
          ) : null}
          {events.data ? (
            <Card>
              {teamEvents.length === 0 ? (
                <Empty icon="calendar-outline" text="Keine Termine." />
              ) : null}
              {teamEvents.map((e, i) => (
                <EventRow key={e.id} event={e} first={i === 0} />
              ))}
            </Card>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}
