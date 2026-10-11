import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LoginResponse, PublicClub, TwoFactorChallenge } from '@clubroof/core';
import { Text } from '@/components/app-text';
import {
  CLUBROOF_BLUE,
  CLUBROOF_CYAN,
  ClubroofLogo,
  GradientHeader,
  PoweredBy,
} from '@/components/brand-header';
import { Button, Card, Chip, Crest, T, TextField } from '@/components/ui';
import { request, RequestError } from '@/lib/api';
import { setBrand, useBrand } from '@/lib/brand';
import { readSetting } from '@/lib/flags';
import { clubInitials } from '@/lib/format';
import { useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';
import { ABOUT_LINKS } from '@/lib/about-content';
import { t } from '@/lib/i18n';
import { Linking } from 'react-native';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@sv-gruen-weiss.example' },
  { label: 'Trainer', email: 'trainer@sv-gruen-weiss.example' },
  { label: 'Spieler', email: 'spieler@sv-gruen-weiss.example' },
  { label: 'Eltern', email: 'eltern@sv-gruen-weiss.example' },
  { label: 'Vorstand', email: 'vorstand@sv-gruen-weiss.example' },
  { label: 'Mitglied', email: 'mitglied@sv-gruen-weiss.example' },
];

/**
 * Anmeldeseite (Paket LG). Kennt das Gerät den Verein (nach Einladung oder erster Anmeldung), erscheint
 * sie im Vereinsverlauf mit Logo, Name und Ort und dem Siegel „Powered by Clubroof“. Beim ersten Start
 * zeigt sie Clubroof in Hausfarben mit der Startauswahl: Einladungscode (QR scannen oder Code eingeben),
 * schon ein Konto, Verein einrichten.
 */
export default function LoginScreen() {
  const brand = useBrand();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    void readSetting('brand')
      .then((v) => {
        const [colorTheme, ...rest] = typeof v === 'string' ? v.split('|') : [];
        if (colorTheme && rest.length) setBrand({ colorTheme, shortName: rest.join('|') });
      })
      .finally(() => setChecked(true));
  }, []);
  if (!checked) return <View style={{ flex: 1 }} />;
  // Verein bekannt: Vereinsfarbe; sonst Clubroof-Blau
  return (
    <ThemeProvider clubColor={brand ? (brand.colorTheme as never) : 'blue'}>
      <Login known={!!brand} />
    </ThemeProvider>
  );
}

