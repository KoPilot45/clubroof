import type { CommentEntity, CommentItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Section, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Kurzer Austausch der Beteiligten zu einer Freigabe oder Anfrage. */
export function CommentThread({ type, id }: { type: CommentEntity; id: string }) {
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const key = ['comments', type, id];
  const comments = useQuery({
    queryKey: key,
    queryFn: () => api<CommentItem[]>(`/comments/${type}/${id}`),
  });
  const post = useMutation({
    mutationFn: () =>
      api<CommentItem[]>(`/comments/${type}/${id}`, { method: 'POST', body: { body: text } }),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      setText('');
    },
  });
  if (!comments.data) return null;
  return (
    <Section title={`Kommentare (${comments.data.length})`}>
      <Card style={{ gap: 10 }}>
        {comments.data.length === 0 ? (
          <T variant="caption">
            Noch keine Kommentare. Rückfragen landen direkt bei den Beteiligten.
          </T>
        ) : null}
        {comments.data.map((c) => (
          <View
            key={c.id}
            style={{
              alignSelf: c.mine ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              padding: 10,
              gap: 2,
              borderRadius: radii.md,
              backgroundColor: c.mine ? colors.primaryContainer : colors.background,
            }}
          >
            <T variant="caption" style={{ fontWeight: '700' }}>
              {c.mine ? 'Du' : c.author} · {formatAgo(c.createdAt)}
            </T>
            <T>{c.body}</T>
          </View>
        ))}
        <TextField
          label="Kommentar"
          value={text}
          onChangeText={setText}
          maxLength={1000}
          multiline
        />
        {post.error ? (
          <Chip
            tone="urgent"
            icon="alert-circle"
            label={post.error instanceof RequestError ? post.error.message : 'Nicht gesendet.'}
          />
        ) : null}
        <Button
          label="Senden"
          icon="send"
          loading={post.isPending}
          disabled={!text.trim()}
          onPress={() => post.mutate()}
        />
      </Card>
    </Section>
  );
}
