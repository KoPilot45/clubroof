import type { RefereeOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

const STATUS = {
  requested: { label: 'Angefragt', tone: 'action' },
  confirmed: { label: 'Bestätigt', tone: 'success' },
  declined: { label: 'Abgesagt', tone: 'urgent' },
} as const;

export default function RefereesScreen() {
  const { api, me } = useSignedIn();
  const when = new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: me.club.timezone,
  });
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ['referees'],
    queryFn: () => api<RefereeOverview>('/referees'),
  });
  const act = useMutation({
    mutationFn: (v: { path: string; method: 'POST' | 'DELETE'; body?: unknown }) =>
      api<RefereeOverview>(v.path, { method: v.method, body: v.body }),
    onSuccess: (d) => {
      queryClient.setQueryData(['referees'], d);
      setPicking(null);
    },
  });
  if (data.isPending) return <Loading />;
  if (data.error) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const r = data.data;
  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {act.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={act.error instanceof RequestError ? act.error.message : 'Das hat nicht geklappt.'}
        />
      ) : null}
      {r.mine.length ? (
        <Section title="Meine Einsätze">
          {r.mine.map((m) => (
            <Card key={m.assignmentId} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TeamBadge badge={m.badge} />
                <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
                  {m.title}
                </T>
                <Chip tone={STATUS[m.status].tone} label={STATUS[m.status].label} />
              </View>
              <T variant="caption">{`${when.format(new Date(m.startsAt))} Uhr${m.location ? ` · ${m.location}` : ''}`}</T>
              {m.status !== 'declined' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {m.status === 'requested' ? (
                    <Button
                      label="Bestätigen"
                      icon="checkmark"
                      style={{ flex: 1 }}
                      onPress={() =>
                        act.mutate({
                          path: `/referees/assignments/${m.assignmentId}/respond`,
                          method: 'POST',
                          body: { status: 'confirmed' },
                        })
                      }
                    />
                  ) : null}
                  <Button
                    label="Kann nicht"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      act.mutate({
                        path: `/referees/assignments/${m.assignmentId}/respond`,
                        method: 'POST',
                        body: { status: 'declined' },
                      })
                    }
                  />
                </View>
              ) : null}
            </Card>
          ))}
        </Section>
      ) : null}
      {r.canManage ? (
        <>
          <Section title="Heimspiele (6 Wochen)">
            {r.matches.length === 0 ? (
              <Card>
                <Empty icon="football-outline" text="Keine Heimspiele geplant." />
              </Card>
            ) : null}
            {r.matches.map((m) => {
              const active = m.assignments.filter((a) => a.status !== 'declined');
              return (
                <Card key={m.eventId} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TeamBadge badge={m.badge} />
                    <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
                      {m.title}
                    </T>
                    {active.length === 0 ? <Chip tone="urgent" label="Schiri fehlt" /> : null}
                  </View>
                  <T variant="caption">{`${when.format(new Date(m.startsAt))} Uhr`}</T>
                  {m.assignments.map((a) => (
                    <View key={a.id} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <T
                        style={{ flex: 1 }}
                      >{`${a.name}${a.role === 'assistant' ? ' (Assistent)' : ''}`}</T>
                      <Chip tone={STATUS[a.status].tone} label={STATUS[a.status].label} />
                    </View>
                  ))}
                  {picking === m.eventId ? (
                    <ChoiceChips
                      options={r.referees
                        .filter(
                          (x) => x.active && !m.assignments.some((a) => a.personId === x.personId),
                        )
                        .map((x) => ({ value: x.personId, label: `${x.name} (${x.upcoming})` }))}
                      selected={[]}
                      onToggle={(personId) =>
                        act.mutate({
                          path: '/referees/assignments',
                          method: 'POST',
                          body: { eventId: m.eventId, personId },
                        })
                      }
                    />
                  ) : (
                    <Button
                      label="Schiedsrichter einteilen"
                      icon="person-add-outline"
                      variant="outline"
                      onPress={() => setPicking(m.eventId)}
                    />
                  )}
                </Card>
              );
            })}
          </Section>
          <Section title="Vereinsschiedsrichter">
            <Card style={{ gap: 6 }}>
              {r.referees.map((x) => (
                <View
                  key={x.personId}
                  style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <T>{x.name}</T>
                  <T variant="caption">{`${x.level ?? ''} · ${x.upcoming} Einsätze`}</T>
                </View>
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
