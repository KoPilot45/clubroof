import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionError, useCash, useCashAction } from '@/components/cash';
import {
  Button,
  Card,
  Empty,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { toGermanDate } from '@/lib/dates';
import { formatEuro } from '@/lib/format';

/** Kassenprüfung / Saisonabschluss: Kassenstand zum Stichtag festhalten, mit Prüfer. */
export default function CashClosingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cash = useCash(id);
  const [auditor, setAuditor] = useState('');
  const [note, setNote] = useState('');
  const save = useCashAction(id, () => {
    setAuditor('');
    setNote('');
  });
  if (cash.isPending) return <Loading />;
  const closings = cash.data?.closings ?? [];
  return (
    <Screen edges={[]}>
      <T variant="caption">
        Hält den Kassenstand von heute fest – z. B. nach der Kassenprüfung oder zum Saisonende. Der
        Abschluss erscheint auch im Kassenbericht. Beim Saisonwechsel geht die Kasse automatisch auf
        die neue Mannschaft über.
      </T>
      <Card style={{ gap: 12 }}>
        <T variant="label">Heutiger Stand: {formatEuro(cash.data?.balanceCents ?? 0)}</T>
        <TextField
          label="Geprüft von (optional)"
          value={auditor}
          onChangeText={setAuditor}
          maxLength={80}
        />
        <TextField
          label="Bemerkung (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={300}
        />
        <Button
          label="Abschluss festhalten"
          icon="shield-checkmark-outline"
          loading={save.isPending}
          onPress={() =>
            save.mutate({
              path: `/teams/${id}/cash/closings`,
              method: 'POST',
              body: { auditor: auditor.trim() || null, note: note.trim() || null },
            })
          }
        />
      </Card>
      <ActionError error={save.error} />
      <Section title="Bisherige Abschlüsse">
        <Card>
          {closings.length === 0 ? (
            <Empty icon="shield-outline" text="Noch keine Kassenprüfung." />
          ) : null}
          {closings.map((cl, i) => (
            <ListRow
              key={cl.id}
              first={i === 0}
              title={`${toGermanDate(cl.closedOn)} · ${formatEuro(cl.balanceCents)}`}
              subtitle={[
                cl.auditor ? `geprüft von ${cl.auditor}` : null,
                cl.openCents ? `offen ${formatEuro(cl.openCents)}` : null,
                cl.note,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
