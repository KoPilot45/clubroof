import { useLocalSearchParams } from 'expo-router';
import { CategoryPage } from '@/components/area-shell';
import { Empty, Screen } from '@/components/ui';
import { adminCategories } from '@/lib/areas';
import { useSignedIn } from '@/lib/session';
import { useTileInfo, withTileInfo } from '@/lib/tile-info';

/** Eine Kategorie der Verwaltung (Mitglieder, Sport, Inhalte, Verein): Untergruppen mit farbigen Kacheln. */
export default function AdminAreaScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { me } = useSignedIn();
  const info = useTileInfo('admin');
  const category = adminCategories(me).find((c) => c.key === key);
  if (!category)
    return (
      <Screen edges={[]}>
        <Empty icon="lock-closed-outline" text="Dafür hast du keine Rechte." />
      </Screen>
    );
  // Kennzahlen aus den Kachel-Infos der Verwaltung (Mitglieder, offene Freigaben, Anfragen …)
  const withInfo = {
    ...category,
    groups: category.groups.map((g) => ({ ...g, tiles: withTileInfo(g.tiles, info) })),
  };
  return <CategoryPage category={withInfo} />;
}
