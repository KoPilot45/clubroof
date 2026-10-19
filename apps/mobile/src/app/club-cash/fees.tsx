import { Cell, DataTable } from '@/components/data-table';
import { useIsDesktop } from '@/lib/layout';
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
  SidePanel,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { Counted } from '@/lib/motion';

const STATUS = [
  { value: 'open', label: 'Offen' },
  { value: 'overdue', label: 'Überfällig' },
  { value: 'paid', label: 'Bezahlt' },
  { value: 'cancelled', label: 'Storniert' },
] as const;

const SECTION_TITLE = {
  open: 'Offene Forderungen',
  overdue: 'Überfällige Forderungen',
  paid: 'Bezahlte Forderungen',
  cancelled: 'Stornierte Forderungen',
} as const;
const EMPTY_TEXT = {
  open: 'Keine offenen Forderungen.',
  overdue: 'Keine überfälligen Forderungen.',
  paid: 'Keine bezahlten Forderungen.',
  cancelled: 'Keine stornierten Forderungen.',
} as const;

const TONE = { open: 'info', overdue: 'urgent', paid: 'success', cancelled: 'archived' } as const;
const STATUS_LABEL = {
  open: 'Offen',
  overdue: 'Überfällig',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
} as const;

/** Mitgliedsbeiträge (Paket K2): Rückstände, Zahlungseingang, Erinnerungen, fällige Beiträge anlegen. */
export default function ClubFeesScreen() {
  const desktop = useIsDesktop();
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
  const renderActions = (d: NonNullable<typeof f>['dues'][number]) =>
    f ? (
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
    ) : null;
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
              <Counted value={f.summary.openCents} format={formatEuro} />
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
                  label="Fällige Beiträge anlegen"
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
          {f.canManage ? (
            <T variant="caption">
              „Fällige Beiträge anlegen“ erzeugt für alle zugeordneten Mitglieder die Forderungen,
              die bis heute fällig sind – nie doppelt.
            </T>
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
              <Section title={`${t(SECTION_TITLE[status])} (${f.dues.length})`}>
                {desktop && f.dues.length > 0 ? (
                  <>
                    <DataTable
                      rows={f.dues}
                      rowKey={(d) => d.id}
                      exportName="forderungen"
                      defaultSort={{ key: 'due', dir: 'asc' }}
                      onRowPress={(d) => setOpen(open === d.id ? null : d.id)}
                      columns={[
                        {
                          key: 'person',
                          label: 'Person',
                          flex: 2,
                          sort: (x, y) => x.personName.localeCompare(y.personName),
                          csv: (r) => r.personName,
                          render: (r) => <Cell>{r.personName}</Cell>,
                        },
                        {
                          key: 'fee',
                          label: 'Beitragsart',
                          flex: 2,
                          sort: (x, y) => x.feeTypeName.localeCompare(y.feeTypeName),
                          csv: (r) => r.feeTypeName,
                          render: (r) => <Cell muted>{r.feeTypeName}</Cell>,
                        },
                        {
                          key: 'period',
                          label: 'Zeitraum',
                          flex: 1,
                          csv: (r) => r.periodLabel,
                          render: (r) => <Cell muted>{r.periodLabel}</Cell>,
                        },
                        {
                          key: 'due',
                          label: 'Fällig',
                          width: 110,
                          sort: (x, y) => x.dueOn.localeCompare(y.dueOn),
                          csv: (r) => r.dueOn,
                          render: (r) => (
                            <Cell muted>{r.dueOn.split('-').reverse().join('.')}</Cell>
                          ),
                        },
                        {
                          key: 'open',
                          label: 'Offen',
                          width: 130,
                          align: 'right',
                          sort: (x, y) => x.openCents - y.openCents,
                          csv: (r) => String(r.openCents / 100),
                          render: (r) => (
                            <Cell>
                              {r.status === 'paid' || r.status === 'cancelled'
                                ? STATUS_LABEL[r.status]
                                : formatEuro(r.openCents)}
                            </Cell>
                          ),
                        },
                      ]}
                    />
                    {(() => {
                      const chosen = f.dues.find((d) => d.id === open);
                      return (
                        <SidePanel
                          visible={!!chosen}
                          onClose={() => setOpen(null)}
                          title={chosen ? `${chosen.personName} · ${chosen.periodLabel}` : ''}
                        >
                          {chosen ? renderActions(chosen) : null}
                        </SidePanel>
                      );
                    })()}
                  </>
                ) : (
                  <Card>
                    {f.dues.length === 0 ? (
                      <Empty icon="checkmark-done-outline" text={EMPTY_TEXT[status]} />
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
                          {open === d.id ? renderActions(d) : null}
                        </View>
                      ))
                    )}
                  </Card>
                )}
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
  // Zahlungen gehören in die Zielkasse der Beitragsart (leer = Hauptkasse)
  const targetFundId = due.fundId ?? cash?.funds.find((f) => f.isMain)?.id;
  const accounts = (cash?.accounts ?? []).filter((a) => !a.archived && a.fundId === targetFundId);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(due.openCents / 100).replace('.', ','));
  const [paidOn, setPaidOn] = useState(today);
  const [reason, setReason] = useState('');
  // pro Eingabe ein Schlüssel: wiederholte Anfragen (Netz, Doppeltipp) buchen nicht doppelt
  const [paymentKey] = useState(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
  );
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
          idempotencyKey: paymentKey,
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
