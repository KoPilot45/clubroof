import type { ClubCash, UploadedImage } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { pickFile } from '@/lib/upload';
import { t } from '@/lib/i18n';

type Kind = 'income' | 'expense' | 'transfer';

/** Einnahme, Ausgabe oder Umbuchung der Vereinskasse erfassen (nur Kassenwart). */
export default function ClubCashNewScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [kind, setKind] = useState<Kind>(
    kindParam === 'expense' || kindParam === 'transfer' ? kindParam : 'income',
  );
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [costCenterId, setCostCenterId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [bookedOn, setBookedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const c = cash.data;
  const accounts = (c?.accounts ?? []).filter((a) => !a.archived);
  const from = accountId ?? accounts[0]?.id ?? null;
  const cents = parseEuro(amount);
  const categories = (c?.categories ?? []).filter((k) => !k.archived && k.direction === kind);

  const attachReceipt = async () => {
    try {
      const file = await pickFile('image');
      if (!file) return;
      setUploading(true);
      const image = await api<UploadedImage>('/media', {
        method: 'POST',
        body: { purpose: 'receipt', fileName: file.name, dataBase64: file.dataBase64 },
      });
      setReceipt({ id: image.id, name: file.name });
    } catch (e) {
      setError(
        e instanceof RequestError ? e.message : 'Der Beleg konnte nicht hochgeladen werden.',
      );
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: () =>
      kind === 'transfer'
        ? api('/club-cash/transfers', {
            method: 'POST',
            body: {
              fromAccountId: from,
              toAccountId,
              amountCents: cents,
              bookedOn,
              purpose: purpose.trim() || null,
            },
          })
        : api('/club-cash/entries', {
            method: 'POST',
            body: {
              accountId: from,
              kind,
              amountCents: cents,
              bookedOn,
              categoryId,
              costCenterId,
              counterparty: counterparty.trim() || null,
              purpose: purpose.trim(),
              receiptNo: receiptNo.trim() || null,
              receiptImageId: receipt?.id ?? null,
            },
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
      router.back();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Buchung konnte nicht gespeichert werden.',
      ),
  });

  if (cash.isPending) return <Loading />;
  if (!c?.canManage)
    return (
      <Screen edges={[]}>
        <Card>
          <T>Die Vereinskasse führt der Kassenwart (Verein).</T>
        </Card>
      </Screen>
    );

  const problem = !cents
    ? 'Bitte gib einen gültigen Betrag ein, z. B. 12,50.'
    : kind === 'transfer'
      ? !toAccountId || toAccountId === from
        ? 'Bitte wähle ein anderes Zielkonto.'
        : null
      : !categoryId
        ? 'Bitte wähle eine Kategorie.'
        : purpose.trim().length < 2
          ? 'Bitte gib einen Verwendungszweck ein.'
          : null;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Art der Buchung"
          options={[
            { value: 'income', label: 'Einnahme' },
            { value: 'expense', label: 'Ausgabe' },
            { value: 'transfer', label: 'Umbuchung' },
          ]}
          selected={[kind]}
          onToggle={(v) => {
            setKind(v as Kind);
            setCategoryId(null);
            setError(null);
          }}
        />
        <ChoiceChips
          label={kind === 'transfer' ? 'Von Konto' : 'Konto'}
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          selected={from ? [from] : []}
          onToggle={setAccountId}
        />
        {kind === 'transfer' ? (
          <ChoiceChips
            label="Auf Konto"
            options={accounts
              .filter((a) => a.id !== from)
              .map((a) => ({ value: a.id, label: a.name }))}
            selected={toAccountId ? [toAccountId] : []}
            onToggle={setToAccountId}
          />
        ) : null}
      </Card>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Betrag in €"
          value={amount}
          onChangeText={setAmount}
          placeholder={t('0,00')}
        />
        <TextField
          label={kind === 'transfer' ? 'Zweck (optional)' : 'Verwendungszweck'}
          value={purpose}
          onChangeText={setPurpose}
          maxLength={200}
        />
        <DateStepper label="Buchungsdatum" value={bookedOn} onChange={setBookedOn} />
      </Card>
      {kind !== 'transfer' ? (
        <Card style={{ gap: 12 }}>
          {categories.length === 0 ? (
            <T variant="caption">
              Es gibt noch keine Kategorien für diese Art. Lege sie unter „Einrichtung“ an.
            </T>
          ) : (
            <ChoiceChips
              label="Kategorie"
              options={categories.map((k) => ({ value: k.id, label: k.name }))}
              selected={categoryId ? [categoryId] : []}
              onToggle={setCategoryId}
            />
          )}
          {c.costCenters.some((k) => !k.archived) ? (
            <ChoiceChips
              label="Kostenstelle (optional)"
              options={c.costCenters
                .filter((k) => !k.archived)
                .map((k) => ({ value: k.id, label: k.name }))}
              selected={costCenterId ? [costCenterId] : []}
              onToggle={(v) => setCostCenterId(costCenterId === v ? null : v)}
            />
          ) : null}
          <TextField
            label={kind === 'income' ? 'Von (optional)' : 'An (optional)'}
            value={counterparty}
            onChangeText={setCounterparty}
            maxLength={120}
          />
          <TextField
            label="Belegnummer (optional)"
            value={receiptNo}
            onChangeText={setReceiptNo}
            maxLength={40}
          />
          {receipt ? (
            <Chip tone="success" icon="document-attach" label={`${t('Beleg')}: ${receipt.name}`} />
          ) : (
            <Button
              label="Beleg fotografieren / anhängen"
              icon="camera-outline"
              size="sm"
              variant="outline"
              style={{ alignSelf: 'flex-start' }}
              loading={uploading}
              onPress={() => void attachReceipt()}
            />
          )}
        </Card>
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {problem && amount ? <Chip tone="action" label={problem} /> : null}
      <Button
        label={cents ? `${t('Buchen')}: ${formatEuro(cents)}` : 'Buchen'}
        icon="checkmark"
        disabled={!!problem}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
