import type { DocumentCategory } from '@clubroof/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
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
  const targets = me.create.documents;
  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('forms');
  const [scope, setScope] = useState(targets[0] ? key(targets[0]) : '');
  const [error, setError] = useState<string | null>(null);
  const target = targets.find((t) => key(t) === scope);

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
      <Card style={{ gap: 10 }}>
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
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Hochladen"
        icon="cloud-upload"
        disabled={!file || title.trim().length < 2 || !target}
        loading={upload.isPending}
        onPress={() => upload.mutate()}
      />
    </Screen>
  );
}
