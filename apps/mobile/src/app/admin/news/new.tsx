import type { EditorialNews, EditorialOverview, SaveNewsInput } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { NewsEditor } from '@/components/news-editor';
import { Chip, ErrorNotice, Loading, Screen } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

export default function NewNewsScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ['editorial'],
    queryFn: () => api<EditorialOverview>('/editorial/news'),
  });
  const save = useMutation({
    mutationFn: (body: SaveNewsInput) =>
      api<EditorialNews>('/editorial/news', { method: 'POST', body }),
    onSuccess: (n) => {
      for (const k of ['editorial', 'news', 'home'])
        void queryClient.invalidateQueries({ queryKey: [k] });
      router.replace(`/admin/news/${n.id}`);
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Die News konnte nicht gespeichert werden.'),
  });
  if (overview.isPending) return <Loading />;
  if (overview.error)
    return <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />;
  return (
    <Screen edges={[]}>
      <NewsEditor
        scopes={overview.data.scopes}
        busy={save.isPending}
        onSave={(b) => save.mutate(b)}
      />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
    </Screen>
  );
}
