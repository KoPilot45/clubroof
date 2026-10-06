import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionError, centsToInput, useCash, useCashAction } from '@/components/cash';
import {
  Button,
  Card,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
  Toggle,
} from '@/components/ui';
import { parseEuro } from '@/lib/format';

/** Bezahlinfos (IBAN, PayPal), Getränkepreis, Sichtbarkeit und automatische Erinnerung. */
export default function CashSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cash = useCash(id);
  if (cash.isPending || !cash.data) return <Loading />;
  return <Form id={id} settings={cash.data.settings} drinks={cash.data.config.drinks} />;
}

function Form({
  id,
  settings,
  drinks,
}: {
  id: string;
  settings: NonNullable<ReturnType<typeof useCash>['data']>['settings'];
  drinks: boolean;
}) {
  const save = useCashAction(id, () => router.back());
  const [iban, setIban] = useState(settings.iban ?? '');
  const [holder, setHolder] = useState(settings.accountHolder ?? '');
  const [paypal, setPaypal] = useState(settings.paypalLink ?? '');
  const [price, setPrice] = useState(
    settings.drinkPriceCents ? centsToInput(settings.drinkPriceCents) : '',
  );
  const [showBalances, setShowBalances] = useState(settings.showMemberBalances);
  const [autoReminder, setAutoReminder] = useState(settings.autoReminder);
  return (
    <Screen edges={[]}>
      <Section title="Bezahlinfos für die Mannschaft">
        <Card style={{ gap: 12 }}>
          <TextField
            label="IBAN"
            value={iban}
            onChangeText={setIban}
            placeholder="DE.."
            maxLength={42}
          />
          <TextField label="Kontoinhaber" value={holder} onChangeText={setHolder} maxLength={80} />
          <TextField
            label="PayPal-Link (optional)"
            value={paypal}
            onChangeText={setPaypal}
            placeholder="https://paypal.me/…"
            maxLength={200}
          />
          <T variant="caption">
            Sieht nur die eigene Mannschaft – beim Bezahlen im persönlichen Konto.
          </T>
        </Card>
      </Section>
      {drinks ? (
        <Section title="Getränke">
          <Card>
            <TextField
              label="Preis je Getränk in €"
              value={price}
              onChangeText={setPrice}
              placeholder="1,50"
            />
          </Card>
        </Section>
      ) : null}
      <Section title="Sichtbarkeit und Erinnerungen">
        <Card>
          <ListRow
            first
            title="Offene Beträge für alle sichtbar"
            subtitle="Aus: Jede Person sieht nur das eigene Konto."
            trailing={
              <Toggle
                label="Offene Beträge sichtbar"
                value={showBalances}
                onChange={setShowBalances}
              />
            }
          />
          <ListRow
            title="Monatlich erinnern"
            subtitle="Am Monatsersten an offene Beträge erinnern"
            trailing={
              <Toggle label="Monatlich erinnern" value={autoReminder} onChange={setAutoReminder} />
            }
          />
        </Card>
      </Section>
      <ActionError error={save.error} />
      <Button
        label="Speichern"
        icon="checkmark"
        loading={save.isPending}
        onPress={() =>
          save.mutate({
            path: `/teams/${id}/cash/settings`,
            method: 'PUT',
            body: {
              iban: iban.trim() || null,
              accountHolder: holder.trim() || null,
              paypalLink: paypal.trim() || null,
              ...(drinks ? { drinkPriceCents: parseEuro(price) } : {}),
              showMemberBalances: showBalances,
              autoReminder,
            },
          })
        }
      />
    </Screen>
  );
}
