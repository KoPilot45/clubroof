import { router } from 'expo-router';
import { useState } from 'react';
import { PublicShell } from '@/components/public-shell';
import { Button, Card, Chip, T, TextField } from '@/components/ui';
import { request, RequestError } from '@/lib/api';

export default function ForgotScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await request('/auth/password/forgot', { method: 'POST', body: { email: email.trim() } });
      setSent(true);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <PublicShell
      title="Passwort vergessen"
      subtitle="Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst."
    >
      <Card style={{ gap: 12 }}>
        {sent ? (
          <T>
            Falls zu {email.trim()} ein Konto existiert, ist die E-Mail unterwegs. Der Link ist 30
            Minuten gültig.
          </T>
        ) : (
          <>
            <TextField
              label="E-Mail-Adresse"
              kind="email"
              value={email}
              onChangeText={setEmail}
              maxLength={120}
              onSubmit={() => void submit()}
            />
            {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
            <Button
              label="Link anfordern"
              icon="mail"
              loading={busy}
              disabled={!email.includes('@')}
              onPress={() => void submit()}
            />
          </>
        )}
      </Card>
      <Button
        label="Zurück zur Anmeldung"
        variant="outline"
        onPress={() => router.replace('/login')}
      />
    </PublicShell>
  );
}
