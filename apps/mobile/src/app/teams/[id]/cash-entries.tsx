import type { CashEntry } from '@clubroof/core';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ActionError, EntryRow, useCash, useCashAction } from '@/components/cash';
import {
  Button,
  Card,
  ChoiceChips,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { cashCategory } from '@/lib/cash';
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';

type Period = 'all' | '30' | '90' | 'season';

/** Alle Buchungen mit Suche und Filter; Kassenverwaltung kann stornieren. */
export default function CashEntriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cash = useCash(id);
  const cancel = useCashAction(id, () => {
    setSelected(null);
    setReason('');
  });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState<Period>('all');
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  if (cash.isPending) return <Loading />;
  if (cash.error) return <ErrorNotice error={cash.error} onRetry={() => cash.refetch()} />;
  const c = cash.data;
  const entries = c.entries ?? [];
  const since =
    period === 'all'
      ? ''
      : new Date(Date.now() - Number(period === 'season' ? 365 : period) * 86_400_000)
          .toISOString()
          .slice(0, 10);
  const categories = [...new Set(entries.map((e) => e.category))];
  const q = query.trim().toLowerCase();
  const list = entries.filter(
    (e: CashEntry) =>
      (showCancelled || !e.cancelled) &&
      (category === 'all' || e.category === category) &&
      (!since || e.bookedOn >= since) &&
      (!q ||
        e.description.toLowerCase().includes(q) ||
        (e.person?.name ?? '').toLowerCase().includes(q) ||
        (e.counterparty ?? '').toLowerCase().includes(q)),
  );
  const sum = list
    .filter((e) => !e.cancelled && !e.isCharge)
    .reduce((a, e) => a + (e.direction === 'income' ? e.amountCents : -e.amountCents), 0);
  return (
    <Screen edges={[]} refreshing={cash.isRefetching} onRefresh={() => cash.refetch()}>
      <Card style={{ gap: 10 }}>
        <TextField
          label="Suchen"
          value={query}
          onChangeText={setQuery}
          placeholder={t('Name, Beschreibung …')}
        />
        <ChoiceChips
          options={[
            { value: 'all', label: 'Alle Arten' },
            ...categories.map((k) => ({ value: k, label: cashCategory(k).label })),
          ]}
          selected={[category]}
          onToggle={setCategory}
        />
        <ChoiceChips
          options={[
            { value: 'all' as const, label: 'Gesamt' },
            { value: '30' as const, label: '30 Tage' },
            { value: '90' as const, label: '90 Tage' },
            { value: 'season' as const, label: '12 Monate' },
          ]}
          selected={[period]}
          onToggle={setPeriod}
        />
        <ChoiceChips
          options={[{ value: 'x', label: 'Stornierte zeigen' }]}
          selected={showCancelled ? ['x'] : []}
          onToggle={() => setShowCancelled(!showCancelled)}
        />
        <T variant="caption">
          {list.length} Buchungen · Geldbewegung {sum >= 0 ? '+' : '−'}
          {formatEuro(Math.abs(sum))}
        </T>
      </Card>
      <Card>
        {list.length === 0 ? (
          <Empty icon="receipt-outline" text="Keine passenden Buchungen." />
        ) : null}
        {list.map((e, i) => (
          <View key={e.id}>
            <EntryRow
              entry={e}
              first={i === 0}
              showPerson
              onPress={
                c.permissions.manageCash && !e.cancelled
                  ? () => setSelected(selected === e.id ? null : e.id)
                  : undefined
              }
            />
            {selected === e.id ? (
              <View style={{ gap: 8, paddingBottom: 10 }}>
                <TextField
                  label="Grund für das Storno (optional)"
                  value={reason}
                  onChangeText={setReason}
                  placeholder={t('z. B. doppelt erfasst')}
                  maxLength={200}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label="Abbrechen"
                    size="sm"
                    variant="outline"
                    onPress={() => setSelected(null)}
                  />
                  <Button
                    label="Buchung stornieren"
                    icon="close-circle-outline"
                    size="sm"
                    variant="danger"
                    loading={cancel.isPending}
                    onPress={() =>
                      cancel.mutate({
                        path: `/cash/transactions/${e.id}/cancel`,
                        method: 'POST',
                        body: { reason: reason.trim() || null },
                      })
                    }
                  />
                </View>
                <T variant="caption">
                  Zum Korrigieren stornieren und die Buchung neu erfassen. Stornos bleiben sichtbar.
                </T>
              </View>
            ) : null}
          </View>
        ))}
      </Card>
      <ActionError error={cancel.error} />
    </Screen>
  );
}
