import { Tabs } from 'expo-router/js-tabs';
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
      <Tabs.Screen name="index" options={{ title: t('Home') }} />
      <Tabs.Screen name="team" options={{ title: t('Team') }} />
      <Tabs.Screen name="termine" options={{ title: t('Termine') }} />
      <Tabs.Screen name="verein" options={{ title: t('Verein') }} />
      <Tabs.Screen name="mehr" options={{ title: t('Mehr') }} />
    </Tabs>
  );
}
