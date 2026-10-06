import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LoginResponse } from '@clubroof/core';
import { Button, Card, Chip, Crest, T, TextField } from '@/components/ui';
import { request, RequestError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@sv-gruen-weiss.example' },
  { label: 'Trainer', email: 'trainer@sv-gruen-weiss.example' },
  { label: 'Spieler', email: 'spieler@sv-gruen-weiss.example' },
  { label: 'Eltern', email: 'eltern@sv-gruen-weiss.example' },
  { label: 'Vorstand', email: 'vorstand@sv-gruen-weiss.example' },
  { label: 'Mitglied', email: 'mitglied@sv-gruen-weiss.example' },
];

export default function LoginScreen() {
  const { signIn, adopt } = useSession();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const { colors, radii, spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Leerer Server → direkt zum Einrichtungsassistenten
  useEffect(() => {
    request<{ needsSetup: boolean }>('/setup/status')
      .then((s) => {
        if (s.needsSetup) router.replace('/setup');
      })
      .catch(() => {});
  }, []);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Bitte gib E-Mail-Adresse und Passwort ein.');
      return;
    }
    setBusy(true);
    try {
      setChallenge(await signIn(email.trim(), password));
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Die Anmeldung ist fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      await adopt(
        await request<LoginResponse>('/auth/2fa/verify', {
          method: 'POST',
          body: { challenge, code: code.trim() },
        }),
      );
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Der Code konnte nicht geprüft werden.');
      if (e instanceof RequestError && e.code === 'challenge_invalid') setChallenge(null);
    } finally {
      setBusy(false);
    }
  };

  const input = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}
      >
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: spacing.xl }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Crest initials="CR" size={56} />
            <T variant="display">Clubroof</T>
            <T variant="caption">Dein Verein unter einem Dach.</T>
          </View>

          {challenge ? (
            <Card style={{ gap: spacing.md, padding: spacing.lg }}>
              <T variant="heading">Bestätigungscode</T>
              <T variant="caption">
                Gib den 6-stelligen Code aus deiner Authenticator-App ein – oder einen deiner
                Wiederherstellungscodes.
              </T>
              <TextField
                label="Code"
                kind="code"
                value={code}
                onChangeText={setCode}
                maxLength={20}
                onSubmit={() => void verify()}
              />
              {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
              <Button
                label="Bestätigen"
                onPress={() => void verify()}
                loading={busy}
                disabled={code.trim().length < 6}
              />
              <Button
                label="Abbrechen"
                variant="outline"
                onPress={() => {
                  setChallenge(null);
                  setCode('');
                  setError(null);
                }}
              />
            </Card>
          ) : (
            <Card style={{ gap: spacing.md, padding: spacing.lg }}>
              <View style={{ gap: 6 }}>
                <T variant="label">E-Mail-Adresse</T>
                <TextInput
                  accessibilityLabel="E-Mail-Adresse"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  placeholder="name@verein.de"
                  placeholderTextColor={colors.onSurfaceMuted}
                  style={input}
                />
              </View>
              <View style={{ gap: 6 }}>
                <T variant="label">Passwort</T>
                <TextInput
                  accessibilityLabel="Passwort"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  onSubmitEditing={submit}
                  style={input}
                />
              </View>
              {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
              <Button label="Anmelden" onPress={submit} loading={busy} />
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/forgot')}
                style={{ alignSelf: 'center', padding: 4 }}
              >
                <T variant="label" color={colors.primaryText}>
                  Passwort vergessen?
                </T>
              </Pressable>
            </Card>
          )}

          {__DEV__ ? (
            <View style={{ gap: spacing.sm }}>
              <T variant="overline" style={{ textAlign: 'center' }}>
                Demoverein · Passwort clubroof-demo
              </T>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}
              >
                {DEMO_ACCOUNTS.map((a) => (
                  <Pressable
                    key={a.email}
                    accessibilityRole="button"
                    onPress={() => {
                      setEmail(a.email);
                      setPassword('clubroof-demo');
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <T variant="label">{a.label}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
