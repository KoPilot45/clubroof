/**
 * Assistent „Vereinskasse einrichten“ (Paket E2): Gemeinnützigkeit, Konten, Kategorien, Beiträge, Erinnerungen,
 * Kassenverantwortliche und Sichtbarkeit – ein Thema pro Seite. Angelegt wird erst in der Zusammenfassung;
 * der Zwischenstand bleibt auf dem Gerät.
 */
import {
  CLUB_CASH_ACCOUNT_KINDS,
  CLUB_CASH_ACCOUNT_KIND_LABEL,
  CLUB_CASH_AREA_LABEL,
  CLUB_CASH_CATEGORY_TEMPLATE,
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
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Loading,
  T,
  TextField,
  ToggleRow,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { formatEuro, parseEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

type Person = { id: string; name: string };
type AccountDraft = { name: string; kind: ClubCashAccountKind; opening: string };
type FeeDraft = {
  name: string;
  amount: string;
  interval: ClubFeeInterval;
  /** Fälligkeit: Tag im Monat, erster Fälligkeitsmonat, bei „einmalig“ das Datum */
  dueDay: number;
  dueMonth: number;
  dueOn: string;
};
/** Zuordnungsregel: von oben nach unten, die erste passende gilt */
type RuleDraft = {
  when: 'age_range' | 'inactive' | 'rest';
  fromAge: number | null;
  toAge: number | null;
  /** Beitragsart (Index in `fees`) */
  fee: string;
};
const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

type Draft = {
  flow: SetupMode;
  nonprofit: 'yes' | 'no' | 'unknown';
  simplify: boolean;
  /** Haushaltsjahr: Kalenderjahr oder abweichender Startmonat */
  fiscal: 'calendar' | 'month';
  fiscalMonth: number;
  accounts: AccountDraft[];
  /** Kategorien, die abgewählt wurden (nach Name), und eigene Kategorien */
  catOff: string[];
  customCats: { name: string; direction: 'income' | 'expense' }[];
  costCenters: string[];
  customCostCenters: string[];
  costCentersTouched: boolean;
  fees: FeeDraft[];
  rules: RuleDraft[];
  remindDays: number;
  remindText: string;
  treasurers: Person[];
  auditors: Person[];
  visibility: ClubCashVisibility;
  /** Abteilungen (IDs), die eine eigene Kasse bekommen */
  fundUnits: string[];
  /** Auslagen: Belegpflicht und Betrag (€) ab dem eine zweite Person freigibt (leer = keine Grenze) */
  claimReceipt: boolean;
  claimLimit: string;
  /** Spenden (nur gemeinnützig): Steuerdaten für Zuwendungsbestätigungen oder später */
  taxLater: boolean;
  taxOffice: string;
  taxNumber: string;
  taxKind: 'freistellung' | 'feststellung';
  taxDate: string;
  taxPeriod: string;
  taxPurposes: string;
};

const INITIAL: Draft = {
  flow: 'quick',
  nonprofit: 'unknown',
  simplify: true,
  fiscal: 'calendar',
  fiscalMonth: 7,
  accounts: [{ name: 'Girokonto', kind: 'bank', opening: '' }],
  catOff: [],
  customCats: [],
  costCenters: [],
  customCostCenters: [],
  costCentersTouched: false,
  fees: [],
  rules: [],
  remindDays: 14,
  remindText: '',
  treasurers: [],
  auditors: [],
  visibility: 'treasury',
  fundUnits: [],
  claimReceipt: true,
  claimLimit: '250',
  taxLater: true,
  taxOffice: '',
  taxNumber: '',
  taxKind: 'freistellung',
  taxDate: '',
  taxPeriod: '',
  taxPurposes: '',
};

type StepKey =
  | 'intro'
  | 'nonprofit'
  | 'fiscal'
  | 'accounts'
  | 'categories'
  | 'costcenters'
  | 'funds'
  | 'fees'
  | 'rules'
  | 'reminders'
  | 'people'
  | 'claims'
  | 'donations'
  | 'visibility'
  | 'summary';

const FULL: StepKey[] = [
  'intro',
  'nonprofit',
  'fiscal',
  'accounts',
  'categories',
  'costcenters',
  'funds',
  'fees',
  'rules',
  'reminders',
  'people',
  'claims',
  'donations',
  'visibility',
  'summary',
];
const QUICK: StepKey[] = [
  'intro',
  'nonprofit',
  'fiscal',
  'accounts',
  'categories',
  'fees',
  'people',
  'summary',
];

/** Häufige Kostenstellen neben den Abteilungen des Vereins */
const COST_CENTER_IDEAS = ['Platzpflege', 'Vereinsheim', 'Feste und Feiern'];
/** Beispielwerte, keine Empfehlung */
const FEE_PRESETS: FeeDraft[] = [
  { name: 'Erwachsene', amount: '120', interval: 'yearly', dueDay: 1, dueMonth: 1, dueOn: '' },
  { name: 'Jugend', amount: '60', interval: 'yearly', dueDay: 1, dueMonth: 1, dueOn: '' },
  { name: 'Passive Mitglieder', amount: '30', interval: 'yearly', dueDay: 1, dueMonth: 1, dueOn: '' },
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
  } = useWizardDraft(backend.demo ? 'cash-wizard-demo-2' : 'cash-wizard-2', INITIAL);
  const [step, setStep] = useState(0);
  const [fromSummary, setFromSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ assigned: number } | null>(null);

  const cash = backend.cash;
  if (!cash || !loaded) return <Loading />;
  // Spenden-Angaben gibt es nur für gemeinnützige Vereine; Abteilungskassen nur mit mehreren Abteilungen
  const keys = (d.flow === 'quick' ? QUICK : FULL).filter(
    (k) => (k !== 'donations' || d.nonprofit === 'yes') && (k !== 'funds' || cash.units.length > 1),
  );
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
  // Kostenstellen: Abteilungen und häufige Vorschläge, alles vorausgewählt (bereits vorhandene entfallen)
  const haveCenters = new Set(cash.costCenters.map((c) => c.name));
  const centerOptions = [
    ...new Set([
      ...cash.units.map((u) => u.name),
      ...COST_CENTER_IDEAS,
      ...d.customCostCenters,
    ]),
  ].filter((n) => !haveCenters.has(n));
  const centersChosen = d.costCentersTouched
    ? d.costCenters.filter((n) => centerOptions.includes(n))
    : centerOptions;
  // Kategorien: vorhandene (aus der Ersteinrichtung) oder die Vorlage; abgewählte werden archiviert
  const catBase = hasCategories
    ? cash.categories.filter((c) => !c.archived)
    : CLUB_CASH_CATEGORY_TEMPLATE.map((c) => ({ ...c, id: c.name, archived: false }));
  const taxFilled =
    d.taxOffice.trim().length >= 2 &&
    d.taxNumber.trim().length >= 3 &&
    d.taxPeriod.trim().length >= 4 &&
    d.taxPurposes.trim().length >= 3;
  /** Beitragsregeln nach Alter greifen nur mit Geburtsdaten */
  const hasBirthDates = cash.memberStats.withBirthDate > 0;
  const setAccount = (i: number, p: Partial<AccountDraft>) =>
    patch({ accounts: d.accounts.map((a, n) => (n === i ? { ...a, ...p } : a)) });
  const setFee = (i: number, p: Partial<FeeDraft>) =>
    patch({ fees: d.fees.map((f, n) => (n === i ? { ...f, ...p } : f)) });

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
        const limitCents = d.claimLimit.trim() ? parseEuro(d.claimLimit) : null;
        const fiscalChanged =
          d.fiscal === 'month'
            ? cash.fiscalYear !== 'month' || cash.fiscalStartMonth !== d.fiscalMonth
            : cash.fiscalYear !== 'calendar';
        await api('/club-cash/rules', {
          method: 'PUT',
          body: {
            ...(fiscalChanged
              ? {
                  fiscalYear: d.fiscal,
                  ...(d.fiscal === 'month' ? { fiscalStartMonth: d.fiscalMonth } : {}),
                }
              : {}),
            ...(d.flow === 'full'
              ? { claimReceiptRequired: d.claimReceipt, claimSecondApprovalCents: limitCents }
              : {}),
          },
        });
        for (const a of accounts) {
          await api('/club-cash/accounts', {
            method: 'POST',
            body: { name: a.name.trim(), kind: a.kind, openingBalanceCents: cents(a.opening) ?? 0 },
          });
        }
        let cats = cash.categories;
        if (!hasCategories) {
          cats = (await api<ClubCash>('/club-cash/categories/template', { method: 'POST' }))
            .categories;
        }
        for (const c of cats) {
          if (d.catOff.includes(c.name) && !c.archived)
            await api(`/club-cash/categories/${c.id}`, {
              method: 'PATCH',
              body: { archived: true },
            });
        }
        for (const c of d.customCats) {
          if (cats.some((x) => x.name === c.name.trim())) continue;
          await api('/club-cash/categories', {
            method: 'POST',
            body: { name: c.name.trim(), direction: c.direction, area: 'ideal' },
          });
        }
        for (const name of centersChosen) {
          await api('/club-cash/cost-centers', { method: 'POST', body: { name, kind: 'other' } });
        }
        for (const unitId of d.fundUnits) {
          const unit = cash.units.find((u) => u.id === unitId);
          if (unit)
            await api('/club-cash/funds', {
              method: 'POST',
              body: { name: `Kasse ${unit.name}`, unitIds: [unitId] },
            });
        }
        const made = new Map<string, string>();
        for (const f of fees) {
          const res = await api<ClubFees>('/club-cash/fees/types', {
            method: 'POST',
            body: {
              name: f.name.trim(),
              amountCents: parseEuro(f.amount),
              interval: f.interval,
              dueDay: f.dueDay,
              dueMonth: f.dueMonth,
              ...(f.interval === 'once' && f.dueOn ? { dueOn: f.dueOn } : {}),
            },
          });
          const id = res.types.find((x) => x.name === f.name.trim())?.id;
          if (id) made.set(f.name, id);
        }
        const rules: ClubFeeRule[] = [];
        const idOf = (i: string) => (i === '' ? undefined : made.get(feeName(i)));
        for (const r of d.rules) {
          const feeTypeId = idOf(r.fee);
          if (!feeTypeId) continue;
          if (r.when === 'age_range')
            rules.push({
              when: 'age_range',
              ...(r.fromAge !== null ? { fromAge: r.fromAge } : {}),
              ...(r.toAge !== null ? { toAge: r.toAge } : {}),
              feeTypeId,
            });
          else rules.push({ when: r.when, feeTypeId });
        }
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
        if (d.flow === 'full' && d.nonprofit === 'yes' && !d.taxLater && taxFilled)
          await api('/club-cash/tax', {
            method: 'PUT',
            body: {
              taxOffice: d.taxOffice.trim(),
              taxNumber: d.taxNumber.trim(),
              exemptionKind: d.taxKind,
              exemptionDate: d.taxDate || todayIso(),
              exemptionPeriod: d.taxPeriod.trim(),
              purposes: d.taxPurposes.trim(),
            },
          }).catch(() => undefined);
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
              icon="stats-chart"
              title="Haushaltsplan anlegen"
              text="Soll je Kategorie für das Haushaltsjahr festlegen"
              selected={false}
              onPress={() => router.replace('/club-cash/budget')}
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
              icon="receipt"
              title="Beiträge fällig stellen"
              text="Fällige Beiträge für das laufende Jahr anlegen"
              selected={false}
              onPress={() => router.replace('/club-cash/fees')}
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
          <ToggleRow
            label="Vorhandene Kategorien vereinfachen"
            hint="Alle Kategorien gehören dann zum ideellen Bereich."
            value={d.simplify}
            onChange={(simplify) => patch({ simplify })}
          />
        ) : null}
      </WizardShell>
    );

  if (key === 'fiscal')
    return (
      <WizardShell
        {...shell}
        title="Haushaltsjahr"
        explanation="Haushaltsplan, Jahresabschluss und Auswertungen rechnen je Haushaltsjahr. Es beginnt am 1. Januar oder in einem Monat, den du wählst."
        hint={
          cash.fiscalYear !== d.fiscal
            ? 'Das Haushaltsjahr lässt sich nur ändern, solange noch kein Jahr abgeschlossen ist.'
            : undefined
        }
      >
        <ChoiceCard
          icon="calendar"
          title="Kalenderjahr"
          text="1. Januar bis 31. Dezember – üblich für Steuer und Finanzamt"
          badge="Empfohlen"
          selected={d.fiscal === 'calendar'}
          onPress={() => patch({ fiscal: 'calendar' })}
        />
        <ChoiceCard
          icon="football"
          title="Abweichender Startmonat"
          text="z. B. Juli bis Juni, wenn ihr nach der Spielzeit abrechnet"
          selected={d.fiscal === 'month'}
          onPress={() => patch({ fiscal: 'month' })}
        />
        {d.fiscal === 'month' ? (
          <ChoiceChips
            label="Startmonat"
            options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: t(m) }))}
            selected={[String(d.fiscalMonth)]}
            onToggle={(m) => patch({ fiscalMonth: Number(m) })}
          />
        ) : null}
        <WhyBox>
          Das Haushaltsjahr hat nichts mit dem Saisonwechsel der Mannschaften zu tun, den der Verein
          von Hand auslöst. Für die Steuererklärung zählt meist das Kalenderjahr.
        </WhyBox>
        <LaterHint where="Vereinskasse › Haushaltsplan" />
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

  if (key === 'categories') {
    const group = (direction: 'income' | 'expense') => (
      <View style={{ gap: 8 }}>
        <T variant="section">{direction === 'income' ? 'Einnahmen' : 'Ausgaben'}</T>
        {catBase
          .filter((c) => c.direction === direction)
          .map((c) => (
            <ChoiceCard
              key={c.id}
              multi
              icon={direction === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'}
              title={c.name}
              text={d.nonprofit === 'yes' ? t(CLUB_CASH_AREA_LABEL[c.area]) : undefined}
              selected={!d.catOff.includes(c.name)}
              onPress={() =>
                patch({
                  catOff: d.catOff.includes(c.name)
                    ? d.catOff.filter((x) => x !== c.name)
                    : [...d.catOff, c.name],
                })
              }
            />
          ))}
        {d.customCats
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.direction === direction)
          .map(({ c, i }) => (
            <Card key={`custom-${i}`} style={{ gap: 8 }}>
              <TextField
                label={direction === 'income' ? 'Eigene Einnahmekategorie' : 'Eigene Ausgabekategorie'}
                value={c.name}
                maxLength={60}
                onChangeText={(name) =>
                  patch({ customCats: d.customCats.map((x, n) => (n === i ? { ...x, name } : x)) })
                }
              />
              <Button
                label="Entfernen"
                variant="outline"
                icon="trash-outline"
                onPress={() => patch({ customCats: d.customCats.filter((_, n) => n !== i) })}
              />
            </Card>
          ))}
        <Button
          label={direction === 'income' ? 'Eigene Einnahmekategorie' : 'Eigene Ausgabekategorie'}
          icon="add"
          variant="outline"
          onPress={() => patch({ customCats: [...d.customCats, { name: '', direction }] })}
        />
      </View>
    );
    return (
      <WizardShell
        {...shell}
        title="Kategorien für Buchungen"
        explanation="Eine Kategorie sagt, welche Art von Einnahme oder Ausgabe es ist – zum Beispiel „Spende“ oder „Platzmiete“. Alles ist vorausgewählt; wähle ab, was ihr nicht braucht, und ergänze eigene."
        nextDisabled={d.customCats.some((c) => c.name.trim().length === 1)}
      >
        <WhyBox>
          Mit Kategorien zeigt die Auswertung später, woher das Geld kommt und wofür es ausgegeben
          wird.
        </WhyBox>
        {hasCategories ? (
          <Chip
            tone="neutral"
            icon="checkmark-circle"
            label={t(`${cash.categories.length} Kategorien sind schon vorhanden`)}
          />
        ) : null}
        {group('income')}
        {group('expense')}
        {d.nonprofit === 'yes' ? (
          <T variant="caption">
            Unter jeder Kategorie steht der steuerliche Bereich, dem die Vorlage sie zuordnet.
          </T>
        ) : null}
        <LaterHint where="Vereinskasse › Kategorien" />
      </WizardShell>
    );
  }

  if (key === 'costcenters')
    return (
      <WizardShell
        {...shell}
        title="Kostenstellen"
        explanation="Eine Kostenstelle sagt, wofür im Verein Geld ausgegeben oder eingenommen wird – zum Beispiel „Jugend“ oder „Platzpflege“. So lässt sich später ablesen, was ein Bereich kostet."
        onSkip={() => {
          patch({ costCentersTouched: true, costCenters: [] });
          next();
        }}
      >
        <WhyBox>
          Beispiel: „Neue Tore für die Jugend“ bekommt die Kategorie Sportgeräte und die
          Kostenstelle Jugend. Der Schritt ist optional.
        </WhyBox>
        <ChoiceChips
          options={centerOptions.map((c) => ({ value: c, label: c }))}
          selected={centersChosen}
          check
          onToggle={(c) =>
            patch({
              costCentersTouched: true,
              costCenters: centersChosen.includes(c)
                ? centersChosen.filter((x) => x !== c)
                : [...centersChosen, c],
            })
          }
        />
        {d.customCostCenters.map((c, i) => (
          <Card key={i} style={{ gap: 8 }}>
            <TextField
              label="Eigene Kostenstelle"
              value={c}
              maxLength={60}
              onChangeText={(name) =>
                patch({
                  customCostCenters: d.customCostCenters.map((x, n) => (n === i ? name : x)),
                  costCenters: centersChosen.map((x) => (x === c ? name : x)),
                  costCentersTouched: true,
                })
              }
            />
          </Card>
        ))}
        <Button
          label="Eigene Kostenstelle"
          icon="add"
          variant="outline"
          onPress={() => patch({ customCostCenters: [...d.customCostCenters, ''] })}
        />
        <LaterHint where="Vereinskasse › Kostenstellen" />
      </WizardShell>
    );

  if (key === 'funds')
    return (
      <WizardShell
        {...shell}
        title="Abteilungskassen"
        explanation="Hat eine Abteilung eigenes Geld (z. B. die Jugend), bekommt sie eine eigene Kasse. Wer die Abteilung leitet, sieht dann nur diese Kasse. Optional."
        onSkip={next}
      >
        <ChoiceChips
          options={cash.units.map((u) => ({ value: u.id, label: u.name }))}
          selected={d.fundUnits}
          check
          onToggle={(id) =>
            patch({
              fundUnits: d.fundUnits.includes(id)
                ? d.fundUnits.filter((x) => x !== id)
                : [...d.fundUnits, id],
            })
          }
        />
        <T variant="caption">
          Konten legst du danach unter Vereinskasse › Kassen und Konten in der jeweiligen Kasse an.
        </T>
        <LaterHint where="Vereinskasse › Kassen" />
      </WizardShell>
    );

  if (key === 'fees')
    return (
      <WizardShell
        {...shell}
        title="Mitgliedsbeiträge"
        explanation="Hier legst du Beitragsarten an – zum Beispiel Erwachsene, Jugend, Familie oder Passiv, jede mit Betrag, Rhythmus und Fälligkeit. Jedes Mitglied bekommt später eine Beitragsart, im nächsten Schritt per Regel oder jederzeit in der Verwaltung von Hand."
        onSkip={next}
      >
        {d.fees.length === 0 ? (
          <>
            <Button
              label="Beispiele einfügen"
              icon="sparkles"
              variant="outline"
              onPress={() => patch({ fees: FEE_PRESETS })}
            />
            <T variant="caption">
              Die Beispiele (Erwachsene 120 €, Jugend 60 €, Passive 30 € im Jahr) sind nur
              Beispielwerte, keine Empfehlung – passe Namen und Beträge an.
            </T>
          </>
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
              label="Rhythmus"
              options={CLUB_FEE_INTERVALS.map((v) => ({
                value: v,
                label: CLUB_FEE_INTERVAL_LABEL[v],
              }))}
              selected={[f.interval]}
              onToggle={(interval) => setFee(i, { interval })}
            />
            <T variant="label" style={{ fontWeight: '700' }}>
              Wann ist der Beitrag fällig?
            </T>
            {f.interval === 'once' ? (
              <DateStepper
                label="Fällig am"
                value={f.dueOn || todayIso()}
                onChange={(dueOn) => setFee(i, { dueOn })}
              />
            ) : (
              <>
                {f.interval !== 'monthly' ? (
                  <ChoiceChips
                    label={f.interval === 'yearly' ? 'Monat' : 'Erster Fälligkeitsmonat'}
                    options={MONTH_NAMES.map((m, n) => ({ value: String(n + 1), label: t(m) }))}
                    selected={[String(f.dueMonth)]}
                    onToggle={(m) => setFee(i, { dueMonth: Number(m) })}
                  />
                ) : null}
                <NumberStepper
                  label="Tag im Monat"
                  value={f.dueDay}
                  min={1}
                  max={31}
                  onChange={(dueDay) => setFee(i, { dueDay })}
                />
              </>
            )}
            <T variant="caption">
              {f.interval === 'yearly'
                ? t(`Jährlich am ${f.dueDay}. ${t(MONTH_NAMES[f.dueMonth - 1]!)}`)
                : f.interval === 'monthly'
                  ? t(`Monatlich am ${f.dueDay}.`)
                  : f.interval === 'quarterly'
                    ? t(
                        `Vierteljährlich, erstmals am ${f.dueDay}. ${t(MONTH_NAMES[f.dueMonth - 1]!)}`,
                      )
                    : 'Einmalig zum gewählten Datum.'}
            </T>
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
          onPress={() =>
            patch({
              fees: [
                ...d.fees,
                {
                  name: '',
                  amount: '',
                  interval: 'yearly',
                  dueDay: 1,
                  dueMonth: 1,
                  dueOn: '',
                },
              ],
            })
          }
        />
        <LaterHint where="Vereinskasse › Beiträge" />
      </WizardShell>
    );

  if (key === 'rules') {
    const setRule = (i: number, p: Partial<RuleDraft>) =>
      patch({ rules: d.rules.map((r, n) => (n === i ? { ...r, ...p } : r)) });
    const move = (i: number, by: number) => {
      const j = i + by;
      if (j < 0 || j >= d.rules.length) return;
      const list = [...d.rules];
      [list[i], list[j]] = [list[j]!, list[i]!];
      patch({ rules: list });
    };
    return (
      <WizardShell
        {...shell}
        title="Wer zahlt welchen Beitrag?"
        explanation="Regeln ordnen allen Mitgliedern ohne laufende Beitragsart eine zu. Sie gelten von oben nach unten, die erste passende gilt. Ohne Regel bleibt es bei der manuellen Zuordnung."
        onSkip={next}
      >
        <WhyBox>
          Die Gruppen kommen aus dem Geburtsdatum und dem Mitgliedsstatus in den Mitgliedsdaten.
          Sonderfälle wie Familie, Ehrenmitglied oder Student ordnest du in der Verwaltung von Hand
          zu.
        </WhyBox>
        {!hasBirthDates ? (
          <>
            <T>
              Für Regeln nach dem Alter braucht Clubroof die Geburtsdaten der Mitglieder. Importiere
              zuerst die Mitgliederliste, danach holst du die Zuordnung unter Vereinskasse ›
              Beiträge nach.
            </T>
            <Button
              label="Später nach dem Import"
              icon="cloud-upload"
              variant="outline"
              onPress={() => router.push('/admin/import')}
            />
          </>
        ) : fees.length === 0 ? (
          <T>Lege zuerst im vorigen Schritt Beitragsarten an.</T>
        ) : (
          <View style={{ gap: 12 }}>
            {d.rules.map((r, i) => (
              <Card key={i} style={{ gap: 10 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {r.when === 'age_range'
                    ? t(
                        `Wenn das Alter ${r.fromAge ?? 0} bis ${r.toAge === null ? 'beliebig' : r.toAge} Jahre ist`,
                      )
                    : r.when === 'inactive'
                      ? 'Wenn das Mitglied passiv ist'
                      : 'Alle übrigen'}
                </T>
                {r.when === 'age_range' ? (
                  <>
                    <NumberStepper
                      label="Alter von"
                      value={r.fromAge ?? 0}
                      min={0}
                      max={99}
                      onChange={(fromAge) => setRule(i, { fromAge })}
                    />
                    <ToggleRow
                      label="Mit oberer Altersgrenze"
                      value={r.toAge !== null}
                      onChange={(on) => setRule(i, { toAge: on ? Math.max(r.fromAge ?? 0, 17) : null })}
                    />
                    {r.toAge !== null ? (
                      <NumberStepper
                        label="Alter bis (einschließlich)"
                        value={r.toAge}
                        min={r.fromAge ?? 0}
                        max={120}
                        onChange={(toAge) => setRule(i, { toAge })}
                      />
                    ) : null}
                  </>
                ) : null}
                <ChoiceChips
                  label="Beitragsart"
                  options={fees.map((f, n) => ({ value: String(n), label: f.name }))}
                  selected={r.fee === '' ? [] : [r.fee]}
                  onToggle={(fee) => setRule(i, { fee })}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label="Nach oben"
                    variant="tonal"
                    size="sm"
                    icon="arrow-up"
                    onPress={() => move(i, -1)}
                  />
                  <Button
                    label="Nach unten"
                    variant="tonal"
                    size="sm"
                    icon="arrow-down"
                    onPress={() => move(i, 1)}
                  />
                  <Button
                    label="Entfernen"
                    variant="outline"
                    size="sm"
                    icon="trash-outline"
                    onPress={() => patch({ rules: d.rules.filter((_, n) => n !== i) })}
                  />
                </View>
              </Card>
            ))}
            <Button
              label="Regel nach Alter hinzufügen"
              icon="add"
              variant="outline"
              onPress={() =>
                patch({
                  rules: [...d.rules, { when: 'age_range', fromAge: 0, toAge: 17, fee: '' }],
                })
              }
            />
            {!d.rules.some((r) => r.when === 'inactive') ? (
              <Button
                label="Regel für passive Mitglieder"
                icon="add"
                variant="outline"
                onPress={() =>
                  patch({ rules: [...d.rules, { when: 'inactive', fromAge: null, toAge: null, fee: '' }] })
                }
              />
            ) : null}
            {!d.rules.some((r) => r.when === 'rest') ? (
              <Button
                label="Regel für alle übrigen"
                icon="add"
                variant="outline"
                onPress={() =>
                  patch({ rules: [...d.rules, { when: 'rest', fromAge: null, toAge: null, fee: '' }] })
                }
              />
            ) : null}
            <T variant="caption">
              Mitglieder ohne Geburtsdatum werden übersprungen und bleiben ohne Beitragsart;
              Mitglieder mit laufender Beitragsart werden nie verändert.
            </T>
          </View>
        )}
      </WizardShell>
    );
  }

  if (key === 'reminders')
    return (
      <WizardShell
        {...shell}
        title="Zahlungserinnerungen"
        explanation="„Alle erinnern“ in den Beiträgen wartet so viele Tage nach dem Fälligkeitsdatum der Beitragsart und kann einen Zusatztext anhängen. Beispiel: Fällig 1. Januar, Erinnerung am 15. Januar."
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

  if (key === 'claims')
    return (
      <WizardShell
        {...shell}
        title="Auslagen und Freigaben"
        explanation="Mitglieder reichen Auslagen und Fahrtkosten ein, die Kassenführung prüft sie. Lege fest, wie streng das geschieht."
        onSkip={next}
      >
        <Card style={{ gap: 14 }}>
          <ToggleRow
            label="Beleg ist Pflicht (Fahrtkosten nicht)"
            value={d.claimReceipt}
            onChange={(claimReceipt) => patch({ claimReceipt })}
          />
          <TextField
            label="Zweite Freigabe ab Betrag in € (leer = nie)"
            value={d.claimLimit}
            onChangeText={(claimLimit) => patch({ claimLimit })}
            placeholder="250"
          />
          <T variant="caption">
            Ab diesem Betrag müssen zwei verschiedene Personen der Kassenführung freigeben
            (Vier-Augen-Prinzip). Wer die Auslage eingereicht hat, zählt nicht mit.
          </T>
        </Card>
        {d.flow === 'full' ? (
          <WhyBox>
            Ein Beleg schützt bei der Kassenprüfung. Die zweite Freigabe verhindert, dass eine
            Person allein größere Beträge anweist.
          </WhyBox>
        ) : null}
        <LaterHint where="Vereinskasse › Auslagen" />
      </WizardShell>
    );

  if (key === 'donations')
    return (
      <WizardShell
        {...shell}
        title="Spenden und Zuwendungsbestätigungen"
        explanation="Für Zuwendungsbestätigungen braucht der Verein Angaben aus dem Freistellungsbescheid. Das trägt die Vereinsadministration ein; die Vorlage wird erst nach rechtlicher Prüfung freigegeben."
        onSkip={next}
      >
        {!cash.canChangeSettings ? (
          <T>Die Steuerdaten pflegt die Vereinsadministration (Vereinskasse › Steuerdaten).</T>
        ) : (
          <>
            <ChoiceCard
              icon="time"
              title="Später eintragen"
              text="Du ergänzt die Steuerdaten, wenn der Bescheid zur Hand ist"
              badge="Empfohlen"
              selected={d.taxLater}
              onPress={() => patch({ taxLater: true })}
            />
            <ChoiceCard
              icon="document-text"
              title="Jetzt eintragen"
              text="Finanzamt, Steuernummer und Bescheid"
              selected={!d.taxLater}
              onPress={() => patch({ taxLater: false })}
            />
            {!d.taxLater ? (
              <Card style={{ gap: 12 }}>
                <TextField
                  label="Finanzamt"
                  value={d.taxOffice}
                  onChangeText={(taxOffice) => patch({ taxOffice })}
                  maxLength={120}
                />
                <TextField
                  label="Steuernummer"
                  value={d.taxNumber}
                  onChangeText={(taxNumber) => patch({ taxNumber })}
                  maxLength={40}
                />
                <ChoiceChips
                  label="Nachweis"
                  selected={[d.taxKind]}
                  onToggle={(taxKind) => patch({ taxKind })}
                  options={[
                    { value: 'freistellung' as const, label: t('Freistellungsbescheid') },
                    { value: 'feststellung' as const, label: t('Feststellung nach § 60a AO') },
                  ]}
                />
                <DateStepper
                  label="Datum des Bescheids"
                  value={d.taxDate || todayIso()}
                  onChange={(taxDate) => patch({ taxDate })}
                />
                <TextField
                  label="Zeitraum (z. B. 2022 bis 2024)"
                  value={d.taxPeriod}
                  onChangeText={(taxPeriod) => patch({ taxPeriod })}
                  maxLength={40}
                />
                <TextField
                  label="Begünstigter Zweck"
                  value={d.taxPurposes}
                  onChangeText={(taxPurposes) => patch({ taxPurposes })}
                  maxLength={200}
                  placeholder={t('z. B. Förderung des Sports')}
                />
              </Card>
            ) : null}
          </>
        )}
        <LaterHint where="Vereinskasse › Steuerdaten" />
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
      label: t('Haushaltsjahr'),
      value:
        d.fiscal === 'month'
          ? t(`Beginn im ${t(MONTH_NAMES[d.fiscalMonth - 1]!)}`)
          : t('Kalenderjahr'),
      key: 'fiscal',
    },
    {
      label: t('Konten'),
      value: accounts.map((a) => a.name.trim()).join(' · '),
      key: 'accounts',
    },
    {
      label: t('Kategorien'),
      value: t(
        `${catBase.filter((c) => !d.catOff.includes(c.name)).length + d.customCats.filter((c) => c.name.trim()).length} gewählt`,
      ),
      key: 'categories',
    },
    ...(d.flow === 'full'
      ? [
          {
            label: t('Kostenstellen'),
            value: centersChosen.join(' · '),
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
    ...(d.flow === 'full'
      ? [
          {
            label: t('Auslagen'),
            value: [
              d.claimReceipt ? t('Beleg Pflicht') : t('Beleg freiwillig'),
              d.claimLimit.trim()
                ? t(`zweite Freigabe ab ${formatEuro(parseEuro(d.claimLimit) ?? 0)}`)
                : t('keine zweite Freigabe'),
            ].join(' · '),
            key: 'claims' as const,
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
    </WizardShell>
  );
}
