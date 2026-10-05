import type {
  AnnouncementPriority,
  EditorialNews,
  EditorialScope,
  NewsAction,
  SaveNewsInput,
} from '@clubroof/core';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ChoiceChips, Chip, T, TextField } from '@/components/ui';

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
    });

  return (
    <>
      <Card style={{ gap: 12 }}>
        <TextField label="Überschrift" value={title} onChangeText={setTitle} maxLength={120} />
        <TextField
          label="Kurztext (optional)"
          value={teaser}
          onChangeText={setTeaser}
          placeholder="Erscheint in der Übersicht"
          maxLength={200}
        />
        <TextField label="Text" value={body} onChangeText={setBody} maxLength={5000} multiline />
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
