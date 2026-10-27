/**
 * Assistent „Mannschaft anlegen“ (Pakete E und E2): Schnellstart (Empfehlungen, nur das Nötigste) oder ausführlich
 * (jeder Schritt mit Erklärung), ein Thema pro Seite, am Ende eine Zusammenfassung mit „Ändern“. Angelegt wird erst
 * dort – bis dahin entstehen keine halben Daten; der Zwischenstand bleibt auf dem Gerät.
 */
import {
  TEAM_TEMPLATE_INFO,
  at,
  defaultLineupSize,
  fromIsoDate,
  type AttendanceVisibility,
  type MemberListItem,
  type ParticipationMode,
  type TeamAdminOverview,
  type TeamDetailAdmin,
  type TeamTemplate,
} from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { AnswerButtons } from '@/components/events';
import {
  ChoiceCard,
  HoursStepper,
  LaterHint,
  ModeChoice,
  MoreSettings,
  NumberStepper,
  OptionCard,
  RuleList,
  SummaryList,
  WhyBox,
  WizardShell,
  DateRangeField,
  useWizardDraft,
  type SetupMode,
} from '@/components/wizard';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Loading,
  T,
  TextField,
  TimeStepper,
  Toggle,
  type IconName,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { PARTICIPATION_OPTIONS } from '@/lib/team-labels';
import { t } from '@/lib/i18n';

type Person = { id: string; name: string };
/** Ein wöchentlicher Trainingstermin: Wochentag (1 = Montag … 7 = Sonntag), Beginn, Dauer und Platz */
type TrainingSlot = { weekday: number; start: string; minutes: number; facilityId: string | null };

export type Draft = {
  flow: SetupMode;
  name: string;
  badge: string;
  unitId: string | null;
  seasonId: string | null;
  ageGroup: string;
  league: string;
  /** Spielform im Aufstellungsplaner; leer = nach Altersklasse */
  format: 7 | 9 | 11 | null;
  template: TeamTemplate;
  /** Teilnahme-Modell Training / Spiele (getrennt wählbar) */
  mode: ParticipationMode;
  matchMode: ParticipationMode;
  coaches: Person[];
  players: Person[];
  trainingDeadline: number;
  matchDeadline: number;
  reminder: number | null;
  reasonRequired: boolean;
  allowMaybe: boolean;
  meetingPoint: string;
  trainingMeeting: number | null;
  matchMeeting: number | null;
  aliases: string;
  trainings: TrainingSlot[];
  trainFrom: string;
  trainTo: string;
  /** Team-Funktionen (Schlüssel aus `MODULES`), die eingeschaltet werden */
  modules: string[];
  responsesVisible: boolean;
  lineupVisible: boolean;
  welcome: string;
  /** Eltern je Kind (Schlüssel: Personen-ID des Kindes) – nur Jugend */
  parents: Record<string, Person[]>;
  /** Rückennummern: aus, je Spiel oder fest (nur wenn die Funktion gewählt ist) */
  jerseyMode: 'off' | 'match' | 'season';
  /** Abwesenheitsgründe: nur Trainerteam oder ganze Mannschaft */
  absenceTeam: boolean;
  attendance: AttendanceVisibility;
};

const INITIAL: Draft = {
  flow: 'quick',
  name: '',
  badge: '',
  unitId: null,
  seasonId: null,
  ageGroup: '',
  league: '',
  format: null,
  template: 'classic',
  // Empfehlung: am wenigsten Aufwand
  mode: 'auto_accept',
  matchMode: 'auto_accept',
  coaches: [],
  players: [],
  trainingDeadline: 24,
  matchDeadline: 48,
  reminder: null,
  reasonRequired: false,
  allowMaybe: true,
  meetingPoint: '',
  trainingMeeting: null,
  matchMeeting: null,
  aliases: '',
  trainings: [],
  trainFrom: '',
  trainTo: '',
  modules: ['training_planning'],
  responsesVisible: true,
  lineupVisible: false,
  welcome: '',
  parents: {},
  jerseyMode: 'off',
  absenceTeam: false,
  attendance: 'count',
};

type StepKey =
  | 'intro'
  | 'basics'
  | 'unit'
  | 'age'
  | 'template'
  | 'responses'
  | 'meeting'
  | 'training'
  | 'coaches'
  | 'squad'
  | 'parents'
  | 'features'
  | 'privacy'
  | 'schedule'
  | 'info'
  | 'summary';

const FULL: StepKey[] = [
  'intro',
  'basics',
  'unit',
  'age',
  'template',
  'coaches',
  'responses',
  'meeting',
  'training',
  'squad',
  'parents',
  'features',
  'privacy',
  'schedule',
  'info',
  'summary',
];
const QUICK: StepKey[] = [
  'intro',
  'basics',
  'unit',
  'age',
  'coaches',
  'responses',
  'training',
  'squad',
  'parents',
  'privacy',
  'summary',
];

/** Jugend-Mannschaft? Dann fragt der Assistent nach den Eltern der Kinder. */
const isYouth = (d: Pick<Draft, 'template' | 'ageGroup'>) =>
  d.template === 'youth' || /^\s*[UuJj]\s?\d{1,2}\b|jugend|bambini|minis/i.test(d.ageGroup);

