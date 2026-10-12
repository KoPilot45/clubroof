import type { ClubCash, ClubFeeImportPreview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { pickFile } from '@/lib/upload';
import { t } from '@/lib/i18n';

/** Kontoauszug (CSV) einlesen: Eingänge werden offenen Beiträgen zugeordnet, gebucht wird erst nach der Vorschau. */
export default function FeeImportScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClubFeeImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const [csv, setCsv] = useState<string | null>(null);
  const accounts = (cash.data?.accounts ?? []).filter((a) => !a.archived);
  const target = accountId ?? accounts[0]?.id ?? null;
  // Die Vorschau gilt für das gewählte Konto (Beiträge gehören in die Zielkasse ihrer Beitragsart)
  const run = useMutation({
    mutationFn: (v: { dataBase64: string; accountId: string | null }) =>
      api<ClubFeeImportPreview>('/club-cash/fees/import/preview', {
        method: 'POST',
        body: v,
      }),
    onSuccess: (p) => {
      setError(null);
      setPreview(p);
    },
    onError: fail,
  });
  const read = useMutation({
    mutationFn: async () => {
      const file = await pickFile('csv');
      if (!file) return null;
      setCsv(file.dataBase64);
      return run.mutateAsync({ dataBase64: file.dataBase64, accountId: target });
    },
    onError: fail,
  });
  const chooseAccount = (id: string) => {
    setAccountId(id);
    if (csv) run.mutate({ dataBase64: csv, accountId: id });
  };
  const book = useMutation({
    mutationFn: () =>
      api<{ booked: number }>('/club-cash/fees/import/commit', {
        method: 'POST',
        body: {
          accountId: target,
          items: (preview?.rows ?? [])
            .filter((r) => r.match)
            .map((r) => ({ dueId: r.match!.dueId, amountCents: r.amountCents, paidOn: r.paidOn })),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['club-fees'] });
      void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
      router.back();
    },
    onError: fail,
  });

  if (cash.isPending) return <Loading />;
  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <T>
          Lade den Kontoauszug als CSV-Datei deiner Bank hoch. Erkannt werden Buchungstag, Betrag,
          Name und Verwendungszweck. Zugeordnet wird per Mitgliedsnummer oder Name, wenn der Betrag
          genau zu einer offenen Forderung passt. Du siehst alles vorher.
        </T>
        <ChoiceChips
          label="Gebucht wird auf Konto"
          options={accounts.map((a) => ({
            value: a.id,
            label:
              (cash.data?.funds.filter((f) => !f.archived).length ?? 0) > 1
                ? `${cash.data?.funds.find((f) => f.id === a.fundId)?.name ?? ''} › ${a.name}`
                : a.name,
          }))}
          selected={target ? [target] : []}
          onToggle={chooseAccount}
        />
        <Button
          label={preview ? 'Andere Datei wählen' : 'CSV-Datei wählen'}
          icon="document-text-outline"
          loading={read.isPending}
          onPress={() => read.mutate()}
        />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {preview ? (
        <>
          <Chip
            tone={preview.matched ? 'success' : 'neutral'}
            label={t(`${preview.matched} zugeordnet · ${preview.skipped} übersprungen`)}
          />
          <Section title="Vorschau">
            <Card>
              {preview.rows.map((r, i) => (
                <ListRow
                  key={r.row}
                  first={i === 0}
                  title={r.match ? `${r.match.personName} · ${r.match.periodLabel}` : r.name || '–'}
                  subtitle={r.match ? r.purpose : (r.note ?? r.purpose)}
                  trailing={
                    <Chip
                      tone={r.match ? 'success' : 'neutral'}
                      label={r.amountCents === null ? '–' : formatEuro(r.amountCents)}
                    />
                  }
                />
              ))}
            </Card>
          </Section>
          <Button
            label={t(`${preview.matched} Zahlungen buchen`)}
            icon="checkmark"
            disabled={!preview.matched || !target}
            loading={book.isPending}
            onPress={() => book.mutate()}
          />
        </>
      ) : null}
    </Screen>
  );
}
