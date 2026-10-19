import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { CategoryPage } from '@/components/area-shell';
import { Empty, Screen, T } from '@/components/ui';
import { cashCategories } from '@/lib/areas';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Ein Reiter der Vereinskasse (Buchung, Beiträge, Planung, Auswertung): farbige Untergruppen mit Kacheln. */
export default function CashAreaScreen() {
  const { key: raw } = useLocalSearchParams<{ key: string }>();
  const { me } = useSignedIn();
  const { colors } = useTheme();
  // alter Reiter „Prüfung“ heißt jetzt „Auswertung“ (Direktlinks bleiben gültig)
  const key = raw === 'pruefung' ? 'auswertung' : raw;
  const category = cashCategories(me).find((c) => c.key === key);
  if (!category)
    return (
      <Screen edges={[]}>
        <Empty icon="lock-closed-outline" text="Dafür hast du keine Rechte." />
      </Screen>
    );
  const link =
    key === 'beitraege' || key === 'planung' ? (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('Auswertung ansehen')}
        onPress={() => router.navigate('/club-cash/area/auswertung')}
        style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
      >
        <T color={colors.primaryText} style={{ fontWeight: '700' }}>
          Auswertung ansehen ›
        </T>
      </Pressable>
    ) : null;
  return <CategoryPage category={category} top={link} />;
}
