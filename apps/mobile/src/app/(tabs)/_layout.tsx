import type { ErrorBoundaryProps } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Button, Card, Screen, T } from '@/components/ui';
import { FloatingTabBar } from '@/components/tab-bar';
import { t, useLocale } from '@/lib/i18n';
import { useIsDesktop } from '@/lib/layout';

export default function TabLayout() {
  useLocale();
  const desktop = useIsDesktop();
  return (
    <Tabs
      tabBar={(props) => (desktop ? null : <FloatingTabBar {...props} />)}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <Tabs.Screen name="index" options={{ title: t('Start') }} />
      <Tabs.Screen name="termine" options={{ title: t('Termine') }} />
      <Tabs.Screen name="team" options={{ title: t('Team') }} />
      <Tabs.Screen name="verein" options={{ title: t('Verein') }} />
      <Tabs.Screen name="mehr" options={{ title: t('Ich') }} />
    </Tabs>
  );
}

/** Fehlerzustand mit Wiederherstellung: statt einer leeren Fläche eine Meldung und „Neu laden“. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <T variant="title">Hier ist etwas schiefgelaufen</T>
        <T>Die Ansicht konnte nicht angezeigt werden. Deine Daten sind nicht verloren.</T>
        <Button label="Neu laden" icon="refresh" onPress={() => void retry()} />
      </Card>
    </Screen>
  );
}
