import type {
  AnnouncementPriority,
  EditorialNews,
  EditorialScope,
  NewsAction,
  SaveNewsInput,
} from '@clubroof/core';
import type { UploadedImage } from '@clubroof/core';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Button, Card, ChoiceChips, Chip, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri, pickFile } from '@/lib/upload';
import { t } from '@/lib/i18n';

const PRIORITIES: { value: AnnouncementPriority; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'important', label: 'Wichtig' },
  { value: 'urgent', label: 'Dringend' },
];

const key = (sc: { type: string; id: string | null }) => `${sc.type}:${sc.id ?? ''}`;

/** Formular zum Schreiben und Bearbeiten einer News. */
export function NewsEditor({
  scopes,
  initial,
  busy,
  onSave,
}: {
  scopes: EditorialScope[];
  initial?: EditorialNews;
  busy: boolean;
  onSave: (input: SaveNewsInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [teaser, setTeaser] = useState(initial?.teaser ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [priority, setPriority] = useState<AnnouncementPriority>(initial?.priority ?? 'info');
  const { api } = useSignedIn();
  const { radii } = useTheme();
  const [image, setImage] = useState<{ id: string; url: string | null } | null>(
    initial?.imageId ? { id: initial.imageId, url: initial.imageUrl } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const chooseImage = async () => {
    setImageError(null);
    try {
      const file = await pickFile('image');
      if (!file) return;
      setUploading(true);
      const uploaded = await api<UploadedImage>('/media', {
        method: 'POST',
        body: { purpose: 'news', fileName: file.name, dataBase64: file.dataBase64 },
      });
      setImage({ id: uploaded.id, url: uploaded.url });
    } catch (e) {
      setImageError(
        e instanceof RequestError ? e.message : 'Das Bild konnte nicht hochgeladen werden.',
      );
    } finally {
      setUploading(false);
    }
  };
  // Bereich der bestehenden News bleibt wählbar, auch wenn er nicht in meinen Schreibbereichen liegt
  const options: EditorialScope[] =
    initial && !scopes.some((sc) => key(sc) === key(initial.scope))
      ? [{ ...initial.scope, canPublish: initial.can.publish }, ...scopes]
      : scopes;
  const [scopeKey, setScopeKey] = useState(
    initial ? key(initial.scope) : options[0] ? key(options[0]) : '',
  );
  const scope = options.find((sc) => key(sc) === scopeKey);
  const published = initial?.status === 'published';
  const invalid = title.trim().length < 3 || !body.trim() || !scope;

  const save = (action: NewsAction) =>
    onSave({
      title: title.trim(),
      teaser: teaser.trim() || null,
      body: body.trim(),
      priority,
      scopeType: scope!.type,
      scopeId: scope!.id,
      action,
      imageId: image?.id ?? null,
    });

  return (
    <>
      <Card style={{ gap: 12 }}>
        <TextField label="Überschrift" value={title} onChangeText={setTitle} maxLength={120} />
        <TextField
          label="Kurztext (optional)"
          value={teaser}
          onChangeText={setTeaser}
          placeholder={t('Erscheint in der Übersicht')}
          maxLength={200}
        />
        <TextField label="Text" value={body} onChangeText={setBody} maxLength={5000} multiline />
      </Card>
      <Card style={{ gap: 10 }}>
        <T variant="label">Bild (optional)</T>
        {image?.url ? (
          <Image
            source={{ uri: mediaUri(image.url)! }}
            accessibilityLabel={t('Vorschau des News-Bilds')}
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            style={{ flex: 1 }}
            label={image ? 'Anderes Bild' : 'Bild auswählen'}
            variant="outline"
            icon="image-outline"
            loading={uploading}
            onPress={() => void chooseImage()}
          />
          {image ? (
            <Button
              style={{ flex: 1 }}
              label="Entfernen"
              variant="outline"
              onPress={() => setImage(null)}
            />
          ) : null}
        </View>
        <T variant="caption">JPG, PNG oder WebP, höchstens 5 MB.</T>
        {imageError ? <Chip tone="urgent" icon="alert-circle" label={imageError} /> : null}
      </Card>
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Für wen?"
          options={options.map((sc) => ({ value: key(sc), label: sc.label }))}
          selected={scopeKey ? [scopeKey] : []}
          onToggle={setScopeKey}
        />
        <ChoiceChips
          label="Priorität"
          options={PRIORITIES}
          selected={[priority]}
          onToggle={setPriority}
        />
        {priority !== 'info' ? (
          <T variant="caption">
            Wichtige und dringende News werden beim Veröffentlichen an alle im gewählten Bereich
            gesendet.
          </T>
        ) : null}
      </Card>
      {scope && !scope.canPublish && !published ? (
        <Chip
          tone="info"
          icon="shield-checkmark-outline"
          label="Wird nach dem Einreichen von Vorstand bzw. Leitung freigegeben"
        />
      ) : null}
      <View style={{ gap: 10 }}>
        {published ? (
          <Button
            label="Korrektur speichern"
            icon="checkmark"
            disabled={invalid}
            loading={busy}
            onPress={() => save('draft')}
          />
        ) : scope?.canPublish ? (
          <Button
            label="Veröffentlichen"
            icon="send"
            disabled={invalid}
            loading={busy}
            onPress={() => save('publish')}
          />
        ) : (
          <Button
            label="Zur Freigabe einreichen"
            icon="send"
            disabled={invalid}
            loading={busy}
            onPress={() => save('submit')}
          />
        )}
        {!published ? (
          <Button
            label="Als Entwurf speichern"
            variant="outline"
            disabled={invalid}
            onPress={() => save('draft')}
          />
        ) : null}
      </View>
    </>
  );
}
