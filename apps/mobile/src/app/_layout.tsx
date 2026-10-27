import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  OpenSans_400Regular,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
  OpenSans_800ExtraBold,
} from '@expo-google-fonts/open-sans';
import {
  SairaCondensed_700Bold,
  SairaCondensed_800ExtraBold,
} from '@expo-google-fonts/saira-condensed';
import {
  NotoSansArabic_400Regular,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
  NotoSansArabic_800ExtraBold,
} from '@expo-google-fonts/noto-sans-arabic';
import { useFonts } from 'expo-font';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { BrandSplash, FadeIn } from '@/components/brand-splash';
import { setBrand, useBrand } from '@/lib/brand';
import { readSetting, writeSetting } from '@/lib/flags';
import { OfflineBanner } from '@/components/offline-banner';
import { OutboxSync } from '@/components/outbox-sync';
import { ConfirmProvider } from '@/lib/confirm';
import { ToastProvider } from '@/lib/toast';
import { fontState } from '@/lib/fonts';
import { AppLockGate } from '@/components/app-lock-gate';
import { loadAppLock } from '@/lib/app-lock';
import { loadFontScale } from '@/lib/font-scale';
import { hapticError, hapticSuccess, loadHaptics } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/motion';
import { loadAppearance } from '@/lib/appearance';
import { useLocale } from '@/lib/i18n';
import { Platform, View } from 'react-native';
import { DirectionProvider } from '@/lib/direction';
import { NO_SUB_NAV, SubNav } from '@/components/sub-nav';
import { Sidebar } from '@/components/sidebar';
import { useIsDesktop } from '@/lib/layout';
import { SubHeader } from '@/components/sub-header';

/** Web: Seitenhintergrund und `theme-color` folgen dem Theme (Statusleiste, Überscroll-Bereich). */
function useWebChrome(background: string) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', background);
  }, [background]);
}

