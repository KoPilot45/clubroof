import type { LineupCandidate, LineupRole, MatchSheet } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

type Pick = { role: LineupRole; jersey: string };
const STATUS = {
  yes: { label: 'Zugesagt', tone: 'success' },
  maybe: { label: 'Unsicher', tone: 'action' },
  pending: { label: 'Offen', tone: 'neutral' },
  no: { label: 'Abgesagt', tone: 'urgent' },
} as const;

export default function LineupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const sheet = useQuery({
    queryKey: ['match', id],
    queryFn: () => api<MatchSheet>(`/events/${id}/match`),
  });
  if (sheet.isPending) return <Loading />;
  if (sheet.error) return <ErrorNotice error={sheet.error} onRetry={() => sheet.refetch()} />;
  return <Editor sheet={sheet.data} />;
}

function Editor({ sheet }: { sheet: MatchSheet }) {
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(
      (sheet.lineup?.entries ?? []).map((e) => [
        e.personId,
        { role: e.role, jersey: e.jerseyNumber != null ? String(e.jerseyNumber) : '' },
      ]),
    ),
  );
  const candidates = sheet.candidates ?? [];
  const starters = Object.values(picks).filter((p) => p.role === 'starter').length;
  const bench = Object.values(picks).filter((p) => p.role === 'substitute').length;

  const cycle = (c: LineupCandidate) => {
    if (c.status === 'no') return;
    setPicks((cur) => {
      const now = cur[c.personId];
      const next = { ...cur };
      const jersey = now?.jersey ?? (c.jerseyNumber != null ? String(c.jerseyNumber) : '');
      if (!now) next[c.personId] = { role: starters < 11 ? 'starter' : 'substitute', jersey };
      else if (now.role === 'starter') next[c.personId] = { role: 'substitute', jersey };
      else delete next[c.personId];
      return next;
    });
  };

  const save = useMutation({
    mutationFn: (publish: boolean) =>
      api<MatchSheet>(`/events/${sheet.eventId}/lineup`, {
        method: 'PUT',
        body: {
          publish,
          entries: Object.entries(picks).map(([personId, p]) => ({
            personId,
            role: p.role,
            jerseyNumber: sheet.jerseyMode && p.jersey.trim() ? Number(p.jersey) : null,
          })),
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['match', sheet.eventId], data);
      void queryClient.invalidateQueries({ queryKey: ['event', sheet.eventId] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Aufstellung konnte nicht gespeichert werden.',
      ),
  });

  const label = (role?: LineupRole) =>
    role === 'starter' ? 'Startelf' : role === 'substitute' ? 'Bank' : '–';
  return (
    <Screen edges={[]}>
      <Card style={{ gap: 4 }}>
        <T variant="heading">{sheet.title}</T>
        <T variant="caption">
          Tippe auf einen Spieler: Startelf → Bank → nicht dabei. Wer abgesagt hat, kann nicht
          nominiert werden.
        </T>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <Chip tone={starters === 11 ? 'success' : 'action'} label={`Startelf ${starters}/11`} />
          <Chip tone="neutral" label={`Bank ${bench}`} />
        </View>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Section title="Spieler">
        <Card style={{ gap: 8 }}>
          {candidates.map((c) => {
            const p = picks[c.personId];
            const disabled = c.status === 'no';
            return (
              <View
                key={c.personId}
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  alignItems: 'center',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}: ${label(p?.role)}`}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => cycle(c)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 10,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: p ? colors.primary : colors.border,
                    backgroundColor:
                      p?.role === 'starter' ? colors.primaryContainer : colors.surface,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <T variant="body" style={{ fontWeight: '700' }}>
                      {c.name}
                    </T>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <Chip tone={STATUS[c.status].tone} label={STATUS[c.status].label} />
                      {c.position ? <Chip tone="neutral" label={c.position} /> : null}
                      {c.guestFrom ? <Chip tone="info" label={`Gast ${c.guestFrom}`} /> : null}
                    </View>
                  </View>
                  <T variant="label" color={p ? colors.primaryText : colors.onSurfaceMuted}>
                    {label(p?.role)}
                  </T>
                </Pressable>
                {p && sheet.jerseyMode ? (
                  <View style={{ width: 64 }}>
                    <TextField
                      label="Nr."
                      value={p.jersey}
                      onChangeText={(v) =>
                        setPicks((cur) => ({
                          ...cur,
                          [c.personId]: { ...cur[c.personId]!, jersey: v.replace(/\D/g, '') },
                        }))
                      }
                      maxLength={2}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      </Section>
      <Button
        label={
          sheet.lineup?.published
            ? 'Änderungen veröffentlichen'
            : 'Veröffentlichen und Spieler benachrichtigen'
        }
        icon="send"
        loading={save.isPending && save.variables === true}
        disabled={starters === 0}
        onPress={() => save.mutate(true)}
      />
      {!sheet.lineup?.published ? (
        <Button
          label="Als Entwurf speichern"
          variant="outline"
          loading={save.isPending && save.variables === false}
          onPress={() => save.mutate(false)}
        />
      ) : null}
    </Screen>
  );
}
