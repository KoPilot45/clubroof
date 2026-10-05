import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, Crest, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const DEMO_ACCOUNTS = [
  { label: 'Trainer', email: 'trainer@sv-gruen-weiss.example' },
  { label: 'Spieler', email: 'spieler@sv-gruen-weiss.example' },
  { label: 'Eltern', email: 'eltern@sv-gruen-weiss.example' },
  { label: 'Vorstand', email: 'vorstand@sv-gruen-weiss.example' },
];

export default function LoginScreen() {
  const { signIn } = useSession();
  const { colors, radii, spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Bitte gib E-Mail-Adresse und Passwort ein.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Die Anmeldung ist fehlgeschlagen.');
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
          </Card>

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
