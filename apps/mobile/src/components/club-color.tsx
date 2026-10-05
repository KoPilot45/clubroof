import { CLUB_COLOR_KEYS, CLUB_COLOR_LABELS, clubColors } from '@clubroof/design-tokens';
import type { ClubColorKey } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

/** Auswahl der Vereinsfarbe aus dem Farbkonzept (5 geprüfte Farben). */
export function ClubColorPicker({
  value,
  onChange,
}: {
  value: ClubColorKey;
  onChange: (key: ClubColorKey) => void;
}) {
  const { colors, radii, scheme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T variant="label">Vereinsfarbe</T>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
      >
        {CLUB_COLOR_KEYS.map((key) => {
          const active = key === value;
          const swatch = clubColors[key][scheme];
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={CLUB_COLOR_LABELS[key]}
              accessibilityState={{ checked: active }}
              onPress={() => onChange(key)}
              style={{
                alignItems: 'center',
                gap: 6,
                padding: 8,
                minWidth: 64,
                borderRadius: radii.md,
                borderWidth: 2,
                borderColor: active ? colors.primaryText : colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: swatch.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active ? <Ionicons name="checkmark" size={20} color={swatch.onPrimary} /> : null}
              </View>
              <T variant="caption">{CLUB_COLOR_LABELS[key]}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const ORG_UNIT_KIND_LABELS = {
  seniors: 'Senioren',
  youth: 'Jugend',
  women: 'Frauen & Mädchen',
  veterans: 'Alte Herren',
  other: 'Sonstiges',
} as const;
