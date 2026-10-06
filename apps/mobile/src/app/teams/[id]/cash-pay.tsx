import type { PaymentMethod } from '@clubroof/core';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';
import {
  ActionError,
  PaymentMethodChips,
  centsToInput,
  useCash,
  useCashAction,
} from '@/components/cash';
import {
  Button,
  Card,
  Chip,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { formatEuro, parseEuro } from '@/lib/format';

/** Bezahlen: Bezahlinfos der Mannschaftskasse und „Ich habe bezahlt“ melden. */
export default function CashPayScreen() {
  const { id, personId, amount } = useLocalSearchParams<{
    id: string;
    personId: string;
    amount?: string;
  }>();
  const cash = useCash(id);
  const [value, setValue] = useState(amount ? centsToInput(Number(amount)) : '');
  const [method, setMethod] = useState<PaymentMethod>('ueberweisung');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  const save = useCashAction(id, () => router.back());
  if (cash.isPending) return <Loading />;
  const c = cash.data;
  const s = c?.settings;
  const person = c?.personal.find((p) => p.personId === personId);
  const cents = parseEuro(value);
  return (
    <Screen edges={[]}>
      {person ? (
        <Card style={{ gap: 6 }}>
          <T variant="label">{person.name}</T>
          <Chip tone="action" label={`Offen: ${formatEuro(Math.max(0, -person.balanceCents))}`} />
        </Card>
      ) : null}
      <Section title="So kannst du bezahlen">
        <Card>
          {s?.iban ? (
            <ListRow
              first
              title={s.iban}
              subtitle={`Überweisung an ${s.accountHolder ?? 'die Mannschaftskasse'} · antippen zum Kopieren`}
              onPress={() =>
                void Clipboard.setStringAsync(s.iban!.replace(/\s/g, '')).then(() =>
                  setCopied(true),
                )
              }
            />
          ) : null}
          {s?.paypalLink ? (
            <ListRow
              first={!s.iban}
              title="Mit PayPal bezahlen"
              subtitle={s.paypalLink}
              onPress={() => void Linking.openURL(s.paypalLink!)}
            />
          ) : null}
          <ListRow
            first={!s?.iban && !s?.paypalLink}
            title="Bar"
            subtitle="Beim Kassenwart oder Trainerteam"
          />
          {copied ? <Chip tone="success" icon="checkmark" label="IBAN kopiert" /> : null}
        </Card>
      </Section>
      <Section title="Zahlung melden">
        <Card style={{ gap: 12 }}>
          <T variant="caption">
            Die Kasse bestätigt den Eingang – erst dann ist dein Konto ausgeglichen.
          </T>
          <PaymentMethodChips value={method} onChange={setMethod} />
          <TextField label="Betrag in €" value={value} onChangeText={setValue} placeholder="0,00" />
          <TextField
            label="Hinweis (optional)"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </Card>
      </Section>
      <ActionError error={save.error} />
      <Button
        label="Ich habe bezahlt"
        icon="checkmark"
        disabled={!cents}
        loading={save.isPending}
        onPress={() =>
          save.mutate({
            path: `/teams/${id}/cash/payment-notices`,
            method: 'POST',
            body: {
              personId,
              amountCents: cents,
              paymentMethod: method,
              note: note.trim() || null,
            },
          })
        }
      />
    </Screen>
  );
}
