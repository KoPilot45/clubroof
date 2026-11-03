/**
 * Kurzassistent „Mannschaftskasse einrichten“ (Paket E2, Stufe 3b): Kassenwart, Anfangsbestand, Strafenkatalog aus
 * der Vorlage, Getränkepreis, Beitrag und Sichtbarkeit. Angelegt wird erst in der Zusammenfassung; der Zwischenstand
 * bleibt auf dem Gerät. Nutzt die vorhandenen Endpunkte der Mannschaftskasse.
 */
import type { TeamCash, TreasurerCandidates } from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  ChoiceCard,
  LaterHint,
  ModeChoice,
  OptionCard,
  SummaryList,
  WhyBox,
  WizardShell,
  useWizardDraft,
  type SetupMode,
} from '@/components/wizard';
import { Card, ChoiceChips, Chip, Loading, T, TextField, Toggle } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

/** Übliche Strafen einer Mannschaftskasse (Vorlage, danach frei änderbar) */
export const TEAM_FINE_TEMPLATE: { name: string; amountCents: number }[] = [
  { name: 'Zu spät zum Training', amountCents: 500 },
  { name: 'Zu spät zum Spiel', amountCents: 1000 },
  { name: 'Unentschuldigt gefehlt', amountCents: 1500 },
  { name: 'Handy in der Kabine', amountCents: 200 },
  { name: 'Trikot vergessen', amountCents: 500 },
  { name: 'Kabinendienst vergessen', amountCents: 1000 },
];

type Interval = 'monthly' | 'season' | 'once';
const INTERVALS: { value: Interval; label: string }[] = [
  { value: 'monthly', label: 'monatlich' },
  { value: 'season', label: 'pro Saison' },
  { value: 'once', label: 'einmalig' },
];

type Draft = {
  flow: SetupMode;
  treasurers: string[];
  /** Wer buchen darf: Kassenwart und Trainerteam (empfohlen) oder nur der Kassenwart */
  bookingBy: 'staff' | 'treasurer';
  /** Einzahlungsweg (ausführlich) */
  cashPayment: boolean;
  iban: string;
  accountHolder: string;
  paypal: string;
  paymentNote: string;
  seasonEnd: 'carry' | 'payout';
  clubOwned: boolean;
  opening: string;
  fines: string[];
  drinkPrice: string;
  fee: boolean;
  feeName: string;
  feeAmount: string;
  feeInterval: Interval;
  showBalances: boolean;
  autoReminder: boolean;
};

const INITIAL: Draft = {
  flow: 'quick',
  treasurers: [],
  bookingBy: 'staff',
  cashPayment: true,
  iban: '',
  accountHolder: '',
  paypal: '',
  paymentNote: '',
  seasonEnd: 'carry',
  clubOwned: true,
  opening: '',
  fines: TEAM_FINE_TEMPLATE.map((f) => f.name),
  drinkPrice: '1,50',
  fee: false,
  feeName: 'Mannschaftsbeitrag',
  feeAmount: '',
  feeInterval: 'season',
  showBalances: false,
  autoReminder: true,
};

type StepKey =
  | 'intro'
  | 'treasurers'
  | 'booking'
  | 'opening'
  | 'payment'
  | 'fines'
  | 'drinks'
  | 'fee'
  | 'visibility'
  | 'season'
  | 'club'
  | 'summary';

export type TeamCashWizardBackend = {
  demo?: boolean;
  teamId: string;
  cash: TeamCash | undefined;
  candidates: TreasurerCandidates | undefined;
  api: <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  finish: () => void;
};

export default function TeamCashSetupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const cash = useQuery({
    queryKey: ['cash', id],
    queryFn: () => api<TeamCash>(`/teams/${id}/cash`),
  });
  const candidates = useQuery({
    queryKey: ['cash-treasurers', id],
    queryFn: () => api<TreasurerCandidates>(`/teams/${id}/cash/treasurers`),
  });
  const backend: TeamCashWizardBackend = {
    teamId: id,
    cash: cash.data,
    candidates: candidates.data,
    api: (path, init) => api(path, init as never),
    finish: () => router.replace(`/teams/${id}/cash`),
  };
  return <TeamCashWizard backend={backend} />;
}

