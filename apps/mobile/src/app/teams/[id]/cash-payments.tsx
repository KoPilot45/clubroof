import type { PaymentMethod } from '@clubroof/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ActionError,
  PaymentMethodChips,
  PersonChecklist,
  centsToInput,
  useCash,
  useCashAction,
  usePlayers,
} from '@/components/cash';
import { Button, Card, Chip, Loading, Screen, T, TextField } from '@/components/ui';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';

/** Einzahlungen buchen – eine oder mehrere Personen, Betrag je Person (vorbelegt: offener Betrag). */
export default function CashPaymentsScreen() {
  const { id, personId, amount } = useLocalSearchParams<{
    id: string;
    personId?: string;
    amount?: string;
  }>();
  const cash = useCash(id);
  const { players, isPending } = usePlayers(id);
  const [selected, setSelected] = useState<string[]>(personId ? [personId] : []);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    personId && amount ? { [personId]: centsToInput(Number(amount)) } : {},
  );
  const [method, setMethod] = useState<PaymentMethod>('bar');
  const save = useCashAction(id, () => router.back());
  if (cash.isPending || isPending) return <Loading />;
  const openOf = (pid: string) =>
    -(cash.data?.members?.find((m) => m.personId === pid)?.balanceCents ?? 0);
  const toggle = (pid: string) => {
    if (selected.includes(pid)) {
      setSelected(selected.filter((p) => p !== pid));
    } else {
      setSelected([...selected, pid]);
      if (!amounts[pid] && openOf(pid) > 0)
        setAmounts({ ...amounts, [pid]: centsToInput(openOf(pid)) });
    }
  };
  const items = selected.map((pid) => ({
    personId: pid,
    amountCents: parseEuro(amounts[pid] ?? ''),
  }));
  const invalid = items.length === 0 || items.some((i) => !i.amountCents);
  const total = items.reduce((a, i) => a + (i.amountCents ?? 0), 0);
  // Personen mit offenem Betrag zuerst
  const sorted = [...players].sort((a, b) => openOf(b.personId) - openOf(a.personId));

  return (
    <Screen edges={[]}>
      <Card>
        <PaymentMethodChips value={method} onChange={setMethod} />
      </Card>
      <Card style={{ gap: 4 }}>
        <T variant="overline">Wer hat bezahlt?</T>
        <PersonChecklist
          players={sorted}
          selected={selected}
          onToggle={toggle}
          trailing={(pid) =>
            selected.includes(pid) ? (
              <View style={{ width: 96 }}>
                <TextField
                  label=""
                  value={amounts[pid] ?? ''}
                  onChangeText={(v) => setAmounts({ ...amounts, [pid]: v })}
                  placeholder={t('0,00')}
                />
              </View>
            ) : openOf(pid) > 0 ? (
              <Chip tone="action" label={`offen ${formatEuro(openOf(pid))}`} />
            ) : null
          }
        />
      </Card>
      <ActionError error={save.error} />
      <Button
        label={
          selected.length > 1
            ? `${selected.length} Einzahlungen buchen (${formatEuro(total)})`
            : 'Einzahlung buchen'
        }
        icon="checkmark"
        disabled={invalid}
        loading={save.isPending}
        onPress={() =>
          save.mutate({
            path: `/teams/${id}/cash/payments`,
            method: 'POST',
            body: { items, paymentMethod: method },
          })
        }
      />
    </Screen>
  );
}
