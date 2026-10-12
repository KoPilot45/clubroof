import type { ClubAuditDetail, ClubAudits } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

/**
 * Kassenprüfung (Paket K4): Prüfer beginnen eine Prüfung für ein Jahr (ganzer Verein oder einzelne Kasse),
 * ziehen Stichproben und geben den Prüfbericht ab. Die Kassenführung sieht abgegebene Berichte.
 */
export default function AuditListScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['club-audits'],
    queryFn: () => api<ClubAudits>('/club-cash/audits'),
  });
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [fundId, setFundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: (scopeFund: string | null) =>
      api<ClubAuditDetail>('/club-cash/audits', {
        method: 'POST',
        body: { year, fundId: scopeFund },
      }),
    onSuccess: (d) => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['club-audits'] });
      router.push(`/club-cash/audit/${d.id}`);
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
      ),
  });

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const years = [year - 1, year, year + 1].filter((y) => y <= new Date().getFullYear());
  // Wer nur einzelne Kassen prüft, muss eine wählen; bei Prüfung für den ganzen Verein ist „Ganzer Verein“ dabei
  const scopeOptions = [
    ...(d.wholeClub ? [{ value: 'all', label: t('Ganzer Verein') }] : []),
    ...d.funds.map((f) => ({ value: f.id, label: f.name })),
  ];
  const chosen = fundId ?? (d.wholeClub ? 'all' : (d.funds[0]?.id ?? ''));

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {d.canAudit ? (
        <Section title="Neue Prüfung">
          <Card style={{ gap: 12 }}>
            <ChoiceChips
              label="Prüfjahr"
              selected={[String(year)]}
              onToggle={(v) => setYear(Number(v))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
            {scopeOptions.length > 1 ? (
              <ChoiceChips
                label="Prüfumfang"
                selected={[chosen]}
                onToggle={setFundId}
                options={scopeOptions}
              />
            ) : null}
            <Button
              label="Prüfung beginnen"
              icon="search"
              loading={start.isPending}
              onPress={() => start.mutate(chosen === 'all' ? null : chosen)}
            />
          </Card>
        </Section>
      ) : (
        <Card>
          <T variant="caption">
            Die Kassenprüfung machen Kassenprüfer. Hier siehst du die abgegebenen Prüfberichte.
          </T>
        </Card>
      )}

      <Section title="Prüfungen">
        <Card>
          {d.audits.length === 0 ? (
            <Empty icon="search-outline" text="Noch keine Prüfung." />
          ) : null}
          {d.audits.map((a, i) => (
            <ListRow
              key={a.id}
              first={i === 0}
              leading={
                <IconTile
                  name={a.status === 'submitted' ? 'checkmark-done' : 'search'}
                  tone={a.objections > 0 ? 'action' : a.status === 'submitted' ? 'success' : 'blue'}
                />
              }
              title={`${a.year} · ${a.fundName}`}
              subtitle={[
                a.status === 'submitted' ? t('Bericht abgegeben') : t('In Arbeit'),
                t(`${a.checked} in Ordnung`),
                a.objections > 0 ? t(`${a.objections} Beanstandungen`) : null,
                a.pending > 0 ? t(`${a.pending} offen`) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push(`/club-cash/audit/${a.id}`)}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}
