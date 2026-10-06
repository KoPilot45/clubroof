import type { ForumOverview, ForumTopicDetail } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatAgo, formatRemaining } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

export default function ForumScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [days, setDays] = useState('14');
  const forum = useQuery({ queryKey: ['forum'], queryFn: () => api<ForumOverview>('/forum') });
  const create = useMutation({
    mutationFn: () =>
      api<ForumTopicDetail>('/forum', {
        method: 'POST',
        body: { title, body, days: Number(days) },
      }),
    onSuccess: (topic) => {
      void queryClient.invalidateQueries({ queryKey: ['forum'] });
      setCreating(false);
      setTitle('');
      setBody('');
      router.push(`/forum/${topic.id}`);
    },
  });
  if (forum.isPending) return <Loading />;
  if (forum.error) return <ErrorNotice error={forum.error} onRetry={() => forum.refetch()} />;
  const f = forum.data;
  return (
    <Screen edges={[]} refreshing={forum.isRefetching} onRefresh={() => forum.refetch()}>
      <Card style={{ gap: 4 }}>
        <T variant="caption">
          Wenige Themen, die nach Ablauf schließen – für Absprachen, Ideen und Rückmeldungen. Bitte
          freundlich bleiben; das Moderationsteam blendet Unpassendes aus.
        </T>
      </Card>
      {f.canCreate ? (
        creating ? (
          <Card style={{ gap: 12 }}>
            <TextField label="Thema" value={title} onChangeText={setTitle} maxLength={100} />
            <TextField
              label="Worum geht es?"
              value={body}
              onChangeText={setBody}
              maxLength={2000}
              multiline
            />
            <ChoiceChips
              label="Offen für"
              options={[
                { value: '7', label: '1 Woche' },
                { value: '14', label: '2 Wochen' },
                { value: '30', label: '1 Monat' },
                { value: '60', label: '2 Monate' },
              ]}
              selected={[days]}
              onToggle={setDays}
            />
            {create.error ? (
              <Chip
                tone="urgent"
                icon="alert-circle"
                label={
                  create.error instanceof RequestError ? create.error.message : 'Nicht gespeichert.'
                }
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Abbrechen"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setCreating(false)}
              />
              <Button
                label="Eröffnen"
                style={{ flex: 1 }}
                loading={create.isPending}
                disabled={title.trim().length < 3 || !body.trim()}
                onPress={() => create.mutate()}
              />
            </View>
          </Card>
        ) : (
          <Button label="Thema eröffnen" icon="add" onPress={() => setCreating(true)} />
        )
      ) : null}
      <Card>
        {f.topics.length === 0 ? (
          <Empty icon="chatbubbles-outline" text="Gerade keine Themen." />
        ) : null}
        {f.topics.map((t, i) => (
          <ListRow
            key={t.id}
            first={i === 0}
            title={`${t.pinned ? '📌 ' : ''}${t.title}`}
            subtitle={
              <View style={{ gap: 4 }}>
                <T variant="caption">
                  {`${t.postCount} ${t.postCount === 1 ? 'Antwort' : 'Antworten'}${t.lastPostAt ? ` · zuletzt ${formatAgo(t.lastPostAt)}` : ''}`}
                </T>
                {t.open ? (
                  <Chip
                    tone="neutral"
                    icon="time-outline"
                    label={`offen ${formatRemaining(t.closesAt).replace(/^Noch /, 'noch ')}`}
                  />
                ) : (
                  <Chip tone="archived" icon="lock-closed" label="Geschlossen" />
                )}
              </View>
            }
            onPress={() => router.push(`/forum/${t.id}`)}
          />
        ))}
      </Card>
    </Screen>
  );
}
