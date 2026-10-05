import type { JoinInfo, JoinRequestInput, LoginResponse } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { PublicShell } from '@/components/public-shell';
import { Button, Card, ChoiceChips, Chip, Loading, T, TextField } from '@/components/ui';
import { request, RequestError } from '@/lib/api';
import { parseGermanDate } from '@/lib/dates';
import { useSession } from '@/lib/session';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const info = useQuery({
    queryKey: ['join', token],
    queryFn: () => request<JoinInfo>(`/join/${token}`),
    retry: false,
  });
  if (info.isPending) return <Loading />;
  if (info.error || !info.data)
    return (
      <PublicShell
        title="Einladung nicht gültig"
        subtitle="Der Link ist abgelaufen oder wurde bereits verwendet. Bitte frage im Verein nach einem neuen Link."
      >
        <Button label="Zur Anmeldung" onPress={() => router.replace('/login')} />
      </PublicShell>
    );
  return info.data.kind === 'person' ? (
    <Accept token={token} info={info.data} />
  ) : (
    <Request token={token} info={info.data} />
  );
}

function Passwords({
  pw,
  setPw,
  pw2,
  setPw2,
}: {
  pw: string;
  setPw: (v: string) => void;
  pw2: string;
  setPw2: (v: string) => void;
}) {
  return (
    <>
      <TextField
        label="Passwort (mind. 10 Zeichen)"
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
    </>
  );
}

function Accept({ token, info }: { token: string; info: JoinInfo }) {
  const { adopt } = useSession();
  const [email, setEmail] = useState(info.person?.email ?? '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await request<LoginResponse>(`/join/${token}/accept`, {
        method: 'POST',
        body: { email: email.trim(), password: pw },
      });
      await adopt(result);
      router.replace('/');
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <PublicShell
      club={info.club}
      title={`Willkommen, ${info.person?.firstName ?? ''}!`}
      subtitle={`${info.club.name} lädt dich in die Vereins-App ein. Lege deine Anmeldedaten fest.`}
    >
      <Card style={{ gap: 12 }}>
        <TextField
          label="E-Mail-Adresse"
          kind="email"
          value={email}
          onChangeText={setEmail}
          maxLength={120}
        />
        <Passwords pw={pw} setPw={setPw} pw2={pw2} setPw2={setPw2} />
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
        <Button
          label="Zugang einrichten"
          icon="checkmark"
          loading={busy}
          disabled={!email.includes('@') || pw.length < 10 || pw !== pw2}
          onPress={() => void submit()}
        />
      </Card>
    </PublicShell>
  );
}

function Request({ token, info }: { token: string; info: JoinInfo }) {
  const [relation, setRelation] = useState<'player' | 'parent'>('player');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birth, setBirth] = useState('');
  const [childFirst, setChildFirst] = useState('');
  const [childLast, setChildLast] = useState('');
  const [childBirth, setChildBirth] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const birthDate = parseGermanDate(birth);
  const childBirthDate = parseGermanDate(childBirth);

  if (sent)
    return (
      <PublicShell
        club={info.club}
        title="Anfrage gesendet"
        subtitle={`Das Trainerteam von ${info.team?.name} prüft deine Anfrage. Sobald sie freigegeben ist, bekommst du eine E-Mail und kannst dich anmelden.`}
      >
        <Button label="Zur Anmeldung" variant="outline" onPress={() => router.replace('/login')} />
      </PublicShell>
    );

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: JoinRequestInput = {
        email: email.trim(),
        password: pw,
        relation,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: birthDate ?? null,
        childFirstName: relation === 'parent' ? childFirst.trim() : null,
        childLastName: relation === 'parent' ? childLast.trim() || lastName.trim() : null,
        childBirthDate: relation === 'parent' ? (childBirthDate ?? null) : null,
        message: message.trim() || null,
      };
      await request(`/join/${token}/request`, { method: 'POST', body });
      setSent(true);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  const valid =
    firstName.trim() &&
    lastName.trim() &&
    birthDate !== undefined &&
    (relation === 'player' || (childFirst.trim() && childBirthDate !== undefined)) &&
    email.includes('@') &&
    pw.length >= 10 &&
    pw === pw2;

  return (
    <PublicShell
      club={info.club}
      title={`${info.team?.name} · ${info.club.shortName}`}
      subtitle="Stelle eine Beitrittsanfrage. Das Trainerteam gibt sie frei."
    >
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Wer tritt bei?"
          options={[
            { value: 'player', label: 'Ich spiele selbst' },
            { value: 'parent', label: 'Ich melde mein Kind an' },
          ]}
          selected={[relation]}
          onToggle={setRelation}
        />
        <TextField
          label={relation === 'parent' ? 'Dein Vorname' : 'Vorname'}
          value={firstName}
          onChangeText={setFirstName}
          maxLength={60}
        />
        <TextField
          label={relation === 'parent' ? 'Dein Nachname' : 'Nachname'}
          value={lastName}
          onChangeText={setLastName}
          maxLength={60}
        />
        {relation === 'player' ? (
          <TextField
            label="Geburtsdatum (TT.MM.JJJJ, optional)"
            value={birth}
            onChangeText={setBirth}
            maxLength={10}
          />
        ) : (
          <>
            <TextField
              label="Vorname des Kindes"
              value={childFirst}
              onChangeText={setChildFirst}
              maxLength={60}
            />
            <TextField
              label="Nachname des Kindes (falls anders)"
              value={childLast}
              onChangeText={setChildLast}
              maxLength={60}
            />
            <TextField
              label="Geburtsdatum des Kindes (TT.MM.JJJJ)"
              value={childBirth}
              onChangeText={setChildBirth}
              maxLength={10}
            />
          </>
        )}
        <TextField
          label="Nachricht an das Trainerteam (optional)"
          value={message}
          onChangeText={setMessage}
          maxLength={300}
          multiline
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <T variant="label">Deine Anmeldedaten</T>
        <TextField
          label="E-Mail-Adresse"
          kind="email"
          value={email}
          onChangeText={setEmail}
          maxLength={120}
        />
        <Passwords pw={pw} setPw={setPw} pw2={pw2} setPw2={setPw2} />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Anfrage senden"
        icon="send"
        loading={busy}
        disabled={!valid}
        onPress={() => void submit()}
      />
    </PublicShell>
  );
}
