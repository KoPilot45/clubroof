import {
  CLUB_FEE_MAX_REMINDER,
  type ClubCash,
  type ClubFeeDue,
  type ClubFees,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  HeroCard,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

const STATUS = [
  { value: 'open', label: 'Offen' },
  { value: 'overdue', label: 'Überfällig' },
  { value: 'paid', label: 'Bezahlt' },
  { value: 'cancelled', label: 'Storniert' },
] as const;

const TONE = { open: 'info', overdue: 'urgent', paid: 'success', cancelled: 'archived' } as const;
const STATUS_LABEL = {
  open: 'Offen',
  overdue: 'Überfällig',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
} as const;

/** Mitgliedsbeiträge (Paket K2): Rückstände, Zahlungseingang, Erinnerungen, Sollstellung. */
export default function ClubFeesScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS)[number]['value']>('overdue');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const query = new URLSearchParams({ status, ...(q.trim() ? { q: q.trim() } : {}) }).toString();
  const fees = useQuery({
    queryKey: ['club-fees', status, q.trim()],
    queryFn: () => api<ClubFees>(`/club-cash/fees?${query}`),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['club-fees'] });
    void queryClient.invalidateQueries({ queryKey: ['club-cash'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );

  const generate = useMutation({
    mutationFn: () =>
      api<{ created: number }>('/club-cash/fees/generate', { method: 'POST', body: {} }),
    onSuccess: (r) => {
      setError(null);
      setMessage(
        r.created === 0
          ? t('Alle Forderungen sind schon erzeugt.')
          : t(`${r.created} neue Forderungen erzeugt.`),
      );
      refresh();
    },
    onError: fail,
  });
  const remindAll = useMutation({
    mutationFn: () =>
      api<{ reminded: number; withoutLogin: number }>('/club-cash/fees/remind-overdue', {
        method: 'POST',
      }),
    onSuccess: (r) => {
      setError(null);
      setMessage(
        r.reminded === 0
          ? t('Keine neuen Erinnerungen nötig.')
          : r.withoutLogin
            ? t(`${r.reminded} Erinnerungen verschickt (${r.withoutLogin} ohne App-Zugang).`)
            : t(`${r.reminded} Erinnerungen verschickt.`),
      );
      refresh();
    },
    onError: fail,
  });

  const f = fees.data;
  const full = f?.level === 'full';
  return (
    <Screen edges={[]} refreshing={fees.isRefetching} onRefresh={() => fees.refetch()}>
      {fees.isPending ? <Loading /> : null}
      {fees.error ? <ErrorNotice error={fees.error} onRetry={() => fees.refetch()} /> : null}
      {f ? (
        <>
          <HeroCard>
            <T variant="overline" color={colors.hero.onHero}>
              Offene Beiträge
            </T>
            <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 44 }}>
              {formatEuro(f.summary.openCents)}
            </T>
            <T variant="label" color={colors.hero.onHero}>
              {t(
                `davon überfällig ${formatEuro(f.summary.overdueCents)} · ${f.summary.overduePersons} Mitglieder`,
              )}
            </T>
            <T variant="caption" color={colors.hero.onHero}>
              {t(`Eingegangen in diesem Jahr: ${formatEuro(f.summary.paidThisYearCents)}`)}
            </T>
          </HeroCard>

          {f.canManage ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label="Sollstellung erzeugen"
                  icon="add-circle-outline"
                  style={{ flex: 1 }}
                  loading={generate.isPending}
                  onPress={() => generate.mutate()}
                />
                <Button
                  label="Alle erinnern"
                  icon="notifications-outline"
                  variant="outline"
                  style={{ flex: 1 }}
                  loading={remindAll.isPending}
                  onPress={() => remindAll.mutate()}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label="Kontoauszug importieren"
                  icon="document-text-outline"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => router.push('/club-cash/fee-import')}
                />
                <Button
                  label="Beitragsarten & Mitglieder"
                  icon="people-outline"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => router.push('/club-cash/fee-setup')}
                />
              </View>
            </View>
          ) : null}
          {message ? <Chip tone="success" icon="checkmark-circle" label={message} /> : null}
          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

          {full ? (
            <>
              <Card style={{ gap: 12 }}>
                <ChoiceChips
                  label="Anzeigen"
                  options={STATUS.map((s) => ({ value: s.value, label: s.label }))}
                  selected={[status]}
                  onToggle={setStatus}
                />
                <TextField
                  label="Suchen"
                  value={q}
                  onChangeText={setQ}
                  placeholder={t('Name oder Mitgliedsnummer')}
                />
              </Card>
              <Section title="Forderungen">
                <Card>
                  {f.dues.length === 0 ? (
                    <Empty
                      icon="checkmark-done-outline"
                      text="Keine Forderungen in dieser Ansicht."
                    />
                  ) : (
                    f.dues.map((d, i) => (
                      <View key={d.id}>
                        <ListRow
                          first={i === 0}
                          strike={d.status === 'cancelled'}
                          title={d.personName}
                          subtitle={t(
                            `${d.feeTypeName} · ${d.periodLabel} · fällig ${d.dueOn
                              .split('-')
                              .reverse()
                              .join('.')}`,
                          )}
                          trailing={
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Chip
                                tone={TONE[d.status]}
                                label={
                                  d.status === 'paid' || d.status === 'cancelled'
                                    ? STATUS_LABEL[d.status]
                                    : formatEuro(d.openCents)
                                }
                              />
                              {d.reminderLevel > 0 && d.status === 'overdue' ? (
                                <T variant="caption">{t(`Stufe ${d.reminderLevel}`)}</T>
                              ) : null}
                            </View>
                          }
                          onPress={() => setOpen(open === d.id ? null : d.id)}
                        />
                        {open === d.id ? (
                          <DueActions
                            due={d}
                            cash={cash.data}
                            canManage={f.canManage}
                            today={f.today}
                            onDone={(text) => {
                              setMessage(text);
                              setError(null);
                              setOpen(null);
                              refresh();
                            }}
                            onError={setError}
                          />
                        ) : null}
                      </View>
                    ))
                  )}
                </Card>
              </Section>
            </>
          ) : (
            <Card>
              <T variant="caption">
                Du siehst Summen, aber keine Forderungen einzelner Mitglieder.
              </T>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function DueActions({
  due,
  cash,
  canManage,
  today,
  onDone,
  onError,
}: {
  due: ClubFeeDue;
  cash: ClubCash | undefined;
  canManage: boolean;
  today: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { api } = useSignedIn();
  const accounts = (cash?.accounts ?? []).filter((a) => !a.archived);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(due.openCents / 100).replace('.', ','));
  const [paidOn, setPaidOn] = useState(today);
  const [reason, setReason] = useState('');
  const fail = (e: unknown) =>
    onError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );

  const pay = useMutation({
    mutationFn: () =>
      api(`/club-cash/fees/dues/${due.id}/payments`, {
        method: 'POST',
        body: {
          accountId: accountId ?? accounts[0]?.id,
          amountCents: parseEuro(amount),
          paidOn,
        },
      }),
    onSuccess: () => onDone('Zahlung gebucht.'),
    onError: fail,
  });
  const remind = useMutation({
    mutationFn: () =>
      api<{ level: number; notified: boolean }>(`/club-cash/fees/dues/${due.id}/remind`, {
        method: 'POST',
      }),
    onSuccess: (r) =>
      onDone(
        r.notified
          ? t(`Stufe ${r.level}: Erinnerung verschickt.`)
          : t(
              `Stufe ${r.level} vermerkt – das Mitglied hat keinen App-Zugang, bitte anders informieren.`,
            ),
      ),
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () =>
      api(`/club-cash/fees/dues/${due.id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => onDone('Forderung storniert.'),
    onError: fail,
  });

  const live = due.status === 'open' || due.status === 'overdue';
  return (
    <View style={{ gap: 10, paddingVertical: 10 }}>
      <T variant="caption">
        {[
          formatEuro(due.amountCents),
          due.paidCents ? t(`bezahlt ${formatEuro(due.paidCents)}`) : null,
          due.memberNumber ? t(`Mitgliedsnr. ${due.memberNumber}`) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </T>
      {due.cancelReason ? (
        <Chip tone="archived" label={`${t('Storniert')}: ${due.cancelReason}`} />
      ) : null}
      {canManage && live ? (
        <>
          <ChoiceChips
            label="Auf Konto"
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            selected={[accountId ?? accounts[0]?.id ?? '']}
            onToggle={setAccountId}
          />
          <TextField label="Betrag in €" value={amount} onChangeText={setAmount} />
          <DateStepper label="Eingegangen am" value={paidOn} onChange={setPaidOn} />
          <Button
            label="Zahlung buchen"
            icon="checkmark"
            disabled={!parseEuro(amount) || accounts.length === 0}
            loading={pay.isPending}
            onPress={() => pay.mutate()}
          />
          {due.status === 'overdue' && due.reminderLevel < CLUB_FEE_MAX_REMINDER ? (
            <Button
              label={t(`Erinnerung Stufe ${due.reminderLevel + 1} senden`)}
              icon="notifications-outline"
              variant="outline"
              loading={remind.isPending}
              onPress={() => remind.mutate()}
            />
          ) : null}
          {due.paidCents === 0 ? (
            <View style={{ gap: 8 }}>
              <TextField
                label="Begründung für das Storno"
                value={reason}
                onChangeText={setReason}
                maxLength={300}
              />
              <Button
                label="Forderung stornieren"
                icon="close-circle-outline"
                variant="danger"
                disabled={reason.trim().length < 3}
                loading={cancel.isPending}
                onPress={() => cancel.mutate()}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
