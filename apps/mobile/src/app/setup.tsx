import type { ClubColorKey, LoginResponse, OrgUnitKind, SetupInput } from '@clubroof/core';
import { useState } from 'react';
import { View } from 'react-native';
import { ClubColorPicker, ORG_UNIT_KIND_LABELS } from '@/components/club-color';
import { PublicShell } from '@/components/public-shell';
import { Button, Card, ChoiceChips, Chip, T, TextField } from '@/components/ui';
import { request, RequestError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ThemeProvider } from '@/lib/theme';

const STEPS = ['Einrichtungscode', 'Verein', 'Bereiche', 'Dein Konto'] as const;

const SUGGESTED: { name: string; kind: OrgUnitKind }[] = [
  { name: 'Senioren', kind: 'seniors' },
  { name: 'Jugend', kind: 'youth' },
  { name: 'Frauen & Mädchen', kind: 'women' },
  { name: 'Alte Herren', kind: 'veterans' },
];

/** Ersteinrichtung auf einem leeren Server: Verein, Bereiche und erstes Admin-Konto. */
export default function SetupScreen() {
  const [color, setColor] = useState<ClubColorKey>('green');
  // Die Vorschau zeigt die gewählte Vereinsfarbe schon während der Einrichtung
  return (
    <ThemeProvider clubColor={color}>
      <Wizard color={color} setColor={setColor} />
    </ThemeProvider>
  );
}

function Wizard({ color, setColor }: { color: ClubColorKey; setColor: (c: ClubColorKey) => void }) {
  const { adopt } = useSession();
  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [units, setUnits] = useState<string[]>(['Senioren', 'Jugend']);
  const [custom, setCustom] = useState('');
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgUnits: SetupInput['orgUnits'] = [
    ...SUGGESTED.filter((u) => units.includes(u.name)),
    ...customUnits.map((n) => ({ name: n, kind: 'other' as const })),
  ];
  const valid = [
    token.trim().length > 0,
    name.trim().length >= 3 && shortName.trim().length >= 2,
    orgUnits.length > 0,
    firstName.trim() &&
      lastName.trim() &&
      email.includes('@') &&
      password.length >= 10 &&
      password === password2,
  ];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: SetupInput = {
        setupToken: token.trim(),
        club: { name: name.trim(), shortName: shortName.trim(), colorTheme: color },
        orgUnits,
        admin: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        },
      };
      await adopt(await request<LoginResponse>('/setup', { method: 'POST', body }));
    } catch (e) {
      const message = e instanceof RequestError ? e.message : 'Die Einrichtung hat nicht geklappt.';
      setError(message);
      if (e instanceof RequestError && e.code === 'setup_token') setStep(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell
      title="Verein einrichten"
      subtitle={`Schritt ${step + 1} von ${STEPS.length}: ${STEPS[step]}`}
      club={shortName.trim() ? { shortName: shortName.trim(), logoUrl: null } : null}
    >
      <Card style={{ gap: 14 }}>
        {step === 0 ? (
          <>
            <T>
              Willkommen bei Clubroof! Gib den Einrichtungscode ein, den du bei der Installation des
              Servers festgelegt hast (SETUP_TOKEN).
            </T>
            <TextField
              label="Einrichtungscode"
              kind="password"
              value={token}
              onChangeText={setToken}
            />
          </>
        ) : step === 1 ? (
          <>
            <TextField
              label="Vereinsname"
              value={name}
              onChangeText={setName}
              maxLength={100}
              placeholder="z. B. SV Grün-Weiß 1921 e. V."
            />
            <TextField
              label="Kurzname"
              value={shortName}
              onChangeText={setShortName}
              maxLength={40}
              placeholder="z. B. SV Grün-Weiß"
            />
            <ClubColorPicker value={color} onChange={setColor} />
            <T variant="caption">
              Logo, Darstellung und alles Weitere änderst du später unter Verwaltung → Verein &
              Design.
            </T>
          </>
        ) : step === 2 ? (
          <>
            <T>
              Welche Bereiche hat dein Verein? Mannschaften werden später einem Bereich zugeordnet;
              Bereichsleitungen (z. B. Jugendleitung) sehen nur ihren Bereich.
            </T>
            <ChoiceChips
              options={[
                ...SUGGESTED.map((u) => ({ value: u.name, label: u.name })),
                ...customUnits.map((n) => ({ value: n, label: n })),
              ]}
              selected={[...units, ...customUnits]}
              onToggle={(v) =>
                customUnits.includes(v)
                  ? setCustomUnits(customUnits.filter((x) => x !== v))
                  : setUnits(units.includes(v) ? units.filter((x) => x !== v) : [...units, v])
              }
            />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Weiterer Bereich"
                  value={custom}
                  onChangeText={setCustom}
                  maxLength={50}
                  placeholder="z. B. Walking Football"
                />
              </View>
              <Button
                label="Hinzufügen"
                variant="outline"
                disabled={custom.trim().length < 2}
                onPress={() => {
                  const n = custom.trim();
                  if (!customUnits.includes(n) && !SUGGESTED.some((u) => u.name === n))
                    setCustomUnits([...customUnits, n]);
                  setCustom('');
                }}
              />
            </View>
            <T variant="caption">
              {orgUnits.length} {orgUnits.length === 1 ? 'Bereich' : 'Bereiche'}:{' '}
              {orgUnits.map((u) => `${u.name} (${ORG_UNIT_KIND_LABELS[u.kind]})`).join(', ') || '–'}
            </T>
          </>
        ) : (
          <>
            <T>Dein Konto wird die Vereinsadministration mit allen Rechten.</T>
            <TextField
              label="Vorname"
              value={firstName}
              onChangeText={setFirstName}
              maxLength={60}
            />
            <TextField
              label="Nachname"
              value={lastName}
              onChangeText={setLastName}
              maxLength={60}
            />
            <TextField
              label="E-Mail-Adresse"
              kind="email"
              value={email}
              onChangeText={setEmail}
              maxLength={120}
            />
            <TextField
              label="Passwort (mind. 10 Zeichen)"
              kind="newPassword"
              value={password}
              onChangeText={setPassword}
            />
            <TextField
              label="Passwort wiederholen"
              kind="newPassword"
              value={password2}
              onChangeText={setPassword2}
              onSubmit={() => valid[3] && void submit()}
            />
            {password2 && password !== password2 ? (
              <Chip
                tone="action"
                icon="alert-circle"
                label="Die Passwörter stimmen nicht überein."
              />
            ) : null}
          </>
        )}
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {step > 0 ? (
          <Button
            label="Zurück"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => setStep(step - 1)}
          />
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button
            label="Weiter"
            style={{ flex: 1 }}
            disabled={!valid[step]}
            onPress={() => {
              setError(null);
              setStep(step + 1);
            }}
          />
        ) : (
          <Button
            label="Verein anlegen"
            icon="checkmark"
            style={{ flex: 1 }}
            loading={busy}
            disabled={!valid[3]}
            onPress={() => void submit()}
          />
        )}
      </View>
    </PublicShell>
  );
}
