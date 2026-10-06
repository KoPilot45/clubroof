import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/lib/theme';
import type { IconName } from '@/components/ui';
import { bodyFontFor, fontState } from '@/lib/fonts';

const icon =
  (name: IconName, active: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={22} color={color} />
  );

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.onSurfaceMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: {
          fontSize: 11,
          ...(fontState.ready
            ? { fontFamily: bodyFontFor('700'), fontWeight: '400' }
            : { fontWeight: '700' }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="team"
        options={{ title: 'Team', tabBarIcon: icon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="termine"
        options={{ title: 'Termine', tabBarIcon: icon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="verein"
        options={{ title: 'Verein', tabBarIcon: icon('shield-outline', 'shield') }}
      />
      <Tabs.Screen
        name="mehr"
        options={{ title: 'Mehr', tabBarIcon: icon('ellipsis-horizontal', 'ellipsis-horizontal') }}
      />
    </Tabs>
  );
}
