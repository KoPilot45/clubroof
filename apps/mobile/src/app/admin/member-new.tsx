import type { MemberDetail } from '@clubroof/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Chip, Screen, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { parseGermanDate } from '@/lib/dates';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

export default function NewMemberScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birth, setBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const birthDate = parseGermanDate(birth);

  const save = useMutation({
    mutationFn: () =>
      api<MemberDetail>('/admin/members', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate,
          email: email.trim() || null,
          phone: phone.trim() || null,
          memberNumber: number.trim() || null,
        },
      }),
    onSuccess: (m) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      router.replace(`/admin/member/${m.id}`);
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Das Mitglied konnte nicht angelegt werden.',
      ),
  });
  const invalid = !firstName.trim() || !lastName.trim() || birthDate === undefined;

  return (
    <Screen edges={[]}>
      <T variant="caption">
        Lege das Mitglied an und ordne es danach einer Mannschaft zu. Den App-Zugang erhält es
        später über eine Einladung.
      </T>
      <Card style={{ gap: 12 }}>
        <TextField label="Vorname" value={firstName} onChangeText={setFirstName} maxLength={60} />
        <TextField label="Nachname" value={lastName} onChangeText={setLastName} maxLength={60} />
        <TextField
          label="Geburtsdatum (TT.MM.JJJJ)"
          value={birth}
          onChangeText={setBirth}
          placeholder={t('z. B. 14.03.2011')}
          maxLength={10}
        />
        <TextField
          label="E-Mail (optional)"
          value={email}
          onChangeText={setEmail}
          maxLength={120}
        />
        <TextField
          label="Telefon (optional)"
          value={phone}
          onChangeText={setPhone}
          maxLength={30}
        />
        <TextField
          label="Mitgliedsnummer (optional)"
          value={number}
          onChangeText={setNumber}
          maxLength={30}
        />
      </Card>
      {birthDate === undefined ? <Chip tone="action" label="Datum bitte als TT.MM.JJJJ" /> : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Mitglied anlegen"
        icon="person-add"
        disabled={invalid}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