const MODE_ICON: Record<ParticipationMode, IconName> = {
  auto_accept: 'checkmark-done',
  active_response: 'hand-left',
};
const MODE_TEXT: Record<ParticipationMode, string> = {
  auto_accept: 'Alle gelten als zugesagt, bis jemand absagt – gut für feste Gruppen',
  active_response: 'Jede Person sagt zu oder ab – der Trainer sieht, wer noch fehlt',
};
const MODE_EXAMPLE: Record<ParticipationMode, string> = {
  auto_accept: 'z. B. Senioren, Alte Herren',
  active_response: 'z. B. Jugend, wenn Plätze knapp sind',
};
const TEMPLATE_ICON: Record<TeamTemplate, IconName> = {
  performance: 'trophy',
  classic: 'football',
  youth: 'happy',
  leisure: 'cafe',
};
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Di' },
  { value: 3, label: 'Mi' },
  { value: 4, label: 'Do' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 7, label: 'So' },
];
/** Team-Funktionen, die der Assistent ein- oder ausschaltet */
const FEATURES: { key: string; icon: IconName; title: string; text: string }[] = [
  {
    key: 'team_cash',
    icon: 'cash',
    title: 'Mannschaftskasse',
    text: 'Strafen, Getränke und Einzahlungen der Mannschaft – mit Strafenkatalog',
  },
  {
    key: 'training_planning',
    icon: 'clipboard',
    title: 'Trainingsplanung',
    text: 'Schwerpunkt, Ablauf und Material je Training',
  },
  {
    key: 'team_tasks',
    icon: 'checkbox',
    title: 'Aufgaben',
    text: 'Trikots waschen, Bälle mitbringen – fair verteilt',
  },
  {
    key: 'statistics',
    icon: 'stats-chart',
    title: 'Statistik',
    text: 'Tore und Karten erfassen – das Trainerteam trägt sie nach dem Spiel ein',
  },
  {
    key: 'guest_players',
    icon: 'swap-horizontal',
    title: 'Gastspieler',
    text: 'Spieler anderer Mannschaften einzelnen Terminen zuordnen und Spielerbedarf melden',
  },
  {
    key: 'polls',
    icon: 'stats-chart',
    title: 'Umfragen',
    text: 'Schnell abstimmen, z. B. zur Weihnachtsfeier',
  },
];

/** Tage mit gegebenem Wochentag zwischen zwei Daten (einschließlich) – für „n Trainingstermine“ */
function countWeekday(from: string, to: string, weekday: number): number {
  const a = fromIsoDate(from).getTime();
  const b = fromIsoDate(to).getTime();
  if (!from || !to || b < a) return 0;
  let n = 0;
  for (let ms = a; ms <= b; ms += 86_400_000) {
    const js = new Date(ms).getUTCDay();
    if ((js === 0 ? 7 : js) === weekday) n++;
  }
  return n;
}

/** Erster Tag ab `from` mit dem Wochentag (JJJJ-MM-TT) */
function firstWeekday(from: string, weekday: number): string {
  const d = fromIsoDate(from);
  for (let i = 0; i < 7; i++) {
    const js = d.getUTCDay();
    if ((js === 0 ? 7 : js) === weekday) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

/** Was der Assistent vom Server braucht – echt (angemeldet) oder als Vorführung ohne Speichern. */
export type TeamWizardBackend = {
  demo?: boolean;
  overview: TeamAdminOverview | undefined;
  places: { label: string }[];
  /** Plätze des Vereins für das Training */
  facilities: { id: string; name: string }[];
  search: (term: string) => Promise<MemberListItem[]>;
  /** legt die Mannschaft an; gibt die ID und die Zahl der angelegten Trainingstermine zurück */
  create: (
    d: Draft,
    unitId: string | null,
    seasonId: string,
  ) => Promise<{ id: string; trainings: number }>;
  /** Einladungslink der Mannschaft für den fertigen Einladungstext */
  invite: (teamId: string) => Promise<string | null>;
  /** Abschluss: zur Mannschaft bzw. in der Vorführung zurück zur Anmeldung */
  finish: (teamId: string) => void;
};

export default function NewTeamScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api<TeamAdminOverview>('/admin/teams'),
  });
  const places = useQuery({
    queryKey: ['meeting-places'],
    queryFn: () => api<{ label: string }[]>('/meeting-places'),
  });
  const facilities = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api<{ id: string; name: string }[]>('/facilities'),
  });
  const backend: TeamWizardBackend = {
    overview: overview.data,
    places: places.data ?? [],
    facilities: facilities.data ?? [],
    search: (term) =>
      api<MemberListItem[]>(`/admin/members?status=active&q=${encodeURIComponent(term)}`),
    create: async (d, unitId, seasonId) => {
      const team = await api<TeamDetailAdmin>('/admin/teams', {
        method: 'POST',
        body: {
          name: d.name.trim(),
          badge: d.badge.trim(),
          ageGroup: d.ageGroup.trim() || null,
          league: d.league.trim() || null,
          orgUnitId: unitId,
          template: d.template,
          participationMode: d.mode,
          matchParticipationMode: d.matchMode,
          seasonId,
        },
      });
      let trainings = 0;
      try {
        await api(`/teams/${team.id}/profile`, {
          method: 'PUT',
          body: {
            defaultMeetingPoint: d.meetingPoint.trim() || null,
            trainingMeetingMinutes: d.trainingMeeting,
            matchMeetingMinutes: d.matchMeeting,
            trainingDeadlineHours: d.trainingDeadline,
            matchDeadlineHours: d.matchDeadline,
            reminderHours: d.reminder,
            declineReasonRequired: d.reasonRequired,
            allowMaybe: d.allowMaybe,
            matchFormat: d.format,
            responsesVisible: d.responsesVisible,
            lineupVisible: d.lineupVisible,
            welcomeText: d.welcome.trim() || null,
            absenceReasonsVisibleTo: d.absenceTeam ? 'team' : 'staff',
            attendanceVisibility: d.attendance,
            importAliases: d.aliases
              .split(/[;\n]/)
              .map((a) => a.trim())
              .filter(Boolean)
              .slice(0, 10),
          },
        });
        for (const f of FEATURES) {
          await api(`/teams/${team.id}/modules/${f.key}`, {
            method: 'PUT',
            body: { enabled: d.modules.includes(f.key) },
          }).catch(() => undefined);
        }
        if (d.jerseyMode !== 'off')
          await api(`/teams/${team.id}/jerseys`, {
            method: 'PUT',
            body: { mode: d.jerseyMode },
          }).catch(() => undefined);
        for (const [people, fn] of [
          [d.coaches, 'coach'],
          [d.players, 'player'],
        ] as const) {
          for (const p of people) {
            await api(`/admin/members/${p.id}/memberships`, {
              method: 'POST',
              body: { teamId: team.id, function: fn },
            });
          }
        }
        // Eltern mit ihren Kindern verknüpfen (nur wer noch im Kader ist)
        for (const child of d.players) {
          for (const parent of d.parents[child.id] ?? []) {
            await api(`/admin/members/${child.id}/guardians`, {
              method: 'POST',
              body: { guardianPersonId: parent.id },
            }).catch(() => undefined);
          }
        }
        // Training: je Platz und Wochentag eine Serie bis zum Enddatum
        for (const slot of d.trainings) {
          const first = firstWeekday(d.trainFrom, slot.weekday);
          if (first > d.trainTo) continue;
          const startsAt = at(fromIsoDate(first), slot.start, me.club.timezone);
          try {
            await api(`/teams/${team.id}/events`, {
              method: 'POST',
              body: {
                type: 'training',
                startsAt: startsAt.toISOString(),
                endsAt: new Date(startsAt.getTime() + slot.minutes * 60_000).toISOString(),
                facilityId: slot.facilityId,
                repeatUntil: d.trainTo,
                allowConflict: true,
              },
            });
            trainings += countWeekday(first, d.trainTo, slot.weekday);
          } catch {
            // die übrigen Termine werden trotzdem angelegt
          }
        }
      } catch {
        // Mannschaft steht, Rest lässt sich in der Verwaltung ergänzen
      }
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      return { id: team.id, trainings };
    },
    invite: async (teamId) =>
      api<{ url: string }>(`/teams/${teamId}/invite-link`, { method: 'POST' })
        .then((r) => r.url)
        .catch(() => null),
    finish: (id) => router.replace(`/admin/team/${id}`),
  };
  return <TeamWizard backend={backend} />;
}

