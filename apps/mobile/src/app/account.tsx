import {
  LOCALES,
  type ColorMode,
  type Locale,
  type TwoFactorSetup,
  type TwoFactorStatus,
} from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  IconTile,
  ListRow,
  Screen,
  Section,
  T,
  TextField,
  Toggle,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { setFontScale, useFontScaleKey } from '@/lib/font-scale';
import { useAppLockEnabled, setAppLockEnabled } from '@/lib/app-lock';
import { deviceAuthAvailable, deviceAuthenticate } from '@/lib/device-auth';

export default function AccountScreen() {
  const { api, me, signOut } = useSignedIn();
  const { colors } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api('/auth/password/change', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setMsg({ ok: true, text: 'Passwort geändert. Andere Geräte wurden abgemeldet.' });
      setCurrent('');
      setNext('');
      setNext2('');
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof RequestError ? e.message : 'Das hat nicht geklappt.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 4 }}>
        <T variant="heading">{me.user.displayName}</T>
        <T variant="caption">Angemeldet als {me.user.email}</T>
      </Card>
      <AppearanceSection />
      <LanguageSection />
      <FontSizeSection />
      <AppLockSection />
      <Section title="Benachrichtigungen & Kalender">
        <Card>
          <ListRow
            first
            leading={<IconTile name="notifications-outline" />}
            title="Benachrichtigungen einstellen"
            subtitle="Push, Ruhezeit und Themen"
            onPress={() => router.push('/notification-settings')}
          />
          {me.clubModules.includes('calendar_export') ? (
            <ListRow
              leading={<IconTile name="calendar-outline" />}
              title="Kalender-Abo"
              subtitle="Termine im Handy-Kalender"
              onPress={() => router.push('/calendar')}
            />
          ) : null}
        </Card>
      </Section>
      <Section title="Sicherheit">
        <Card style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: pwOpen }}
            onPress={() => setPwOpen(!pwOpen)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <IconTile name="key-outline" />
            <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
              Passwort ändern
            </T>
            <Ionicons
              name={pwOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.onSurfaceMuted}
            />
          </Pressable>
          {pwOpen ? (
            <>
              <TextField
                label="Aktuelles Passwort"
                kind="password"
                value={current}
                onChangeText={setCurrent}
                maxLength={200}
              />
              <TextField
                label="Neues Passwort (mind. 10 Zeichen)"
                kind="newPassword"
                value={next}
                onChangeText={setNext}
                maxLength={200}
              />
              <TextField
                label="Neues Passwort wiederholen"
                kind="newPassword"
                value={next2}
                onChangeText={setNext2}
                maxLength={200}
              />
              {next2 && next !== next2 ? (
                <Chip tone="action" label="Die Passwörter stimmen nicht überein." />
              ) : null}
              {msg ? (
                <Chip
                  tone={msg.ok ? 'success' : 'urgent'}
                  icon={msg.ok ? 'checkmark-circle' : 'alert-circle'}
                  label={msg.text}
                />
              ) : null}
              <Button
                label="Passwort speichern"
                icon="key"
                loading={busy}
                disabled={!current || next.length < 10 || next !== next2}
                onPress={() => void change()}
              />
            </>
          ) : msg ? (
            <Chip
              tone={msg.ok ? 'success' : 'urgent'}
              icon={msg.ok ? 'checkmark-circle' : 'alert-circle'}
              label={msg.text}
            />
          ) : null}
        </Card>
      </Section>
      <TwoFactorSection />
      <Button
        label="Abmelden"
        variant="outline"
        icon="log-out-outline"
        onPress={() => void signOut()}
      />
    </Screen>
  );
}

