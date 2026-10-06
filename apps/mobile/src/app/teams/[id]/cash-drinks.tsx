import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ActionError, centsToInput, useCash, useCashAction, usePlayers } from '@/components/cash';
import { Button, Card, Loading, Screen, T, TextField } from '@/components/ui';
import { formatEuro, parseEuro } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

/** Getränke-Strichliste: je Person Striche zählen, Preis aus den Einstellungen. */
export default function CashDrinksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const cash = useCash(id);
  const { players, isPending } = usePlayers(id);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [price, setPrice] = useState<string | null>(null);
  const save = useCashAction(id, () => router.back());
  if (cash.isPending || isPending) return <Loading />;
  const priceText =
    price ??
    (cash.data?.settings.drinkPriceCents ? centsToInput(cash.data.settings.drinkPriceCents) : '');
  const cents = parseEuro(priceText);
  const items = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([personId, count]) => ({ personId, count }));
  const total = items.reduce((a, i) => a + i.count, 0);
  const change = (pid: string, delta: number) =>
    setCounts({ ...counts, [pid]: Math.max(0, Math.min(50, (counts[pid] ?? 0) + delta)) });
  const step = (pid: string, delta: number, icon: 'remove' | 'add') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Ein Getränk mehr' : 'Ein Getränk weniger'}
      onPress={() => change(pid, delta)}
      hitSlop={6}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: delta > 0 ? colors.primaryContainer : colors.surfaceVariant,
      }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={delta > 0 ? colors.onPrimaryContainer : colors.onSurface}
      />
    </Pressable>
  );
  return (
    <Screen edges={[]}>
      <Card>
        <TextField
          label="Preis je Getränk in €"
          value={priceText}
          onChangeText={setPrice}
          placeholder={t('1,50')}
        />
      </Card>
      <Card>
        {players.map((p, i) => (
          <View
            key={p.personId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 8,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <T variant="label" style={{ flex: 1 }}>
              {p.name}
            </T>
            {step(p.personId, -1, 'remove')}
            <T variant="heading" style={{ width: 28, textAlign: 'center' }}>
              {counts[p.personId] ?? 0}
            </T>
            {step(p.personId, 1, 'add')}
          </View>
        ))}
      </Card>
      <ActionError error={save.error} />
      <Button
        label={
          total
            ? `${total} Getränke buchen (${formatEuro(total * (cents ?? 0))})`
            : 'Getränke buchen'
        }
        icon="checkmark"
        disabled={!total || !cents}
        loading={save.isPending}
        onPress={() =>
          save.mutate({
            path: `/teams/${id}/cash/drinks`,
            method: 'POST',
            body: { items, priceCents: cents },
          })
        }
      />
    </Screen>
  );
}
