import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { Loading } from '@/components/ui';
import { View } from 'react-native';

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
        screenOptions={{
          headerShown: false,
          headerTintColor: colors.primaryText,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.onSurface, fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
          headerBackTitle: 'Zurück',
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="events/[id]" options={{ headerShown: true, title: 'Termin' }} />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: true, title: 'Benachrichtigungen' }}
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
          <Stack.Screen name="stats" options={{ headerShown: true, title: 'Meine Statistik' }} />
          <Stack.Screen name="helpers" options={{ headerShown: true, title: 'Helfer gesucht' }} />
          <Stack.Screen name="documents" options={{ headerShown: true, title: 'Dokumente' }} />
          <Stack.Screen name="club-teams" options={{ headerShown: true, title: 'Mannschaften' }} />
          <Stack.Screen name="contacts" options={{ headerShown: true, title: 'Ansprechpartner' }} />
          <Stack.Screen
            name="club-events"
            options={{ headerShown: true, title: 'Termine & Veranstaltungen' }}
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
          <Stack.Screen name="admin/index" options={{ headerShown: true, title: 'Verwaltung' }} />
          <Stack.Screen name="admin/members" options={{ headerShown: true, title: 'Mitglieder' }} />
          <Stack.Screen
            name="admin/member/[id]"
            options={{ headerShown: true, title: 'Mitglied' }}
          />
          <Stack.Screen
            name="admin/member-new"
            options={{ headerShown: true, title: 'Mitglied anlegen' }}
          />
          <Stack.Screen
            name="admin/roles"
            options={{ headerShown: true, title: 'Rollen & Aufgaben' }}
          />
          <Stack.Screen
            name="admin/audit"
            options={{ headerShown: true, title: 'Änderungsprotokoll' }}
          />
          <Stack.Screen
            name="admin/news/index"
            options={{ headerShown: true, title: 'News-Redaktion' }}
          />
          <Stack.Screen
            name="admin/news/new"
            options={{ headerShown: true, title: 'News schreiben' }}
          />
          <Stack.Screen name="admin/news/[id]" options={{ headerShown: true, title: 'News' }} />
          <Stack.Screen
            name="documents-upload"
            options={{ headerShown: true, title: 'Dokument hochladen' }}
          />
          <Stack.Screen
            name="polls/new"
            options={{ headerShown: true, title: 'Umfrage erstellen' }}
          />
          <Stack.Screen name="admin/club" options={{ headerShown: true, title: 'Vereinslogo' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Vereinsfarbe und Modus kommen nach der Anmeldung aus dem Verein. */
function ClubTheme({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const club = session.status === 'signedIn' ? session.me.club : null;
  return (
    <ThemeProvider clubColor={club?.colorTheme} mode={club?.colorMode ?? 'system'}>
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