export function TeamWizard({ backend }: { backend: TeamWizardBackend }) {
  const {
    state: d,
    patch,
    loaded,
    clear,
  } = useWizardDraft(backend.demo ? 'team-wizard-demo-3' : 'team-wizard-3', INITIAL);
  const [step, setStep] = useState(0);
  /** Nach „Ändern“ in der Zusammenfassung geht es von dort aus direkt dorthin zurück */
  const [fromSummary, setFromSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    trainings: number;
    inviteUrl: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const o = backend.overview;
  if (!o || !loaded) return <Loading />;
  const youth = isYouth(d);
  const keys = (d.flow === 'quick' ? QUICK : FULL).filter((k) => k !== 'parents' || youth);
  const key = keys[Math.min(step, keys.length - 1)]!;
  const units = o.orgUnits.filter((u) => u.canManage);
  const unitId =
    d.unitId && units.some((u) => u.id === d.unitId) ? d.unitId : (units[0]?.id ?? null);
  const seasonId = d.seasonId ?? o.current.id;
  const today = todayIso();
  const season = o.current.id === seasonId ? o.current : (o.next ?? o.current);
  const trainFrom = d.trainFrom || today;
  const trainTo = d.trainTo || (season.endsOn > trainFrom ? season.endsOn : trainFrom);
  const christmas = `${Number(today.slice(0, 4)) + (today > `${today.slice(0, 4)}-12-23` ? 1 : 0)}-12-23`;
  const format = d.format ?? defaultLineupSize(d.ageGroup.trim());

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

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await backend.create(
        { ...d, trainFrom, trainTo, trainings: d.trainings },
        unitId,
        seasonId,
      );
      const inviteUrl = await backend.invite(res.id);
      clear();
      setCreated({ id: res.id, trainings: res.trainings, inviteUrl });
    } catch (e) {
      setError(
        e instanceof RequestError ? e.message : 'Die Mannschaft konnte nicht angelegt werden.',
      );
    } finally {
      setBusy(false);
    }
  };

  const shell = {
    step: step + 1,
    total: keys.length,
    onBack: back,
    onNext: next,
    error,
  } as const;
  const aliasCount = d.aliases.split(/[;\n]/).filter((a) => a.trim()).length;
  const unitName = units.find((u) => u.id === unitId)?.name;

  // ── Fertig ───────────────────────────────────────────────────────────────
  if (created) {
    const teamName = d.name.trim() || t('unsere Mannschaft');
    const text = created.inviteUrl
      ? t(
          `Hallo! Wir nutzen Clubroof für ${teamName}: Termine, Zu- und Absagen und alle Infos an einem Ort. Hier kommst du in die Mannschaft: ${created.inviteUrl}`,
        )
      : null;
    return (
      <WizardShell
        title="Mannschaft angelegt"
        explanation={
          created.trainings > 0
            ? t(`Das Wichtigste steht, dazu ${created.trainings} Trainingstermine.`)
            : 'Das Wichtigste steht. Sinnvolle nächste Schritte – alles lässt sich später ändern.'
        }
        nextLabel={backend.demo ? 'Verlassen' : 'Zur Mannschaft'}
        onNext={() => backend.finish(created.id)}
      >
        {backend.demo ? null : (
          <View style={{ gap: 10 }}>
            {text ? (
              <Card style={{ gap: 10 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  Einladungstext zum Weiterschicken
                </T>
                <T verbatim>{text}</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    style={{ flex: 1 }}
                    label={copied ? 'Kopiert' : 'Text kopieren'}
                    icon="copy-outline"
                    variant="outline"
                    onPress={() => void Clipboard.setStringAsync(text).then(() => setCopied(true))}
                  />
                  <Button
                    style={{ flex: 1 }}
                    label="Teilen"
                    icon="share-outline"
                    onPress={() => void Share.share({ message: text })}
                  />
                </View>
              </Card>
            ) : null}
            <ChoiceCard
              icon="people"
              title="Kader aus Datei importieren"
              text="Excel oder CSV mit Spielern und Betreuern"
              selected={false}
              onPress={() => router.replace(`/import?area=roster&teamId=${created.id}`)}
            />
            <ChoiceCard
              icon="cloud-download"
              title="Spielplan importieren"
              text="Aus dem DFBnet oder als Tabelle"
              selected={false}
              onPress={() => router.replace(`/schedule-import?teamId=${created.id}`)}
            />
            {d.modules.includes('team_cash') ? (
              <ChoiceCard
                icon="cash"
                title="Mannschaftskasse einrichten"
                text="Kassenwart, Strafenkatalog, Getränkepreis und Beitrag"
                selected={false}
                onPress={() => router.replace(`/teams/${created.id}/cash-setup`)}
              />
            ) : null}
            <ChoiceCard
              icon="calendar"
              title="Weiteren Termin anlegen"
              text="Mit Treffpunkt und Antwortfrist der Mannschaft"
              selected={false}
              onPress={() => router.replace(`/teams/${created.id}/event-new`)}
            />
          </View>
        )}
      </WizardShell>
    );
  }

  // ── 1 Start ──────────────────────────────────────────────────────────────
  if (key === 'intro')
    return (
      <WizardShell
        {...shell}
        title="Eine Mannschaft anlegen"
        explanation="Eine Mannschaft ist eine Gruppe mit eigenem Kader, eigenen Terminen und eigenen Regeln – zum Beispiel „B-Jugend“ oder „1. Herren“. Alles lässt sich später ändern."
      >
        <ModeChoice value={d.flow} onChange={(flow) => patch({ flow })} />
        <LaterHint where="Verwaltung › Mannschaften" />
      </WizardShell>
    );

  // ── 2 Grunddaten ─────────────────────────────────────────────────────────
  if (key === 'basics')
    return (
      <WizardShell
        {...shell}
        title="Wie heißt die Mannschaft?"
        explanation="Der Name steht in Terminen und Listen, das Kürzel auf den Kacheln."
        nextDisabled={d.name.trim().length < 2 || !d.badge.trim()}
      >
        <View style={{ gap: 12 }}>
          <TextField
            label="Name"
            value={d.name}
            onChangeText={(name) => patch({ name })}
            placeholder={t('z. B. B-Jugend II')}
            maxLength={60}
          />
          <TextField
            label="Kürzel"
            value={d.badge}
            onChangeText={(badge) => patch({ badge })}
            placeholder={t('z. B. B2')}
            maxLength={6}
          />
        </View>
        {d.flow === 'full' ? (
          <WhyBox>
            Der Name erscheint in Mitteilungen und im Spielplan, das Kürzel auf den Kacheln der App.
          </WhyBox>
        ) : null}
      </WizardShell>
    );

  if (key === 'unit')
    return (
      <WizardShell
        {...shell}
        title="Zu welcher Abteilung gehört sie?"
        explanation="Die Abteilung bestimmt, wer die Mannschaft verwalten darf."
        nextDisabled={!unitId}
        hint={o.next ? undefined : 'Die Saison lässt sich später in der Verwaltung wechseln.'}
      >
        <View style={{ gap: 10 }}>
          {units.map((u) => (
            <OptionCard
              key={u.id}
              icon="git-network"
              title={u.name}
              selected={unitId === u.id}
              onPress={() => patch({ unitId: u.id })}
            />
          ))}
          {o.next ? (
            <>
              <T variant="section">Saison</T>
              <ChoiceCard
                icon="calendar"
                title={`${o.current.name} (laufend)`}
                selected={seasonId === o.current.id}
                onPress={() => patch({ seasonId: o.current.id })}
              />
              <ChoiceCard
                icon="calendar-outline"
                title={`${o.next.name} (in Vorbereitung)`}
                selected={seasonId === o.next.id}
                onPress={() => patch({ seasonId: o.next!.id })}
              />
            </>
          ) : null}
        </View>
      </WizardShell>
    );

  if (key === 'age')
    return (
      <WizardShell
        {...shell}
        title="Altersklasse, Spielform und Liga"
        explanation="Alles ist freiwillig. Die Spielform bestimmt das Feld im Aufstellungsplaner."
        onSkip={next}
      >
        <View style={{ gap: 12 }}>
          <TextField
            label="Altersklasse"
            value={d.ageGroup}
            onChangeText={(ageGroup) => patch({ ageGroup })}
            placeholder={t('z. B. U17')}
            maxLength={30}
          />
          <ChoiceChips
            label="Spielform"
            options={[
              { value: '7', label: '7er' },
              { value: '9', label: '9er' },
              { value: '11', label: '11er' },
            ]}
            selected={[String(format)]}
            onToggle={(f) => patch({ format: Number(f) as 7 | 9 | 11 })}
          />
          <T variant="caption">
            {d.format === null
              ? 'Vorgeschlagen nach der Altersklasse – du kannst sie ändern.'
              : 'Das Trainerteam kann die Spielform bei jeder Aufstellung wechseln.'}
          </T>
          <TextField
            label="Liga"
            value={d.league}
            onChangeText={(league) => patch({ league })}
            maxLength={80}
          />
          <TextField
            label="Name im DFBnet (weitere Schreibweisen, mit Semikolon getrennt)"
            value={d.aliases}
            onChangeText={(aliases) => patch({ aliases })}
            placeholder={t('z. B. SV Grün-Weiß B2; SV GW II')}
          />
        </View>
        {d.flow === 'full' ? (
          <WhyBox>
            Mit den Schreibweisen aus dem DFBnet ordnet der Spielplan-Import die Spiele richtig zu.
          </WhyBox>
        ) : null}
        <LaterHint where="Mannschaft bearbeiten" />
      </WizardShell>
    );

  if (key === 'template')
    return (
      <WizardShell
        {...shell}
        title="Welche Vorlage passt?"
        explanation="Die Vorlage schaltet passende Funktionen für die Mannschaft ein."
      >
        <View style={{ gap: 10 }}>
          {(Object.keys(TEAM_TEMPLATE_INFO) as TeamTemplate[]).map((k) => (
            <OptionCard
              key={k}
              icon={TEMPLATE_ICON[k]}
              title={TEAM_TEMPLATE_INFO[k].name}
              text={TEAM_TEMPLATE_INFO[k].description}
              recommended={k === 'classic'}
              selected={d.template === k}
              onPress={() => patch({ template: k })}
            />
          ))}
        </View>
        <LaterHint where="Mannschaft › Module" />
      </WizardShell>
    );

  // ── 3 Zusagen und Fristen ────────────────────────────────────────────────
  if (key === 'responses')
    return (
      <WizardShell
        {...shell}
        title="Wie sagen Spieler zu und ab?"
        explanation="Training und Spiele kannst du getrennt wählen. Wähle, was für die Gruppe am wenigsten Aufwand macht."
      >
        <ResponseKind
          title="Training"
          deadlineLabel="Frist für Zu- und Absagen – Training"
          mode={d.mode}
          onMode={(mode) => patch({ mode })}
          deadline={d.trainingDeadline}
          onDeadline={(trainingDeadline) => patch({ trainingDeadline })}
          allowMaybe={d.allowMaybe}
          full={d.flow === 'full'}
        />
        <ResponseKind
          title="Spiele"
          deadlineLabel="Frist für Zu- und Absagen – Spiele"
          mode={d.matchMode}
          onMode={(matchMode) => patch({ matchMode })}
          deadline={d.matchDeadline}
          onDeadline={(matchDeadline) => patch({ matchDeadline })}
          allowMaybe={d.allowMaybe}
          full={d.flow === 'full'}
        />
        <MoreSettings>
          <HoursStepper
            label="Erinnerung vor der Frist"
            value={d.reminder ?? 24}
            min={0}
            max={168}
            onChange={(reminder) => patch({ reminder })}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ flex: 1, fontWeight: '600' }}>Bei einer Absage ist ein Grund Pflicht</T>
            <Toggle
              label="Grund bei Absage Pflicht"
              value={d.reasonRequired}
              onChange={(reasonRequired) => patch({ reasonRequired })}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ flex: 1, fontWeight: '600' }}>„Unsicher“ als Antwort erlauben</T>
            <Toggle
              label="Unsicher erlauben"
              value={d.allowMaybe}
              onChange={(allowMaybe) => patch({ allowMaybe })}
            />
          </View>
        </MoreSettings>
        {d.flow === 'full' ? (
          <WhyBox>
            Feste Gruppen müssen nicht ständig antworten – „Automatisch zugesagt“ spart Nachfragen
            und zeigt trotzdem, wer fehlt. Bei Spielen ist die aktive Antwort oft sinnvoller, weil
            der Kader begrenzt ist.
          </WhyBox>
        ) : null}
        <LaterHint where="Mannschaft bearbeiten" />
      </WizardShell>
    );

  if (key === 'meeting')
    return (
      <WizardShell
        {...shell}
        title="Treffpunkt und Treffzeit"
        explanation="Der Standard-Treffpunkt und die Minuten vor Beginn werden bei neuen Terminen vorbelegt."
        onSkip={next}
      >
        <View style={{ gap: 14 }}>
          <TextField
            label="Treffpunkt"
            value={d.meetingPoint}
            onChangeText={(meetingPoint) => patch({ meetingPoint })}
            placeholder={t('z. B. Eingang Kabinengang')}
            maxLength={120}
          />
          {backend.places.length > 0 ? (
            <View style={{ gap: 8 }}>
              <T variant="caption">Vorschläge aus eurer Vereinseinrichtung</T>
              <ChoiceChips
                label="Treffpunkt wählen"
                options={backend.places.map((p) => ({ value: p.label, label: p.label }))}
                selected={d.meetingPoint ? [d.meetingPoint] : []}
                onToggle={(meetingPoint) => patch({ meetingPoint })}
              />
            </View>
          ) : null}
          <Card style={{ gap: 16 }}>
            <MinutesRow
              label="Training: Treffen vor Beginn"
              value={d.trainingMeeting}
              onChange={(trainingMeeting) => patch({ trainingMeeting })}
            />
            <MinutesRow
              label="Spiele: Treffen vor Beginn"
              value={d.matchMeeting}
              onChange={(matchMeeting) => patch({ matchMeeting })}
            />
          </Card>
        </View>
        <LaterHint where="Mannschaft bearbeiten" />
      </WizardShell>
    );

  // ── 4 Training ───────────────────────────────────────────────────────────
  if (key === 'training') {
    const total = d.trainings.reduce(
      (n, s) => n + countWeekday(firstWeekday(trainFrom, s.weekday), trainTo, s.weekday),
      0,
    );
    const setSlot = (i: number, p: Partial<TrainingSlot>) =>
      patch({ trainings: d.trainings.map((s, j) => (j === i ? { ...s, ...p } : s)) });
    return (
      <WizardShell
        {...shell}
        title="Wann trainiert die Mannschaft?"
        explanation="Wöchentliche Termine mit Wochentag, Zeit und Platz. Sie werden beim Anlegen als Serie erzeugt."
        onSkip={next}
        nextDisabled={d.trainings.length > 0 && trainTo < trainFrom}
      >
        {d.trainings.map((s, i) => (
          <Card key={i} style={{ gap: 12 }}>
            <ChoiceChips
              label="Wochentag"
              options={WEEKDAYS.map((w) => ({ value: String(w.value), label: w.label }))}
              selected={[String(s.weekday)]}
              onToggle={(weekday) => setSlot(i, { weekday: Number(weekday) })}
            />
            <TimeStepper
              label="Beginn"
              value={s.start}
              onChange={(start) => setSlot(i, { start })}
            />
            <ChoiceChips
              label="Dauer"
              options={[60, 75, 90, 120].map((m) => ({ value: String(m), label: t(`${m} Min.`) }))}
              selected={[String(s.minutes)]}
              onToggle={(minutes) => setSlot(i, { minutes: Number(minutes) })}
            />
            {backend.facilities.length > 0 ? (
              <ChoiceChips
                label="Platz"
                options={backend.facilities.map((f) => ({ value: f.id, label: f.name }))}
                selected={s.facilityId ? [s.facilityId] : []}
                onToggle={(id) => setSlot(i, { facilityId: s.facilityId === id ? null : id })}
              />
            ) : null}
            <Button
              label="Termin entfernen"
              icon="trash-outline"
              variant="tonal"
              size="sm"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => patch({ trainings: d.trainings.filter((_, j) => j !== i) })}
            />
          </Card>
        ))}
        <Button
          label={
            d.trainings.length === 0 ? 'Trainingstermin hinzufügen' : 'Weiteren Termin hinzufügen'
          }
          icon="add"
          variant="outline"
          onPress={() =>
            patch({
              trainings: [
                ...d.trainings,
                {
                  weekday: 2,
                  start: '18:00',
                  minutes: 90,
                  facilityId: backend.facilities[0]?.id ?? null,
                },
              ],
              trainFrom,
              trainTo,
            })
          }
        />
        {d.trainings.length > 0 ? (
          <>
            <T variant="section">Zeitraum</T>
            <DateRangeField
              from={trainFrom}
              to={trainTo}
              min={today}
              onChange={(a, b) => patch({ trainFrom: a, trainTo: b })}
              presets={[
                { label: 'Saison', from: today, to: season.endsOn > today ? season.endsOn : today },
                { label: 'Bis Weihnachten', from: today, to: christmas },
              ]}
            />
            <Chip tone="primary" icon="calendar" label={t(`${total} Trainingstermine`)} />
          </>
        ) : null}
        {d.flow === 'full' ? (
          <WhyBox>
            Mit festen Trainingszeiten stehen die Termine sofort im Kalender, und Zu- und Absagen
            funktionieren ab dem ersten Tag.
          </WhyBox>
        ) : null}
        <LaterHint where="Termine › Neuer Termin" />
      </WizardShell>
    );
  }

  if (key === 'coaches')
    return (
      <WizardShell
        {...shell}
        title="Wer trainiert die Mannschaft?"
        explanation="Trainer sehen Kader und Rückmeldungen und können Termine anlegen. Co-Trainer haben dieselben Rechte."
        onSkip={next}
      >
        <PersonPicker
          search={backend.search}
          demo={backend.demo}
          selected={d.coaches}
          exclude={d.players}
          onChange={(coaches) => patch({ coaches })}
        />
      </WizardShell>
    );

  if (key === 'squad')
    return (
      <WizardShell
        {...shell}
        title="Wer spielt in der Mannschaft?"
        explanation="Suche Mitglieder und füge sie dem Kader hinzu. Weitere kannst du später einladen oder aus einer Datei importieren."
        onSkip={next}
        hint="Neue Personen legt die Mitgliederverwaltung an; Rückennummern und Positionen ergänzt du unter Mannschaft bearbeiten."
      >
        <PersonPicker
          search={backend.search}
          demo={backend.demo}
          selected={d.players}
          exclude={d.coaches}
          onChange={(players) => patch({ players })}
        />
      </WizardShell>
    );

  // ── 5 Funktionen und Sichtbarkeit ────────────────────────────────────────
  if (key === 'features')
    return (
      <WizardShell
        {...shell}
        title="Funktionen"
        explanation="Schalte ein, was die Mannschaft nutzt."
        onSkip={next}
      >
        <View style={{ gap: 10 }}>
          {FEATURES.map((f) => (
            <ChoiceCard
              key={f.key}
              icon={f.icon}
              title={f.title}
              text={f.text}
              multi
              selected={d.modules.includes(f.key)}
              onPress={() =>
                patch({
                  modules: d.modules.includes(f.key)
                    ? d.modules.filter((m) => m !== f.key)
                    : [...d.modules, f.key],
                })
              }
            />
          ))}
        </View>
        <Card style={{ gap: 10 }}>
          <ChoiceChips
            label="Rückennummern"
            options={[
              { value: 'off', label: 'Aus' },
              { value: 'match', label: 'Je Spiel' },
              { value: 'season', label: 'Fest' },
            ]}
            selected={[d.jerseyMode]}
            onToggle={(jerseyMode) => patch({ jerseyMode: jerseyMode as Draft['jerseyMode'] })}
          />
          <T variant="caption">
            Je Spiel: die Nummer wird bei jeder Aufstellung neu vergeben. Fest: eine Nummer pro
            Spieler für die ganze Saison.
          </T>
        </Card>
        <LaterHint where="Mannschaft › Module" />
      </WizardShell>
    );

  if (key === 'parents') {
    const setParents = (childId: string, list: Person[]) =>
      patch({ parents: { ...d.parents, [childId]: list } });
    return (
      <WizardShell
        {...shell}
        title="Eltern und Kinder"
        explanation="Eltern, die mit ihrem Kind verknüpft sind, antworten für das Kind und sehen dessen Termine. Ohne Verknüpfung sagt niemand für das Kind zu."
        onSkip={next}
        hint="Später nachholbar: Mitglieder › Person › Eltern. Bis dahin antworten Eltern noch nicht für das Kind."
      >
        {d.players.length === 0 ? (
          <T variant="caption">Noch keine Spieler im Kader – hier gibt es nichts zu verknüpfen.</T>
        ) : (
          d.players.map((child) => (
            <Card key={child.id} style={{ gap: 10 }}>
              <T variant="label" style={{ fontWeight: '700' }}>
                {child.name}
              </T>
              <PersonPicker
                search={backend.search}
                demo={backend.demo}
                selected={d.parents[child.id] ?? []}
                exclude={[...d.players, ...d.coaches]}
                onChange={(list) => setParents(child.id, list)}
              />
            </Card>
          ))
        )}
        <LaterHint where="Mitglieder › Person › Eltern" />
      </WizardShell>
    );
  }

  if (key === 'privacy')
    return (
      <WizardShell
        {...shell}
        title="Wer sieht was?"
        explanation="Datensparsam voreingestellt: Gründe und Beteiligung sieht nur das Trainerteam."
        onSkip={next}
      >
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ flex: 1, fontWeight: '600' }}>
              Zu- und Absage-Übersicht für Spieler und Eltern sichtbar
            </T>
            <Toggle
              label="Zu- und Absage-Übersicht sichtbar"
              value={d.responsesVisible}
              onChange={(responsesVisible) => patch({ responsesVisible })}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ flex: 1, fontWeight: '600' }}>
              Aufstellung für Spieler und Eltern sichtbar
            </T>
            <Toggle
              label="Aufstellung sichtbar"
              value={d.lineupVisible}
              onChange={(lineupVisible) => patch({ lineupVisible })}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T style={{ flex: 1, fontWeight: '600' }}>
              Abwesenheitsgründe für die ganze Mannschaft sichtbar
            </T>
            <Toggle
              label="Abwesenheitsgründe für die Mannschaft sichtbar"
              value={d.absenceTeam}
              onChange={(absenceTeam) => patch({ absenceTeam })}
            />
          </View>
        </Card>
        <ChoiceChips
          label="Trainingsbeteiligung (Quoten)"
          options={[
            { value: 'staff', label: 'Nur Trainerteam' },
            { value: 'count', label: 'Nur Anzahl' },
            { value: 'named', label: 'Mit Namen' },
          ]}
          selected={[d.attendance]}
          onToggle={(attendance) => patch({ attendance: attendance as AttendanceVisibility })}
        />
        {d.flow === 'full' ? (
          <WhyBox>
            Abwesenheitsgründe können Gesundheit oder Familie betreffen. Standard ist deshalb: nur
            das Trainerteam sieht sie. Die Beteiligung zeigt, wer wie oft kommt.
          </WhyBox>
        ) : null}
        <LaterHint where="Mannschaft bearbeiten" />
      </WizardShell>
    );

  if (key === 'schedule')
    return (
      <WizardShell
        {...shell}
        title="Spielplan"
        explanation="Spiele kommen später dazu – drei Wege stehen nach dem Anlegen bereit."
        onSkip={next}
      >
        <View style={{ gap: 10 }}>
          <ChoiceCard
            icon="cloud-download"
            title="Import aus dem DFBnet"
            text="Alle Spiele der Saison auf einmal"
            selected={false}
            onPress={next}
          />
          <ChoiceCard
            icon="grid"
            title="Als Tabelle (Excel oder CSV)"
            text="Verwaltung › Importieren › Termine einer Mannschaft"
            selected={false}
            onPress={next}
          />
          <ChoiceCard
            icon="create"
            title="Von Hand"
            text="Einzelne Spiele unter Termine anlegen"
            selected={false}
            onPress={next}
          />
        </View>
        <T variant="caption">Auf der letzten Seite findest du die passenden Schaltflächen.</T>
      </WizardShell>
    );

  if (key === 'info')
    return (
      <WizardShell
        {...shell}
        title="Information für Eltern und Spieler"
        explanation="Ein kurzer Willkommenstext erscheint im Team-Tab – zum Beispiel zu Kleidung, Treffpunkten und Regeln."
        onSkip={next}
      >
        <TextField
          label="Willkommenstext"
          value={d.welcome}
          onChangeText={(welcome) => patch({ welcome })}
          multiline
          maxLength={1500}
          placeholder={t(
            'z. B. Bitte 15 Minuten vor Beginn da sein, Schienbeinschoner nicht vergessen.',
          )}
        />
        <LaterHint where="Mannschaft bearbeiten" />
      </WizardShell>
    );

  // ── Zusammenfassung ──────────────────────────────────────────────────────
  const modeLabelOf = (m: ParticipationMode) =>
    PARTICIPATION_OPTIONS.find((p) => p.value === m)?.label ?? '';
  const weekdayLabel = (n: number) => WEEKDAYS.find((w) => w.value === n)?.label ?? '';
  const rows: { label: string; value: string; key: StepKey }[] = [
    {
      label: 'Mannschaft',
      value: [d.name.trim(), d.badge.trim(), unitName].filter(Boolean).join(' · '),
      key: 'basics',
    },
    {
      label: 'Altersklasse und Liga',
      value: [d.ageGroup.trim(), t(`${format}er`), d.league.trim()].filter(Boolean).join(' · '),
      key: 'age',
    },
    {
      label: 'Zu- und Absagen',
      value: [
        `${t('Training')}: ${t(modeLabelOf(d.mode))}`,
        t(`Frist ${d.trainingDeadline} Std.`),
        `${t('Spiele')}: ${t(modeLabelOf(d.matchMode))}`,
        t(`Frist ${d.matchDeadline} Std.`),
      ].join(' · '),
      key: 'responses',
    },
    {
      label: 'Training',
      value:
        d.trainings.length === 0
          ? ''
          : d.trainings.map((s) => `${weekdayLabel(s.weekday)} ${s.start}`).join(' · '),
      key: 'training',
    },
    {
      label: 'Trainerteam und Kader',
      value: [t(`Trainer: ${d.coaches.length}`), t(`Kader: ${d.players.length}`)].join(' · '),
      key: 'coaches',
    },
  ];
  if (youth)
    rows.push({
      label: 'Eltern und Kinder',
      value: t(
        `${Object.values(d.parents).filter((l) => l.length > 0).length} von ${d.players.length} Kindern verknüpft`,
      ),
      key: 'parents',
    });
  rows.push({
    label: 'Wer sieht was?',
    value: [
      d.responsesVisible ? t('Zu-/Absagen sichtbar') : t('Zu-/Absagen nur Trainerteam'),
      d.absenceTeam ? t('Gründe für alle') : t('Gründe nur Trainerteam'),
    ].join(' · '),
    key: 'privacy',
  });
  if (d.flow === 'full')
    rows.push(
      {
        label: 'Funktionen',
        value: FEATURES.filter((f) => d.modules.includes(f.key))
          .map((f) => t(f.title))
          .join(' · '),
        key: 'features',
      },
      { label: 'Treffpunkt', value: d.meetingPoint.trim(), key: 'meeting' },
      { label: 'Information', value: d.welcome.trim().slice(0, 80), key: 'info' },
    );
  return (
    <WizardShell
      {...shell}
      title="Alles bereit?"
      explanation="Prüfe die Angaben. Mit „Ändern“ springst du in den Schritt. Erst jetzt wird die Mannschaft angelegt."
      nextLabel="Mannschaft anlegen"
      onNext={() => void create()}
      busy={busy}
    >
      <SummaryList rows={rows.map((r) => ({ ...r, onEdit: () => goKey(r.key) }))} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip tone="primary" label={TEAM_TEMPLATE_INFO[d.template].name} />
        {aliasCount > 0 ? <Chip tone="neutral" label={t(`DFBnet-Namen: ${aliasCount}`)} /> : null}
      </View>
      <RuleList
        rules={[
          'Nach dem Anlegen bekommst du einen fertigen Einladungstext zum Weiterschicken.',
          'Alle Angaben lassen sich später unter „Mannschaft bearbeiten“ ändern.',
        ]}
      />
    </WizardShell>
  );
}

