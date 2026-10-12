import { useLocalSearchParams } from 'expo-router';
import { CategoryPage } from '@/components/area-shell';
import { Empty, Screen } from '@/components/ui';
import { cashCategories } from '@/lib/areas';
import { useSignedIn } from '@/lib/session';

/** Ein Reiter der Vereinskasse (Buchung, Beiträge, Planung, Prüfung): farbige Untergruppen mit Kacheln. */
export default function CashAreaScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { me } = useSignedIn();
  const category = cashCategories(me).find((c) => c.key === key);
  if (!category)
    return (
      <Screen edges={[]}>
        <Empty icon="lock-closed-outline" text="Dafür hast du keine Rechte." />
      </Screen>
    );
  return <CategoryPage category={category} />;
}
