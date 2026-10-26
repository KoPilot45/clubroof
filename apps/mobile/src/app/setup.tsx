import {
  MODULES,
  defaultClubCode,
  normalizeClubCode,
  type ClubColorKey,
  type LoginResponse,
  type PitchSurface,
  type SetupInput,
  type UploadedImage,
} from '@clubroof/core';
import { Ionicons } from '@/components/icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { ClubroofLogo } from '@/components/brand-header';
import { ClubColorPicker } from '@/components/club-color';
import {
  ChoiceCard,
  LaterHint,
  ModeChoice,
  NumberStepper,
  OptionCard,
  RuleList,
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
  Crest,
  T,
  TextField,
  type IconName,
} from '@/components/ui';
import { request, RequestError } from '@/lib/api';
import { clubInitials } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { pickFile, type PickedFile } from '@/lib/upload';

type StepKey =
  | 'welcome'
  | 'size'
  | 'name'
  | 'details'
  | 'venue'
  | 'rooms'
  | 'surface'
  | 'logo'
  | 'color'
  | 'units'
  | 'season'
  | 'board'
  | 'team-modules'
  | 'club-modules'
  | 'members'
  | 'comms'
  | 'account'
  | 'password'
  | 'security'
  | 'summary';

/** Ausführlich: alle Schritte (Paket E2); Schnellstart: nur das Nötigste, Empfehlungen sind vorbelegt. */
const FULL: StepKey[] = [
  'welcome',
  'size',
  'name',
  'details',
  'venue',
  'rooms',
  'surface',
  'logo',
  'color',
  'units',
  'season',
  'board',
  'team-modules',
  'club-modules',
  'members',
  'comms',
  'account',
  'password',
  'security',
  'summary',
];
const QUICK: StepKey[] = [
  'welcome',
  'name',
  'venue',
  'rooms',
  'surface',
  'logo',
  'color',
  'units',
  'account',
  'password',
  'security',
  'summary',
];

/** Aufgaben im Vorstand: Rolle der App, Beschriftung und Abteilung, in der die Rolle gilt */
const BOARD_ROLES: { key: string; role: string; label: string; unit?: 'youth' }[] = [
  { key: 'chair', role: 'board', label: 'Vorsitzende' },
  { key: 'youth', role: 'youth_director', label: 'Jugendleitung', unit: 'youth' },
  { key: 'treasurer', role: 'club_treasurer', label: 'Kassenwart' },
  { key: 'secretary', role: 'member_admin', label: 'Schriftführer' },
  { key: 'groundskeeper', role: 'facility_manager', label: 'Platzwart' },
  { key: 'auditor', role: 'cash_auditor', label: 'Kassenprüfer' },
];
type BoardEntry = { name: string; email: string };

const SEASON_STARTS: { value: string; label: string; text: string }[] = [
  { value: '7', label: 'Juli', text: '1. Juli bis 30. Juni – üblich im Fußball' },
  { value: '8', label: 'August', text: '1. August bis 31. Juli' },
  { value: '9', label: 'September', text: '1. September bis 31. August' },
  { value: '1', label: 'Januar', text: 'Kalenderjahr, 1. Januar bis 31. Dezember' },
];
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'Europe/Berlin', label: 'Deutschland' },
  { value: 'Europe/Vienna', label: 'Österreich' },
  { value: 'Europe/Zurich', label: 'Schweiz' },
];
const VISIBILITIES: {
  value: 'club' | 'team_and_coaches' | 'coaches_only';
  label: string;
  text: string;
}[] = [
  {
    value: 'club',
    label: 'Alle im Verein',
    text: 'Name, E-Mail und Telefon sind im ganzen Verein sichtbar',
  },
  {
    value: 'team_and_coaches',
    label: 'Mannschaft und Trainer',
    text: 'Sichtbar für die eigene Mannschaft und alle Trainer',
  },
  { value: 'coaches_only', label: 'Nur Trainer', text: 'Nur das Trainerteam sieht Kontaktdaten' },
];

const SURFACES: { value: PitchSurface; label: string }[] = [
  { value: 'grass', label: 'Rasen' },
  { value: 'artificial', label: 'Kunstrasen' },
  { value: 'hard', label: 'Hartplatz' },
];

/** Optionale Module in den zwei Auswahlschritten; Kernmodule sind immer an. */
const TEAM_MODULES = [
  'squad',
  'statistics',
  'team_cash',
  'team_tasks',
  'jersey_numbers',
  'parent_access',
  'training_planning',
  'guest_players',
];
const CLUB_MODULES = [
  'club_cash',
  'sponsors',
  'polls',
  'club_events',
  'helpers',
  'documents',
  'facility_booking',
  'player_exchange',
  'forum',
  'calendar_export',
  'lost_and_found',
  'equipment',
  'referees',
  'marketplace',
  'wiki',
];
const RECOMMENDED = new Set([
  'squad',
  'statistics',
  'team_cash',
  'team_tasks',
  'parent_access',
  'polls',
  'club_events',
  'helpers',
  'documents',
  'calendar_export',
]);
const MODULE_ICON: Record<string, IconName> = {
  club_cash: 'wallet',
  sponsors: 'heart',
  squad: 'people',
  guest_players: 'swap-horizontal',
  statistics: 'bar-chart',
  team_cash: 'wallet',
  team_tasks: 'checkbox',
  jersey_numbers: 'shirt',
  parent_access: 'happy',
  training_planning: 'library',
  polls: 'stats-chart',
  club_events: 'balloon',
  helpers: 'hand-left',
  documents: 'document-text',
  facility_booking: 'calendar-number',
  player_exchange: 'repeat',
  forum: 'chatbubbles',
  calendar_export: 'calendar',
  lost_and_found: 'search',
  equipment: 'construct',
  referees: 'flag',
  marketplace: 'pricetags',
  wiki: 'book',
};

type VenueDraft = {
  name: string;
  address: string;
  pitches: number;
  rooms: number;
  surfaces: PitchSurface[];
};
const emptyVenue = (): VenueDraft => ({
  name: '',
  address: '',
  pitches: 1,
  rooms: 2,
  surfaces: ['grass'],
});

