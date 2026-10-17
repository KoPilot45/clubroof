import { CLUB_CASH_AREA_LABEL, type ClubClosing, type ClubClosingLine } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  HeroCard,
  ListRow,
  Loading,
  Notice,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Counted } from '@/lib/motion';

const signed = (cents: number) =>
  `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${formatEuro(Math.abs(cents))}`;

/**
 * Jahresabschluss (Paket K3): Einnahmen-Ausgaben-Rechnung nach den vier Bereichen mit Vorjahr, Bestände,
 * Rücklagen, Export als CSV/PDF und Periodensperre. Gilt immer für den ganzen Verein.
 */
export default function ClosingScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const key = ['club-closing', year];
  const data = useQuery({
    queryKey: key,
    queryFn: () => api<ClubClosing>(`/club-cash/closing?year=${year}`),
  });
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);

  const done = (d: ClubClosing) => {
    setError(null);
    setConfirm(false);
    setReason('');
    queryClient.setQueryData(key, d);
    // gesperrte Jahre ändern Plan und Kassenbuch
    void queryClient.invalidateQueries({ queryKey: ['club-budget'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const close = useMutation({
    mutationFn: () =>
      api<ClubClosing>('/club-cash/closing/close', { method: 'POST', body: { year } }),
    onSuccess: done,
    onError: fail,
  });
  const reopen = useMutation({
    mutationFn: () =>
      api<ClubClosing>('/club-cash/closing/reopen', { method: 'POST', body: { year, reason } }),
    onSuccess: done,
    onError: fail,
  });
  const exportAs = (format: 'csv' | 'pdf') =>
    void api<{ url: string }>(`/club-cash/closing/link?year=${year}&format=${format}`)
      .then(({ url }) => Linking.openURL(url))
      .catch(fail);

  const d = data.data;
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 2, thisYear - 1, thisYear];
  const result = d ? d.incomeCents - d.expenseCents : 0;
  const previousResult = d ? d.previousIncomeCents - d.previousExpenseCents : 0;

  const lineRow = (prefix: string, l: ClubClosingLine, i: number) => (
    <ListRow
      key={`${prefix}${l.categoryName}`}
      first={i === 0}
      title={l.categoryName}
      subtitle={`${t('Vorjahr')} ${formatEuro(l.previousCents)}`}
      trailing={<Chip tone="neutral" label={formatEuro(l.cents)} />}
    />
  );

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      <ChoiceChips
        scroll
        selected={[String(year)]}
        onToggle={(v) => {
          setYear(Number(v));
          setError(null);
          setConfirm(false);
        }}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
      />
      {data.isPending ? <Loading /> : null}
      {data.error ? <ErrorNotice error={data.error} onRetry={() => data.refetch()} /> : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {d ? (
        <>
          <HeroCard>
            <T variant="overline" color={colors.hero.onHero}>
              {`${t('Jahresergebnis')} ${year}`}
            </T>
            <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
              <Counted value={result} format={signed} />
            </T>
            <T variant="caption" color={colors.hero.onHero}>
              {`${t('Einnahmen')} ${formatEuro(d.incomeCents)} · ${t('Ausgaben')} ${formatEuro(d.expenseCents)} · ${t('Vorjahr')} ${signed(previousResult)}`}
            </T>
          </HeroCard>

          {d.lock ? (
            <Chip
              tone="archived"
              icon="lock-closed"
              label={`${t('Abgeschlossen am')} ${d.lock.lockedAt.slice(0, 10).split('-').reverse().join('.')}${d.lock.lockedByName ? ` ${t('von')} ${d.lock.lockedByName}` : ''}`}
            />
          ) : (
            <Chip
              tone="action"
              icon="create-outline"
              label={t('Entwurf – das Jahr ist noch offen')}
            />
          )}

          {d.areas.map((a) => (
            <Section key={a.area} title={CLUB_CASH_AREA_LABEL[a.area]}>
              <Card>
                {a.incomeLines.length + a.expenseLines.length === 0 ? (
                  <T variant="caption">Keine Buchungen.</T>
                ) : null}
                {a.incomeLines.map((l, i) => lineRow('i', l, i))}
                {a.expenseLines.map((l, i) => lineRow('e', l, i + a.incomeLines.length))}
              </Card>
              <T variant="caption">
                {`${t('Einnahmen')} ${formatEuro(a.incomeCents)} · ${t('Ausgaben')} ${formatEuro(a.expenseCents)} · ${t('Ergebnis')} ${signed(a.incomeCents - a.expenseCents)}`}
              </T>
            </Section>
          ))}

          <Section title="Bestände">
            <Card>
              {d.accounts.map((a, i) => (
                <ListRow
                  key={`${a.fundName}${a.name}`}
                  first={i === 0}
                  title={a.name}
                  subtitle={`${a.fundName} · 01.01. ${formatEuro(a.openingCents)}`}
                  trailing={<Chip tone="neutral" label={formatEuro(a.closingCents)} />}
                />
              ))}
            </Card>
            <T variant="caption">
              {`${t('Gesamt')} 01.01.: ${formatEuro(d.openingCents)} · 31.12.: ${formatEuro(d.closingCents)}`}
            </T>
            {d.reserves.length ? (
              <T variant="caption">
                {`${t('Davon als Rücklage gebunden')}: ${d.reserves.map((r) => `${r.name} ${formatEuro(r.balanceCents)}`).join(' · ')}`}
              </T>
            ) : null}
          </Section>

          <Section title="Ausgabe">
            <View style={{ gap: 10 }}>
              <Button
                label="Als PDF öffnen"
                icon="document-text-outline"
                disabled={d.level !== 'full'}
                onPress={() => exportAs('pdf')}
              />
              <Button
                label="Als CSV für Excel"
                icon="download-outline"
                variant="outline"
                disabled={d.level !== 'full'}
                onPress={() => exportAs('csv')}
              />
            </View>
          </Section>

          {d.canManage && !d.lock ? (
            d.canClose ? (
              <Notice
                tone="action"
                icon="lock-closed"
                title={t(`Jahr ${year} abschließen`)}
                text="Danach sind Buchungen, Stornos, Plan und Rücklagen in diesem Jahr gesperrt. Öffnen kann es nur die Administration, mit Begründung."
                action={
                  confirm
                    ? {
                        label: t(`Ja, ${year} abschließen`),
                        icon: 'checkmark',
                        onPress: () => close.mutate(),
                      }
                    : { label: 'Abschließen', icon: 'lock-closed', onPress: () => setConfirm(true) }
                }
              />
            ) : (
              <T variant="caption">
                Das laufende Jahr kann erst nach seinem Ende abgeschlossen werden.
              </T>
            )
          ) : null}
          {d.lock && d.canUnlock ? (
            <Card style={{ gap: 10 }}>
              <T variant="label" style={{ fontWeight: '700' }}>
                Jahr wieder öffnen
              </T>
              <TextField
                label="Begründung"
                value={reason}
                onChangeText={setReason}
                maxLength={300}
              />
              <Button
                label="Wieder öffnen"
                icon="lock-open-outline"
                variant="danger"
                disabled={reason.trim().length < 3}
                loading={reopen.isPending}
                onPress={() => reopen.mutate()}
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