function TwoFactorSection() {
  const { api, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['2fa'], queryFn: () => api<TwoFactorStatus>('/auth/2fa') });
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  const done = async () => {
    setCode('');
    setPassword('');
    await queryClient.invalidateQueries({ queryKey: ['2fa'] });
    await refresh();
  };

  const s = status.data;
  return (
    <Section title="2-Faktor-Anmeldung">
      <Card style={{ gap: 12 }}>
        {s?.required && !s.enabled ? (
          <Chip
            tone="urgent"
            icon="shield-outline"
            label="Der Verein verlangt sie für deine Verwaltungsrechte."
          />
        ) : null}
        {codes ? (
          <>
            <Chip tone="success" icon="shield-checkmark" label="Eingerichtet" />
            <T variant="label">Deine Wiederherstellungscodes</T>
            <T variant="caption">
              Bewahre sie sicher auf (z. B. ausdrucken). Jeder Code funktioniert einmal, falls dein
              Handy nicht zur Hand ist. Sie werden nur jetzt angezeigt.
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {codes.map((c) => (
                <View key={c} style={{ width: '46%' }}>
                  <T variant="body" style={{ fontFamily: 'monospace' }}>
                    {c}
                  </T>
                </View>
              ))}
            </View>
            <Button label="Ich habe die Codes gesichert" onPress={() => setCodes(null)} />
          </>
        ) : s?.enabled ? (
          <>
            <Chip tone="success" icon="shield-checkmark" label="Aktiv" />
            <T variant="caption">Noch {s.recoveryCodesLeft} Wiederherstellungscodes übrig.</T>
            {disabling ? (
              <>
                <TextField
                  label="Passwort"
                  kind="password"
                  value={password}
                  onChangeText={setPassword}
                  maxLength={200}
                />
                <TextField
                  label="Code aus der App"
                  kind="code"
                  value={code}
                  onChangeText={setCode}
                  maxLength={20}
                />
                <Button
                  label="Ausschalten"
                  variant="danger"
                  loading={busy}
                  disabled={!password || code.trim().length < 6}
                  onPress={() =>
                    void run(async () => {
                      await api('/auth/2fa/disable', {
                        method: 'POST',
                        body: { password, code: code.trim() },
                      });
                      setDisabling(false);
                      await done();
                    })
                  }
                />
              </>
            ) : !s.required ? (
              <Button label="Ausschalten" variant="outline" onPress={() => setDisabling(true)} />
            ) : null}
          </>
        ) : setup ? (
          <>
            <T>
              1. Öffne eine Authenticator-App (z. B. Google oder Microsoft Authenticator) und scanne
              den Code. 2. Gib den angezeigten 6-stelligen Code ein.
            </T>
            <View style={{ alignItems: 'center' }}>
              <View
                style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 12 }}
                accessibilityLabel={t('QR-Code für die Authenticator-App')}
              >
                <SvgXml xml={setup.qrSvg} width={190} height={190} />
              </View>
            </View>
            <T variant="caption" style={{ textAlign: 'center' }}>
              Oder manuell eingeben: {setup.secret}
            </T>
            <TextField
              label="Code aus der App"
              kind="code"
              value={code}
              onChangeText={setCode}
              maxLength={6}
            />
            <Button
              label="Bestätigen"
              icon="checkmark"
              loading={busy}
              disabled={code.trim().length !== 6}
              onPress={() =>
                void run(async () => {
                  const r = await api<{ recoveryCodes: string[] }>('/auth/2fa/enable', {
                    method: 'POST',
                    body: { code: code.trim() },
                  });
                  setSetup(null);
                  setCodes(r.recoveryCodes);
                  await done();
                })
              }
            />
          </>
        ) : (
          <>
            <T variant="caption">
              Schützt dein Konto zusätzlich: Nach dem Passwort fragt die App einen Code aus deiner
              Authenticator-App ab.
            </T>
            <Button
              label="Einrichten"
              icon="shield-checkmark-outline"
              loading={busy}
              onPress={() =>
                void run(async () =>
                  setSetup(await api<TwoFactorSetup>('/auth/2fa/setup', { method: 'POST' })),
                )
              }
            />
          </>
        )}
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      </Card>
    </Section>
  );
}

