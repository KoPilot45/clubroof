import { useState } from 'react';
import { Button, Card, Chip, Screen, Section, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';

export default function AccountScreen() {
  const { api, me, signOut } = useSignedIn();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api('/auth/password/change', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setMsg({ ok: true, text: 'Passwort geändert. Andere Geräte wurden abgemeldet.' });
      setCurrent('');
      setNext('');
      setNext2('');
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof RequestError ? e.message : 'Das hat nicht geklappt.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 4 }}>
        <T variant="heading">{me.user.displayName}</T>
        <T variant="caption">Angemeldet als {me.user.email}</T>
      </Card>
      <Section title="Passwort ändern">
        <Card style={{ gap: 12 }}>
          <TextField
            label="Aktuelles Passwort"
            kind="password"
            value={current}
            onChangeText={setCurrent}
            maxLength={200}
          />
          <TextField
            label="Neues Passwort (mind. 10 Zeichen)"
            kind="newPassword"
            value={next}
            onChangeText={setNext}
            maxLength={200}
          />
          <TextField
            label="Neues Passwort wiederholen"
            kind="newPassword"
            value={next2}
            onChangeText={setNext2}
            maxLength={200}
          />
          {next2 && next !== next2 ? (
            <Chip tone="action" label="Die Passwörter stimmen nicht überein." />
          ) : null}
          {msg ? (
            <Chip
              tone={msg.ok ? 'success' : 'urgent'}
              icon={msg.ok ? 'checkmark-circle' : 'alert-circle'}
              label={msg.text}
            />
          ) : null}
          <Button
            label="Passwort speichern"
            icon="key"
            loading={busy}
            disabled={!current || next.length < 10 || next !== next2}
            onPress={() => void change()}
          />
        </Card>
      </Section>
      <Button
        label="Abmelden"
        variant="outline"
        icon="log-out-outline"
        onPress={() => void signOut()}
      />
    </Screen>
  );
}
