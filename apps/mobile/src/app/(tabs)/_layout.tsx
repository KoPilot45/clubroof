import { Tabs } from 'expo-router/js-tabs';
import { FloatingTabBar } from '@/components/tab-bar';
import { t, useLocale } from '@/lib/i18n';

export default function TabLayout() {
  useLocale();
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('Home') }} />
      <Tabs.Screen name="team" options={{ title: t('Team') }} />
      <Tabs.Screen name="termine" options={{ title: t('Termine') }} />
      <Tabs.Screen name="verein" options={{ title: t('Verein') }} />
      <Tabs.Screen name="mehr" options={{ title: t('Mehr') }} />
    </Tabs>
  );
}
