/**
 * Bausteine der Anmeldeseite (Paket LG): Farbverlauf-Kopf, Clubroof-Logo und das Siegel
 * „Powered by Clubroof“. Der Verein erscheint mit seinem Verlauf, Clubroof selbst in seinen
 * Hausfarben (#002AFA → #00C3FF).
 */
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Text } from '@/components/app-text';
import { useTheme } from '@/lib/theme';

export const CLUBROOF_BLUE = '#002AFA';
export const CLUBROOF_CYAN = '#00C3FF';

/** Verlaufsfläche für den Kopf der Anmeldeseite; Inhalt liegt darüber. */
export function GradientHeader({
  from,
  to,
  children,
  style,
}: {
  from: string;
  to: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Clubroof-Logo: Schild mit „CR“. `mono` = weißes Schild (auf dem Blauverlauf). */
export function ClubroofLogo({ size = 40, mono }: { size?: number; mono?: boolean }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 40 44" accessibilityLabel="Clubroof">
      <Path
        d="M20 1 L38 6 V20 C38 32 30 39 20 43 C10 39 2 32 2 20 V6 Z"
        fill={mono ? '#FFFFFF' : CLUBROOF_BLUE}
      />
      <Path
        d="M20 5 L34.5 9 V20 C34.5 30 28 35.6 20 39 C12 35.6 5.5 30 5.5 20 V9 Z"
        fill="none"
        stroke={mono ? CLUBROOF_BLUE : '#FFFFFF'}
        strokeWidth={1.4}
      />
      <SvgText
        x="20"
        y="25"
        textAnchor="middle"
        fontWeight="800"
        fontSize={10}
        fill={mono ? CLUBROOF_BLUE : '#FFFFFF'}
      >
        CR
      </SvgText>
    </Svg>
  );
}

/** Siegel „Powered by Clubroof“ (Logo etwa 30 px, Text 15–17 px) oben in der Karte. */
export function PoweredBy() {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Powered by Clubroof"
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <ClubroofLogo size={30} />
      <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: '700' }}>
        Powered by Clubroof
      </Text>
    </View>
  );
}
