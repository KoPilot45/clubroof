import {
  type ClubBudget,
  type ClubBudgetLine,
  type ClubBudgetStatus,
  type ClubCash,
  type ClubCashDirection,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { BudgetBar } from '@/components/budget-bar';
import { FundSwitcher } from '@/components/fund-switcher';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  HeroCard,
  Loading,
  Notice,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useFundFilter } from '@/lib/fund-filter';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useConfirmDelete } from '@/lib/confirm';

const STATUS_LABEL: Record<ClubBudgetStatus, string> = {
  ok: 'im Plan',
  warn: 'fast aufgebraucht',
  over: 'über Plan',
};

/**
 * Haushaltsplan und Soll-Ist (Paket K3): Planbeträge je Kasse, Jahr und Kategorie, Ist aus dem Kassenbuch,
 * Fortschrittsbalken, Warnung bei Überschreitung. `mode=actual` zeigt nur die Auswertung.
 */
export default function BudgetScreen() {
  const confirmDelete = useConfirmDelete();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [fundId, setFundId] = useFundFilter();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [year, setYear] = useState(() => new Date().getFullYear());
  const key = ['club-budget', year, fundId ?? 'all'];
  const budget = useQuery({
    queryKey: key,
    queryFn: () =>
      api<ClubBudget>(`/club-cash/budget?year=${year}${fundId ? `&fundId=${fundId}` : ''}`),
  });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const done = (data: ClubBudget) => {
    setError(null);
    queryClient.setQueryData(key, data);
    void queryClient.invalidateQueries({ queryKey: ['club-budget'] });
    setEditing(null);
  };
  const save = useMutation({
    mutationFn: (v: { line?: ClubBudgetLine; categoryId?: string; cents: number }) =>
      api<ClubBudget>('/club-cash/budget', {
        method: 'PUT',
        body: {
          fundId: v.line?.fundId ?? editFund,
          year,
          categoryId: v.line?.categoryId ?? v.categoryId,
          costCenterId: v.line?.costCenterId ?? null,
          plannedCents: v.cents,
        },
      }),
    onSuccess: (d) => {
      done(d);
      setNewCategory(null);
      setNewAmount('');
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<ClubBudget>(`/club-cash/budget/${id}?year=${year}${fundId ? `&fundId=${fundId}` : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: done,
    onError: fail,
  });
  const copy = useMutation({
    mutationFn: () =>
      api<ClubBudget & { copied: number }>('/club-cash/budget/copy', {
        method: 'POST',
        body: { fundId: editFund, fromYear: year - 1, toYear: year },
      }),
    onSuccess: (d) => {
      done(d);
      setNote(d.copied ? t(`${d.copied} Zeilen übernommen.`) : t('Es gab nichts zu übernehmen.'));
    },
    onError: fail,
  });

  const c = cash.data;
  const b = budget.data;
  // Bei nur einer Kasse ist sie immer die Bearbeitungskasse
  const activeFunds = (c?.funds ?? []).filter((f) => !f.archived);
  const editFund = fundId ?? (activeFunds.length === 1 ? activeFunds[0]!.id : null);
  if (budget.isPending || cash.isPending) return <Loading />;
  if (budget.error || !b || !c)
    return <ErrorNotice error={budget.error ?? cash.error} onRetry={() => budget.refetch()} />;

  const plan = mode !== 'actual';
  const edit = plan && b.canManage && !b.locked && !!editFund;
  const lines = (dir: ClubCashDirection) => b.lines.filter((l) => l.direction === dir);
  const categories = c.categories.filter(
    (k) =>
      !k.archived &&
      k.direction === 'expense' &&
      !b.lines.some((l) => l.categoryId === k.id && !l.costCenterId),
  );
  const incomeCategories = c.categories.filter(
    (k) =>
      !k.archived &&
      k.direction === 'income' &&
      !b.lines.some((l) => l.categoryId === k.id && !l.costCenterId),
  );
  const years = [year - 1, year, year + 1];

  const row = (l: ClubBudgetLine, i: number) => (
    <View
      key={l.id}
      style={{ gap: 6, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
          {[l.categoryName, l.costCenterName, !fundId && c.funds.length > 1 ? l.fundName : null]
            .filter(Boolean)
            .join(' · ')}
        </T>
        <Chip
          tone={l.status === 'over' ? 'urgent' : l.status === 'warn' ? 'action' : 'success'}
          label={t(STATUS_LABEL[l.status])}
        />
      </View>
      <BudgetBar planned={l.plannedCents} actual={l.actualCents} status={l.status} />
      <T variant="caption">
        {`${t('Ist')} ${formatEuro(l.actualCents)} ${t('von')} ${formatEuro(l.plannedCents)} ${t('geplant')}`}
      </T>
      {edit ? (
        editing === l.id ? (
          <View style={{ gap: 8 }}>
            <TextField label="Planbetrag in €" value={amount} onChangeText={setAmount} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Speichern"
                style={{ flex: 1 }}
                disabled={parseEuro(amount) === null}
                loading={save.isPending}
                onPress={() => save.mutate({ line: l, cents: parseEuro(amount) ?? 0 })}
              />
              <Button
                label="Zeile entfernen"
                variant="danger"
                style={{ flex: 1 }}
                loading={remove.isPending}
                onPress={() =>
                  confirmDelete({
                    title: 'Wirklich entfernen?',
                    confirmLabel: 'Entfernen',
                    name: l.categoryName,
                    text: `Die Zeile „${l.categoryName}“ wird aus dem Haushaltsplan entfernt.`,
                    onConfirm: () => remove.mutate(l.id),
                  })
                }
              />
            </View>
          </View>
        ) : (
          <Button
            label="Planbetrag ändern"
            icon="pencil"
            size="sm"
            variant="tonal"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              setEditing(l.id);
              setAmount(String(l.plannedCents / 100).replace('.', ','));
            }}
          />
        )
      ) : null}
    </View>
  );

  const heroPct =
    b.totals.plannedExpenseCents > 0
      ? Math.round((b.totals.actualExpenseCents / b.totals.plannedExpenseCents) * 100)
      : null;

  return (
    <Screen edges={[]} refreshing={budget.isRefetching} onRefresh={() => budget.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {note ? <Chip tone="success" icon="checkmark-circle" label={note} /> : null}
      <ChoiceChips
        scroll
        selected={[String(year)]}
        onToggle={(v) => setYear(Number(v))}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
      />
      <FundSwitcher funds={c.funds} value={fundId} onChange={setFundId} />
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          {`${t('Ausgaben')} ${year}`}
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          {formatEuro(b.totals.actualExpenseCents)}
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          {heroPct === null
            ? t('Noch kein Plan für Ausgaben.')
            : `${heroPct} % ${t('von')} ${formatEuro(b.totals.plannedExpenseCents)} ${t('geplant')}`}
        </T>
      </HeroCard>
      {b.locked ? (
        <Chip tone="archived" icon="lock-closed" label={t(`Das Jahr ${year} ist abgeschlossen.`)} />
      ) : null}
      {b.totals.overCount > 0 ? (
        <Notice
          tone="urgent"
          icon="warning"
          title={
            b.totals.overCount === 1
              ? t('Eine Ausgabe liegt über dem Plan')
              : t(`${b.totals.overCount} Ausgaben liegen über dem Plan`)
          }
          text="Prüfe die rot markierten Zeilen und passe Plan oder Ausgaben an."
        />
      ) : null}

      <Section title="Ausgaben">
        <Card>
          {lines('expense').length === 0 ? (
            <Empty icon="clipboard-outline" text="Noch keine Planzeile für Ausgaben." />
          ) : null}
          {lines('expense').map(row)}
        </Card>
      </Section>
      <Section title="Einnahmen">
        <Card>
          {lines('income').length === 0 ? (
            <Empty icon="clipboard-outline" text="Noch keine Planzeile für Einnahmen." />
          ) : null}
          {lines('income').map(row)}
        </Card>
        {b.lines.some((l) => l.direction === 'income') ? (
          <T variant="caption">
            {`${t('Einnahmen')} ${formatEuro(b.totals.actualIncomeCents)} ${t('von')} ${formatEuro(b.totals.plannedIncomeCents)} ${t('geplant')}`}
          </T>
        ) : null}
      </Section>

      {plan && b.canManage && !b.locked && !editFund ? (
        <Card>
          <T variant="caption">Wähle oben eine einzelne Kasse, um deren Plan zu bearbeiten.</T>
        </Card>
      ) : null}
      {edit ? (
        <Section title="Planzeile hinzufügen">
          <Card style={{ gap: 12 }}>
            <ChoiceChips
              label="Kategorie"
              options={[...categories, ...incomeCategories].map((k) => ({
                value: k.id,
                label: `${k.name} (${k.direction === 'income' ? t('Einnahme') : t('Ausgabe')})`,
              }))}
              selected={newCategory ? [newCategory] : []}
              onToggle={(v) => setNewCategory(newCategory === v ? null : v)}
            />
            <TextField label="Planbetrag in €" value={newAmount} onChangeText={setNewAmount} />
            <Button
              label="Zeile anlegen"
              icon="add"
              disabled={!newCategory || parseEuro(newAmount) === null}
              loading={save.isPending && !editing}
              onPress={() =>
                save.mutate({ categoryId: newCategory!, cents: parseEuro(newAmount) ?? 0 })
              }
            />
            <Button
              label={t(`Plan aus ${year - 1} übernehmen`)}
              icon="copy-outline"
              variant="outline"
              loading={copy.isPending}
              onPress={() => copy.mutate()}
            />
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
