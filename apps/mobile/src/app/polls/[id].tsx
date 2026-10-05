import type { PollDetail } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Chip, ErrorNotice, Loading, Screen, T, TeamBadge } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatLongDate, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { PollStatus } from '@/components/polls';

const VISIBILITY_HINT = {
  always: 'Die Ergebnisse sind für alle sichtbar.',
  after_vote: 'Die Ergebnisse siehst du, sobald du abgestimmt hast.',
  after_close: 'Die Ergebnisse bleiben bis zum Ende der Frist verborgen.',
} as const;

export default function PollScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const poll = useQuery({ queryKey: ['poll', id], queryFn: () => api<PollDetail>(`/polls/${id}`) });
  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api<PollDetail>(`/polls/${id}/vote`, { method: 'PUT', body: { optionId } }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['poll', id], data);
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Stimme konnte nicht gespeichert werden.',
      ),
  });
  const p = poll.data;
  const total = p?.options.reduce((sum, o) => sum + (o.votes ?? 0), 0) ?? 0;

  return (
    <Screen edges={[]} refreshing={poll.isRefetching} onRefresh={() => poll.refetch()}>
      {poll.isPending ? <Loading /> : null}
      {poll.error ? (
        <ErrorNotice message={poll.error.message} onRetry={() => poll.refetch()} />
      ) : null}
      {p ? (
        <>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {p.source.type === 'team' ? (
                <TeamBadge badge={p.source.label} />
              ) : (
                <Chip tone="info" label={p.source.label} />
              )}
              <PollStatus poll={p} />
            </View>
            <T variant="display">{p.question}</T>
            <T variant="caption">
              {p.closesAt
                ? `${p.isOpen ? 'Abstimmung bis' : 'Beendet am'} ${formatLongDate(p.closesAt)}, ${formatTime(p.closesAt)} Uhr`
                : 'Ohne Frist'}
              {` · ${p.votes} ${p.votes === 1 ? 'Stimme' : 'Stimmen'}`}
              {p.createdBy ? ` · Erstellt von ${p.createdBy}` : ''}
            </T>
            {p.description ? <T>{p.description}</T> : null}
          </View>

          <Card style={{ gap: 8 }}>
            {p.options.map((o) => {
              const mine = p.myOptionId === o.id;
              const share =
                p.resultsVisible && total > 0 ? Math.round(((o.votes ?? 0) / total) * 100) : null;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mine, disabled: !p.isOpen }}
                  disabled={!p.isOpen || vote.isPending}
                  onPress={() => vote.mutate(o.id)}
                  style={{
                    gap: 8,
                    padding: 12,
                    borderRadius: radii.md,
                    borderWidth: mine ? 2 : 1,
                    borderColor: mine ? colors.primaryText : colors.border,
                    backgroundColor: mine ? colors.primaryContainer : colors.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons
                      name={mine ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={mine ? colors.onPrimaryContainer : colors.onSurfaceMuted}
                    />
                    <T
                      style={{ flex: 1, fontWeight: '600' }}
                      color={mine ? colors.onPrimaryContainer : undefined}
                    >
                      {o.label}
                    </T>
                    {share !== null ? (
                      <T
                        variant="label"
                        color={mine ? colors.onPrimaryContainer : colors.onSurfaceMuted}
                      >
                        {share} %
                      </T>
                    ) : null}
                  </View>
                  {share !== null ? (
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.surfaceVariant,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${share}%`,
                          height: '100%',
                          backgroundColor: colors.primaryText,
                        }}
                      />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>

          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
          <Card style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={18} color={colors.onSurfaceMuted} />
            <T variant="caption" style={{ flex: 1 }}>
              {VISIBILITY_HINT[p.resultVisibility]}
              {p.isOpen ? ' Du kannst deine Stimme bis zum Ende ändern.' : ''}
            </T>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