function Navigator() {
  const session = useSession();
  useLocale();
  useEffect(() => {
    void loadFontScale();
    void loadHaptics();
    void loadAppearance();
    void loadAppLock();
  }, []);
  const { colors, scheme } = useTheme();
  const reduceMotion = useReduceMotion();
  const desktop = useIsDesktop();
  useWebChrome(colors.background);
  // Untere Navigation auf Unterseiten (Paket NV); die Tabs und die Verwaltung bringen eine eigene mit
  const segments = useSegments();
  const [navHeight, setNavHeight] = useState(0);
  // Überschriftenschrift laden; bei einem Fehler bleibt die Systemschrift
  const [fontsLoaded, fontError] = useFonts({
    SairaCondensed_700Bold,
    SairaCondensed_800ExtraBold,
    OpenSans_400Regular,
    OpenSans_600SemiBold,
    OpenSans_700Bold,
    OpenSans_800ExtraBold,
    NotoSansArabic_400Regular,
    NotoSansArabic_600SemiBold,
    NotoSansArabic_700Bold,
    NotoSansArabic_800ExtraBold,
  });
  fontState.ready = fontsLoaded;

  if (session.status === 'loading' || (!fontsLoaded && !fontError)) {
    return <BrandSplash />;
  }

  const signedIn = session.status === 'signedIn';
  const noClub = session.status === 'noClub';
  // Ab 1100 px: feste Seitenleiste statt schwebender Leiste (Paket DT)
  const showSidebar = signedIn && desktop && !PUBLIC_ROUTES.has(segments[0] ?? '');
  const showNav =
    signedIn &&
    !showSidebar &&
    !NO_SUB_NAV.has(segments[0] ?? '') &&
    !(segments[0] === 'match' && (segments as string[])[2] === 'lineup');
  return (
    <ConfirmProvider>
      <FadeIn
        style={{
          flex: 1,
          flexDirection: showSidebar ? 'row' : 'column',
          backgroundColor: colors.background,
        }}
      >
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {showSidebar ? <Sidebar /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <BottomTabBarHeightContext.Provider value={showNav ? navHeight : 0}>
            <Stack
              screenOptions={{
                headerShown: false,
                // sanfte Seitenübergänge (280 ms); „Bewegung reduzieren“ schaltet sie ab
                animation: reduceMotion ? 'none' : 'slide_from_right',
                animationDuration: 280,
                // Kopfzeile mit Pfad wie in den Tabs (Paket NV); öffentliche Seiten bekommen eine einfache
                header: (p) => <SubHeader route={p.route} options={p.options} />,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Protected guard={signedIn}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="events/index"
                  options={{ headerShown: true, title: 'Alle Termine' }}
                />
                <Stack.Screen name="events/[id]" options={{ headerShown: true, title: 'Termin' }} />
                <Stack.Screen
                  name="events/archive"
                  options={{ headerShown: true, title: 'Archiv' }}
                />
                <Stack.Screen
                  name="notifications"
                  options={{ headerShown: true, title: 'Benachrichtigungen' }}
                />
                {/* Verwaltungsmodus mit eigener Navigation (app/admin/_layout.tsx) */}
                <Stack.Screen name="admin" />
                <Stack.Screen name="bausteine" />
                <Stack.Screen
                  name="training-plan/[id]"
                  options={{ headerShown: true, title: 'Trainingsplan' }}
                />
                <Stack.Screen name="exercises" options={{ headerShown: true, title: 'Übungen' }} />
                <Stack.Screen name="forum/index" options={{ headerShown: true, title: 'Forum' }} />
                <Stack.Screen name="forum/[id]" options={{ headerShown: true, title: 'Thema' }} />
                <Stack.Screen
                  name="board"
                  options={{ headerShown: true, title: 'Fundbüro & Marktplatz' }}
                />
                <Stack.Screen
                  name="wiki/index"
                  options={{ headerShown: true, title: 'Vereinswissen' }}
                />
                <Stack.Screen name="wiki/[id]" options={{ headerShown: true, title: 'Artikel' }} />
                <Stack.Screen
                  name="equipment/index"
                  options={{ headerShown: true, title: 'Anlage & Material' }}
                />
                <Stack.Screen
                  name="equipment/rooms"
                  options={{ headerShown: true, title: 'Kabinenplan' }}
                />
                <Stack.Screen
                  name="equipment/items"
                  options={{ headerShown: true, title: 'Material & Schlüssel' }}
                />
                <Stack.Screen
                  name="equipment/damages"
                  options={{ headerShown: true, title: 'Schäden' }}
                />
                <Stack.Screen
                  name="referees"
                  options={{ headerShown: true, title: 'Schiedsrichter' }}
                />
                <Stack.Screen name="calendar" options={{ headerShown: true, title: 'Kalender' }} />
                <Stack.Screen
                  name="notification-settings"
                  options={{ headerShown: true, title: 'Benachrichtigungen einstellen' }}
                />
                <Stack.Screen
                  name="news/index"
                  options={{ headerShown: true, title: 'Vereinsnews' }}
                />
                <Stack.Screen name="news/[id]" options={{ headerShown: true, title: 'News' }} />
                <Stack.Screen
                  name="polls/index"
                  options={{ headerShown: true, title: 'Umfragen' }}
                />
                <Stack.Screen name="polls/[id]" options={{ headerShown: true, title: 'Umfrage' }} />
                <Stack.Screen
                  name="absences/index"
                  options={{ headerShown: true, title: 'Abwesenheiten' }}
                />
                <Stack.Screen
                  name="absences/new"
                  options={{ headerShown: true, title: 'Abwesenheit eintragen' }}
                />
                <Stack.Screen
                  name="profile/[id]"
                  options={{ headerShown: true, title: 'Profil' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-admin"
                  options={{ headerShown: true, title: 'Kassenverwaltung' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-payments"
                  options={{ headerShown: true, title: 'Einzahlungen' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-pay"
                  options={{ headerShown: true, title: 'Bezahlen' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-drinks"
                  options={{ headerShown: true, title: 'Getränke-Strichliste' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-levy"
                  options={{ headerShown: true, title: 'Umlage' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-fees"
                  options={{ headerShown: true, title: 'Beiträge' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-entries"
                  options={{ headerShown: true, title: 'Buchungen' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-treasurers"
                  options={{ headerShown: true, title: 'Kassenwart' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-settings"
                  options={{ headerShown: true, title: 'Bezahlinfos & Einstellungen' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-setup"
                  options={{ headerShown: false, title: 'Mannschaftskasse einrichten' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-closings"
                  options={{ headerShown: true, title: 'Kassenprüfung' }}
                />
                <Stack.Screen
                  name="teams/[id]/fines"
                  options={{ headerShown: true, title: 'Strafenkatalog' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-stats"
                  options={{ headerShown: true, title: 'Kassenstatistik' }}
                />
                <Stack.Screen
                  name="club-team/[id]"
                  options={{ headerShown: true, title: 'Mannschaft' }}
                />
                <Stack.Screen
                  name="helpers"
                  options={{ headerShown: true, title: 'Helfer gesucht' }}
                />
                <Stack.Screen
                  name="documents"
                  options={{ headerShown: true, title: 'Dokumente' }}
                />
                <Stack.Screen name="search" options={{ headerShown: true, title: 'Suche' }} />
                <Stack.Screen
                  name="club-teams"
                  options={{ headerShown: true, title: 'Mannschaften' }}
                />
                <Stack.Screen
                  name="sponsors"
                  options={{ headerShown: true, title: 'Unsere Sponsoren' }}
                />
                <Stack.Screen
                  name="sponsor/[id]"
                  options={{ headerShown: true, title: 'Sponsor' }}
                />
                <Stack.Screen
                  name="expense-claims"
                  options={{ headerShown: true, title: 'Auslage einreichen' }}
                />
                <Stack.Screen
                  name="club-cash-overview"
                  options={{ headerShown: true, title: 'Kassenübersicht' }}
                />
                <Stack.Screen
                  name="club-schedule"
                  options={{ headerShown: true, title: 'Spielplan' }}
                />
                <Stack.Screen
                  name="contacts"
                  options={{ headerShown: true, title: 'Ansprechpartner' }}
                />
                {/* Vereinskasse als eigener Bereich mit Kopfband und Reitern (app/club-cash/_layout.tsx) */}
                <Stack.Screen name="club-cash" />
                <Stack.Screen
                  name="help"
                  options={{ headerShown: true, title: 'Hilfe & Anleitung' }}
                />
                <Stack.Screen
                  name="about/privacy"
                  options={{ headerShown: true, title: 'Privatsphäre-Einstellungen' }}
                />
                <Stack.Screen
                  name="club-calendar"
                  options={{ headerShown: true, title: 'Vereinskalender' }}
                />
                <Stack.Screen
                  name="club-events"
                  options={{ headerShown: true, title: 'Veranstaltungen' }}
                />
                <Stack.Screen
                  name="exchange/index"
                  options={{ headerShown: true, title: 'Gastspieler' }}
                />
                <Stack.Screen
                  name="exchange/[id]"
                  options={{ headerShown: true, title: 'Spielerbedarf' }}
                />
                <Stack.Screen
                  name="exchange/new-demand"
                  options={{ headerShown: true, title: 'Bedarf melden' }}
                />
                <Stack.Screen
                  name="exchange/new-offer"
                  options={{ headerShown: true, title: 'Spieler anbieten' }}
                />
                <Stack.Screen
                  name="facilities/index"
                  options={{ headerShown: true, title: 'Platzbelegung' }}
                />
                <Stack.Screen
                  name="facilities/block-new"
                  options={{ headerShown: true, title: 'Sperrung anlegen' }}
                />
                <Stack.Screen
                  name="documents-upload"
                  options={{ headerShown: true, title: 'Dokument hochladen' }}
                />
                <Stack.Screen
                  name="polls/new"
                  options={{ headerShown: true, title: 'Umfrage erstellen' }}
                />
                <Stack.Screen
                  name="match/[id]/lineup"
                  // Planer ohne Kopfzeile und untere Navigation: Spielfeld, Bank und Kaderleiste sollen zugleich sichtbar sein
                  options={{ headerShown: false, title: 'Aufstellung' }}
                />
                <Stack.Screen
                  name="match/[id]/report"
                  options={{ headerShown: true, title: 'Spielbericht' }}
                />
                <Stack.Screen
                  name="teams/[id]/roster"
                  options={{ headerShown: true, title: 'Kader' }}
                />
                <Stack.Screen
                  name="teams/[id]/stats/index"
                  options={{ headerShown: true, title: 'Statistik' }}
                />
                <Stack.Screen
                  name="teams/[id]/stats/[kind]"
                  options={{ headerShown: true, title: 'Statistik' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash"
                  options={{ headerShown: true, title: 'Mannschaftskasse' }}
                />
                <Stack.Screen
                  name="teams/[id]/cash-new"
                  options={{ headerShown: true, title: 'Buchung erfassen' }}
                />
                <Stack.Screen
                  name="teams/[id]/event-new"
                  options={{ headerShown: true, title: 'Termin anlegen' }}
                />
                <Stack.Screen
                  name="event-edit/[id]"
                  options={{ headerShown: true, title: 'Termin bearbeiten' }}
                />
                <Stack.Screen
                  name="teams/[id]/modules"
                  options={{ headerShown: true, title: 'Funktionen der Mannschaft' }}
                />
                <Stack.Screen
                  name="teams/[id]/tasks"
                  options={{ headerShown: true, title: 'Aufgaben' }}
                />
                <Stack.Screen
                  name="teams/[id]/archive"
                  options={{ headerShown: true, title: 'Archiv' }}
                />
                <Stack.Screen
                  name="teams/[id]/manage"
                  options={{ headerShown: true, title: 'Mannschaft bearbeiten' }}
                />
                <Stack.Screen name="import" options={{ headerShown: true, title: 'Importieren' }} />
                <Stack.Screen name="export" options={{ headerShown: true, title: 'Exportieren' }} />
                <Stack.Screen
                  name="schedule-import"
                  options={{ headerShown: true, title: 'Spielplan importieren' }}
                />
                <Stack.Screen
                  name="teams/[id]/jerseys"
                  options={{ headerShown: true, title: 'Rückennummern' }}
                />
                <Stack.Screen
                  name="account"
                  options={{ headerShown: true, title: 'Konto & Einstellungen' }}
                />
              </Stack.Protected>
              <Stack.Protected guard={noClub}>
                <Stack.Screen name="no-club" />
              </Stack.Protected>
              <Stack.Protected guard={signedIn || noClub}>
                <Stack.Screen
                  name="operator/index"
                  options={{ headerShown: true, title: 'Betreiber-Konsole' }}
                />
                <Stack.Screen
                  name="operator/club"
                  options={{ headerShown: true, title: 'Support-Ansicht' }}
                />
              </Stack.Protected>
              <Stack.Protected guard={!signedIn && !noClub}>
                <Stack.Screen name="login" />
                <Stack.Screen name="forgot" />
                <Stack.Screen name="setup" />
                <Stack.Screen name="demo/club" />
                <Stack.Screen name="demo/team" />
                <Stack.Screen name="demo/cash" />
                <Stack.Screen name="demo/team-cash" />
              </Stack.Protected>
              {/* Öffentliche Links aus E-Mails – mit und ohne Anmeldung erreichbar */}
              <Stack.Screen name="join/[token]" />
              <Stack.Screen
                name="join-code"
                options={{ headerShown: true, title: 'Einladungscode' }}
              />
              <Stack.Screen
                name="about/[page]"
                options={{ headerShown: true, title: 'Über Clubroof' }}
              />
              <Stack.Screen name="reset/[token]" />
            </Stack>
          </BottomTabBarHeightContext.Provider>
          {showNav ? <SubNav routeName={segments.join('/')} onHeight={setNavHeight} /> : null}
        </View>
      </FadeIn>
    </ConfirmProvider>
  );
}

/** Vereinsfarbe kommt aus dem Verein, hell/dunkel ist persönlich (Standard: hell). */
function ClubTheme({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const club = session.status === 'signedIn' ? session.me.club : null;
  const brand = useBrand();
  // Verein dieses Geräts merken: Ladebildschirm und Anmeldung erscheinen beim nächsten Start in seiner Farbe
  useEffect(() => {
    if (club) {
      setBrand({ colorTheme: club.colorTheme, shortName: club.shortName });
      void writeSetting('brand', `${club.colorTheme}|${club.shortName}`);
    }
  }, [club?.colorTheme, club?.shortName]);
  useEffect(() => {
    void readSetting('brand').then((v) => {
      const [colorTheme, ...rest] = typeof v === 'string' ? v.split('|') : [];
      if (colorTheme && rest.length) setBrand({ colorTheme, shortName: rest.join('|') });
    });
  }, []);
  return (
    <ThemeProvider clubColor={club?.colorTheme ?? brand?.colorTheme}>{children}</ThemeProvider>
  );
}

/** Seiten ohne Seitenleiste (Anmeldung, Einrichtung, öffentliche Links) */
const PUBLIC_ROUTES = new Set([
  'login',
  'forgot',
  'setup',
  'demo',
  'join',
  'join-code',
  'reset',
  'no-club',
]);

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
        // Speichern und Fehler: Erfolgs- bzw. Fehler-Impuls an zentraler Stelle (abschaltbar in den Einstellungen);
        // `meta: { silent: true }` schaltet einzelne Aktionen stumm
        mutationCache: new MutationCache({
          onSuccess: (_d, _v, _c, mutation) => {
            if (!mutation.meta?.silent) hapticSuccess();
          },
          onError: (_e, _v, _c, mutation) => {
            if (!mutation.meta?.silent) hapticError();
          },
        }),
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ClubTheme>
            <ToastProvider>
              <DirectionProvider>
                <AppLockGate>
                  <Navigator />
                  <OfflineBanner />
                  <OutboxSync />
                </AppLockGate>
              </DirectionProvider>
            </ToastProvider>
          </ClubTheme>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