/** Karte „Training“ bzw. „Spiele“: Teilnahme-Modell (Standard automatisch zugesagt, empfohlen), Frist, Vorschau */
function ResponseKind({
  title,
  deadlineLabel,
  mode,
  onMode,
  deadline,
  onDeadline,
  allowMaybe,
  full,
}: {
  title: string;
  deadlineLabel: string;
  mode: ParticipationMode;
  onMode: (m: ParticipationMode) => void;
  deadline: number;
  onDeadline: (h: number) => void;
  allowMaybe: boolean;
  full: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <T variant="section">{title}</T>
      {PARTICIPATION_OPTIONS.map((p) => (
        <OptionCard
          key={p.value}
          icon={MODE_ICON[p.value]}
          title={p.label}
          text={MODE_TEXT[p.value]}
          example={full ? MODE_EXAMPLE[p.value] : undefined}
          recommended={p.value === 'auto_accept'}
          selected={mode === p.value}
          onPress={() => onMode(p.value)}
        />
      ))}
      <Card style={{ gap: 12 }}>
        <HoursStepper
          label={deadlineLabel}
          value={deadline}
          onChange={onDeadline}
        />
        <T variant="caption">
          {mode === 'auto_accept'
            ? 'Bis dahin kann abgesagt werden; danach gilt die Zusage.'
            : 'Bis dahin kann zu- oder abgesagt werden; danach wendet sich der Spieler ans Trainerteam.'}
        </T>
        <T variant="label" style={{ fontWeight: '700' }}>
          So sieht es für Spieler aus
        </T>
        <View pointerEvents="none">
          <AnswerButtons
            variant="segment"
            status={mode === 'auto_accept' ? 'yes' : null}
            allowMaybe={allowMaybe}
            onYes={() => undefined}
            onMaybe={() => undefined}
            onNo={() => undefined}
          />
        </View>
      </Card>
    </View>
  );
}

function MinutesRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return value === null ? (
    <View style={{ gap: 8 }}>
      <T variant="label" style={{ fontWeight: '700' }}>
        {label}
      </T>
      <Button label="Treffzeit festlegen" variant="outline" onPress={() => onChange(30)} />
    </View>
  ) : (
    <View style={{ gap: 8 }}>
      <NumberStepper label={label} value={value} min={0} max={300} onChange={onChange} />
      <Button label="Kein automatisches Treffen" variant="tonal" onPress={() => onChange(null)} />
    </View>
  );
}

/** Mitglieder suchen und auswählen (noch ohne Mannschaft – gespeichert wird erst am Ende). */
export function PersonPicker({
  selected,
  exclude,
  onChange,
  search,
  demo,
}: {
  search: (term: string) => Promise<MemberListItem[]>;
  demo?: boolean;
  selected: Person[];
  exclude: Person[];
  onChange: (p: Person[]) => void;
}) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const results = useQuery({
    queryKey: ['admin', 'members', 'wizard', demo ? 'demo' : 'live', term],
    queryFn: () => search(term),
    enabled: term.length >= 2,
  });
  const taken = new Set([...selected, ...exclude].map((p) => p.id));
  const hits = (results.data ?? []).filter((m) => !taken.has(m.id)).slice(0, 8);
  return (
    <View style={{ gap: 12 }}>
      <TextField
        label="Mitglied suchen"
        value={q}
        onChangeText={setQ}
        placeholder={t('Name oder Mitgliedsnummer')}
      />
      {hits.map((m) => (
        <ChoiceCard
          key={m.id}
          icon="person-add"
          title={`${m.firstName} ${m.lastName}`}
          text={m.memberNumber ?? undefined}
          selected={false}
          onPress={() => {
            onChange([...selected, { id: m.id, name: `${m.firstName} ${m.lastName}` }]);
            setQ('');
          }}
        />
      ))}
      {selected.length > 0 ? (
        <T variant="section">{`${t('Ausgewählt')} (${selected.length})`}</T>
      ) : null}
      {selected.map((p) => (
        <ChoiceCard
          key={p.id}
          icon="person"
          title={p.name}
          selected
          multi
          onPress={() => onChange(selected.filter((s) => s.id !== p.id))}
        />
      ))}
    </View>
  );
}
