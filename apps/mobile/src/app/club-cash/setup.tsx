/**
 * Assistent „Vereinskasse einrichten“ (Paket E2): Gemeinnützigkeit, Konten, Kategorien, Beiträge, Erinnerungen,
 * Kassenverantwortliche und Sichtbarkeit – ein Thema pro Seite. Angelegt wird erst in der Zusammenfassung;
 * der Zwischenstand bleibt auf dem Gerät.
 */
import {
  CLUB_CASH_ACCOUNT_KINDS,
  CLUB_CASH_ACCOUNT_KIND_LABEL,
  CLUB_CASH_VISIBILITIES,
  CLUB_CASH_VISIBILITY_INFO,
  CLUB_FEE_INTERVALS,
  CLUB_FEE_INTERVAL_LABEL,
  type ClubCash,
  type ClubCashAccountKind,
  type ClubCashVisibility,
  type ClubFeeInterval,
  type ClubFeeRule,
  type ClubFeeRuleResult,
  type ClubFees,
  type MemberListItem,
} from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PersonPicker } from '@/app/admin/team-new';
import {
  ChoiceCard,
  LaterHint,
  ModeChoice,
  MoreSettings,
  NumberStepper,
  SummaryList,
  WhyBox,
  WizardShell,
  useWizardDraft,
  type SetupMode,
} from '@/components/wizard';
import { Button, Card, ChoiceChips, Chip, Loading, T, TextField, Toggle } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

type Person = { id: string; name: string };
type AccountDraft = { name: string; kind: ClubCashAccountKind; opening: string };
type FeeDraft = { name: string; amount: string; interval: ClubFeeInterval };

type Draft = {
  flow: SetupMode;
  nonprofit: 'yes' | 'no' | 'unknown';
  simplify: boolean;
  accounts: AccountDraft[];
  template: boolean;
  costCenters: string[];
  fees: FeeDraft[];
  /** Beitragsart (Index in `fees`) je Regel; leer = keine Regel */
  youthFee: string;
  youthAge: number;
  inactiveFee: string;
  restFee: string;
  remindDays: number;
  remindText: string;
  treasurers: Person[];
  auditors: Person[];
  visibility: ClubCashVisibility;
};

const INITIAL: Draft = {
  flow: 'quick',
  nonprofit: 'unknown',
  simplify: true,
  accounts: [{ name: 'Girokonto', kind: 'bank', opening: '' }],
  template: true,
  costCenters: [],
  fees: [],
  youthFee: '',
  youthAge: 18,
  inactiveFee: '',
  restFee: '',
  remindDays: 14,
  remindText: '',
  treasurers: [],
  auditors: [],
  visibility: 'treasury',
};

type StepKey =
  | 'intro'
  | 'nonprofit'
  | 'accounts'
  | 'categories'
  | 'costcenters'
  | 'fees'
  | 'rules'
  | 'reminders'
  | 'people'
  | 'visibility'
  | 'summary';

const FULL: StepKey[] = [
  'intro',
  'nonprofit',
  'accounts',
  'categories',
  'costcenters',
  'fees',
  'rules',
  'reminders',
  'people',
  'visibility',
  'summary',
];
const QUICK: StepKey[] = [
  'intro',
  'nonprofit',
  'accounts',
  'categories',
  'fees',
  'people',
  'summary',
];

const COST_CENTER_IDEAS = ['Jugend', 'Senioren', 'Platzpflege', 'Vereinsheim', 'Feste und Feiern'];
const FEE_PRESETS: FeeDraft[] = [
  { name: 'Erwachsene', amount: '120', interval: 'yearly' },
  { name: 'Jugend', amount: '60', interval: 'yearly' },
  { name: 'Passive Mitglieder', amount: '30', interval: 'yearly' },
];

export type CashWizardBackend = {
  demo?: boolean;
  cash: ClubCash | undefined;
  search: (term: string) => Promise<MemberListItem[]>;
  api: <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  finish: () => void;
};

