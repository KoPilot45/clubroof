import { View } from 'react-native';
import { clubInitials } from '@/lib/format';
import { useBrand } from '@/lib/brand';
import { useTheme } from '@/lib/theme';
import { Crest, T } from './ui';

/** Ladebildschirm in der Vereinsfarbe des Geräts (zuletzt angemeldeter Verein) mit Wappen. */
export function BrandSplash() {
  const { colors } = useTheme();
  const brand = useBrand();
  const name = brand?.shortName ?? 'Clubroof';
  return (
    <View
      accessibilityRole="progressbar"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        backgroundColor: colors.hero.from,
      }}
    >
      <Crest initials={clubInitials(name)} size={84} />
      <T variant="headline" color={colors.hero.onHero}>
        {name}
      </T>
    </View>
  );
}
