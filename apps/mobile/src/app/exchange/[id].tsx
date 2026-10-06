import type { DemandDetail } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { CommentThread } from '@/components/comments';
import { RequestError } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

const STATE_LABEL = {
  available: null,
  absent: 'Abwesend',
  busy: 'Anderweitig im Einsatz',
  nominated: 'Bereits eingetragen',
} as const;

export default function DemandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const demand = useQuery({
    queryKey: ['exchange', 'demand', id],
    queryFn: () => api<DemandDetail>(`/exchange/demands/${id}`),
  });

  const done = (data: DemandDetail) => {
    setError(null);
    queryClient.setQueryData(['exchange', 'demand', id], data);
    void queryClient.invalidateQueries({ queryKey: ['exchange'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');

  const nominate = useMutation({
    mutationFn: (v: { personId: string; fromTeamId: string }) =>
      api<DemandDetail>(`/exchange/demands/${id}/nominate`, { method: 'POST', body: v }),
    onSuccess: done,
    onError: fail,
  });
  const withdraw = useMutation({
    mutationFn: (personId: string) =>
      api<DemandDetail>(`/exchange/demands/${id}/nominations/${personId}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => api<void>(`/exchange/demands/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exchange'] });
      router.back();
    },
    onError: fail,
  });

  if (demand.isPending) return <Loading />;
  if (demand.error)
    return <ErrorNotice message={demand.error.message} onRetry={() => demand.refetch()} />;
  const d = demand.data;
  const open = d.count - d.filled;

  return (
    <Screen edges={[]} refreshing={demand.isRefetching} onRefresh={() => demand.refetch()}>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TeamBadge badge={d.team.badge} />
          <T variant="heading" style={{ flex: 1 }}>
            {d.event.title}
          </T>
        </View>
        <T variant="caption">
          {formatDay(d.event.startsAt)}, {formatTime(d.event.startsAt)} Uhr
          {d.event.location ? ` · ${d.event.location}` : ''}
        </T>
        <T variant="body">
          {d.count} Spieler gesucht{d.positions.length ? ` (${d.positions.join(', ')})` : ''}
        </T>
        {d.note ? <T variant="caption">„{d.note}“</T> : null}
        {open > 0 ? (
          <Chip tone="action" label={`Noch ${open} offen`} />
        ) : (
          <Chip tone="success" icon="checkmark-circle" label="Gedeckt" />
        )}
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {d.guests.length ? (
        <Section title="Eingetragene Gastspieler">
          <Card style={{ gap: 10 }}>
            {d.guests.map((g) => (
              <View key={g.personId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T variant="body">{g.name}</T>
                  <T variant="caption">
                    von {g.fromTeam} ·{' '}
                    {g.status === 'yes'
                      ? 'Zugesagt'
                      : g.status === 'no'
                        ? 'Abgesagt'
                        : 'Antwort steht aus'}
                  </T>
                </View>
                {g.canWithdraw ? (
                  <Button
                    label="Zurückziehen"
                    variant="outline"
                    onPress={() => withdraw.mutate(g.personId)}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {d.candidates.length ? (
        <Section title="Spieler abstellen">
          {d.candidates.map((c) => (
            <Card key={c.team.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TeamBadge badge={c.team.badge} />
                <T variant="heading">{c.team.name}</T>
              </View>
              {c.players.map((p) => (
                <View
                  key={p.personId}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <View style={{ flex: 1 }}>
                    <T variant="body">
                      {p.name}
                      {p.jerseyNumber != null ? ` · Nr. ${p.jerseyNumber}` : ''}
                    </T>
                    <T variant="caption">
                      {[p.position, p.hint].filter(Boolean).join(' · ') || ' '}
                    </T>
                  </View>
                  {p.state === 'available' ? (
                    <Button
                      label="Abstellen"
                      icon="person-add"
                      disabled={open <= 0}
                      loading={nominate.isPending && nominate.variables?.personId === p.personId}
                      onPress={() =>
                        nominate.mutate({ personId: p.personId, fromTeamId: c.team.id })
                      }
                    />
                  ) : (
                    <Chip tone="neutral" label={STATE_LABEL[p.state]!} />
                  )}
                </View>
              ))}
            </Card>
          ))}
        </Section>
      ) : null}

      {d.availability.length ? (
        <Section title="Verfügbarkeit anderer Mannschaften">
          <Card style={{ gap: 8 }}>
            {d.availability.map((a) => (
              <View key={a.team.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TeamBadge badge={a.team.badge} />
                <T variant="body" style={{ flex: 1 }}>
                  {a.team.name}
                </T>
                <T variant="caption">
                  {a.available} von {a.players} verfügbar
                </T>
              </View>
            ))}
            <T variant="caption">
              Aus Datenschutzgründen siehst du nur Zahlen. Den Trainer der Mannschaft kannst du über
              „Ansprechpartner“ erreichen.
            </T>
          </Card>
        </Section>
      ) : null}

      {d.mine ? (
        <Button
          label="Bedarf zurückziehen"
          variant="danger"
          icon="trash"
          loading={cancel.isPending}
          onPress={() => cancel.mutate()}
        />
      ) : null}
      <CommentThread type="demand" id={d.id} />
    </Screen>
  );
}