function Login({ known }: { known: boolean }) {
  const { signIn, adopt } = useSession();
  const [pending, setChallenge] = useState<TwoFactorChallenge | null>(null);
  const challenge = pending?.challenge ?? null;
  const [mailSent, setMailSent] = useState(false);
  const [code, setCode] = useState('');
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'start' | 'login'>(known ? 'login' : 'start');
  const [pub, setPub] = useState<PublicClub | null>(null);

  // Leerer Server → direkt zum Einrichtungsassistenten; sonst Vereinsangaben für den Kopf
  useEffect(() => {
    request<PublicClub>('/public/club')
      .then((p) => {
        if (p.needsSetup) router.replace('/setup');
        else setPub(p);
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

  const sendMailCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await request('/auth/2fa/email/send', { method: 'POST', body: { challenge } });
      setMailSent(true);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Der Code konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  };

  const club = known ? pub?.club : null;
  const logo = mediaUri(club?.logoUrl ?? null);
  const on = colors.hero.onHero;
  const wide = width >= 640;

  // ── Kopf: Vereinsverlauf (bekannt) oder Clubroof-Verlauf ─────────────────
  const header = known ? (
    <GradientHeader
      from={colors.hero.from}
      to={colors.hero.to}
      style={{ paddingTop: insets.top + 28, paddingBottom: 56, alignItems: 'center', gap: 10 }}
    >
      <View
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {logo ? (
          <Image
            source={{ uri: logo }}
            accessibilityLabel={t('Vereinslogo')}
            resizeMode="contain"
            style={{ width: 84, height: 84 }}
          />
        ) : (
          <Crest initials={clubInitials(club?.shortName ?? '')} size={64} />
        )}
      </View>
      <Text
        style={{
          color: on,
          fontSize: 24,
          fontWeight: '800',
          textAlign: 'center',
          paddingHorizontal: 24,
        }}
      >
        {club?.name ?? ''}
      </Text>
      {club && (club.city || club.foundedYear) ? (
        <Text style={{ color: on, fontSize: 14 }}>
          {[club.city, club.foundedYear ? t(`seit ${club.foundedYear}`) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
    </GradientHeader>
  ) : (
    <GradientHeader
      from={CLUBROOF_BLUE}
      to={CLUBROOF_CYAN}
      style={{
        paddingTop: insets.top + (view === 'start' ? 48 : 28),
        paddingBottom: view === 'start' ? 72 : 48,
        alignItems: 'center',
        gap: 10,
      }}
    >
      <ClubroofLogo size={view === 'start' ? 72 : 56} mono />
      <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: 3 }}>
        CLUBROOF
      </Text>
      {view === 'start' ? (
        <Text style={{ color: '#FFFFFF', fontSize: 15 }}>{t('Dein Verein unter einem Dach.')}</Text>
      ) : null}
    </GradientHeader>
  );

  // ── Startauswahl beim ersten Start ───────────────────────────────────────
  const start = (
    <Card style={{ gap: spacing.lg, padding: spacing.lg }}>
      <View style={{ gap: 10 }}>
        <T variant="label" style={{ fontWeight: '700' }}>
          Ich habe einen Einladungscode
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label="QR scannen"
            icon="qr-code-outline"
            style={{ flex: 1 }}
            onPress={() => router.push('/join-code?scan=1')}
          />
          <Button
            label="Code eingeben"
            icon="keypad-outline"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => router.push('/join-code')}
          />
        </View>
      </View>
      <Button
        label="Ich habe schon ein Konto"
        icon="log-in-outline"
        variant="outline"
        onPress={() => setView('login')}
      />
      <Button
        label="Meinen Verein einrichten"
        icon="construct-outline"
        variant="tonal"
        onPress={() => router.push('/setup')}
      />
    </Card>
  );

  const twoFactor = (
    <Card style={{ gap: spacing.md, padding: spacing.lg }}>
      <T variant="section">Bestätigungscode</T>
      <T variant="caption">
        {pending?.methods.includes('app')
          ? 'Gib den 6-stelligen Code aus deiner Authenticator-App ein – oder einen deiner Wiederherstellungscodes.'
          : 'Wir haben dir einen 6-stelligen Code per E-Mail geschickt. Er ist 10 Minuten gültig.'}
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
      {pending?.methods.includes('email') ? (
        <Button
          label={
            mailSent || !pending.methods.includes('app')
              ? 'Code erneut per E-Mail senden'
              : 'Code per E-Mail senden'
          }
          icon="mail-outline"
          variant="outline"
          onPress={() => void sendMailCode()}
          disabled={busy}
        />
      ) : null}
      {mailSent ? <Chip tone="success" icon="mail" label="Der Code ist unterwegs." /> : null}
      <Button
        label="Abbrechen"
        variant="outline"
        onPress={() => {
          setMailSent(false);
          setChallenge(null);
          setCode('');
          setError(null);
        }}
      />
    </Card>
  );

  const form = (
    <Card style={{ gap: spacing.md, padding: spacing.lg }}>
      {known ? <PoweredBy /> : null}
      <TextField
        label="E-Mail-Adresse"
        kind="email"
        value={email}
        onChangeText={setEmail}
        placeholder="name@verein.de"
        onSubmit={() => void submit()}
      />
      <TextField
        label="Passwort"
        kind="password"
        value={password}
        onChangeText={setPassword}
        onSubmit={() => void submit()}
      />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button label="Anmelden" onPress={() => void submit()} loading={busy} />
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/forgot')}
        style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', padding: 4 }}
      >
        <T variant="label" color={colors.primaryText}>
          Passwort vergessen?
        </T>
      </Pressable>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Button
        label="Einladungscode eingeben"
        icon="ticket-outline"
        variant="outline"
        onPress={() => router.push('/join-code')}
      />
      {!known ? (
        <Button
          label="Zurück"
          icon="chevron-back"
          variant="tonal"
          onPress={() => setView('start')}
        />
      ) : null}
    </Card>
  );

  const link = (label: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="link"
      onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 }}
    >
      <T variant="caption" color={colors.primaryText}>
        {label}
      </T>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          {header}
          <View
            style={{
              width: '100%',
              maxWidth: wide ? 460 : 520,
              alignSelf: 'center',
              paddingHorizontal: spacing.xl,
              marginTop: -32,
              gap: spacing.xl,
              paddingBottom: spacing.xl,
            }}
          >
            {challenge ? twoFactor : view === 'start' && !known ? start : form}

            {__DEV__ ? (
              <View style={{ gap: spacing.sm }}>
                <T variant="overline" style={{ textAlign: 'center' }}>
                  Demoverein · Passwort clubroof-demo
                </T>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    justifyContent: 'center',
                  }}
                >
                  {DEMO_ACCOUNTS.map((a) => (
                    <Pressable
                      key={a.email}
                      accessibilityRole="button"
                      onPress={() => {
                        setView('login');
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
                <T variant="overline" style={{ textAlign: 'center' }}>
                  Einrichtungs-Demos (ohne Funktion)
                </T>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    justifyContent: 'center',
                  }}
                >
                  {[
                    { label: 'Vereinseinrichtung', href: '/demo/club' as const },
                    { label: 'Mannschaftseinrichtung', href: '/demo/team' as const },
                  ].map((d) => (
                    <Pressable
                      key={d.href}
                      accessibilityRole="button"
                      onPress={() => router.push(d.href)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryContainer,
                      }}
                    >
                      <T variant="label" color={colors.onPrimaryContainer}>
                        {d.label}
                      </T>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              {link('Hilfe', () => void Linking.openURL(ABOUT_LINKS.support))}
              {link('Datenschutz', () => router.push('/about/datenschutz'))}
              {link('Impressum', () => router.push('/about/impressum'))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