type Draft = {
  step: number;
  flow: SetupMode;
  /** Größe des Vereins vorbelegt Aufbau und Funktionen (optional) */
  size: 'single' | 'several' | 'large' | null;
  name: string;
  shortName: string;
  /** Kürzel; leer = Vorgabe aus den Initialen des Kurznamens */
  code: string;
  venues: VenueDraft[];
  color: ClubColorKey;
  colorMode: 'light' | 'dark' | 'system';
  orgMode: 'single' | 'split';
  modules: string[];
  foundedYear: string;
  street: string;
  postalCode: string;
  city: string;
  clubEmail: string;
  clubPhone: string;
  website: string;
  timezone: string;
  seasonStartMonth: string;
  board: Record<string, BoardEntry>;
  /** Daten, die nach der Einrichtung übernommen werden sollen (Paket IMPORT-EXPORT, Stufe 5) */
  importPlan: ('members' | 'roster' | 'events' | 'fees' | 'invite')[];
  contactVisibility: 'club' | 'team_and_coaches' | 'coaches_only';
  firstName: string;
  lastName: string;
  email: string;
};
const INITIAL: Draft = {
  step: 0,
  flow: 'quick',
  size: null,
  name: '',
  shortName: '',
  code: '',
  venues: [emptyVenue()],
  color: 'green',
  colorMode: 'system',
  orgMode: 'split',
  modules: [...RECOMMENDED],
  foundedYear: '',
  street: '',
  postalCode: '',
  city: '',
  clubEmail: '',
  clubPhone: '',
  website: '',
  timezone: 'Europe/Berlin',
  seasonStartMonth: '7',
  board: {},
  importPlan: [],
  contactVisibility: 'team_and_coaches',
  firstName: '',
  lastName: '',
  email: '',
};

/**
 * Vereinseinrichtung (Paket E): einmaliger Assistent in Clubroof-Farben auf einem leeren Server. Der Zwischenstand
 * bleibt auf dem Gerät; angelegt wird erst am Ende – ein Abbruch hinterlässt nichts Halbes. Alles ist später in der
 * Verwaltung änderbar.
 */
export default function SetupScreen() {
  return <SetupWizard />;
}

/** `demo`: Vorführung ohne Server und ohne Speichern (Demo-Zugänge der Anmeldeseite). */
export function SetupWizard({ demo }: { demo?: boolean }) {
  // Clubroof-Farben (Blau) während der Einrichtung; die Vereinsfarbe zeigt nur der Farbschritt als Vorschau
  return (
    <ThemeProvider clubColor="clubroof">
      <Wizard demo={demo} />
    </ThemeProvider>
  );
}

function strength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ['zu kurz', 'schwach', 'ok', 'gut', 'stark'][score]! };
}

