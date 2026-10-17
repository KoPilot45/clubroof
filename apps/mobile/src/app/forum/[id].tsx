import type { ForumTopicDetail } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { EditedNote } from '@/components/edited';
import { EditSheet } from '@/components/edit-sheet';
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
import { dateFormat } from '@/lib/i18n';

export default function ForumTopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ kind: 'topic' } | { kind: 'post'; id: string } | null>(
    null,
  );
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
        <EditedNote at={t.editedAt} />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {t.author ? <Chip tone="neutral" label={`von ${t.author}`} /> : null}
          {t.open ? (
            <Chip
              tone="success"
              label={`offen bis ${dateFormat({ dateStyle: 'short' }).format(new Date(t.closesAt))}`}
            />
          ) : (
            <Chip tone="archived" icon="lock-closed" label="Geschlossen" />
          )}
        </View>
        {t.canEdit ? (
          <Button
            label="Bearbeiten"
            icon="create-outline"
            variant="outline"
            onPress={() => setEditing({ kind: 'topic' })}
          />
        ) : null}
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
            <EditedNote at={p.editedAt} />
            {p.reported ? <Chip tone="action" icon="flag" label="Gemeldet" /> : null}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              {p.canEdit ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditing({ kind: 'post', id: p.id })}
                >
                  <T variant="caption" color={colors.primaryText}>
                    Bearbeiten
                  </T>
                </Pressable>
              ) : null}
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
      <EditSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'post' ? 'Antwort bearbeiten' : 'Thema bearbeiten'}
        fields={
          editing?.kind === 'post'
            ? [
                {
                  key: 'body',
                  label: 'Deine Antwort',
                  value: t.posts.find((p) => p.id === editing.id)?.body ?? '',
                  maxLength: 2000,
                  multiline: true,
                },
              ]
            : [
                { key: 'title', label: 'Titel', value: t.title, maxLength: 200 },
                {
                  key: 'body',
                  label: 'Beschreibung',
                  value: t.body,
                  maxLength: 2000,
                  multiline: true,
                },
              ]
        }
        onSave={(v) =>
          act.mutateAsync(
            editing?.kind === 'post'
              ? { path: `/forum/posts/${editing.id}`, method: 'PATCH', body: { body: v.body } }
              : { path: `/forum/${id}`, method: 'PATCH', body: { title: v.title, body: v.body } },
          )
        }
      />
    </Screen>
  );
}
