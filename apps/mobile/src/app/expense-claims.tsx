import {
  CLUB_CLAIM_STATUS_LABEL,
  CLUB_MILEAGE_RATE_CENTS,
  type ClubExpenseClaims,
  type UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { pickFile } from '@/lib/upload';

const TONE = {
  submitted: 'action',
  approved: 'info',
  rejected: 'urgent',
  paid: 'success',
} as const;

/** Auslagen und Fahrtkosten einreichen (Paket K5): jedes Mitglied; der Kassenwart prüft und erstattet. */
export default function ExpenseClaimsScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-claims'],
    queryFn: () => api<ClubExpenseClaims>('/club-cash/claims'),
  });
  const [kind, setKind] = useState<'expense' | 'mileage'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [km, setKm] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const attach = async () => {
    try {
      const file = await pickFile('image');
      if (!file) return;
      const image = await api<UploadedImage>('/media', {
        method: 'POST',
        body: { purpose: 'claim', fileName: file.name, dataBase64: file.dataBase64 },
      });
      setReceipt({ id: image.id, name: file.name });
    } catch (e) {
      fail(e);
    }
  };
  const submit = useMutation({
    mutationFn: () =>
      api<ClubExpenseClaims>('/club-cash/claims', {
        method: 'POST',
        body: {
          kind,
          description: description.trim(),
          ...(kind === 'mileage' ? { kilometers: Number(km) } : { amountCents: parseEuro(amount) }),
          expenseDate: date,
          receiptImageId: receipt?.id ?? null,
        },
      }),
    onSuccess: (d) => {
      setError(null);
      queryClient.setQueryData(['club-claims'], d);
      setDescription('');
      setAmount('');
      setKm('');
      setReceipt(null);
    },
    onError: fail,
  });

  if (data.isPending) return <Loading />;
  if (data.error || !data.data)
    return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const mine = data.data.claims.filter((c) => c.personId === me.person.id);
  const kmValid = Number(km) >= 1 && Number.isInteger(Number(km));
  const valid =
    description.trim().length >= 3 && (kind === 'mileage' ? kmValid : parseEuro(amount) !== null);

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Section title="Auslage einreichen">
        <Card style={{ gap: 12 }}>
          <ChoiceChips
            selected={[kind]}
            onToggle={setKind}
            options={[
              { value: 'expense', label: t('Auslage mit Beleg') },
              { value: 'mileage', label: t('Fahrtkosten') },
            ]}
          />
          <TextField
            label="Wofür?"
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            placeholder={t('z. B. Bälle für das Training')}
          />
          {kind === 'mileage' ? (
            <>
              <TextField label="Gefahrene Kilometer" value={km} onChangeText={setKm} />
              <T variant="caption">
                {kmValid
                  ? `${formatEuro(Number(km) * CLUB_MILEAGE_RATE_CENTS)} (${formatEuro(CLUB_MILEAGE_RATE_CENTS)} ${t('je Kilometer')})`
                  : `${formatEuro(CLUB_MILEAGE_RATE_CENTS)} ${t('je Kilometer')}`}
              </T>
            </>
          ) : (
            <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
          )}
          <DateStepper
            label="Datum"
            value={date}
            onChange={setDate}
            max={new Date().toISOString().slice(0, 10)}
          />
          {kind === 'expense' ? (
            <View style={{ gap: 6 }}>
              <Button
                label={receipt ? 'Anderen Beleg wählen' : 'Beleg fotografieren oder wählen'}
                icon="camera-outline"
                variant="outline"
                onPress={() => void attach()}
              />
              {receipt ? (
                <Chip tone="success" icon="checkmark-circle" label={receipt.name} />
              ) : null}
            </View>
          ) : null}
          <Button
            label="Einreichen"
            icon="send"
            disabled={!valid}
            loading={submit.isPending}
            onPress={() => submit.mutate()}
          />
        </Card>
      </Section>

      <Section title="Meine Auslagen">
        <Card>
          {mine.length === 0 ? (
            <Empty icon="receipt-outline" text="Noch keine Auslage eingereicht." />
          ) : null}
          {mine.map((c, i) => (
            <ListRow
              key={c.id}
              first={i === 0}
              title={c.description}
              subtitle={[
                c.expenseDate.split('-').reverse().join('.'),
                c.kind === 'mileage' ? t(`${c.kilometers} km`) : null,
                c.rejectReason,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Chip tone="neutral" label={formatEuro(c.amountCents)} />
                  <Chip tone={TONE[c.status]} label={t(CLUB_CLAIM_STATUS_LABEL[c.status])} />
                </View>
              }
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
