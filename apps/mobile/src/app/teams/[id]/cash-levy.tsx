import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionError, PersonChecklist, useCashAction, usePlayers } from '@/components/cash';
import { Button, Card, ChoiceChips, Loading, Screen, T, TextField } from '@/components/ui';
import { formatEuro, parseEuro } from '@/lib/format';

/** Umlage: Kosten auf ausgewählte Personen verteilen oder je Person einen festen Betrag fordern. */
export default function CashLevyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, isPending } = usePlayers(id);
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'split' | 'each'>('split');
  const [amount, setAmount] = useState('');
  const [selected, setSelected] = useState<string[] | null>(null);
  const save = useCashAction(id, () => router.back());
  if (isPending) return <Loading />;
  const chosen = selected ?? players.map((p) => p.personId);
  const cents = parseEuro(amount);
  const each =
    cents && chosen.length ? (mode === 'split' ? Math.floor(cents / chosen.length) : cents) : 0;
  const valid = description.trim().length >= 2 && !!cents && chosen.length > 0;
  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Wofür?"
          value={description}
          onChangeText={setDescription}
          placeholder="z. B. Mannschaftsabend, Turnierfahrt"
          maxLength={100}
        />
        <ChoiceChips
          label="Betrag"
          options={[
            { value: 'split', label: 'Gesamtbetrag aufteilen' },
            { value: 'each', label: 'Betrag je Person' },
          ]}
          selected={[mode]}
          onToggle={setMode}
        />
        <TextField
          label={mode === 'split' ? 'Gesamtbetrag in €' : 'Betrag je Person in €'}
          value={amount}
          onChangeText={setAmount}
          placeholder="0,00"
        />
        {each ? (
          <T variant="caption">
            {chosen.length} Personen · je {mode === 'split' ? 'ca. ' : ''}
            {formatEuro(each)}
            {mode === 'split'
              ? ` (zusammen ${formatEuro(cents!)})`
              : ` (zusammen ${formatEuro(each * chosen.length)})`}
          </T>
        ) : null}
      </Card>
      <Card style={{ gap: 4 }}>
        <T variant="overline">Wer ist dabei? ({chosen.length})</T>
        <PersonChecklist
          players={players}
          selected={chosen}
          onToggle={(pid) =>
            setSelected(chosen.includes(pid) ? chosen.filter((p) => p !== pid) : [...chosen, pid])
          }
        />
      </Card>
      <ActionError error={save.error} />
      <Button
        label="Umlage buchen"
        icon="checkmark"
        disabled={!valid}
        loading={save.isPending}
        onPress={() =>
          save.mutate({
            path: `/teams/${id}/cash/levies`,
            method: 'POST',
            body: { description: description.trim(), mode, amountCents: cents, personIds: chosen },
          })
        }
      />
    </Screen>
  );
}
