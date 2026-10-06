import type { ForumTopicDetail } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
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
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function ForumTopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const key = ['forum', id];
  const topic = useQuery({ queryKey: key, queryFn: () => api<ForumTopicDetail>(`/forum/${id}`) });
  const act = useMutation({
    mutationFn: (v: { path: string; method: 'POST' | 'PATCH'; body?: unknown }) =>
      api<ForumTopicDetail>(v.path, { method: v.method, body: v.body }),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['forum'], exact: true });
    },
  });
  if (topic.isPending) return <Loading />;
  if (topic.error) return <ErrorNotice error={topic.error} onRetry={() => topic.refetch()} />;
  const t = topic.data;
  return (
    <Screen edges={[]} refreshing={topic.isRefetching} onRefresh={() => topic.refetch()}>
      <Card style={{ gap: 8 }}>
        <T variant="title">{t.title}</T>
        <T>{t.body}</T>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {t.author ? <Chip tone="neutral" label={`von ${t.author}`} /> : null}
          {t.open ? (
            <Chip
              tone="success"
              label={`offen bis ${new Date(t.closesAt).toLocaleDateString('de-DE')}`}
            />
          ) : (
            <Chip tone="archived" icon="lock-closed" label="Geschlossen" />
          )}
        </View>
        {t.canModerate ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={t.open ? 'Schließen' : 'Wieder öffnen'}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() =>
                act.mutate({ path: `/forum/${id}`, method: 'PATCH', body: { closed: t.open } })
              }
            />
            <Button
              label={t.pinned ? 'Nicht mehr anheften' : 'Anheften'}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() =>
                act.mutate({ path: `/forum/${id}`, method: 'PATCH', body: { pinned: !t.pinned } })
              }
            />
          </View>
        ) : null}
      </Card>

      <Section title={`Antworten (${t.posts.length})`}>
        {t.posts.map((p) => (
          <Card
            key={p.id}
            style={{ gap: 6, borderColor: p.reported ? colors.status.action.solid : colors.border }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T variant="label" style={{ fontWeight: '700' }}>
                {p.mine ? 'Du' : p.author}
              </T>
              <T variant="caption">{formatAgo(p.createdAt)}</T>
            </View>
            {p.hidden ? (
              <Chip tone="archived" icon="eye-off" label="Vom Moderationsteam ausgeblendet" />
            ) : null}
            {p.body ? (
              <View
                style={{
                  padding: p.hidden ? 8 : 0,
                  borderRadius: radii.sm,
                  backgroundColor: p.hidden ? colors.background : 'transparent',
                }}
              >
                <T>{p.body}</T>
              </View>
            ) : null}
            {p.reported ? <Chip tone="action" icon="flag" label="Gemeldet" /> : null}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {!p.mine && !p.hidden ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    act.mutate({ path: `/forum/posts/${p.id}/report`, method: 'POST' })
                  }
                >
                  <T variant="caption">Melden</T>
                </Pressable>
              ) : null}
              {t.canModerate ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    act.mutate({
                      path: `/forum/posts/${p.id}/moderate`,
                      method: 'POST',
                      body: { hidden: !p.hidden },
                    })
                  }
                >
                  <T variant="caption" color={colors.primaryText}>
                    {p.hidden ? 'Wieder einblenden' : 'Ausblenden'}
                  </T>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))}
      </Section>

      {t.canPost ? (
        <Card style={{ gap: 8 }}>
          <TextField
            label="Deine Antwort"
            value={text}
            onChangeText={setText}
            maxLength={2000}
            multiline
          />
          {act.error ? (
            <Chip
              tone="urgent"
              icon="alert-circle"
              label={act.error instanceof RequestError ? act.error.message : 'Nicht gesendet.'}
            />
          ) : null}
          <Button
            label="Antworten"
            icon="send"
            disabled={!text.trim()}
            loading={act.isPending}
            onPress={() =>
              act.mutate(
                { path: `/forum/${id}/posts`, method: 'POST', body: { body: text } },
                { onSuccess: () => setText('') },
              )
            }
          />
        </Card>
      ) : (
        <T variant="caption">Das Thema ist geschlossen – Antworten sind nicht mehr möglich.</T>
      )}
    </Screen>
  );
}
