import type { WikiOverview, WikiPage } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

export default function WikiPageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const overview = useQuery({ queryKey: ['wiki'], queryFn: () => api<WikiOverview>('/wiki') });
  const page = useQuery({
    queryKey: ['wiki', id],
    queryFn: () => api<WikiPage>(`/wiki/${id}`),
    enabled: !isNew,
  });
  useEffect(() => {
    if (!page.data) return;
    setTitle(page.data.title);
    setCategory(page.data.category);
    setBody(page.data.body);
  }, [page.data]);
  const save = useMutation({
    mutationFn: () =>
      api<WikiPage>(isNew ? '/wiki' : `/wiki/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: { title, category, body },
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['wiki'] });
      if (isNew) router.replace(`/wiki/${data.id}`);
      else {
        queryClient.setQueryData(['wiki', id], data);
        setEditing(false);
      }
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/wiki/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wiki'] });
      router.back();
    },
  });

  if (!isNew && page.isPending) return <Loading />;
  if (page.error) return <ErrorNotice error={page.error} onRetry={() => page.refetch()} />;
  const canEdit = overview.data?.canEdit ?? false;

  if (editing)
    return (
      <Screen edges={[]}>
        <Card style={{ gap: 12 }}>
          <TextField label="Titel" value={title} onChangeText={setTitle} maxLength={100} />
          {overview.data?.categories.length ? (
            <ChoiceChips
              label="Kategorie"
              options={overview.data.categories.map((c) => ({ value: c, label: c }))}
              selected={[category]}
              onToggle={setCategory}
            />
          ) : null}
          <TextField
            label="Neue Kategorie"
            value={category}
            onChangeText={setCategory}
            maxLength={40}
          />
          <TextField label="Text" value={body} onChangeText={setBody} maxLength={10000} multiline />
          {save.error ? (
            <Chip
              tone="urgent"
              icon="alert-circle"
              label={save.error instanceof RequestError ? save.error.message : 'Nicht gespeichert.'}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label="Abbrechen"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => (isNew ? router.back() : setEditing(false))}
            />
            <Button
              label="Speichern"
              style={{ flex: 1 }}
              loading={save.isPending}
              disabled={title.trim().length < 3 || category.trim().length < 2 || !body.trim()}
              onPress={() => save.mutate()}
            />
          </View>
        </Card>
      </Screen>
    );

  const p = page.data!;
  return (
    <Screen edges={[]} refreshing={page.isRefetching} onRefresh={() => page.refetch()}>
      <Card style={{ gap: 10 }}>
        <Chip tone="neutral" label={p.category} />
        <T variant="title">{p.title}</T>
        <T>{p.body}</T>
        <T variant="caption">{`Aktualisiert ${formatAgo(p.updatedAt)}${p.updatedBy ? ` von ${p.updatedBy}` : ''}`}</T>
      </Card>
      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label="Bearbeiten"
            icon="create-outline"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => setEditing(true)}
          />
          <Button
            label="Löschen"
            variant="danger"
            style={{ flex: 1 }}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
        </View>
      ) : null}
    </Screen>
  );
}
