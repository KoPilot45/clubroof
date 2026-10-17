import type { ClubBudgetStatus } from '@clubroof/core';
import { View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { GrowBar } from '@/lib/motion';

/** Fortschrittsbalken Ist gegen Plan; Farbe folgt dem Status, der Status steht zusätzlich als Text daneben. */
export function BudgetBar({
  planned,
  actual,
  status,
}: {
  planned: number;
  actual: number;
  status: ClubBudgetStatus;
}) {
  const { colors } = useTheme();
  const ratio = planned > 0 ? Math.min(1, actual / planned) : actual > 0 ? 1 : 0;
  const fill =
    status === 'over'
      ? colors.status.urgent.solid
      : status === 'warn'
        ? colors.status.action.solid
        : colors.status.success.solid;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}
    >
      <GrowBar percent={ratio * 100} style={{ height: 8, backgroundColor: fill }} />
    </View>
  );
}
