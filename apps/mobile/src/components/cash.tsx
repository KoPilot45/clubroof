import type { CashEntry, PaymentMethod, RosterEntry, TeamCash } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Linking, Pressable, View } from 'react-native';
import { RequestError } from '@/lib/api';
import { cashCategory } from '@/lib/cash';
import { formatEuro, formatShortDate } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';
import { ChoiceChips, Chip, IconTile, ListRow, T } from './ui';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'ueberweisung', label: 'Überweisung' },
  { value: 'paypal', label: 'PayPal' },
];
export const paymentLabel = (m: PaymentMethod | null) =>
  PAYMENT_METHODS.find((p) => p.value === m)?.label ?? null;

export function useCash(teamId: string) {
  const { api } = useSignedIn();
  return useQuery({
    queryKey: ['cash', teamId],
    queryFn: () => api<TeamCash>(`/teams/${teamId}/cash`),
  });
}

export function usePlayers(teamId: string) {
  const { api } = useSignedIn();
  const roster = useQuery({
    queryKey: ['roster', teamId],
    queryFn: () => api<RosterEntry[]>(`/teams/${teamId}/roster`),
  });
  return { ...roster, players: (roster.data ?? []).filter((r) => r.function === 'player') };
}

type Call = { path: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown };

/** Kassenaktion: Antwort ist immer die aktuelle Kasse. */
export function useCashAction(teamId: string, onDone?: (cash: TeamCash) => void) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: Call) => api<TeamCash>(v.path, { method: v.method, body: v.body }),
    onSuccess: (cash) => {
      queryClient.setQueryData(['cash', teamId], cash);
      void queryClient.invalidateQueries({ queryKey: ['cash-stats', teamId] });
      onDone?.(cash);
    },
  });
}

export function ActionError({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <Chip
      tone="urgent"
      icon="alert-circle"
      label={error instanceof RequestError ? error.message : 'Das hat nicht geklappt.'}
    />
  );
}

export function PaymentMethodChips({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
}) {
  return (
    <ChoiceChips
      label="Zahlungsart"
      options={PAYMENT_METHODS}
      selected={[value]}
      onToggle={onChange}
    />
  );
}

/** Personen zum Anhaken; optional mit Zusatz rechts (z. B. offener Betrag oder Zähler). */
export function PersonChecklist({
  players,
  selected,
  onToggle,
  trailing,
}: {
  players: { personId: string; name: string; jerseyNumber?: number | null }[];
  selected: string[];
  onToggle: (personId: string) => void;
  trailing?: (personId: string) => React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {players.map((p) => {
        const on = selected.includes(p.personId);
        return (
          <Pressable
            key={p.personId}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(p.personId)}
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
              name={on ? 'checkbox' : 'square-outline'}
              size={22}
              color={on ? colors.primaryText : colors.onSurfaceMuted}
            />
            <T variant="label" style={{ flex: 1 }}>
              {p.name}
            </T>
            {trailing ? trailing(p.personId) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Zeile einer Buchung; storniert durchgestrichen mit Grund. */
export function EntryRow({
  entry,
  first,
  showPerson,
  onPress,
}: {
  entry: CashEntry;
  first: boolean;
  showPerson: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const cat = cashCategory(entry.category);
  const negative = entry.isCharge || entry.direction === 'expense';
  const subtitle = [
    formatShortDate(entry.bookedOn),
    cat.label,
    showPerson ? entry.person?.name : entry.counterparty,
    paymentLabel(entry.paymentMethod),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      first={first}
      onPress={onPress}
      leading={
        <IconTile
          name={cat.icon}
          tone={entry.cancelled ? 'archived' : entry.isCharge ? 'action' : 'primary'}
        />
      }
      title={entry.description}
      subtitle={
        <View style={{ gap: 2 }}>
          <T variant="caption">{subtitle}</T>
          {entry.cancelled ? (
            <T variant="caption" color={colors.status.urgent.onContainer}>
              Storniert{entry.cancelled.by ? ` von ${entry.cancelled.by}` : ''}
              {entry.cancelled.reason ? `: ${entry.cancelled.reason}` : ''}
            </T>
          ) : null}
          {entry.receiptUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(mediaUri(entry.receiptUrl)!)}
            >
              <T variant="caption" color={colors.primaryText}>
                Beleg ansehen
              </T>
            </Pressable>
          ) : null}
        </View>
      }
      trailing={
        <T
          variant="label"
          style={{ textDecorationLine: entry.cancelled ? 'line-through' : 'none' }}
          color={
            entry.cancelled
              ? colors.onSurfaceMuted
              : negative
                ? colors.status.urgent.onContainer
                : colors.status.success.onContainer
          }
        >
          {negative ? '−' : '+'}
          {formatEuro(entry.amountCents)}
        </T>
      }
    />
  );
}

/** Euro-Betrag als Eingabetext („12,50“). */
export const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