export default function CashSetupScreen() {
  const { api } = useSignedIn();
  const cash = useQuery({
    queryKey: ['club-cash', 'setup'],
    queryFn: () => api<ClubCash>('/club-cash'),
  });
  const backend: CashWizardBackend = {
    cash: cash.data,
    search: (term) =>
      api<MemberListItem[]>(`/admin/members?status=active&q=${encodeURIComponent(term)}`),
    api: (path, init) => api(path, init as never),
    finish: () => router.replace('/club-cash'),
  };
  return <CashWizard backend={backend} />;
}

const cents = (s: string) => (s.trim() ? parseEuro(s) : 0);

export function CashWizard({ backend }: { backend: CashWizardBackend }) {
  const queryClient = useQueryClient();
  const {
    state: d,
    patch,
    loaded,
    clear,
  } = useWizardDraft(backend.demo ? 'cash-wizard-demo' : 'cash-wizard', INITIAL);
  const [step, setStep] = useState(0);
  const [fromSummary, setFromSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ assigned: number } | null>(null);

  const cash = backend.cash;
  if (!cash || !loaded) return <Loading />;
  const keys = d.flow === 'quick' ? QUICK : FULL;
  const key = keys[Math.min(step, keys.length - 1)]!;
  const hasCategories = cash.categories.length > 0;

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

  const accounts = d.accounts.filter((a) => a.name.trim());
  const fees = d.fees.filter((f) => f.name.trim() && (parseEuro(f.amount) ?? 0) > 0);
  const feeName = (i: string) => fees[Number(i)]?.name ?? '';
  const setAccount = (i: number, p: Partial<AccountDraft>) =>
    patch({ accounts: d.accounts.map((a, n) => (n === i ? { ...a, ...p } : a)) });
  const setFee = (i: number, p: Partial<FeeDraft>) =>
    patch({ fees: d.fees.map((f, n) => (n === i ? { ...f, ...p } : f)) });
  const feeOptions = [
    { value: '', label: t('keine') },
    ...fees.map((f, i) => ({ value: String(i), label: f.name })),
  ];

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!backend.demo) {
        const api = backend.api;
        if (d.nonprofit !== 'unknown' || cash.nonprofit !== null)
          await api('/club-cash/nonprofit', {
            method: 'PUT',
            body: {
              nonprofit: d.nonprofit === 'unknown' ? null : d.nonprofit === 'yes',
              simplifyCategories: d.nonprofit !== 'yes' && d.simplify,
            },
          });
        for (const a of accounts) {
          await api('/club-cash/accounts', {
            method: 'POST',
            body: { name: a.name.trim(), kind: a.kind, openingBalanceCents: cents(a.opening) ?? 0 },
          });
        }
        if (d.template && !hasCategories)
          await api('/club-cash/categories/template', { method: 'POST' });
        for (const name of d.costCenters) {
          await api('/club-cash/cost-centers', { method: 'POST', body: { name, kind: 'other' } });
        }
        const made = new Map<string, string>();
        for (const f of fees) {
          const res = await api<ClubFees>('/club-cash/fees/types', {
            method: 'POST',
            body: { name: f.name.trim(), amountCents: parseEuro(f.amount), interval: f.interval },
          });
          const id = res.types.find((x) => x.name === f.name.trim())?.id;
          if (id) made.set(f.name, id);
        }
        const rules: ClubFeeRule[] = [];
        const idOf = (i: string) => (i === '' ? undefined : made.get(feeName(i)));
        if (idOf(d.youthFee))
          rules.push({ when: 'under_age', age: d.youthAge, feeTypeId: idOf(d.youthFee)! });
        if (idOf(d.inactiveFee)) rules.push({ when: 'inactive', feeTypeId: idOf(d.inactiveFee)! });
        if (idOf(d.restFee)) rules.push({ when: 'rest', feeTypeId: idOf(d.restFee)! });
        let assigned = 0;
        if (rules.length > 0) {
          const r = await api<ClubFeeRuleResult>('/club-cash/fees/assign-by-rules', {
            method: 'POST',
            body: { apply: true, rules },
          });
          assigned = r.created ?? 0;
        }
        if (d.flow === 'full')
          await api('/club-cash/fees/reminder', {
            method: 'PUT',
            body: { days: d.remindDays, text: d.remindText.trim() || null },
          });
        for (const [people, roleKey] of [
          [d.treasurers, 'club_treasurer'],
          [d.auditors, 'cash_auditor'],
        ] as const) {
          for (const p of people) {
            await api(`/admin/members/${p.id}/roles`, {
              method: 'POST',
              body: { roleKey, scopeType: 'club' },
            }).catch(() => undefined);
          }
        }
        if (d.flow === 'full' && d.visibility !== cash.visibility && cash.canChangeSettings)
          await api('/club-cash/visibility', {
            method: 'PUT',
            body: { visibility: d.visibility },
          });
        void queryClient.invalidateQueries();
        setDone({ assigned });
      } else setDone({ assigned: 0 });
      clear();
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

  // ── Fertig ───────────────────────────────────────────────────────────────
  if (done)
    return (
      <WizardShell
        title="Kasse eingerichtet"
        explanation={
          done.assigned > 0
            ? t(`${done.assigned} Mitgliedern wurde eine Beitragsart zugeordnet.`)
            : 'Das Wichtigste steht. Sinnvolle nächste Schritte – alles lässt sich später ändern.'
        }
        nextLabel={backend.demo ? 'Verlassen' : 'Zur Vereinskasse'}
        onNext={backend.finish}
      >
        {backend.demo ? null : (
          <View style={{ gap: 10 }}>
            <ChoiceCard
              icon="receipt"
              title="Beiträge fällig stellen"
              text="Fällige Beiträge für das laufende Jahr anlegen"
              selected={false}
              onPress={() => router.replace('/club-cash/fees')}
            />
            <ChoiceCard
              icon="cloud-upload"
              title="Kontoauszug importieren"
              text="Zahlungseingänge den Forderungen zuordnen"
              selected={false}
              onPress={() => router.replace('/club-cash/fee-import')}
            />
            <ChoiceCard
              icon="add-circle"
              title="Erste Buchung erfassen"
              text="Einnahme oder Ausgabe mit Beleg"
              selected={false}
              onPress={() => router.replace('/club-cash/new')}
            />
            <ChoiceCard
              icon="stats-chart"
              title="Budget planen"
              text="Soll je Kategorie für das Jahr festlegen"
              selected={false}
              onPress={() => router.replace('/club-cash/budget')}
            />
          </View>
        )}
      </WizardShell>
    );

  if (key === 'intro')
    return (
      <WizardShell
        {...shell}
        title="Die Vereinskasse einrichten"
        explanation="Konten, Kategorien, Beiträge und Zuständigkeiten – Schritt für Schritt. Gebucht wird erst am Ende; alles lässt sich später ändern."
      >
        <ModeChoice value={d.flow} onChange={(flow) => patch({ flow })} />
        <LaterHint where="Vereinskasse › Buchung und Beiträge" />
      </WizardShell>
    );

  if (key === 'nonprofit')
    return (
      <WizardShell
        {...shell}
        title="Ist der Verein gemeinnützig?"
        explanation="Davon hängt ab, welche Bereiche (ideeller Bereich, Zweckbetrieb, wirtschaftlicher Geschäftsbetrieb) die Kasse unterscheidet."
      >
        <WhyBox>
          Gemeinnützige Vereine müssen Einnahmen und Ausgaben steuerlich trennen. Ist der Verein
          nicht gemeinnützig, reicht eine einfachere Kategorieliste.
        </WhyBox>
        <View style={{ gap: 10 }}>
          <ChoiceCard
            icon="ribbon"
            title="Ja, gemeinnützig"
            text="Die Bereiche werden mitgeführt"
            selected={d.nonprofit === 'yes'}
            onPress={() => patch({ nonprofit: 'yes' })}
          />
          <ChoiceCard
            icon="close-circle"
            title="Nein"
            text="Kategorien ohne steuerliche Bereiche"
            selected={d.nonprofit === 'no'}
            onPress={() => patch({ nonprofit: 'no' })}
          />
          <ChoiceCard
            icon="help-circle"
            title="Weiß ich noch nicht"
            text="Du kannst es später in der Kasse angeben"
            selected={d.nonprofit === 'unknown'}
            onPress={() => patch({ nonprofit: 'unknown' })}
          />
        </View>
        {d.nonprofit === 'no' && hasCategories ? (
          <Toggle
            label="Vorhandene Kategorien vereinfachen"
            value={d.simplify}
            onChange={(simplify) => patch({ simplify })}
          />
        ) : null}
      </WizardShell>
    );

  if (key === 'accounts')
    return (
      <WizardShell
        {...shell}
        title="Welche Konten und Kassen gibt es?"
        explanation="Girokonto, Barkasse, PayPal … Der Anfangsbestand ist der Kontostand heute."
        nextDisabled={accounts.length === 0 && cash.accounts.length === 0}
      >
        {cash.accounts.length > 0 ? (
          <Chip
            tone="neutral"
            icon="checkmark-circle"
            label={t(`${cash.accounts.length} Konten sind schon angelegt`)}
          />
        ) : null}
        {d.accounts.map((a, i) => (
          <Card key={i} style={{ gap: 12 }}>
            <TextField
              label="Name"
              value={a.name}
              onChangeText={(name) => setAccount(i, { name })}
            />
            <ChoiceChips
              options={CLUB_CASH_ACCOUNT_KINDS.map((k) => ({
                value: k,
                label: CLUB_CASH_ACCOUNT_KIND_LABEL[k],
              }))}
              selected={[a.kind]}
              onToggle={(kind) => setAccount(i, { kind })}
            />
            <TextField
              label="Anfangsbestand in €"
              value={a.opening}
              onChangeText={(opening) => setAccount(i, { opening })}
              placeholder="0,00"
            />
            {d.accounts.length > 1 ? (
              <Button
                label="Entfernen"
                variant="outline"
                icon="trash-outline"
                onPress={() => patch({ accounts: d.accounts.filter((_, n) => n !== i) })}
              />
            ) : null}
          </Card>
        ))}
        <Button
          label="Weiteres Konto"
          variant="outline"
          icon="add"
          onPress={() =>
            patch({ accounts: [...d.accounts, { name: '', kind: 'cash', opening: '' }] })
          }
        />
        <LaterHint where="Vereinskasse › Kassen und Konten" />
      </WizardShell>
    );

  if (key === 'categories')
    return (
      <WizardShell
        {...shell}
        title="Kategorien für Buchungen"
        explanation="Kategorien sortieren Einnahmen und Ausgaben (Beiträge, Spenden, Platzpflege …)."
      >
        {hasCategories ? (
          <Chip
            tone="neutral"
            icon="checkmark-circle"
            label={t(`${cash.categories.length} Kategorien sind schon vorhanden`)}
          />
        ) : (
          <ChoiceCard
            icon="albums"
            title="Vorlage für Vereine übernehmen"
            text="Bewährte Kategorien, danach frei änderbar"
            badge="Empfohlen"
            selected={d.template}
            multi
            onPress={() => patch({ template: !d.template })}
          />
        )}
        <LaterHint where="Vereinskasse › Kategorien" />
      </WizardShell>
    );

  if (key === 'costcenters')
    return (
      <WizardShell
        {...shell}
        title="Kostenstellen"
        explanation="Kostenstellen zeigen, wofür Geld ausgegeben wird – zum Beispiel je Abteilung. Optional."
        onSkip={next}
      >
        <ChoiceChips
          options={COST_CENTER_IDEAS.map((c) => ({ value: c, label: c }))}
          selected={d.costCenters}
          check
          onToggle={(c) =>
            patch({
              costCenters: d.costCenters.includes(c)
                ? d.costCenters.filter((x) => x !== c)
                : [...d.costCenters, c],
            })
          }
        />
        <LaterHint where="Vereinskasse › Kostenstellen" />
      </WizardShell>
    );

  if (key === 'fees')
    return (
      <WizardShell
        {...shell}
        title="Mitgliedsbeiträge"
        explanation="Welche Beitragsarten gibt es? Mit Vorschlägen starten und Beträge anpassen."
        onSkip={next}
      >
        {d.fees.length === 0 ? (
          <Button
            label="Vorschläge einfügen"
            icon="sparkles"
            variant="outline"
            onPress={() => patch({ fees: FEE_PRESETS })}
          />
        ) : null}
        {d.fees.map((f, i) => (
          <Card key={i} style={{ gap: 12 }}>
            <TextField label="Name" value={f.name} onChangeText={(name) => setFee(i, { name })} />
            <TextField
              label="Betrag in €"
              value={f.amount}
              onChangeText={(amount) => setFee(i, { amount })}
            />
            <ChoiceChips
              options={CLUB_FEE_INTERVALS.map((v) => ({
                value: v,
                label: CLUB_FEE_INTERVAL_LABEL[v],
              }))}
              selected={[f.interval]}
              onToggle={(interval) => setFee(i, { interval })}
            />
            <Button
              label="Entfernen"
              variant="outline"
              icon="trash-outline"
              onPress={() => patch({ fees: d.fees.filter((_, n) => n !== i) })}
            />
          </Card>
        ))}
        <Button
          label="Beitragsart hinzufügen"
          variant="outline"
          icon="add"
          onPress={() => patch({ fees: [...d.fees, { name: '', amount: '', interval: 'yearly' }] })}
        />
        <LaterHint where="Vereinskasse › Beiträge" />
      </WizardShell>
    );

  if (key === 'rules')
    return (
      <WizardShell
        {...shell}
        title="Wer zahlt welchen Beitrag?"
        explanation="Regeln ordnen allen Mitgliedern ohne laufende Beitragsart eine zu. Ohne Regel bleibt es bei der manuellen Zuordnung."
        onSkip={next}
      >
        {fees.length === 0 ? (
          <T>Lege zuerst im vorigen Schritt Beitragsarten an.</T>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <T variant="label">Kinder und Jugendliche</T>
              <ChoiceChips
                options={feeOptions}
                selected={[d.youthFee]}
                onToggle={(youthFee) => patch({ youthFee })}
              />
              {d.youthFee !== '' ? (
                <NumberStepper
                  label="Jünger als … Jahre"
                  value={d.youthAge}
                  min={1}
                  max={30}
                  onChange={(youthAge) => patch({ youthAge })}
                />
              ) : null}
            </View>
            <View style={{ gap: 8 }}>
              <T variant="label">Passive Mitglieder</T>
              <ChoiceChips
                options={feeOptions}
                selected={[d.inactiveFee]}
                onToggle={(inactiveFee) => patch({ inactiveFee })}
              />
            </View>
            <View style={{ gap: 8 }}>
              <T variant="label">Alle übrigen</T>
              <ChoiceChips
                options={feeOptions}
                selected={[d.restFee]}
                onToggle={(restFee) => patch({ restFee })}
              />
            </View>
            <WhyBox>
              Mitglieder ohne Geburtsdatum werden bei der Jugend-Regel übersprungen und bleiben ohne
              Beitragsart; Mitglieder mit laufender Beitragsart werden nie verändert.
            </WhyBox>
          </View>
        )}
      </WizardShell>
    );

  if (key === 'reminders')
    return (
      <WizardShell
        {...shell}
        title="Zahlungserinnerungen"
        explanation="„Alle erinnern“ in den Beiträgen wartet so viele Tage nach der Fälligkeit und kann einen Zusatztext anhängen."
      >
        <NumberStepper
          label="Tage nach Fälligkeit"
          value={d.remindDays}
          min={0}
          max={90}
          onChange={(remindDays) => patch({ remindDays })}
        />
        <TextField
          label="Zusatztext (optional)"
          value={d.remindText}
          multiline
          maxLength={500}
          onChangeText={(remindText) => patch({ remindText })}
          placeholder={t('z. B. Bitte überweise den Beitrag bis Monatsende.')}
        />
        <LaterHint where="Vereinskasse › Beiträge" />
      </WizardShell>
    );

  if (key === 'people')
    return (
      <WizardShell
        {...shell}
        title="Wer führt die Kasse?"
        explanation="Der Kassenwart bucht und verwaltet Beiträge, Kassenprüfer sehen alles und prüfen am Jahresende. Optional – Rollen lassen sich später vergeben."
        onSkip={next}
      >
        <T variant="section">Kassenwart</T>
        <PersonPicker
          search={backend.search}
          demo={backend.demo}
          selected={d.treasurers}
          exclude={d.auditors}
          onChange={(treasurers) => patch({ treasurers })}
        />
        {d.flow === 'full' ? (
          <MoreSettings title="Kassenprüfer">
            <PersonPicker
              search={backend.search}
              demo={backend.demo}
              selected={d.auditors}
              exclude={d.treasurers}
              onChange={(auditors) => patch({ auditors })}
            />
          </MoreSettings>
        ) : null}
        <LaterHint where="Verwaltung › Mitglieder › Rollen" />
      </WizardShell>
    );

  if (key === 'visibility')
    return (
      <WizardShell
        {...shell}
        title="Wer darf die Kasse einsehen?"
        explanation="Neben Kassenführung und Administration."
      >
        {!cash.canChangeSettings ? (
          <T>Das ändert nur die Vereinsadministration.</T>
        ) : (
          <View style={{ gap: 10 }}>
            {CLUB_CASH_VISIBILITIES.map((v) => (
              <ChoiceCard
                key={v}
                icon="eye"
                title={CLUB_CASH_VISIBILITY_INFO[v].name}
                text={CLUB_CASH_VISIBILITY_INFO[v].description}
                selected={d.visibility === v}
                onPress={() => patch({ visibility: v })}
              />
            ))}
          </View>
        )}
      </WizardShell>
    );

  // ── Zusammenfassung ──────────────────────────────────────────────────────
  const rows: { label: string; value: string; key: StepKey }[] = [
    {
      label: t('Gemeinnützig'),
      value: d.nonprofit === 'yes' ? t('Ja') : d.nonprofit === 'no' ? t('Nein') : t('offen'),
      key: 'nonprofit',
    },
    {
      label: t('Konten'),
      value: accounts.map((a) => a.name.trim()).join(' · '),
      key: 'accounts',
    },
    {
      label: t('Kategorien'),
      value: hasCategories ? t('vorhanden') : d.template ? t('Vorlage') : t('keine'),
      key: 'categories',
    },
    ...(d.flow === 'full'
      ? [
          {
            label: t('Kostenstellen'),
            value: d.costCenters.join(' · '),
            key: 'costcenters' as const,
          },
        ]
      : []),
    {
      label: t('Beiträge'),
      value: fees
        .map(
          (f) =>
            `${f.name} ${formatEuro(parseEuro(f.amount) ?? 0)} ${t(CLUB_FEE_INTERVAL_LABEL[f.interval])}`,
        )
        .join(' · '),
      key: 'fees',
    },
    {
      label: t('Kassenwart'),
      value: d.treasurers.map((p) => p.name).join(' · '),
      key: 'people',
    },
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
    </WizardShell>
  );
}
