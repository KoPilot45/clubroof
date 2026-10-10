import {
  MODULES,
  type ClubColorKey,
  type LoginResponse,
  type PitchSurface,
  type SetupInput,
  type UploadedImage,
} from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { ClubColorPicker } from '@/components/club-color';
import { ChoiceCard, NumberStepper, WizardShell, useWizardDraft } from '@/components/wizard';
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

/** Zahl der Schritte ohne Willkommen und Abschluss (siehe docs/PAKETE.md, Paket E). */
const TOTAL = 12;

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
  name: string;
  shortName: string;
  venues: VenueDraft[];
  color: ClubColorKey;
  orgMode: 'single' | 'split';
  modules: string[];
  firstName: string;
  lastName: string;
  email: string;
};
const INITIAL: Draft = {
  step: 0,
  name: '',
  shortName: '',
  venues: [emptyVenue()],
  color: 'green',
  orgMode: 'split',
  modules: [...RECOMMENDED],
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
    <ThemeProvider clubColor="blue">
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
  } = useWizardDraft<Draft>(demo ? 'setupDraftDemo' : 'setupDraft', INITIAL);
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

  const step = d.step;
  const go = (n: number) => {
    setError(null);
    patch({ step: n });
  };
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

  // Schritte ohne Inhalt überspringen (keine Plätze: kein Untergrund)
  const next = () => go(step === 3 && !hasPitches ? 5 : step + 1);
  const back = () => go(step === 5 && !hasPitches ? 3 : step - 1);

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

  const finish = () =>
    call(async () => {
      if (demo) {
        clear();
        setPassword('');
        setPassword2('');
        setDone(true);
        return;
      }
      const body: SetupInput = {
        setupToken: token.trim(),
        emailProof: proof!.value,
        club: { name: d.name.trim(), shortName: d.shortName.trim(), colorTheme: d.color },
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
        explanation="Das Wichtigste steht. Hier sind sinnvolle nächste Schritte – alles lässt sich später in der Verwaltung ändern."
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
              text="Aus einer CSV-Datei"
              selected={false}
              onPress={() => router.replace('/admin/import')}
            />
            <ChoiceCard
              icon="calendar"
              title="Spielplan importieren"
              text="Aus dem DFBnet"
              selected={false}
              onPress={() => router.replace('/schedule-import')}
            />
            <ChoiceCard
              icon="person-add"
              title="Personen einladen"
              text="Link oder QR-Code teilen"
              selected={false}
              onPress={() => router.replace('/admin/invites')}
            />
          </View>
        )}
      </WizardShell>
    );

  const shell = {
    step,
    total: TOTAL,
    onBack: back,
    onNext: next,
    error,
  } as const;

  // ── Willkommen ───────────────────────────────────────────────────────────
  if (step === 0)
    return (
      <WizardShell
        title="Willkommen bei Clubroof"
        explanation="In wenigen Minuten richtest du deinen Verein ein: Name, Anlage, Farbe, Funktionen und dein Konto. Du kannst jederzeit zurück, und alles lässt sich später in der Verwaltung ändern."
        nextLabel="Los geht’s"
        nextDisabled={token.trim().length === 0}
        onNext={() => go(1)}
        error={error}
        header={
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Crest initials="CR" size={72} />
            <T variant="headline" color={colors.primaryText} style={{ letterSpacing: 2 }} verbatim>
              CLUBROOF
            </T>
          </View>
        }
      >
        <TextField
          label="Einrichtungscode"
          kind="password"
          value={token}
          onChangeText={setToken}
          placeholder={t('Den Code hast du bei der Installation festgelegt')}
        />
      </WizardShell>
    );

  // ── 1 Name ───────────────────────────────────────────────────────────────
  if (step === 1)
    return (
      <WizardShell
        {...shell}
        title="Wie heißt euer Verein?"
        explanation="Der volle Name steht auf Dokumenten, der Kurzname in der Kopfzeile und auf dem Wappen."
        nextDisabled={d.name.trim().length < 3 || d.shortName.trim().length < 2}
        onBack={() => go(0)}
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
      </WizardShell>
    );

  // ── 2 Spielstätte ────────────────────────────────────────────────────────
  if (step === 2)
    return (
      <WizardShell
        {...shell}
        title="Wo spielt ihr?"
        explanation="Name und Adresse der Sportanlage. Sie erscheinen bei Terminen, mit Link zur Karten-App."
        nextDisabled={!venues[0]?.name.trim()}
        onSkip={() => go(5)}
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

  // ── 3 Plätze und Kabinen ─────────────────────────────────────────────────
  if (step === 3)
    return (
      <WizardShell
        {...shell}
        title="Plätze und Kabinen"
        explanation="Wie viele Plätze und Kabinen gibt es je Anlage? Sie lassen sich später umbenennen."
        onSkip={() => go(5)}
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

  // ── 4 Untergrund ─────────────────────────────────────────────────────────
  if (step === 4)
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

  // ── 5 Logo ───────────────────────────────────────────────────────────────
  if (step === 5)
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

  // ── 6 Farbe ──────────────────────────────────────────────────────────────
  if (step === 6)
    return (
      <ThemeProvider clubColor={d.color}>
        <WizardShell
          {...shell}
          title="Eure Vereinsfarbe"
          explanation="Zehn geprüfte Farben – jede ist im hellen und dunklen Modus gut lesbar. So sieht die App für eure Mitglieder aus."
          hint="Die Farbe änderst du später jederzeit unter Verwaltung › Verein & Design."
        >
          <ClubColorPicker value={d.color} onChange={(c) => patch({ color: c })} />
          <ColorPreview shortName={d.shortName} />
        </WizardShell>
      </ThemeProvider>
    );

  // ── 7 Bereiche ───────────────────────────────────────────────────────────
  if (step === 7)
    return (
      <WizardShell
        {...shell}
        title="Wie ist euer Verein aufgebaut?"
        explanation="Bereiche gliedern den Verein. Wer einen Bereich leitet, sieht nur dessen Mannschaften."
        hint="Vorstand und Administration sehen immer alles. Weitere Abteilungen kannst du später ergänzen."
      >
        <ChoiceCard
          icon="layers"
          title="Ein gemeinsamer Bereich"
          text="Alle Mannschaften gehören zusammen"
          selected={d.orgMode === 'single'}
          onPress={() => patch({ orgMode: 'single' })}
        />
        <ChoiceCard
          icon="git-branch"
          title="Jugend und Senioren getrennt"
          text="Jede Leitung sieht nur Daten ihres Bereichs"
          selected={d.orgMode === 'split'}
          onPress={() => patch({ orgMode: 'split' })}
          badge="Üblich"
        />
      </WizardShell>
    );

  // ── 8 / 9 Wofür nutzt ihr Clubroof ───────────────────────────────────────
  if (step === 8 || step === 9) {
    const keys = step === 8 ? TEAM_MODULES : CLUB_MODULES;
    return (
      <WizardShell
        {...shell}
        title={step === 8 ? 'Wofür nutzt ihr Clubroof – in der Mannschaft?' : 'Und im Verein?'}
        explanation={
          step === 8
            ? 'Termine, News und Abwesenheiten sind immer dabei. Wähle, was eure Mannschaften zusätzlich brauchen.'
            : 'Was soll der ganze Verein nutzen können? Empfohlenes ist vorausgewählt.'
        }
        hint="Funktionen aktivierst oder deaktivierst du später unter Verwaltung › Module."
      >
        {MODULES.filter((m) => keys.includes(m.key)).map((m) => (
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

  // ── 10 Konto ─────────────────────────────────────────────────────────────
  if (step === 10)
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

  // ── 11 Passwort ──────────────────────────────────────────────────────────
  if (step === 11)
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

  // ── 12 Sicherheit ────────────────────────────────────────────────────────
  return (
    <WizardShell
      {...shell}
      title="Zusätzlich absichern?"
      explanation="Mit der Zwei-Faktor-Anmeldung braucht jede neue Anmeldung zusätzlich einen Code. Für das Administrationskonto empfehlen wir sie."
      nextLabel="Einrichtung abschließen"
      onNext={() => void finish()}
      busy={busy}
      hint="Das betrifft nur neue Anmeldungen – dein jetziges Gerät bleibt angemeldet. Du richtest sie später unter Mehr › Konto & Einstellungen ein."
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
}

/** Vorschau der gewählten Vereinsfarbe: Wappen, Blickfang und Knopf. */
function ColorPreview({ shortName }: { shortName: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Crest initials={clubInitials(shortName || 'CR')} size={36} />
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
