import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { PublicShell } from '@/components/public-shell';
import { Button, Card, Chip, T, TextField } from '@/components/ui';
import { request, RequestError } from '@/lib/api';

export default function ResetScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await request('/auth/password/reset', { method: 'POST', body: { token, password: pw } });
      setDone(true);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <PublicShell
      title="Neues Passwort"
      subtitle="Mindestens 10 Zeichen – am besten ein kurzer Satz."
    >
      <Card style={{ gap: 12 }}>
        {done ? (
          <T>
            Dein Passwort ist geändert. Aus Sicherheitsgründen wurdest du auf allen Geräten
            abgemeldet.
          </T>
        ) : (
          <>
            <TextField
              label="Neues Passwort"
              kind="newPassword"
              value={pw}
              onChangeText={setPw}
              maxLength={200}
            />
            <TextField
              label="Passwort wiederholen"
              kind="newPassword"
              value={pw2}
              onChangeText={setPw2}
              maxLength={200}
            />
            {pw2 && pw !== pw2 ? (
              <Chip tone="action" label="Die Passwörter stimmen nicht überein." />
            ) : null}
            {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
            <Button
              label="Passwort speichern"
              icon="checkmark"
              loading={busy}
              disabled={pw.length < 10 || pw !== pw2}
              onPress={() => void submit()}
            />
          </>
        )}
      </Card>
      <Button
        label="Zur Anmeldung"
        variant={done ? 'primary' : 'outline'}
        onPress={() => router.replace('/login')}
      />
    </PublicShell>
  );
}
