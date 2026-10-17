import type { DocumentCategory, DocumentItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { EditedNote, useLeaveGuard } from '@/components/edited';
import { Button, Card, ChoiceChips, Chip, Screen, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { pickFile, type PickedFile } from '@/lib/upload';

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'regulations', label: 'Ordnung' },
  { value: 'forms', label: 'Formular' },
  { value: 'training_plans', label: 'Trainingsplan' },
  { value: 'other', label: 'Sonstiges' },
];

const key = (t: { type: string; id: string | null }) => `${t.type}:${t.id ?? ''}`;

export default function UploadDocumentScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const { teamId, id } = useLocalSearchParams<{ teamId?: string; id?: string }>();
  const editing = !!id;
  const targets = me.create.documents;
  const preset = targets.find((t) => t.type === 'team' && t.id === teamId) ?? targets[0];
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('forms');
  const [scope, setScope] = useState(preset ? key(preset) : '');
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((t) => key(t) === scope);

  // Bearbeiten: Titel, Art und Sichtbarkeit; die Datei bleibt (austauschen = löschen und neu hochladen)
  const list = useQuery({
    queryKey: ['documents', 'edit'],
    queryFn: () => api<DocumentItem[]>('/documents'),
    enabled: editing,
  });
  const existing = list.data?.find((d) => d.id === id);
  const [loaded, setLoaded] = useState(!editing);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!existing || loaded) return;
    setTitle(existing.title);
    setCategory(existing.category);
    setScope(key({ type: existing.source.type, id: existing.scopeId }));
    setLoaded(true);
  }, [existing, loaded]);

  const choose = async () => {
    setError(null);
    try {
      const picked = await pickFile('document');
      if (!picked) return;
      setFile(picked);
      if (!title.trim()) setTitle(picked.name.replace(/\.[^.]*$/, ''));
    } catch {
      setError('Die Datei konnte nicht gelesen werden.');
    }
  };

  const change = useMutation({
    mutationFn: () =>
      api<void>(`/documents/${id}`, {
        method: 'PATCH',
        body: {
          title: title.trim(),
          category,
          ...(target &&
          existing &&
          key(target) !== key({ type: existing.source.type, id: existing.scopeId })
            ? { scopeType: target.type, scopeId: target.id }
            : {}),
        },
      }),
    onSuccess: () => {
      allowLeave();
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Änderungen konnten nicht gespeichert werden.',
      ),
  });
  const dirty =
    editing &&
    loaded &&
    !saved &&
    !!existing &&
    (title !== existing.title ||
      category !== existing.category ||
      scope !== key({ type: existing.source.type, id: existing.scopeId }));
  const { guard, allowLeave } = useLeaveGuard(dirty, () => change.mutate());

  const upload = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/documents', {
        method: 'POST',
        body: {
          title: title.trim(),
          category,
          scopeType: target!.type,
          scopeId: target!.id,
          fileName: file!.name,
          dataBase64: file!.dataBase64,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Das Hochladen ist fehlgeschlagen.'),
  });

  return (
    <Screen edges={[]}>
      {guard}
      <Card style={{ gap: 10, display: editing ? 'none' : 'flex' }}>
        <Button
          label={file ? 'Andere Datei wählen' : 'Datei auswählen'}
          variant="outline"
          icon="attach"
          onPress={() => void choose()}
        />
        {file ? (
          <Chip
            tone="success"
            icon="document-attach"
            label={`${file.name}${file.size ? ` · ${formatBytes(file.size)}` : ''}`}
          />
        ) : null}
        <T variant="caption">PDF, Word (.docx), Excel (.xlsx), JPG oder PNG, höchstens 10 MB.</T>
      </Card>
      <Card style={{ gap: 12 }}>
        <TextField label="Titel" value={title} onChangeText={setTitle} maxLength={120} />
        <ChoiceChips
          label="Art"
          options={CATEGORIES}
          selected={[category]}
          onToggle={setCategory}
        />
        <ChoiceChips
          label="Sichtbar für"
          options={targets.map((t) => ({ value: key(t), label: t.label }))}
          selected={scope ? [scope] : []}
          onToggle={setScope}
        />
      </Card>
      {editing ? <EditedNote at={existing?.editedAt} /> : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {editing ? (
        <Button
          label="Änderungen speichern"
          icon="checkmark"
          disabled={title.trim().length < 2 || !target}
          loading={change.isPending}
          onPress={() => change.mutate()}
        />
      ) : (
        <Button
          label="Hochladen"
          icon="cloud-upload"
          disabled={!file || title.trim().length < 2 || !target}
          loading={upload.isPending}
          onPress={() => upload.mutate()}
        />
      )}
    </Screen>
  );
}
