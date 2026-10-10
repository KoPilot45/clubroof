import type { ClubCash, ClubCashEntry } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { EntryRow } from '@/app/club-cash';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { mediaUri } from '@/lib/upload';
import { formatEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';

/** Kassenbuch: Suche und Filter, Beleg ansehen, Storno mit Begründung. */
export default function ClubCashEntriesScreen() {
  const params = useLocalSearchParams<{ accountId?: string; focus?: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [accountId, setAccountId] = useState<string | null>(params.accountId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [withCancelled, setWithCancelled] = useState(false);
  const [open, setOpen] = useState<string | null>(params.focus ?? null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const query = new URLSearchParams();
  if (q.trim()) query.set('q', q.trim());
  if (accountId) query.set('accountId', accountId);
  if (categoryId) query.set('categoryId', categoryId);
  if (withCancelled) query.set('includeCancelled', 'true');
  const entries = useQuery({
    queryKey: ['club-cash', 'entries', query.toString()],
    queryFn: () => api<ClubCashEntry[]>(`/club-cash/entries?${query.toString()}`),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api<ClubCash>(`/club-cash/entries/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      setReason('');
      setOpen(null);
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Buchung konnte nicht storniert werden.',
      ),
  });

  const c = cash.data;
  return (
    <Screen edges={[]} refreshing={entries.isRefetching} onRefresh={() => entries.refetch()}>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Suchen"
          value={q}
          onChangeText={setQ}
          placeholder={t('Zweck, Gegenpartei oder Belegnummer')}
        />
        {c ? (
          <>
            <ChoiceChips
              label="Konto"
              options={c.accounts.map((a) => ({ value: a.id, label: a.name }))}
              selected={accountId ? [accountId] : []}
              onToggle={(v) => setAccountId(accountId === v ? null : v)}
            />
            <ChoiceChips
              label="Kategorie"
              options={c.categories
                .filter((k) => !k.archived)
                .map((k) => ({ value: k.id, label: k.name }))}
              selected={categoryId ? [categoryId] : []}
              onToggle={(v) => setCategoryId(categoryId === v ? null : v)}
            />
          </>
        ) : null}
        <Button
          label={withCancelled ? 'Stornierte ausblenden' : 'Stornierte anzeigen'}
          variant="tonal"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => setWithCancelled(!withCancelled)}
        />
      </Card>
      {entries.isPending ? <Loading /> : null}
      {entries.error ? (
        <ErrorNotice error={entries.error} onRetry={() => entries.refetch()} />
      ) : null}
      {entries.data && entries.data.length === 0 ? (
        <Card>
          <Empty icon="receipt-outline" text="Keine Buchungen gefunden." />
        </Card>
      ) : null}
      {entries.data?.map((e) => (
        <Card key={e.id}>
          <EntryRow entry={e} first onPress={() => setOpen(open === e.id ? null : e.id)} />
          {open === e.id ? (
            <View style={{ gap: 8, paddingTop: 8 }}>
              <T variant="caption">
                {[
                  e.counterparty,
                  e.costCenterName ? `${t('Kostenstelle')}: ${e.costCenterName}` : null,
                  e.receiptNo ? `${t('Beleg')} ${e.receiptNo}` : null,
                  e.createdByName ? `${t('Gebucht von')} ${e.createdByName}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </T>
              <T variant="caption">{formatEuro(e.amountCents)}</T>
              {e.receiptUrl ? (
                <Button
                  label="Beleg ansehen"
                  icon="document-attach-outline"
                  variant="outline"
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => void Linking.openURL(mediaUri(e.receiptUrl)!)}
                />
              ) : null}
              {e.cancelled ? (
                <Chip
                  tone="urgent"
                  icon="close-circle"
                  label={`${t('Storniert')}: ${e.cancelled.reason}`}
                />
              ) : c?.canManage ? (
                <View style={{ gap: 8 }}>
                  <TextField
                    label="Begründung für das Storno"
                    value={reason}
                    onChangeText={setReason}
                    maxLength={300}
                  />
                  {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
                  <Button
                    label="Buchung stornieren"
                    icon="close-circle-outline"
                    variant="danger"
                    disabled={reason.trim().length < 3}
                    loading={cancel.isPending}
                    onPress={() => cancel.mutate(e.id)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
