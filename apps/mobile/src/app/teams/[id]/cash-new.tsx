import type { CashBookingKind, RosterEntry, TeamCash } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, ChoiceChips, Chip, Loading, Screen, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

const KINDS: { value: CashBookingKind; label: string; needsPerson: boolean; hint: string }[] = [
  { value: 'fine', label: 'Strafe', needsPerson: true, hint: 'z. B. Zu spät zum Training' },
  {
    value: 'drinks',
    label: 'Getränke',
    needsPerson: true,
    hint: 'z. B. 4 Getränke nach dem Spiel',
  },
  { value: 'payment', label: 'Einzahlung', needsPerson: true, hint: 'z. B. Bar bezahlt' },
  { value: 'income', label: 'Einnahme', needsPerson: false, hint: 'z. B. Kuchenverkauf Heimspiel' },
  { value: 'expense', label: 'Ausgabe', needsPerson: false, hint: 'z. B. Trainingsbälle' },
];

export default function NewBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const cash = useQuery({
    queryKey: ['cash', id],
    queryFn: () => api<TeamCash>(`/teams/${id}/cash`),
  });
  const roster = useQuery({
    queryKey: ['roster', id],
    queryFn: () => api<RosterEntry[]>(`/teams/${id}/roster`),
  });
  const [kind, setKind] = useState<CashBookingKind>('fine');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [counterparty, setCounterparty] = useState('');
  const [error, setError] = useState<string | null>(null);

  const config = cash.data?.config;
  const kinds = KINDS.filter(
    (k) => (k.value !== 'fine' || config?.fines) && (k.value !== 'drinks' || config?.drinks),
  );
  const current = KINDS.find((k) => k.value === kind)!;
  const cents = parseEuro(amount);

  const save = useMutation({
    mutationFn: () =>
      api<TeamCash>(`/teams/${id}/cash/bookings`, {
        method: 'POST',
        body: {
          kind,
          amountCents: cents,
          description: description.trim(),
          personId: current.needsPerson ? personId : null,
          counterparty: current.needsPerson ? null : counterparty.trim() || null,
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['cash', id], data);
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Buchung konnte nicht gespeichert werden.',
      ),
  });

  const validationError = !cents
    ? 'Bitte gib einen gültigen Betrag ein, z. B. 12,50.'
    : description.trim().length < 2
      ? 'Bitte gib eine Beschreibung ein.'
      : current.needsPerson && !personId
        ? 'Bitte wähle eine Person aus.'
        : null;

  if (cash.isPending || roster.isPending) return <Loading />;

  return (
    <Screen edges={[]}>
      <Card>
        <ChoiceChips
          label="Art der Buchung"
          options={kinds.map((k) => ({ value: k.value, label: k.label }))}
          selected={[kind]}
          onToggle={(v) => {
            setKind(v);
            setError(null);
          }}
        />
      </Card>
      <Card style={{ gap: 12 }}>
        <TextField label="Betrag in €" value={amount} onChangeText={setAmount} placeholder="0,00" />
        <TextField
          label="Beschreibung"
          value={description}
          onChangeText={setDescription}
          placeholder={current.hint}
          maxLength={120}
        />
        {!current.needsPerson ? (
          <TextField
            label="Von / an (optional)"
            value={counterparty}
            onChangeText={setCounterparty}
            placeholder="z. B. Sportshop Musterstadt"
            maxLength={120}
          />
        ) : null}
      </Card>
      {current.needsPerson ? (
        <Card>
          <ChoiceChips
            label="Person"
            options={(roster.data ?? [])
              .filter((r) => r.function === 'player')
              .map((r) => ({ value: r.personId, label: r.name }))}
            selected={personId ? [personId] : []}
            onToggle={setPersonId}
          />
        </Card>
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {validationError && amount ? <Chip tone="action" label={validationError} /> : null}
      <Button
        label="Buchung speichern"
        icon="checkmark"
        disabled={!!validationError}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