function Wizard({ demo }: { demo?: boolean }) {
  const { adopt } = useSession();
  const { colors } = useTheme();
  const {
    state: d,
    patch,
    loaded,
    clear,
  } = useWizardDraft<Draft>(demo ? 'setupDraftDemo2' : 'setupDraft2', INITIAL);
  // Geheimnisse und Dateien bleiben im Speicher und nie im Entwurf
  const [token, setToken] = useState(demo ? 'demo' : '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [proof, setProof] = useState<{ email: string; value: string } | null>(null);
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [invited, setInvited] = useState(0);
  /** Nach „Ändern“ in der Zusammenfassung geht es von dort aus direkt dorthin zurück */
  const [fromSummary, setFromSummary] = useState(false);

  const venues = d.venues;
  const setVenue = (i: number, p: Partial<VenueDraft>) =>
    patch({ venues: venues.map((v, j) => (j === i ? { ...v, ...p } : v)) });
  const hasPitches = venues.some((v) => v.pitches > 0);
  const verified = proof?.email === d.email.trim().toLowerCase() && !!proof;
  const pw = strength(password);
  const toggleModule = (key: string) =>
    patch({
      modules: d.modules.includes(key) ? d.modules.filter((k) => k !== key) : [...d.modules, key],
    });

  // Ohne Plätze entfällt der Untergrund
  const keys = (d.flow === 'quick' ? QUICK : FULL).filter((k) => k !== 'surface' || hasPitches);
  const step = Math.min(d.step, keys.length - 1);
  const key = keys[step]!;
  const summaryAt = keys.indexOf('summary');
  const go = (n: number) => {
    setError(null);
    patch({ step: n });
  };
  const goKey = (k: StepKey) => {
    setFromSummary(true);
    go(keys.indexOf(k));
  };
  const next = () => (fromSummary ? (setFromSummary(false), go(summaryAt)) : go(step + 1));
  const back = () =>
    fromSummary ? (setFromSummary(false), go(summaryAt)) : go(Math.max(0, step - 1));

  const call = async (fn: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    call(async () => {
      if (demo) {
        setCodeSent(true);
        return;
      }
      await request('/setup/email-code', {
        method: 'POST',
        body: { setupToken: token.trim(), email: d.email.trim() },
      });
      setCodeSent(true);
    }, 'Der Code konnte nicht gesendet werden.');
  const verifyCode = () =>
    call(async () => {
      if (demo) {
        setProof({ email: d.email.trim().toLowerCase(), value: 'demo' });
        return;
      }
      const res = await request<{ proof: string }>('/setup/email-code/verify', {
        method: 'POST',
        body: { email: d.email.trim(), code: code.trim() },
      });
      setProof({ email: d.email.trim().toLowerCase(), value: res.proof });
    }, 'Der Code konnte nicht geprüft werden.');

  /** Vorstand einladen: Person anlegen, Rolle vergeben, Einladung senden – Fehler einzelner Einträge stoppen nichts */
  const inviteBoard = async (accessToken: string): Promise<number> => {
    let ok = 0;
    let youthUnit: string | null = null;
    try {
      const overview = await request<{ orgUnits: { id: string; name: string }[] }>('/admin/teams', {
        token: accessToken,
      });
      youthUnit = overview.orgUnits.find((u) => u.name === 'Jugend')?.id ?? null;
    } catch {
      // Jugendleitung gilt dann im ganzen Verein
    }
    for (const r of BOARD_ROLES) {
      const entry = d.board[r.key];
      if (!entry?.name.trim() || !entry.email.includes('@')) continue;
      const parts = entry.name.trim().split(/\s+/);
      const lastName = parts.length > 1 ? parts.pop()! : parts[0]!;
      const firstName = parts.length ? parts.join(' ') : '–';
      try {
        const person = await request<{ id: string }>('/admin/members', {
          method: 'POST',
          token: accessToken,
          body: { firstName, lastName, email: entry.email.trim() },
        });
        await request(`/admin/members/${person.id}/roles`, {
          method: 'POST',
          token: accessToken,
          body:
            r.unit === 'youth' && youthUnit
              ? { roleKey: r.role, scopeType: 'org_unit', scopeId: youthUnit }
              : { roleKey: r.role, scopeType: 'club' },
        });
        await request('/invitations/person', {
          method: 'POST',
          token: accessToken,
          body: { personId: person.id, email: entry.email.trim(), send: true },
        });
        ok++;
      } catch {
        // später unter Verwaltung › Rollen & Aufgaben nachholen
      }
    }
    return ok;
  };

  const finish = () =>
    call(async () => {
      if (demo) {
        clear();
        setPassword('');
        setPassword2('');
        setDone(true);
        return;
      }
      const text = (v: string) => v.trim() || null;
      const body: SetupInput = {
        setupToken: token.trim(),
        emailProof: proof!.value,
        club: {
          name: d.name.trim(),
          shortName: d.shortName.trim(),
          shortCode: d.code || defaultClubCode(d.shortName.trim()),
          colorTheme: d.color,
          colorMode: d.colorMode,
          foundedYear: d.foundedYear ? Number(d.foundedYear) : null,
          street: text(d.street),
          postalCode: text(d.postalCode),
          city: text(d.city),
          email: text(d.clubEmail),
          phone: text(d.clubPhone),
          website: text(d.website),
          timezone: d.timezone,
          seasonStartMonth: Number(d.seasonStartMonth),
          defaultContactVisibility: d.contactVisibility,
        },
        orgUnits:
          d.orgMode === 'split'
            ? [
                { name: 'Senioren', kind: 'seniors' },
                { name: 'Jugend', kind: 'youth' },
              ]
            : [{ name: 'Mannschaften', kind: 'other' }],
        venues: venues
          .filter((v) => v.name.trim())
          .map((v) => ({
            name: v.name.trim(),
            address: v.address.trim() || null,
            pitches: Array.from({ length: v.pitches }, (_, i) => ({
              name: `Platz ${i + 1}`,
              surface: v.surfaces[i] ?? 'grass',
            })),
            changingRooms: Array.from({ length: v.rooms }, (_, i) => `Kabine ${i + 1}`),
          })),
        modules: d.modules,
        admin: {
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          email: d.email.trim(),
          password,
        },
      };
      const login = await request<LoginResponse>('/setup', { method: 'POST', body });
      // Logo nach dem Anlegen hochladen (braucht die neue Anmeldung); misslingt es, bleibt das Wappen
      if (logo) {
        try {
          const image = await request<UploadedImage>('/media', {
            method: 'POST',
            token: login.token,
            body: { purpose: 'logo', fileName: logo.name, dataBase64: logo.dataBase64 },
          });
          await request('/club/logo', {
            method: 'PUT',
            token: login.token,
            body: { imageId: image.id },
          });
        } catch {
          // später unter Verwaltung › Verein & Design nachholen
        }
      }
      setInvited(await inviteBoard(login.token));
      clear();
      setPassword('');
      setPassword2('');
      await adopt(login);
      setDone(true);
    }, 'Die Einrichtung hat nicht geklappt.');

  if (!loaded) return null;

  // ── Fertig ───────────────────────────────────────────────────────────────
  if (done)
    return (
      <WizardShell
        title="Dein Verein ist eingerichtet"
        explanation={
          invited > 0
            ? t(
                `Das Wichtigste steht, ${invited} Einladungen sind unterwegs. Hier sind sinnvolle nächste Schritte – alles lässt sich später in der Verwaltung ändern.`,
              )
            : 'Das Wichtigste steht. Hier sind sinnvolle nächste Schritte – alles lässt sich später in der Verwaltung ändern.'
        }
        nextLabel={demo ? 'Verlassen' : 'Zur App'}
        onNext={() => router.replace(demo ? '/login' : '/')}
        header={
          <View style={{ alignItems: 'center' }}>
            <Crest initials={clubInitials(d.shortName)} size={72} />
          </View>
        }
      >
        {demo ? null : (
          <View style={{ gap: 10 }}>
            {d.modules.includes('club_cash') ? (
              <ChoiceCard
                icon="wallet"
                title="Vereinskasse einrichten"
                text="Konten, Beitragsarten und Haushaltsplan"
                selected={false}
                onPress={() => router.replace('/club-cash')}
              />
            ) : null}
            <ChoiceCard
              icon="shirt"
              title="Erste Mannschaft anlegen"
              text="Mit Trainerteam, Kader und Antwortfristen"
              selected={false}
              onPress={() => router.replace('/admin/team-new')}
            />
            <ChoiceCard
              icon="people"
              title="Mitglieder importieren"
              text="Aus Excel oder CSV, mit Vorlage zum Herunterladen"
              badge={d.importPlan.includes('members') ? 'Geplant' : undefined}
              selected={false}
              onPress={() => router.replace('/admin/import')}
            />
            <ChoiceCard
              icon="shirt"
              title="Kader importieren"
              text="Spieler und Betreuer je Mannschaft, nach dem Anlegen der Mannschaften"
              badge={d.importPlan.includes('roster') ? 'Geplant' : undefined}
              selected={false}
              onPress={() => router.replace('/import?area=roster')}
            />
            <ChoiceCard
              icon="calendar"
              title="Spielplan und Termine importieren"
              text="Aus Excel oder CSV; DFBnet-Dateien gehen über „Spielplan importieren“"
              badge={d.importPlan.includes('events') ? 'Geplant' : undefined}
              selected={false}
              onPress={() => router.replace('/import?area=events')}
            />
            {d.modules.includes('club_cash') ? (
              <ChoiceCard
                icon="wallet"
                title="Beiträge und Buchungen importieren"
                text="Beitragsarten, Zuordnung, offene Posten, Haushaltsplan und Buchungen"
                badge={d.importPlan.includes('fees') ? 'Geplant' : undefined}
                selected={false}
                onPress={() => router.replace('/import?area=fee_types')}
              />
            ) : null}
            <ChoiceCard
              icon="cloud-download"
              title="Spielplan aus dem DFBnet"
              text="DFBnet-Export einlesen"
              selected={false}
              onPress={() => router.replace('/schedule-import')}
            />
            <ChoiceCard
              icon="person-add"
              title="Personen einladen"
              text="Link oder QR-Code teilen"
              badge={d.importPlan.includes('invite') ? 'Geplant' : undefined}
              selected={false}
              onPress={() => router.replace('/admin/invites')}
            />
          </View>
        )}
      </WizardShell>
    );

  const shell = {
    step: step + 1,
    total: keys.length,
    onBack: back,
    onNext: next,
    error,
  } as const;

  // ── Willkommen ───────────────────────────────────────────────────────────
  if (key === 'welcome')
    return (
      <WizardShell
        title="Willkommen bei Clubroof"
        explanation="In wenigen Minuten richtest du deinen Verein ein. Du kannst jederzeit zurück, und alles lässt sich später in der Verwaltung ändern."
        nextLabel="Los geht’s"
        nextDisabled={token.trim().length === 0}
        busy={busy}
        onNext={() =>
          call(async () => {
            if (!demo)
              await request('/setup/token', { method: 'POST', body: { setupToken: token.trim() } });
            go(1);
          }, 'Der Einrichtungscode konnte nicht geprüft werden.')
        }
        error={error}
        header={
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ClubroofLogo size={84} />
            <T variant="headline" color={colors.primaryText} style={{ letterSpacing: 2 }} verbatim>
              CLUBROOF
            </T>
          </View>
        }
      >
        <TextField
          label="Einrichtungscode"
          value={token}
          onChangeText={setToken}
          placeholder={t('z. B. CR-XXXX-XXXX')}
          maxLength={60}
        />
        <T variant="caption">
          Den Einrichtungscode bekommst du von Clubroof, sobald die Zahlung eingegangen ist. Er gilt
          einmal.
        </T>
        <T variant="section">Wie möchtest du vorgehen?</T>
        <ModeChoice value={d.flow} onChange={(flow) => patch({ flow })} />
        <T variant="section">Gut zu haben</T>
        <RuleList
          rules={[
            'Logo des Vereins (quadratisches PNG)',
            'Mitgliederliste als Excel- oder CSV-Datei',
            'Namen der Plätze und Kabinen eurer Sportanlage',
          ]}
        />
      </WizardShell>
    );

  // ── Größe (optional) ─────────────────────────────────────────────────────
  if (key === 'size')
    return (
      <WizardShell
        {...shell}
        title="Wie groß ist euer Verein?"
        explanation="Das belegt Aufbau und Funktionen sinnvoll vor – du kannst alles in den nächsten Schritten ändern."
        onSkip={next}
        onBack={() => go(0)}
      >
        {(
          [
            {
              v: 'single' as const,
              icon: 'person' as const,
              title: 'Ein Team',
              text: 'Eine Gruppe, wenige Funktionen',
            },
            {
              v: 'several' as const,
              icon: 'people' as const,
              title: 'Mehrere Abteilungen',
              text: 'Jugend und Senioren mit eigener Leitung',
            },
            {
              v: 'large' as const,
              icon: 'business' as const,
              title: 'Großverein',
              text: 'Viele Mannschaften, Kasse, Forum und Platzbelegung',
            },
          ] as const
        ).map((o) => (
          <OptionCard
            key={o.v}
            icon={o.icon}
            title={o.title}
            text={o.text}
            recommended={o.v === 'several'}
            selected={d.size === o.v}
            onPress={() =>
              patch({
                size: o.v,
                orgMode: o.v === 'single' ? 'single' : 'split',
                modules:
                  o.v === 'single'
                    ? ['squad', 'team_cash', 'team_tasks', 'parent_access']
                    : o.v === 'large'
                      ? [
                          ...RECOMMENDED,
                          'club_cash',
                          'forum',
                          'facility_booking',
                          'referees',
                          'equipment',
                          'sponsors',
                        ]
                      : [...RECOMMENDED],
              })
            }
          />
        ))}
        <LaterHint where="Verwaltung › Module" />
      </WizardShell>
    );

  // ── Name ─────────────────────────────────────────────────────────────────
  if (key === 'name')
    return (
      <WizardShell
        {...shell}
        title="Wie heißt euer Verein?"
        explanation="Der volle Name steht auf Dokumenten, der Kurzname in der Kopfzeile und auf dem Wappen."
        nextDisabled={d.name.trim().length < 3 || d.shortName.trim().length < 2}
        hint="Das änderst du später unter Verwaltung › Verein & Design."
      >
        <TextField
          label="Vereinsname"
          value={d.name}
          onChangeText={(v) => patch({ name: v })}
          maxLength={100}
          placeholder={t('z. B. SV Grün-Weiß 1921 e. V.')}
        />
        <TextField
          label="Kurzname"
          value={d.shortName}
          onChangeText={(v) => patch({ shortName: v })}
          maxLength={40}
          placeholder={t('z. B. SV Grün-Weiß')}
        />
        <TextField
          label="Kürzel (2 bis 4 Zeichen)"
          value={d.code || (d.shortName.trim().length >= 2 ? defaultClubCode(d.shortName) : '')}
          onChangeText={(v) => patch({ code: normalizeClubCode(v) })}
          maxLength={4}
          letterSpacing={3}
          hint="Steht groß im Plakat der Startseite und ersetzt das Wappen ohne Logo."
        />
      </WizardShell>
    );

  // ── Euer Verein ──────────────────────────────────────────────────────────
  if (key === 'details')
    return (
      <WizardShell
        {...shell}
        title="Euer Verein"
        explanation="Anschrift und Kontakt – sie erscheinen auf Spendenbescheinigungen und im Impressum. Alles ist freiwillig."
        onSkip={next}
      >
        <View style={{ gap: 12 }}>
          <TextField
            label="Gründungsjahr"
            kind="code"
            value={d.foundedYear}
            onChangeText={(v) => patch({ foundedYear: v.replace(/\D/g, '').slice(0, 4) })}
            maxLength={4}
          />
          <TextField
            label="Straße und Hausnummer"
            value={d.street}
            onChangeText={(street) => patch({ street })}
            maxLength={120}
          />
          <TextField
            label="Postleitzahl"
            kind="code"
            value={d.postalCode}
            onChangeText={(v) => patch({ postalCode: v.replace(/\D/g, '').slice(0, 5) })}
            maxLength={5}
          />
          <TextField
            label="Ort"
            value={d.city}
            onChangeText={(city) => patch({ city })}
            maxLength={80}
          />
          <TextField
            label="Kontakt-E-Mail"
            kind="email"
            value={d.clubEmail}
            onChangeText={(clubEmail) => patch({ clubEmail })}
            maxLength={120}
          />
          <TextField
            label="Telefon"
            value={d.clubPhone}
            onChangeText={(clubPhone) => patch({ clubPhone })}
            maxLength={40}
          />
          <TextField
            label="Webseite"
            value={d.website}
            onChangeText={(website) => patch({ website })}
            maxLength={200}
            placeholder={t('z. B. https://www.sv-gruen-weiss.example')}
          />
          <ChoiceChips
            label="Land und Zeitzone"
            options={TIMEZONES}
            selected={[d.timezone]}
            onToggle={(timezone) => patch({ timezone })}
          />
        </View>
        <WhyBox>
          Mit der Anschrift füllt Clubroof Spendenbescheinigungen aus; die Zeitzone bestimmt Fristen
          und Terminzeiten.
        </WhyBox>
        <LaterHint where="Verwaltung › Verein & Design" />
      </WizardShell>
    );

  // ── Spielstätte ──────────────────────────────────────────────────────────
  if (key === 'venue')
    return (
      <WizardShell
        {...shell}
        title="Wo spielt ihr?"
        explanation="Name und Adresse der Sportanlage. Sie erscheinen bei Terminen, mit Link zur Karten-App."
        nextDisabled={!venues[0]?.name.trim()}
        onSkip={() => go(keys.indexOf('logo'))}
        hint="Du kannst weitere Anlagen ergänzen und alles später in der Verwaltung ändern."
      >
        {venues.map((v, i) => (
          <Card key={i} style={{ gap: 12 }}>
            <TextField
              label={i === 0 ? 'Name der Anlage' : `Name der Anlage ${i + 1}`}
              value={v.name}
              onChangeText={(n) => setVenue(i, { name: n })}
              maxLength={80}
              placeholder={t('z. B. Sportplatz am Wald')}
            />
            <TextField
              label="Adresse"
              value={v.address}
              onChangeText={(a) => setVenue(i, { address: a })}
              maxLength={160}
              placeholder={t('Straße, Ort')}
            />
            {i > 0 ? (
              <Button
                label="Anlage entfernen"
                variant="outline"
                size="sm"
                icon="trash-outline"
                onPress={() => patch({ venues: venues.filter((_, j) => j !== i) })}
              />
            ) : null}
          </Card>
        ))}
        {venues.length < 5 ? (
          <Button
            label="Weitere Anlage hinzufügen"
            variant="tonal"
            icon="add"
            onPress={() => patch({ venues: [...venues, emptyVenue()] })}
          />
        ) : null}
      </WizardShell>
    );

  // ── Plätze und Kabinen ───────────────────────────────────────────────────
  if (key === 'rooms')
    return (
      <WizardShell
        {...shell}
        title="Plätze und Kabinen"
        explanation="Wie viele Plätze und Kabinen gibt es je Anlage? Sie lassen sich später umbenennen."
        onSkip={() => go(keys.indexOf('logo'))}
      >
        {venues
          .filter((v) => v.name.trim())
          .map((v) => {
            const i = venues.indexOf(v);
            return (
              <Card key={i} style={{ gap: 14 }}>
                <T variant="heading">{v.name}</T>
                <NumberStepper
                  label="Plätze"
                  value={v.pitches}
                  onChange={(n) =>
                    setVenue(i, {
                      pitches: n,
                      surfaces: Array.from({ length: n }, (_, k) => v.surfaces[k] ?? 'grass'),
                    })
                  }
                />
                <NumberStepper
                  label="Kabinen"
                  value={v.rooms}
                  onChange={(n) => setVenue(i, { rooms: n })}
                  max={30}
                />
              </Card>
            );
          })}
      </WizardShell>
    );

  // ── Untergrund ───────────────────────────────────────────────────────────
  if (key === 'surface')
    return (
      <WizardShell
        {...shell}
        title="Welcher Untergrund?"
        explanation="Der Untergrund je Platz hilft bei der Planung, z. B. wenn Rasenplätze gesperrt sind."
      >
        {venues
          .filter((v) => v.name.trim() && v.pitches > 0)
          .map((v) => {
            const i = venues.indexOf(v);
            return (
              <Card key={i} style={{ gap: 12 }}>
                <T variant="heading">{v.name}</T>
                {Array.from({ length: v.pitches }, (_, k) => (
                  <ChoiceChips
                    key={k}
                    label={`Platz ${k + 1}`}
                    options={SURFACES}
                    selected={[v.surfaces[k] ?? 'grass']}
                    onToggle={(s) =>
                      setVenue(i, {
                        surfaces: Array.from({ length: v.pitches }, (_, x) =>
                          x === k ? s : (v.surfaces[x] ?? 'grass'),
                        ),
                      })
                    }
                  />
                ))}
              </Card>
            );
          })}
      </WizardShell>
    );

  // ── Logo ─────────────────────────────────────────────────────────────────
  if (key === 'logo')
    return (
      <WizardShell
        {...shell}
        title="Habt ihr ein Logo?"
        explanation="Es erscheint oben in der App bei allen Mitgliedern. Ohne Logo zeigt die App ein Wappen mit dem Kürzel."
        nextLabel={logo ? 'Weiter' : 'Ohne Logo weiter'}
        onSkip={() => {
          setLogo(null);
          next();
        }}
        hint="Am besten ein quadratisches PNG mit transparentem Hintergrund."
      >
        <Card style={{ alignItems: 'center', gap: 14 }}>
          {logo ? (
            <Image
              source={{ uri: logo.previewUri }}
              accessibilityLabel={t('Vorschau des Logos')}
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
          ) : (
            <Crest initials={clubInitials(d.shortName || 'CR')} size={96} />
          )}
          <Button
            label={logo ? 'Anderes Logo wählen' : 'Logo auswählen'}
            icon="image-outline"
            variant="tonal"
            onPress={() =>
              void call(async () => {
                const file = await pickFile('image');
                if (file) setLogo(file);
              }, 'Das Logo konnte nicht gelesen werden.')
            }
          />
        </Card>
      </WizardShell>
    );

  // ── Farbe und Darstellung ────────────────────────────────────────────────
  if (key === 'color')
    return (
      <ThemeProvider clubColor={d.color}>
        <WizardShell
          {...shell}
          title="Eure Vereinsfarbe"
          explanation="Zehn geprüfte Farben – jede ist im hellen und dunklen Modus gut lesbar. So sieht die App für eure Mitglieder aus."
          hint="Die Farbe änderst du später jederzeit unter Verwaltung › Verein & Design."
        >
          <ClubColorPicker value={d.color} onChange={(c) => patch({ color: c })} />
          <ColorPreview shortName={d.shortName} code={d.code || defaultClubCode(d.shortName)} />
          {d.flow === 'full' ? (
            <ChoiceChips
              label="Standard-Darstellung"
              options={[
                { value: 'system' as const, label: 'Wie Gerät' },
                { value: 'light' as const, label: 'Hell' },
                { value: 'dark' as const, label: 'Dunkel' },
              ]}
              selected={[d.colorMode]}
              onToggle={(colorMode) => patch({ colorMode })}
            />
          ) : null}
        </WizardShell>
      </ThemeProvider>
    );

  // ── Bereiche ─────────────────────────────────────────────────────────────
  if (key === 'units')
    return (
      <WizardShell
        {...shell}
        title="Wie ist euer Verein aufgebaut?"
        explanation="Abteilungen gliedern den Verein. Wer eine Abteilung leitet, sieht nur deren Mannschaften."
        hint="Vorstand und Administration sehen immer alles. Weitere Abteilungen kannst du später ergänzen."
      >
        <ChoiceCard
          icon="layers"
          title="Eine gemeinsame Abteilung"
          text="Alle Mannschaften gehören zusammen"
          selected={d.orgMode === 'single'}
          onPress={() => patch({ orgMode: 'single' })}
        />
        <ChoiceCard
          icon="git-branch"
          title="Jugend und Senioren getrennt"
          text="Jede Leitung sieht nur Daten ihrer Abteilung"
          selected={d.orgMode === 'split'}
          onPress={() => patch({ orgMode: 'split' })}
          badge="Üblich"
        />
      </WizardShell>
    );

  // ── Saison ───────────────────────────────────────────────────────────────
  if (key === 'season')
    return (
      <WizardShell
        {...shell}
        title="Wann beginnt eure Saison?"
        explanation="Mannschaften, Beiträge und Statistiken laufen je Saison. Der Beginn legt fest, wann sie wechselt."
      >
        {SEASON_STARTS.map((o) => (
          <OptionCard
            key={o.value}
            icon="calendar"
            title={o.label}
            text={o.text}
            recommended={o.value === '7'}
            selected={d.seasonStartMonth === o.value}
            onPress={() => patch({ seasonStartMonth: o.value })}
          />
        ))}
        <WhyBox>
          Zum Saisonwechsel übernimmt Clubroof Mannschaften samt Kasse und Verlauf in die neue
          Saison.
        </WhyBox>
        <LaterHint where="Verwaltung › Mannschaften & Saison" />
      </WizardShell>
    );

  // ── Vorstand und Aufgaben ────────────────────────────────────────────────
  if (key === 'board')
    return (
      <WizardShell
        {...shell}
        title="Vorstand und Aufgaben"
        explanation="Wer soll von Anfang an dabei sein? Jede Person bekommt ihre Rolle und eine Einladung per E-Mail, sobald der Verein eingerichtet ist."
        onSkip={next}
      >
        {BOARD_ROLES.map((r) => (
          <Card key={r.key} style={{ gap: 10 }}>
            <T variant="label" style={{ fontWeight: '700' }}>
              {r.label}
            </T>
            <TextField
              label="Name"
              value={d.board[r.key]?.name ?? ''}
              onChangeText={(name) =>
                patch({ board: { ...d.board, [r.key]: { email: '', ...d.board[r.key], name } } })
              }
              maxLength={80}
            />
            <TextField
              label="E-Mail-Adresse"
              kind="email"
              value={d.board[r.key]?.email ?? ''}
              onChangeText={(email) =>
                patch({ board: { ...d.board, [r.key]: { name: '', ...d.board[r.key], email } } })
              }
              maxLength={120}
            />
          </Card>
        ))}
        <WhyBox>
          Vertretung ist wichtig: Empfohlen sind mindestens zwei Personen mit
          Administrationsrechten. Weitere Rollen vergibst du später unter Verwaltung › Rollen &
          Aufgaben.
        </WhyBox>
      </WizardShell>
    );

  // ── Wofür nutzt ihr Clubroof ─────────────────────────────────────────────
  if (key === 'team-modules' || key === 'club-modules') {
    const list = key === 'team-modules' ? TEAM_MODULES : CLUB_MODULES;
    return (
      <WizardShell
        {...shell}
        title={
          key === 'team-modules'
            ? 'Wofür nutzt ihr Clubroof – in der Mannschaft?'
            : 'Und im Verein?'
        }
        explanation={
          key === 'team-modules'
            ? 'Termine, News und Abwesenheiten sind immer dabei. Wähle, was eure Mannschaften zusätzlich brauchen.'
            : 'Was soll der ganze Verein nutzen können? Empfohlenes ist vorausgewählt. „Vereinskasse“ ist nur der Schalter – eingerichtet wird sie danach in einem eigenen Assistenten.'
        }
        hint="Funktionen aktivierst oder deaktivierst du später unter Verwaltung › Module."
      >
        {MODULES.filter((m) => list.includes(m.key)).map((m) => (
          <ChoiceCard
            key={m.key}
            multi
            icon={MODULE_ICON[m.key] ?? 'apps'}
            title={m.name}
            text={m.description}
            selected={d.modules.includes(m.key)}
            onPress={() => toggleModule(m.key)}
            badge={RECOMMENDED.has(m.key) ? 'Empfohlen' : undefined}
          />
        ))}
      </WizardShell>
    );
  }

  // ── Daten übernehmen ─────────────────────────────────────────────────────
  if (key === 'members') {
    const plan = (k: Draft['importPlan'][number]) =>
      patch({
        importPlan: d.importPlan.includes(k)
          ? d.importPlan.filter((x) => x !== k)
          : [...d.importPlan, k],
      });
    return (
      <WizardShell
        {...shell}
        title="Daten übernehmen"
        explanation="Welche Daten habt ihr schon? Die Importe laufen nach der Einrichtung, jeweils mit Vorlage, Spaltenzuordnung und Vorschau. Excel-Dateien mit mehreren Blättern gehen auch – du wählst das Blatt aus."
        onSkip={next}
      >
        <WhyBox>
          Empfohlene Reihenfolge: zuerst die Mitglieder, dann Mannschaften und Kader, zuletzt
          Termine und Kasse – so findet jeder Import seine Personen und Mannschaften wieder.
        </WhyBox>
        <OptionCard
          icon="people"
          title="Mitglieder"
          text="Mitgliederliste aus Excel oder CSV, mit Dublettenprüfung"
          multi
          selected={d.importPlan.includes('members')}
          onPress={() => plan('members')}
        />
        <OptionCard
          icon="shirt"
          title="Kader der Mannschaften"
          text="Spieler und Betreuer mit Nummer und Position"
          multi
          selected={d.importPlan.includes('roster')}
          onPress={() => plan('roster')}
        />
        <OptionCard
          icon="calendar"
          title="Spielplan und Termine"
          text="Trainingsplan und Spiele aus Excel, CSV oder DFBnet"
          multi
          selected={d.importPlan.includes('events')}
          onPress={() => plan('events')}
        />
        {d.modules.includes('club_cash') ? (
          <OptionCard
            icon="wallet"
            title="Beiträge und Buchungen"
            text="Beitragsarten, Zuordnung, offene Posten, Haushaltsplan, Buchungen"
            multi
            selected={d.importPlan.includes('fees')}
            onPress={() => plan('fees')}
          />
        ) : null}
        <OptionCard
          icon="qr-code"
          title="Per Code oder QR einladen"
          text="Eltern und Spieler treten mit einem Link bei und werden von dir freigegeben."
          multi
          selected={d.importPlan.includes('invite')}
          onPress={() => plan('invite')}
        />
        <LaterHint where="Verwaltung › Importieren und Einladungen" />
      </WizardShell>
    );
  }

  // ── Kommunikation und Datenschutz ────────────────────────────────────────
  if (key === 'comms')
    return (
      <WizardShell
        {...shell}
        title="Kommunikation und Datenschutz"
        explanation="Wer sieht die Kontaktdaten neuer Personen? Jede Person kann das für sich ändern."
      >
        {VISIBILITIES.map((o) => (
          <OptionCard
            key={o.value}
            icon="eye"
            title={o.label}
            text={o.text}
            recommended={o.value === 'team_and_coaches'}
            selected={d.contactVisibility === o.value}
            onPress={() => patch({ contactVisibility: o.value })}
          />
        ))}
        <T variant="section">Gut zu wissen</T>
        <RuleList
          rules={[
            'News veröffentlichen Vorstand und Administration; Trainer schreiben für ihre Mannschaft.',
            'Ruhezeiten und Erinnerungen stellt jede Person selbst unter Ich › Einstellungen › Benachrichtigungen ein.',
            'Datenschutzerklärung und Impressum findest du in der App unter Ich › Hilfe und Informationen.',
          ]}
        />
        <LaterHint where="Verwaltung › Verein & Design und Rollen & Aufgaben" />
      </WizardShell>
    );

  // ── Konto ────────────────────────────────────────────────────────────────
  if (key === 'account')
    return (
      <WizardShell
        {...shell}
        title="Dein Konto"
        explanation="Du wirst die Vereinsadministration mit allen Rechten. Wir bestätigen deine E-Mail-Adresse mit einem Code."
        nextDisabled={!(d.firstName.trim() && d.lastName.trim() && verified)}
      >
        <TextField
          label="Vorname"
          value={d.firstName}
          onChangeText={(v) => patch({ firstName: v })}
          maxLength={60}
        />
        <TextField
          label="Nachname"
          value={d.lastName}
          onChangeText={(v) => patch({ lastName: v })}
          maxLength={60}
        />
        <TextField
          label="E-Mail-Adresse"
          kind="email"
          value={d.email}
          onChangeText={(v) => {
            patch({ email: v });
            setCodeSent(false);
            setProof(null);
          }}
          maxLength={120}
        />
        {verified ? (
          <Chip tone="success" icon="checkmark-circle" label="E-Mail-Adresse bestätigt" size="md" />
        ) : (
          <>
            <Button
              label={codeSent ? 'Code erneut senden' : 'Bestätigungscode senden'}
              icon="mail-outline"
              variant="tonal"
              disabled={!d.email.includes('@')}
              loading={busy && !codeSent}
              onPress={() => void sendCode()}
            />
            {codeSent ? (
              <>
                <TextField
                  label="Code aus der E-Mail"
                  kind="code"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  onSubmit={() => code.length >= 4 && void verifyCode()}
                />
                <Button
                  label="Code bestätigen"
                  icon="checkmark"
                  disabled={code.length < 4}
                  loading={busy}
                  onPress={() => void verifyCode()}
                />
              </>
            ) : null}
          </>
        )}
      </WizardShell>
    );

  // ── Passwort ─────────────────────────────────────────────────────────────
  if (key === 'password')
    return (
      <WizardShell
        {...shell}
        title="Wähle ein Passwort"
        explanation="Mindestens 10 Zeichen. Eine Wortfolge oder ein Satz ist sicherer und leichter zu merken als ein kurzes Passwort mit Sonderzeichen."
        nextDisabled={password.length < 10 || password !== password2}
      >
        <TextField
          label="Passwort"
          kind="newPassword"
          value={password}
          onChangeText={setPassword}
        />
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4].map((n) => (
              <View
                key={n}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    pw.score >= n
                      ? pw.score >= 3
                        ? colors.status.success.solid
                        : colors.status.action.solid
                      : colors.border,
                }}
              />
            ))}
          </View>
          <T variant="caption">{`Stärke: ${pw.label}`}</T>
        </View>
        <TextField
          label="Passwort wiederholen"
          kind="newPassword"
          value={password2}
          onChangeText={setPassword2}
        />
        {password2 && password !== password2 ? (
          <Chip tone="action" icon="alert-circle" label="Die Passwörter stimmen nicht überein." />
        ) : null}
      </WizardShell>
    );

  // ── Sicherheit ───────────────────────────────────────────────────────────
  if (key === 'security')
    return (
      <WizardShell
        {...shell}
        title="Zusätzlich absichern?"
        explanation="Mit der Zwei-Faktor-Anmeldung braucht jede neue Anmeldung zusätzlich einen Code. Für das Administrationskonto empfehlen wir sie."
        hint="Das betrifft nur neue Anmeldungen – dein jetziges Gerät bleibt angemeldet. Du richtest sie später unter Ich › Konto & Einstellungen ein."
      >
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={28} color={colors.primaryText} />
            <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
              Empfehlung für das Administrationskonto
            </T>
          </View>
          <T variant="caption">
            Verwaltungsrechte schützen Daten aller Mitglieder. Ein zweiter Faktor (Authenticator-App
            oder Code per E-Mail) verhindert, dass ein gestohlenes Passwort allein genügt.
          </T>
        </Card>
      </WizardShell>
    );

  // ── Zusammenfassung ──────────────────────────────────────────────────────
  const seasonLabel = SEASON_STARTS.find((o) => o.value === d.seasonStartMonth)?.label ?? '';
  const boardCount = BOARD_ROLES.filter(
    (r) => d.board[r.key]?.name.trim() && d.board[r.key]?.email.includes('@'),
  ).length;
  const rows: { label: string; value: string; key: StepKey }[] = [
    {
      label: 'Verein',
      value: [d.name.trim(), d.shortName.trim()].filter(Boolean).join(' · '),
      key: 'name',
    },
    {
      label: 'Sportanlage',
      value: venues
        .filter((v) => v.name.trim())
        .map((v) => v.name.trim())
        .join(' · '),
      key: 'venue',
    },
    {
      label: 'Aufbau',
      value:
        d.orgMode === 'split' ? t('Jugend und Senioren getrennt') : t('Eine gemeinsame Abteilung'),
      key: 'units',
    },
    {
      label: 'Funktionen',
      value: t(`${d.modules.length} gewählt`),
      key: d.flow === 'full' ? 'team-modules' : 'units',
    },
    {
      label: 'Konto',
      value: [d.firstName.trim(), d.lastName.trim(), d.email.trim()].filter(Boolean).join(' · '),
      key: 'account',
    },
  ];
  if (d.flow === 'full')
    rows.splice(
      2,
      0,
      {
        label: 'Anschrift',
        value: [d.street.trim(), [d.postalCode.trim(), d.city.trim()].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', '),
        key: 'details',
      },
      { label: 'Saison', value: t(`Beginn im ${t(seasonLabel)}`), key: 'season' },
      { label: 'Vorstand', value: boardCount ? t(`${boardCount} Einladungen`) : '', key: 'board' },
    );
  return (
    <WizardShell
      {...shell}
      title="Alles bereit?"
      explanation="Prüfe die Angaben. Mit „Ändern“ springst du in den Schritt. Erst jetzt wird der Verein eingerichtet."
      nextLabel="Einrichtung abschließen"
      onNext={() => void finish()}
      busy={busy}
    >
      <SummaryList rows={rows.map((r) => ({ ...r, onEdit: () => goKey(r.key) }))} />
      <RuleList
        rules={[
          'Danach bist du als Administration angemeldet und siehst sinnvolle nächste Schritte.',
          'Alles lässt sich später in der Verwaltung ändern.',
        ]}
      />
    </WizardShell>
  );
}

/** Vorschau der gewählten Vereinsfarbe: Wappen, Blickfang und Knopf. */
function ColorPreview({ shortName, code }: { shortName: string; code: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Crest initials={code || 'CR'} size={36} />
        <T variant="heading">{shortName.trim() || 'Dein Verein'}</T>
      </View>
      <View
        style={{
          borderRadius: 20,
          padding: 16,
          backgroundColor: colors.hero.from,
        }}
      >
        <T variant="overline" color={colors.hero.onHero}>
          Nächstes Spiel
        </T>
        <T variant="headline" color={colors.hero.onHero}>
          Samstag, 15:00 Uhr
        </T>
      </View>
      <Button label="Zusagen" icon="checkmark" onPress={() => undefined} />
    </Card>
  );
}