export function TeamCashWizard({ backend }: { backend: TeamCashWizardBackend }) {
  const queryClient = useQueryClient();
  const {
    state: d,
    patch,
    loaded,
    clear,
  } = useWizardDraft(
    backend.demo ? 'team-cash-wizard-demo' : `team-cash-wizard-${backend.teamId}`,
    INITIAL,
  );
  const [step, setStep] = useState(0);
  const [fromSummary, setFromSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const cash = backend.cash;
  if (!cash || !loaded) return <Loading />;
  const keys: StepKey[] = [
    'intro',
    'treasurers',
    'booking',
    'opening',
    ...(d.flow === 'full' ? (['payment'] as const) : []),
    ...(cash.config.fines ? (['fines'] as const) : []),
    ...(cash.config.drinks ? (['drinks'] as const) : []),
    'fee',
    'visibility',
    ...(d.flow === 'full' ? (['season', 'club'] as const) : []),
    'summary',
  ];
  const key = keys[Math.min(step, keys.length - 1)]!;
  const go = (n: number) => {
    setError(null);
    setStep(n);
  };
  const goKey = (k: StepKey) => {
    setFromSummary(true);
    go(keys.indexOf(k));
  };
  const summaryAt = keys.indexOf('summary');
  const back = () =>
    fromSummary
      ? (setFromSummary(false), go(summaryAt))
      : step === 0
        ? router.back()
        : go(step - 1);
  const next = () => (fromSummary ? (setFromSummary(false), go(summaryAt)) : go(step + 1));
  const shell = { step: step + 1, total: keys.length, onBack: back, onNext: next, error } as const;

  const candidates = backend.candidates?.candidates ?? [];
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const opening = d.opening.trim() ? parseEuro(d.opening) : 0;
  const drinkCents = parseEuro(d.drinkPrice);
  const feeCents = parseEuro(d.feeAmount);
  const alreadyTreasurer = new Set((cash.treasurers ?? []).map((x) => x.personId));
  const newFines = TEAM_FINE_TEMPLATE.filter(
    (f) => d.fines.includes(f.name) && !cash.fineCatalog.some((x) => x.name === f.name),
  );

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!backend.demo) {
        const api = backend.api;
        const base = `/teams/${backend.teamId}/cash`;
        for (const personId of d.treasurers) {
          if (alreadyTreasurer.has(personId)) continue;
          await api(`${base}/treasurers/${personId}`, { method: 'PUT', body: { enabled: true } });
        }
        if (opening && opening > 0)
          await api(`${base}/bookings`, {
            method: 'POST',
            body: { kind: 'income', amountCents: opening, description: 'Anfangsbestand' },
          });
        if (cash.config.fines)
          for (const f of newFines) await api(`${base}/fine-types`, { method: 'POST', body: f });
        await api(`${base}/settings`, {
          method: 'PUT',
          body: {
            ...(cash.config.drinks && drinkCents ? { drinkPriceCents: drinkCents } : {}),
            showMemberBalances: d.showBalances,
            autoReminder: d.autoReminder,
            ...(d.flow === 'full'
              ? {
                  cashPayment: d.cashPayment,
                  paymentNote: d.paymentNote.trim() || null,
                  iban: d.iban.trim() || null,
                  accountHolder: d.accountHolder.trim() || null,
                  paypalLink: d.paypal.trim() || null,
                  seasonEnd: d.seasonEnd,
                  clubOwned: d.clubOwned,
                }
              : {}),
          },
        });
        if (d.fee && feeCents && d.feeName.trim().length >= 2)
          await api(`${base}/fees`, {
            method: 'POST',
            body: { name: d.feeName.trim(), amountCents: feeCents, interval: d.feeInterval },
          });
        // Zuletzt: verlangt die Wahl „nur Kassenwart“, verliert das Trainerteam danach das Buchen
        if (d.bookingBy !== cash.settings.bookingBy)
          await api(`${base}/settings`, { method: 'PUT', body: { bookingBy: d.bookingBy } });
        void queryClient.invalidateQueries({ queryKey: ['cash', backend.teamId] });
      }
      clear();
      setDone(true);
    } catch (e) {
      setError(
        e instanceof RequestError
          ? e.message
          : 'Die Kasse konnte nicht vollständig eingerichtet werden.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <WizardShell
        title="Mannschaftskasse eingerichtet"
        explanation="Das Wichtigste steht. Alles lässt sich in der Kasse der Mannschaft ändern."
        nextLabel={backend.demo ? 'Verlassen' : 'Zur Mannschaftskasse'}
        onNext={backend.finish}
      >
        {backend.demo ? null : (
          <View style={{ gap: 10 }}>
            <ChoiceCard
              icon="beer"
              title="Getränke erfassen"
              text="Wer hat wie viel getrunken?"
              selected={false}
              onPress={() => router.replace(`/teams/${backend.teamId}/cash-drinks`)}
            />
            <ChoiceCard
              icon="alert-circle"
              title="Erste Strafe vergeben"
              text="Aus dem Strafenkatalog"
              selected={false}
              onPress={() => router.replace(`/teams/${backend.teamId}/fines`)}
            />
          </View>
        )}
      </WizardShell>
    );

  if (key === 'intro')
    return (
      <WizardShell
        {...shell}
        title="Die Mannschaftskasse einrichten"
        explanation="In etwa fünf Minuten: wer die Kasse führt und bucht, Anfangsbestand, Strafenkatalog, Getränkepreis, Beitrag und was die Mannschaft sehen darf. Angelegt wird erst am Ende."
      >
        <ModeChoice value={d.flow} onChange={(flow) => patch({ flow })} />
        <WhyBox>
          Die Mannschaftskasse ist getrennt von der Vereinskasse: Sie gehört der Mannschaft, Trainer
          oder Kassenwart führen sie.
        </WhyBox>
        <LaterHint where="Mannschaftskasse › Einstellungen" />
      </WizardShell>
    );

  if (key === 'treasurers')
    return (
      <WizardShell
        {...shell}
        title="Wer führt die Kasse?"
        explanation="Kassenwarte buchen, vergeben Strafen und erinnern an offene Beträge. Trainer können es ohnehin."
        onSkip={next}
      >
        {candidates.length === 0 ? (
          <T>Es gibt noch keine Erwachsenen mit Login in der Mannschaft.</T>
        ) : (
          <View style={{ gap: 10 }}>
            {candidates.map((c) => (
              <ChoiceCard
                key={c.personId}
                icon="person"
                title={c.name}
                text={c.relation}
                multi
                selected={d.treasurers.includes(c.personId) || alreadyTreasurer.has(c.personId)}
                onPress={() =>
                  alreadyTreasurer.has(c.personId)
                    ? undefined
                    : patch({ treasurers: toggle(d.treasurers, c.personId) })
                }
              />
            ))}
          </View>
        )}
        <LaterHint where="Mannschaftskasse › Kassenwart" />
      </WizardShell>
    );

  if (key === 'booking')
    return (
      <WizardShell
        {...shell}
        title="Wer darf buchen?"
        explanation="Buchungen, Strafen und Getränke erfassen. Lesen darf die Mannschaft ohnehin nach den Einstellungen unter „Was darf die Mannschaft sehen?“."
      >
        <OptionCard
          icon="people"
          title="Kassenwart und Trainerteam"
          text="Das Trainerteam kann mitbuchen – wenig Aufwand, die Kasse hängt nicht an einer Person"
          recommended
          selected={d.bookingBy === 'staff'}
          onPress={() => patch({ bookingBy: 'staff' })}
        />
        <OptionCard
          icon="shield-checkmark"
          title="Nur der Kassenwart"
          text="Nur die Kassenwarte der Mannschaft buchen – klare Verantwortung"
          selected={d.bookingBy === 'treasurer'}
          onPress={() => patch({ bookingBy: 'treasurer' })}
        />
        {d.bookingBy === 'treasurer' && d.treasurers.length === 0 && !cash.treasurers.length ? (
          <Chip
            tone="action"
            icon="alert-circle"
            label="Bestimme im ersten Schritt mindestens einen Kassenwart, sonst bucht niemand."
          />
        ) : null}
        <LaterHint where="Mannschaftskasse › Einstellungen" />
      </WizardShell>
    );

  if (key === 'payment')
    return (
      <WizardShell
        {...shell}
        title="Einzahlungsweg"
        explanation="Wie zahlen Spieler und Eltern ein? Die Angaben stehen in der Kasse bei „Bezahlen“."
        onSkip={next}
      >
        <Toggle
          label="Barzahlung möglich"
          value={d.cashPayment}
          onChange={(cashPayment) => patch({ cashPayment })}
        />
        <Card style={{ gap: 12 }}>
          <TextField
            label="IBAN (für Überweisungen)"
            value={d.iban}
            onChangeText={(iban) => patch({ iban })}
            maxLength={42}
          />
          <TextField
            label="Kontoinhaber"
            value={d.accountHolder}
            onChangeText={(accountHolder) => patch({ accountHolder })}
            maxLength={80}
          />
          <TextField
            label="PayPal-Link (optional)"
            value={d.paypal}
            onChangeText={(paypal) => patch({ paypal })}
            placeholder="https://paypal.me/…"
            maxLength={200}
          />
          <TextField
            label="Hinweis für Eltern (optional)"
            value={d.paymentNote}
            onChangeText={(paymentNote) => patch({ paymentNote })}
            multiline
            maxLength={300}
            placeholder={t(
              'z. B. Bitte bar beim Training oder per Überweisung mit dem Namen des Kindes.',
            )}
          />
        </Card>
        <LaterHint where="Mannschaftskasse › Einstellungen" />
      </WizardShell>
    );

  if (key === 'season')
    return (
      <WizardShell
        {...shell}
        title="Saisonabschluss"
        explanation="Was passiert am Ende der Saison mit dem Geld? Das ist ein Hinweis für den Kassenwart; gebucht wird nichts automatisch."
        onSkip={next}
      >
        <OptionCard
          icon="arrow-forward-circle"
          title="In die neue Saison übertragen"
          text="Der Kassenstand geht mit in die Nachfolgemannschaft"
          recommended
          selected={d.seasonEnd === 'carry'}
          onPress={() => patch({ seasonEnd: 'carry' })}
        />
        <OptionCard
          icon="cash"
          title="An die Mitglieder auszahlen"
          text="Zum Saisonende wird abgerechnet und der Rest ausgezahlt"
          selected={d.seasonEnd === 'payout'}
          onPress={() => patch({ seasonEnd: 'payout' })}
        />
        <LaterHint where="Mannschaftskasse › Abschluss" />
      </WizardShell>
    );

  if (key === 'club')
    return (
      <WizardShell
        {...shell}
        title="Gehört die Kasse zum Verein?"
        explanation="Das ist für Gemeinnützigkeit und Kassenprüfung wichtig. Die Einbindung in die Vereinskasse ist ein eigener Schritt für später."
        onSkip={next}
      >
        <OptionCard
          icon="business"
          title="Ja, das Geld gehört dem Verein"
          text="Die Kasse wird bei der Kassenprüfung des Vereins berücksichtigt"
          selected={d.clubOwned}
          onPress={() => patch({ clubOwned: true })}
        />
        <OptionCard
          icon="people-circle"
          title="Nein, es gehört der Mannschaft"
          text="Eine private Mannschaftskasse, unabhängig vom Verein"
          selected={!d.clubOwned}
          onPress={() => patch({ clubOwned: false })}
        />
        <WhyBox>
          Gehört das Geld dem Verein, muss es in dessen Büchern auftauchen. Klärt das bitte mit dem
          Kassenwart des Vereins.
        </WhyBox>
        <LaterHint where="Mannschaftskasse › Einstellungen" />
      </WizardShell>
    );

  if (key === 'opening')
    return (
      <WizardShell
        {...shell}
        title="Wie viel ist schon in der Kasse?"
        explanation="Der Anfangsbestand wird als erste Buchung „Anfangsbestand“ eingetragen."
        nextDisabled={opening === null}
        onSkip={next}
      >
        <TextField
          label="Anfangsbestand in €"
          value={d.opening}
          onChangeText={(opening) => patch({ opening })}
          placeholder="0,00"
        />
        <LaterHint where="Mannschaftskasse › Buchungen" />
      </WizardShell>
    );

  if (key === 'fines')
    return (
      <WizardShell
        {...shell}
        title="Strafenkatalog"
        explanation="Übliche Strafen als Vorlage – abwählen, was ihr nicht wollt. Beträge und weitere Strafen änderst du später."
        onSkip={next}
      >
        <View style={{ gap: 10 }}>
          {TEAM_FINE_TEMPLATE.map((f) => {
            const have = cash.fineCatalog.some((x) => x.name === f.name);
            return (
              <ChoiceCard
                key={f.name}
                icon="alert-circle"
                title={f.name}
                text={have ? 'Schon im Katalog' : formatEuro(f.amountCents)}
                multi
                selected={have || d.fines.includes(f.name)}
                onPress={() => (have ? undefined : patch({ fines: toggle(d.fines, f.name) }))}
              />
            );
          })}
        </View>
        <LaterHint where="Mannschaftskasse › Strafen" />
      </WizardShell>
    );

  if (key === 'drinks')
    return (
      <WizardShell
        {...shell}
        title="Getränkepreis"
        explanation="Der Preis je Getränk für die Getränkeliste."
        nextDisabled={drinkCents === null}
        onSkip={next}
      >
        <ChoiceChips
          options={['1,00', '1,50', '2,00'].map((v) => ({ value: v, label: `${v} €` }))}
          selected={[d.drinkPrice]}
          onToggle={(drinkPrice) => patch({ drinkPrice })}
        />
        <TextField
          label="Preis in €"
          value={d.drinkPrice}
          onChangeText={(drinkPrice) => patch({ drinkPrice })}
        />
        <LaterHint where="Mannschaftskasse › Einstellungen" />
      </WizardShell>
    );

  if (key === 'fee')
    return (
      <WizardShell
        {...shell}
        title="Beitrag oder Umlage"
        explanation="Soll jedes Mitglied der Mannschaft regelmäßig einen Betrag zahlen? Einmalige Umlagen legst du später an."
        nextDisabled={d.fee && (feeCents === null || d.feeName.trim().length < 2)}
      >
        <Toggle
          label="Mannschaftsbeitrag erheben"
          value={d.fee}
          onChange={(fee) => patch({ fee })}
        />
        {d.fee ? (
          <Card style={{ gap: 12 }}>
            <TextField
              label="Name"
              value={d.feeName}
              onChangeText={(feeName) => patch({ feeName })}
            />
            <TextField
              label="Betrag in €"
              value={d.feeAmount}
              onChangeText={(feeAmount) => patch({ feeAmount })}
            />
            <ChoiceChips
              options={INTERVALS.map((i) => ({ value: i.value, label: t(i.label) }))}
              selected={[d.feeInterval]}
              onToggle={(feeInterval) => patch({ feeInterval })}
            />
          </Card>
        ) : null}
        <LaterHint where="Mannschaftskasse › Beiträge" />
      </WizardShell>
    );

  if (key === 'visibility')
    return (
      <WizardShell
        {...shell}
        title="Was darf die Mannschaft sehen?"
        explanation="Kassenstand, Einnahmen und Ausgaben sieht immer die ganze Mannschaft. Die Beträge der einzelnen Personen zeigst du nur, wenn ihr das wollt – sonst sieht jeder nur die eigenen."
      >
        <Toggle
          label="Beträge aller Beteiligten anzeigen"
          value={d.showBalances}
          onChange={(showBalances) => patch({ showBalances })}
        />
        <Toggle
          label="Am Monatsanfang an offene Beträge erinnern"
          value={d.autoReminder}
          onChange={(autoReminder) => patch({ autoReminder })}
        />
        <LaterHint where="Mannschaftskasse › Einstellungen" />
      </WizardShell>
    );

  const people = candidates.filter((c) => d.treasurers.includes(c.personId)).map((c) => c.name);
  const rows: { label: string; value: string; key: StepKey }[] = [
    { label: t('Kassenwart'), value: people.join(' · '), key: 'treasurers' },
    { label: t('Anfangsbestand'), value: opening ? formatEuro(opening) : '', key: 'opening' },
    ...(cash.config.fines
      ? [
          {
            label: t('Strafen'),
            value: newFines.map((f) => f.name).join(' · '),
            key: 'fines' as const,
          },
        ]
      : []),
    ...(cash.config.drinks
      ? [
          {
            label: t('Getränkepreis'),
            value: drinkCents ? formatEuro(drinkCents) : '',
            key: 'drinks' as const,
          },
        ]
      : []),
    {
      label: t('Beitrag'),
      value:
        d.fee && feeCents
          ? `${d.feeName.trim()} ${formatEuro(feeCents)} ${t(INTERVALS.find((i) => i.value === d.feeInterval)!.label)}`
          : '',
      key: 'fee',
    },
    {
      label: t('Buchen'),
      value: d.bookingBy === 'treasurer' ? t('nur Kassenwart') : t('Kassenwart und Trainerteam'),
      key: 'booking',
    },
    {
      label: t('Sichtbarkeit'),
      value: [d.showBalances ? t('Stände sichtbar') : t('nur eigener Stand')].join(' · '),
      key: 'visibility',
    },
    ...(d.flow === 'full'
      ? [
          {
            label: t('Saisonende'),
            value: d.seasonEnd === 'payout' ? t('Auszahlung') : t('Übertrag'),
            key: 'season' as const,
          },
          {
            label: t('Verhältnis zum Verein'),
            value: d.clubOwned ? t('gehört dem Verein') : t('gehört der Mannschaft'),
            key: 'club' as const,
          },
        ]
      : []),
  ];
  return (
    <WizardShell
      {...shell}
      title="Alles bereit?"
      explanation="Prüfe die Angaben. Mit „Kasse einrichten“ wird alles angelegt."
      nextLabel="Kasse einrichten"
      onNext={() => void create()}
      busy={busy}
    >
      <SummaryList rows={rows.map((r) => ({ ...r, onEdit: () => goKey(r.key) }))} />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
    </WizardShell>
  );
}
