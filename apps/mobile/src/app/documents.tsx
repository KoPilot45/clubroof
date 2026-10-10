import type { DocumentCategory, DocumentItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  TeamBadge,
  TextField,
  type IconName,
} from '@/components/ui';
import { openDocument } from '@/lib/documents';
import { formatBytes, formatShortDate } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';
import { useMarkSeen } from '@/lib/tile-info';

const CATEGORIES: { value: DocumentCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'regulations', label: 'Ordnungen' },
  { value: 'forms', label: 'Formulare' },
  { value: 'training_plans', label: 'Trainingspläne' },
  { value: 'other', label: 'Sonstiges' },
];

function fileIcon(mime: string): IconName {
  if (mime.includes('pdf')) return 'document-text-outline';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'grid-outline';
  if (mime.includes('word')) return 'document-outline';
  if (mime.startsWith('image/')) return 'image-outline';
  return 'document-attach-outline';
}

export default function DocumentsScreen() {
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const { api, me } = useSignedIn();
  useMarkSeen(teamId ? `documents:${teamId}` : 'documents');
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (q.trim()) params.set('q', q.trim());
  if (teamId) params.set('teamId', teamId);
  const docs = useQuery({
    queryKey: ['documents', category, q.trim(), teamId ?? null],
    queryFn: () => api<DocumentItem[]>(`/documents?${params.toString()}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['documents'] }),
    onError: () => setError('Das Dokument konnte nicht gelöscht werden.'),
  });

  const open = (doc: DocumentItem) => {
    setError(null);
    openDocument(api, doc.id).catch(() => setError('Das Dokument konnte nicht geöffnet werden.'));
  };

  return (
    <Screen edges={[]} refreshing={docs.isRefetching} onRefresh={() => docs.refetch()}>
      {me.create.documents.length ? (
        <Button
          label="Dokument hochladen"
          icon="cloud-upload"
          variant="outline"
          onPress={() =>
            router.push(teamId ? `/documents-upload?teamId=${teamId}` : '/documents-upload')
          }
        />
      ) : null}
      <TextField
        label="Suchen"
        value={q}
        onChangeText={setQ}
        placeholder={t('z. B. Satzung, Aufnahmeantrag')}
      />
      <ChoiceChips options={CATEGORIES} selected={[category]} onToggle={setCategory} />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {docs.isPending ? <Loading /> : null}
      {docs.error ? <ErrorNotice error={docs.error} onRetry={() => docs.refetch()} /> : null}
      {docs.data ? (
        <Card>
          {docs.data.length === 0 ? (
            <Empty icon="folder-open-outline" text="Keine passenden Dokumente." />
          ) : null}
          {docs.data.map((d, i) => (
            <ListRow
              key={d.id}
              first={i === 0}
              onPress={() => open(d)}
              leading={<IconTile name={fileIcon(d.mimeType)} />}
              title={d.title}
              trailing={
                d.canDelete ? (
                  <Button
                    label="Löschen"
                    variant="outline"
                    loading={remove.isPending && remove.variables === d.id}
                    onPress={() => remove.mutate(d.id)}
                  />
                ) : undefined
              }
              subtitle={
                <View
                  style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  {d.source.type === 'team' ? (
                    <TeamBadge badge={d.source.label} />
                  ) : (
                    <Chip tone="info" label={d.source.label} />
                  )}
                  <Chip
                    tone="neutral"
                    label={`${formatBytes(d.sizeBytes)} · ${formatShortDate(d.createdAt.slice(0, 10))}`}
                  />
                </View>
              }
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