/** Persönliche Darstellung – gilt auf allen Geräten dieses Kontos. */
function AppearanceSection() {
  const { api, me, refresh } = useSignedIn();
  const [saving, setSaving] = useState<ColorMode | null>(null);
  const choose = async (colorMode: ColorMode) => {
    setSaving(colorMode);
    try {
      await api('/me/preferences', { method: 'PUT', body: { colorMode } });
      await refresh();
    } finally {
      setSaving(null);
    }
  };
  return (
    <Section title="Darstellung">
      <Card style={{ gap: 8 }}>
        <ChoiceChips
          options={[
            { value: 'light' as const, label: 'Hell', icon: 'sunny-outline' },
            { value: 'dark' as const, label: 'Dunkel', icon: 'moon-outline' },
            { value: 'system' as const, label: 'Wie Gerät', icon: 'phone-portrait-outline' },
          ]}
          selected={[saving ?? me.user.colorMode]}
          onToggle={(m) => void choose(m)}
        />
        <T variant="caption">Hell ist voreingestellt. Die Wahl gilt auf allen deinen Geräten.</T>
      </Card>
    </Section>
  );
}

/** Persönliche Sprache – gilt auf allen Geräten dieses Kontos; „Automatisch“ folgt dem Gerät. */
function LanguageSection() {
  const { api, me, refresh } = useSignedIn();
  const [saving, setSaving] = useState<Locale | 'auto' | null>(null);
  const choose = async (value: Locale | 'auto') => {
    setSaving(value);
    try {
      await api('/me/preferences', {
        method: 'PUT',
        body: { language: value === 'auto' ? null : value },
      });
      await refresh();
    } finally {
      setSaving(null);
    }
  };
  return (
    <Section title="Sprache">
      <Card style={{ gap: 8 }}>
        <ChoiceChips
          options={[
            { value: 'auto' as const, label: 'Automatisch', icon: 'phone-portrait-outline' },
            ...LOCALES.map((l) => ({ value: l.code as Locale | 'auto', label: l.name })),
          ]}
          selected={[saving ?? me.user.language ?? 'auto']}
          onToggle={(v) => void choose(v)}
        />
        <T variant="caption">
          Automatisch richtet sich nach der Sprache deines Geräts. Die Wahl gilt auf allen deinen
          Geräten.
        </T>
      </Card>
    </Section>
  );
}

/** Schriftgröße der App: nur für dieses Gerät, zusätzlich zur Systemeinstellung. */
function FontSizeSection() {
  const key = useFontScaleKey();
  return (
    <Section title="Schriftgröße">
      <Card style={{ gap: 8 }}>
        <ChoiceChips
          options={[
            { value: 'normal' as const, label: 'Normal' },
            { value: 'large' as const, label: 'Groß' },
            { value: 'xlarge' as const, label: 'Sehr groß' },
          ]}
          selected={[key]}
          onToggle={setFontScale}
        />
        <T>So sieht ein normaler Text in dieser Größe aus.</T>
        <T variant="caption">Die Einstellung gilt nur auf diesem Gerät.</T>
      </Card>
    </Section>
  );
}

/** App-Sperre mit Face ID, Fingerabdruck oder Gerätecode (nur auf dem Handy, nur wenn das Gerät es kann). */
function AppLockSection() {
  const enabled = useAppLockEnabled();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void deviceAuthAvailable().then(setAvailable);
  }, []);
  if (!available) return null;
  return (
    <Section title="App-Sperre">
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T style={{ flex: 1 }}>Mit Face ID oder Fingerabdruck entsperren</T>
          <Toggle
            label="App-Sperre"
            value={enabled}
            onChange={async (next) => {
              setError(null);
              if (next && !(await deviceAuthenticate('App-Sperre einschalten'))) {
                setError('Das hat nicht geklappt. Die App-Sperre bleibt aus.');
                return;
              }
              await setAppLockEnabled(next);
            }}
          />
        </View>
        <T variant="caption">
          Beim Start und nach einer Minute im Hintergrund fragt die App nach Face ID, Fingerabdruck
          oder dem Gerätecode. Die Einstellung gilt nur auf diesem Gerät.
        </T>
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      </Card>
    </Section>
  );
}
