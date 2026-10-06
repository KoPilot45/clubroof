import type {
  BoardItem,
  BoardKind,
  BoardOverview,
  CreateBoardItemInput,
  UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { CommentThread } from '@/components/comments';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { mediaUri, pickFile } from '@/lib/upload';

const KIND: Record<
  BoardKind,
  { label: string; tone: 'info' | 'action' | 'success' | 'neutral'; detail: string }
> = {
  found: { label: 'Gefunden', tone: 'success', detail: 'Fundort / wo abholen?' },
  lost: { label: 'Verloren', tone: 'action', detail: 'Wo verloren?' },
  offer: { label: 'Biete', tone: 'info', detail: 'Preis (oder „zu verschenken“)' },
  search: { label: 'Suche', tone: 'neutral', detail: 'Größe / Preisvorstellung' },
};

/** Fundbüro und Marktplatz – Aushänge mit Rückfragen per Kommentar. */
export default function BoardScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'lostfound' | 'market'>('all');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const board = useQuery({ queryKey: ['board'], queryFn: () => api<BoardOverview>('/board') });
  const change = useMutation({
    mutationFn: (v: { path: string; body?: unknown }) =>
      api<BoardOverview>(v.path, { method: 'POST', body: v.body }),
    onSuccess: (data) => {
      queryClient.setQueryData(['board'], data);
      setCreating(false);
    },
  });
  if (board.isPending) return <Loading />;
  if (board.error)
    return <ErrorNotice message={board.error.message} onRetry={() => board.refetch()} />;
  const b = board.data;
  const both = b.kinds.includes('found') && b.kinds.includes('offer');
  const items = b.items.filter((i) =>
    filter === 'all'
      ? true
      : filter === 'lostfound'
        ? ['found', 'lost'].includes(i.kind)
        : ['offer', 'search'].includes(i.kind),
  );
  return (
    <Screen edges={[]} refreshing={board.isRefetching} onRefresh={() => board.refetch()}>
      {creating ? (
        <NewItem
          kinds={b.kinds}
          busy={change.isPending}
          onCancel={() => setCreating(false)}
          onSave={(body) => change.mutate({ path: '/board', body })}
        />
      ) : (
        <Button label="Aushang erstellen" icon="add" onPress={() => setCreating(true)} />
      )}
      {change.error ? (
        <Chip
          tone="urgent"
          icon="alert-circle"
          label={
            change.error instanceof RequestError ? change.error.message : 'Das hat nicht geklappt.'
          }
        />
      ) : null}
      {both ? (
        <ChoiceChips
          options={[
            { value: 'all' as const, label: 'Alle' },
            { value: 'lostfound' as const, label: 'Fundbüro', icon: 'search' },
            { value: 'market' as const, label: 'Marktplatz', icon: 'pricetag' },
          ]}
          selected={[filter]}
          onToggle={setFilter}
        />
      ) : null}
      {items.length === 0 ? (
        <Card>
          <Empty icon="pricetags-outline" text="Gerade keine Aushänge." />
        </Card>
      ) : null}
      {items.map((item) => (
        <View key={item.id} style={{ gap: 8 }}>
          <ItemCard
            item={item}
            onClose={() => change.mutate({ path: `/board/${item.id}/done` })}
            onToggle={() => setOpen(open === item.id ? null : item.id)}
            expanded={open === item.id}
          />
          {open === item.id ? <CommentThread type="board" id={item.id} /> : null}
        </View>
      ))}
    </Screen>
  );
}

function ItemCard({
  item,
  onClose,
  onToggle,
  expanded,
}: {
  item: BoardItem;
  onClose: () => void;
  onToggle: () => void;
  expanded: boolean;
}) {
  return (
    <Card style={{ gap: 8, opacity: item.done ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {item.imageUrl ? (
          <Image
            source={{ uri: mediaUri(item.imageUrl)! }}
            style={{ width: 72, height: 72, borderRadius: 8 }}
            accessibilityLabel={item.title}
          />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Chip tone={KIND[item.kind].tone} label={KIND[item.kind].label} />
            {item.done ? <Chip tone="archived" icon="checkmark" label="Erledigt" /> : null}
          </View>
          <T variant="label" style={{ fontWeight: '700' }}>
            {item.title}
          </T>
          {item.detail ? <T variant="caption">{item.detail}</T> : null}
        </View>
      </View>
      {item.description ? <T>{item.description}</T> : null}
      <T variant="caption">{`${item.mine ? 'Dein Aushang' : (item.author ?? 'Verein')} · ${formatAgo(item.createdAt)}`}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label={expanded ? 'Rückfragen ausblenden' : 'Rückfragen'}
          icon="chatbubbles-outline"
          variant="outline"
          style={{ flex: 1 }}
          onPress={onToggle}
        />
        {item.canClose ? (
          <Button label="Erledigt" icon="checkmark" style={{ flex: 1 }} onPress={onClose} />
        ) : null}
      </View>
    </Card>
  );
}

function NewItem({
  kinds,
  busy,
  onSave,
  onCancel,
}: {
  kinds: BoardKind[];
  busy: boolean;
  onSave: (body: CreateBoardItemInput) => void;
  onCancel: () => void;
}) {
  const { api } = useSignedIn();
  const [kind, setKind] = useState<BoardKind>(kinds[0]!);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<{ id: string; uri: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const addPhoto = async () => {
    const file = await pickFile('image');
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await api<UploadedImage>('/media', {
        method: 'POST',
        body: { purpose: 'board', fileName: file.name, dataBase64: file.dataBase64 },
      });
      setImage({ id: uploaded.id, uri: file.previewUri });
    } finally {
      setUploading(false);
    }
  };
  return (
    <Card style={{ gap: 12 }}>
      <ChoiceChips
        options={kinds.map((k) => ({ value: k, label: KIND[k].label }))}
        selected={[kind]}
        onToggle={setKind}
      />
      <TextField
        label="Was?"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholder="z. B. Fußballschuhe Größe 38"
      />
      <TextField label={KIND[kind].detail} value={detail} onChangeText={setDetail} maxLength={80} />
      <TextField
        label="Beschreibung (optional)"
        value={description}
        onChangeText={setDescription}
        maxLength={1000}
        multiline
      />
      {image ? (
        <Image source={{ uri: image.uri }} style={{ width: 96, height: 96, borderRadius: 8 }} />
      ) : null}
      <Button
        label={image ? 'Anderes Foto' : 'Foto hinzufügen'}
        icon="camera-outline"
        variant="outline"
        loading={uploading}
        onPress={() => void addPhoto()}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Abbrechen" variant="outline" style={{ flex: 1 }} onPress={onCancel} />
        <Button
          label="Aushängen"
          style={{ flex: 1 }}
          loading={busy}
          disabled={title.trim().length < 3}
          onPress={() =>
            onSave({
              kind,
              title: title.trim(),
              detail: detail.trim() || null,
              description: description.trim() || null,
              imageId: image?.id ?? null,
            })
          }
        />
      </View>
      <T variant="caption">
        Aushänge verschwinden nach 30 Tagen (Fundsachen nach 60). Telefonnummern werden nicht
        angezeigt – Rückfragen laufen über die App.
      </T>
    </Card>
  );
}
