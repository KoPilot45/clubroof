import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { Loading } from '@/components/ui';
import { Pressable, View } from 'react-native';

function HomeBackButton() {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück zur Startseite"
      onPress={() => router.replace('/')}
      hitSlop={12}
      style={{ paddingRight: 12 }}
    >
      <Ionicons name="arrow-back" size={24} color={colors.primaryText} />
    </Pressable>
  );
}

function Navigator() {
  const session = useSession();
  const { colors, scheme } = useTheme();

  if (session.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <Loading />
      </View>
    );
  }

  const signedIn = session.status === 'signedIn';
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={({ navigation }) => ({
          // Direkt geöffnete Seiten (Link, Push) haben keinen Verlauf: Pfeil führt zur Startseite
          ...(navigation.canGoBack() ? {} : { headerLeft: () => <HomeBackButton /> }),
          headerShown: false,
          headerTintColor: colors.primaryText,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.onSurface, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: 'Zurück',
        })}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="events/index"
            options={{ headerShown: true, title: 'Alle Termine' }}
          />
          <Stack.Screen name="events/[id]" options={{ headerShown: true, title: 'Termin' }} />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: true, title: 'Benachrichtigungen' }}
          />
          {/* Verwaltungsmodus mit eigener Navigation (app/admin/_layout.tsx) */}
          <Stack.Screen name="admin" />
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
          <Stack.Screen name="wiki/index" options={{ headerShown: true, title: 'Vereinswissen' }} />
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
          <Stack.Screen name="referees" options={{ headerShown: true, title: 'Schiedsrichter' }} />
          <Stack.Screen name="calendar" options={{ headerShown: true, title: 'Kalender' }} />
          <Stack.Screen
            name="notification-settings"
            options={{ headerShown: true, title: 'Benachrichtigungen einstellen' }}
          />
          <Stack.Screen name="news/index" options={{ headerShown: true, title: 'Vereinsnews' }} />
          <Stack.Screen name="news/[id]" options={{ headerShown: true, title: 'News' }} />
          <Stack.Screen name="polls/index" options={{ headerShown: true, title: 'Umfragen' }} />
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
            name="teams/[id]/events"
            options={{ headerShown: true, title: 'Termine' }}
          />
          <Stack.Screen name="profile/[id]" options={{ headerShown: true, title: 'Profil' }} />
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
          <Stack.Screen name="helpers" options={{ headerShown: true, title: 'Helfer gesucht' }} />
          <Stack.Screen name="documents" options={{ headerShown: true, title: 'Dokumente' }} />
          <Stack.Screen name="club-teams" options={{ headerShown: true, title: 'Mannschaften' }} />
          <Stack.Screen name="contacts" options={{ headerShown: true, title: 'Ansprechpartner' }} />
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
            options={{ headerShown: true, title: 'Aufstellung' }}
          />
          <Stack.Screen
            name="match/[id]/report"
            options={{ headerShown: true, title: 'Spielbericht' }}
          />
          <Stack.Screen name="teams/[id]/roster" options={{ headerShown: true, title: 'Kader' }} />
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
            name="teams/[id]/jerseys"
            options={{ headerShown: true, title: 'Rückennummern' }}
          />
          <Stack.Screen
            name="account"
            options={{ headerShown: true, title: 'Konto & Einstellungen' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot" />
          <Stack.Screen name="setup" />
        </Stack.Protected>
        {/* Öffentliche Links aus E-Mails – mit und ohne Anmeldung erreichbar */}
        <Stack.Screen name="join/[token]" />
        <Stack.Screen name="reset/[token]" />
      </Stack>
    </>
  );
}

/** Vereinsfarbe kommt aus dem Verein, hell/dunkel ist persönlich (Standard: hell). */
function ClubTheme({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const club = session.status === 'signedIn' ? session.me.club : null;
  return (
    <ThemeProvider
      clubColor={club?.colorTheme}
      mode={session.status === 'signedIn' ? session.me.user.colorMode : 'light'}
    >
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ClubTheme>
            <Navigator />
          </ClubTheme>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
