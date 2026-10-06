import type {
  EditorialNews,
  EditorialOverview,
  NewsReadReceipt,
  SaveNewsInput,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { NewsEditor } from '@/components/news-editor';
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
import { useTheme } from '@/lib/theme';

const STATUS = {
  draft: { label: 'Entwurf', tone: 'neutral' },
  pending_approval: { label: 'Wartet auf Freigabe', tone: 'action' },
  published: { label: 'Veröffentlicht', tone: 'success' },
  archived: { label: 'Zurückgezogen', tone: 'neutral' },
} as const;

const REJECT_NOTES = [
  'Bitte Rechtschreibung prüfen',
  'Bitte Datum/Uhrzeit ergänzen',
  'Passt nicht in die Vereins-News',
];

export default function EditNewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const news = useQuery({
    queryKey: ['editorial', id],
    queryFn: () => api<EditorialNews>(`/editorial/news/${id}`),
  });
  const overview = useQuery({
    queryKey: ['editorial'],
    queryFn: () => api<EditorialOverview>('/editorial/news'),
  });

  const refresh = (data?: EditorialNews) => {
    setError(null);
    if (data) queryClient.setQueryData(['editorial', id], data);
    for (const k of ['editorial', 'news', 'home', 'notifications'])
      void queryClient.invalidateQueries({ queryKey: [k] });
  };
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');

  const save = useMutation({
    mutationFn: (body: SaveNewsInput) =>
      api<EditorialNews>(`/editorial/news/${id}`, { method: 'PUT', body }),
    onSuccess: (d) => {
      refresh(d);
      setEditing(false);
    },
    onError: fail,
  });
  const approve = useMutation({
    mutationFn: () => api<EditorialNews>(`/editorial/news/${id}/approve`, { method: 'POST' }),
    onSuccess: refresh,
    onError: fail,
  });
  const reject = useMutation({
    mutationFn: () =>
      api<EditorialNews>(`/editorial/news/${id}/reject`, { method: 'POST', body: { note } }),
    onSuccess: (d) => {
      refresh(d);
      setRejecting(false);
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api<void>(`/editorial/news/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      router.back();
    },
    onError: fail,
  });

  if (news.isPending) return <Loading />;
  if (news.error)
    return <ErrorNotice message={news.error.message} onRetry={() => news.refetch()} />;
  const n = news.data;

  if (editing) {
    return (
      <Screen edges={[]}>
        <NewsEditor
          scopes={overview.data?.scopes ?? []}
          initial={n}
          busy={save.isPending}
          onSave={(b) => save.mutate(b)}
        />
        <Button label="Abbrechen" variant="outline" onPress={() => setEditing(false)} />
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      </Screen>
    );
  }

  return (
    <Screen edges={[]} refreshing={news.isRefetching} onRefresh={() => news.refetch()}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip tone={STATUS[n.status].tone} label={STATUS[n.status].label} />
          <Chip tone="neutral" label={n.scope.label} />
          {n.priority !== 'info' ? (
            <Chip
              tone={n.priority === 'urgent' ? 'urgent' : 'action'}
              label={n.priority === 'urgent' ? 'Dringend' : 'Wichtig'}
            />
          ) : null}
        </View>
        <T variant="title">{n.title}</T>
        {n.teaser ? <T color={colors.onSurfaceMuted}>{n.teaser}</T> : null}
        <T>{n.body}</T>
        <T variant="caption">
          {n.author ? `von ${n.author} · ` : ''}
          {n.publishedAt
            ? `veröffentlicht ${formatAgo(n.publishedAt)}`
            : `geändert ${formatAgo(n.updatedAt)}`}
        </T>
      </Card>

      {n.status === 'published' && (n.mine || n.can.publish) ? <ReadReceipt id={n.id} /> : null}

      {n.reviewNote && n.status === 'draft' ? (
        <Card style={{ gap: 4 }}>
          <Chip tone="urgent" icon="chatbox-ellipses" label="Rückmeldung der Freigabe" />
          <T>{n.reviewNote}</T>
        </Card>
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {n.status === 'pending_approval' && n.can.publish ? (
        rejecting ? (
          <Card style={{ gap: 10 }}>
            <ChoiceChips
              label="Rückmeldung an die Verfasserin / den Verfasser"
              options={REJECT_NOTES.map((r) => ({ value: r, label: r }))}
              selected={REJECT_NOTES.includes(note) ? [note] : []}
              onToggle={setNote}
            />
            <TextField
              label="Oder eigene Rückmeldung"
              value={note}
              onChangeText={setNote}
              maxLength={300}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                style={{ flex: 1 }}
                label="Zurück"
                variant="outline"
                onPress={() => setRejecting(false)}
              />
              <Button
                style={{ flex: 1 }}
                label="Zurückgeben"
                variant="danger"
                disabled={note.trim().length < 3}
                loading={reject.isPending}
                onPress={() => reject.mutate()}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            <Button
              label="Freigeben und veröffentlichen"
              icon="checkmark-circle"
              loading={approve.isPending}
              onPress={() => approve.mutate()}
            />
            <Button
              label="Mit Rückmeldung zurückgeben"
              variant="outline"
              icon="arrow-undo"
              onPress={() => setRejecting(true)}
            />
          </View>
        )
      ) : null}

      {n.can.edit ? (
        <Button
          label="Bearbeiten"
          variant="outline"
          icon="create-outline"
          onPress={() => setEditing(true)}
        />
      ) : null}
      {n.can.remove ? (
        <Button
          label={n.status === 'published' ? 'Zurückziehen' : 'Löschen'}
          variant="danger"
          icon="trash-outline"
          loading={remove.isPending}
          onPress={() => remove.mutate()}
        />
      ) : null}
    </Screen>
  );
}

/** Lesebestätigung: wie viele haben die News geöffnet – bei Team-News auch, wer noch nicht. */
function ReadReceipt({ id }: { id: string }) {
  const { api } = useSignedIn();
  const [open, setOpen] = useState(false);
  const reads = useQuery({
    queryKey: ['editorial', id, 'reads'],
    queryFn: () => api<NewsReadReceipt>(`/editorial/news/${id}/reads`),
  });
  if (!reads.data) return null;
  const r = reads.data;
  const percent = r.audience ? Math.round((r.read / r.audience) * 100) : 0;
  return (
    <Card style={{ gap: 8 }}>
      <T variant="label" style={{ fontWeight: '700' }}>
        Gelesen
      </T>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          tone={percent >= 75 ? 'success' : 'info'}
          icon="eye-outline"
          label={`${r.read} von ${r.audience} (${percent} %)`}
        />
      </View>
      {r.unread && r.unread.length ? (
        <>
          <Button
            label={open ? 'Ausblenden' : `Noch nicht gelesen (${r.unread.length})`}
            variant="outline"
            onPress={() => setOpen(!open)}
          />
          {open ? <T variant="caption">{r.unread.join(', ')}</T> : null}
        </>
      ) : null}
    </Card>
  );
}
