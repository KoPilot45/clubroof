import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { RequestError } from '@/lib/api';
import { Button, Chip, Sheet, TextField } from './ui';

export type EditField = {
  key: string;
  label: string;
  value: string;
  maxLength?: number;
  multiline?: boolean;
  placeholder?: string;
};

/**
 * Kleines Bearbeiten-Fenster (Paket BE) für Texte: Beitrag, Kommentar, Forum-Thema, Aushang. Dieselben Felder wie beim
 * Anlegen, vorausgefüllt; „Änderungen speichern“. `onSave` liefert ein Promise – bei Erfolg schließt das Fenster,
 * ein Fehler des Servers erscheint darin. `children` für Zusatzfelder (z. B. Auswahl der Laufzeit).
 */
export function EditSheet({
  visible,
  onClose,
  title,
  fields,
  onSave,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  fields: EditField[];
  onSave: (values: Record<string, string>) => Promise<unknown>;
  children?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setValues(Object.fromEntries(fields.map((f) => [f.key, f.value])));
      setError(null);
    }
    // nur beim Öffnen vorausfüllen
  }, [visible]);
  const changed = fields.some((f) => (values[f.key] ?? f.value) !== f.value);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: 12 }}>
        {fields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={values[f.key] ?? f.value}
            onChangeText={(v) => setValues((cur) => ({ ...cur, [f.key]: v }))}
            maxLength={f.maxLength}
            multiline={f.multiline}
            placeholder={f.placeholder}
          />
        ))}
        {children}
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} label="Abbrechen" variant="neutral" onPress={onClose} />
          <Button
            style={{ flex: 1 }}
            label="Änderungen speichern"
            icon="checkmark"
            loading={busy}
            disabled={!changed && !children}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSave(values);
                onClose();
              } catch (e) {
                setError(
                  e instanceof RequestError
                    ? e.message
                    : 'Die Änderungen konnten nicht gespeichert werden.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}
