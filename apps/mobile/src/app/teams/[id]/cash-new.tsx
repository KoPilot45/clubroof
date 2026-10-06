import {
  CASH_EXPENSE_CATEGORIES,
  CASH_INCOME_CATEGORIES,
  type CashBookingKind,
  type PaymentMethod,
  type RosterEntry,
  type TeamCash,
  type UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PaymentMethodChips } from '@/components/cash';
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
import { cashCategory } from '@/lib/cash';
import { pickFile } from '@/lib/upload';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

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

/** Freie Strafe ohne Katalog (nur mit vollen Kassenrechten) */
const FREE = 'free';

export default function NewBookingScreen() {
  const { id, kind: initialKind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const cash = useQuery({
    queryKey: ['cash', id],
    queryFn: () => api<TeamCash>(`/teams/${id}/cash`),
  });
  const roster = useQuery({
    queryKey: ['roster', id],
    queryFn: () => api<RosterEntry[]>(`/teams/${id}/roster`),
  });
  // Aufruf mit ?kind=fine (Strafenkatalog, Kasse) startet bei „Strafe“
  const [kind, setKind] = useState<CashBookingKind>(initialKind === 'fine' ? 'fine' : 'income');
  const [fineType, setFineType] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [persons, setPersons] = useState<string[]>([]);
  const [counterparty, setCounterparty] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('bar');
  const [bookedOn, setBookedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
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
  const [error, setError] = useState<string | null>(null);

  const c = cash.data;
  const config = c?.config;
  const perms = c?.permissions;
  // Wer nur Strafen vergeben darf (Trainerteam), sieht nur „Strafe“
  const kinds = KINDS.filter((k) =>
    k.value === 'fine'
      ? config?.fines && (perms?.manageFines || perms?.manageCash)
      : perms?.manageCash && (k.value !== 'drinks' || config?.drinks),
  );
  const current = kinds.find((k) => k.value === kind) ?? kinds[0];
  const isFine = current?.value === 'fine';
  const catalog = c?.fineCatalog ?? [];
  const chosen = catalog.find((f) => f.id === fineType);
  const cents = isFine && chosen ? chosen.amountCents : parseEuro(amount);
  const multi = isFine;
  const money = current?.value === 'income' || current?.value === 'expense';

  const done = (data: TeamCash) => {
    queryClient.setQueryData(['cash', id], data);
    void queryClient.invalidateQueries({ queryKey: ['cash-stats', id] });
    router.back();
  };
  const onError = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Die Buchung konnte nicht gespeichert werden.',
    );
  const save = useMutation({
    mutationFn: () =>
      isFine
        ? api<TeamCash>(`/teams/${id}/cash/fines`, {
            method: 'POST',
            body: chosen
              ? { fineTypeId: chosen.id, personIds: persons }
              : { amountCents: cents, description: description.trim(), personIds: persons },
          })
        : api<TeamCash>(`/teams/${id}/cash/bookings`, {
            method: 'POST',
            body: {
              kind: current!.value,
              amountCents: cents,
              description: description.trim(),
              personId: current!.needsPerson ? persons[0] : null,
              counterparty: current!.needsPerson ? null : counterparty.trim() || null,
              category: money ? category : null,
              paymentMethod: current!.value === 'drinks' ? null : method,
              bookedOn,
              receiptImageId: money ? (receipt?.id ?? null) : null,
            },
          }),
    onSuccess: done,
    onError,
  });

  if (cash.isPending || roster.isPending) return <Loading />;
  if (!current) {
    return (
      <Screen edges={[]}>
        <Card>
          <T>Du kannst in dieser Kasse nichts buchen.</T>
        </Card>
      </Screen>
    );
  }

  const freeFine = isFine && fineType === FREE;
  const validationError = !cents
    ? isFine && !fineType
      ? 'Bitte wähle eine Strafe aus.'
      : 'Bitte gib einen gültigen Betrag ein, z. B. 12,50.'
    : (!isFine || freeFine) && description.trim().length < 2
      ? 'Bitte gib eine Beschreibung ein.'
      : current.needsPerson && persons.length === 0
        ? 'Bitte wähle mindestens eine Person aus.'
        : null;

  const players = (roster.data ?? []).filter((r) => r.function === 'player');
  const toggle = (personId: string) =>
    setPersons(
      multi
        ? persons.includes(personId)
          ? persons.filter((p) => p !== personId)
          : [...persons, personId]
        : [personId],
    );

  return (
    <Screen edges={[]}>
      {kinds.length > 1 ? (
        <Card>
          <ChoiceChips
            label="Art der Buchung"
            options={kinds.map((k) => ({ value: k.value, label: k.label }))}
            selected={[current.value]}
            onToggle={(v) => {
              setKind(v);
              setCategory(null);
              setPersons([]);
              setError(null);
            }}
          />
        </Card>
      ) : null}

      {isFine ? (
        <Card style={{ gap: 12 }}>
          <ChoiceChips
            label="Strafe aus dem Katalog"
            options={[
              ...catalog.map((f) => ({
                value: f.id,
                label: `${f.name} · ${formatEuro(f.amountCents)}`,
              })),
              ...(perms?.manageCash ? [{ value: FREE, label: 'Andere Strafe' }] : []),
            ]}
            selected={fineType ? [fineType] : []}
            onToggle={setFineType}
          />
          {catalog.length === 0 ? <T variant="caption">Der Strafenkatalog ist noch leer.</T> : null}
          {freeFine ? (
            <>
              <TextField
                label="Betrag in €"
                value={amount}
                onChangeText={setAmount}
                placeholder={t('0,00')}
              />
              <TextField
                label="Beschreibung"
                value={description}
                onChangeText={setDescription}
                placeholder={current.hint}
                maxLength={120}
              />
            </>
          ) : null}
        </Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <TextField
            label="Betrag in €"
            value={amount}
            onChangeText={setAmount}
            placeholder={t('0,00')}
          />
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
              placeholder={t('z. B. Sportshop Musterstadt')}
              maxLength={120}
            />
          ) : null}
          {money ? (
            <ChoiceChips
              label="Kategorie"
              options={(current.value === 'income'
                ? CASH_INCOME_CATEGORIES
                : CASH_EXPENSE_CATEGORIES
              ).map((k) => ({ value: k as string, label: cashCategory(k).label }))}
              selected={[category ?? (current.value === 'income' ? 'einnahme' : 'ausgabe')]}
              onToggle={setCategory}
            />
          ) : null}
          {current.value !== 'drinks' ? (
            <PaymentMethodChips value={method} onChange={setMethod} />
          ) : null}
          <DateStepper label="Buchungsdatum" value={bookedOn} onChange={setBookedOn} />
          {money ? (
            receipt ? (
              <Chip tone="success" icon="document-attach" label={`Beleg: ${receipt.name}`} />
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
            )
          ) : null}
        </Card>
      )}

      {current.needsPerson ? (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="overline">{multi ? 'Personen' : 'Person'}</T>
            {multi && persons.length ? <T variant="caption">{persons.length} ausgewählt</T> : null}
          </View>
          {players.map((r) => {
            const on = persons.includes(r.personId);
            return (
              <Pressable
                key={r.personId}
                accessibilityRole={multi ? 'checkbox' : 'radio'}
                accessibilityState={multi ? { checked: on } : { selected: on }}
                onPress={() => toggle(r.personId)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Ionicons
                  name={
                    multi
                      ? on
                        ? 'checkbox'
                        : 'square-outline'
                      : on
                        ? 'radio-button-on'
                        : 'radio-button-off'
                  }
                  size={22}
                  color={on ? colors.primaryText : colors.onSurfaceMuted}
                />
                <T variant="label" style={{ flex: 1 }}>
                  {r.name}
                </T>
                {r.jerseyNumber ? <T variant="caption">#{r.jerseyNumber}</T> : null}
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {validationError && (amount || fineType || persons.length) ? (
        <Chip tone="action" label={validationError} />
      ) : null}
      <Button
        label={
          isFine && cents && persons.length > 1
            ? `${persons.length} Strafen vergeben (je ${formatEuro(cents)})`
            : isFine
              ? 'Strafe vergeben'
              : 'Buchung speichern'
        }
        icon="checkmark"
        disabled={!!validationError}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
