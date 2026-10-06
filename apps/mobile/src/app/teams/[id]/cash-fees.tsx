import type { CashFee } from '@clubroof/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionError, useCash, useCashAction } from '@/components/cash';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { toGermanDate } from '@/lib/dates';
import { formatEuro, parseEuro } from '@/lib/format';

const INTERVALS: { value: CashFee['interval']; label: string }[] = [
  { value: 'monthly', label: 'Monatlich' },
  { value: 'season', label: 'Je Saison' },
  { value: 'once', label: 'Einmalig' },
];

/** Mannschaftsbeiträge: werden allen Spielern automatisch als Forderung gebucht. */
export default function CashFeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cash = useCash(id);
  const action = useCashAction(id, () => setCreating(false));
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('Mannschaftsbeitrag');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState<CashFee['interval']>('monthly');
  const [startsOn, setStartsOn] = useState(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
  });
  if (cash.isPending) return <Loading />;
  const fees = cash.data?.fees ?? [];
  const cents = parseEuro(amount);
  return (
    <Screen edges={[]}>
      <T variant="caption">
        Beiträge werden zum Fälligkeitstag allen Spielerinnen und Spielern der Mannschaft auf ihr
        Konto gebucht; sie bekommen eine Benachrichtigung.
      </T>
      <Section title="Aktive Beiträge">
        <Card>
          {fees.length === 0 ? <Empty icon="repeat-outline" text="Noch keine Beiträge." /> : null}
          {fees.map((f, i) => (
            <ListRow
              key={f.id}
              first={i === 0}
              title={`${f.name} · ${formatEuro(f.amountCents)}`}
              subtitle={`${INTERVALS.find((x) => x.value === f.interval)?.label} · nächste Fälligkeit ${toGermanDate(f.nextDueOn)}`}
              trailing={
                <Button
                  label="Beenden"
                  size="sm"
                  variant="danger"
                  onPress={() => action.mutate({ path: `/cash/fees/${f.id}`, method: 'DELETE' })}
                />
              }
            />
          ))}
        </Card>
      </Section>
      {creating ? (
        <Card style={{ gap: 12 }}>
          <TextField label="Bezeichnung" value={name} onChangeText={setName} maxLength={60} />
          <TextField
            label="Betrag je Spieler in €"
            value={amount}
            onChangeText={setAmount}
            placeholder="5,00"
          />
          <ChoiceChips
            label="Rhythmus"
            options={INTERVALS}
            selected={[interval]}
            onToggle={setInterval}
          />
          <DateStepper label="Erste Fälligkeit" value={startsOn} onChange={setStartsOn} />
          {startsOn <= new Date().toISOString().slice(0, 10) ? (
            <Chip tone="info" label="Fällige Beträge werden sofort gebucht" />
          ) : null}
          <Button
            label="Beitrag anlegen"
            icon="checkmark"
            disabled={!cents || name.trim().length < 2}
            loading={action.isPending}
            onPress={() =>
              action.mutate({
                path: `/teams/${id}/cash/fees`,
                method: 'POST',
                body: { name: name.trim(), amountCents: cents, interval, startsOn },
              })
            }
          />
        </Card>
      ) : (
        <Button
          label="Neuer Beitrag"
          icon="add"
          variant="outline"
          onPress={() => setCreating(true)}
        />
      )}
      <ActionError error={action.error} />
    </Screen>
  );
}
