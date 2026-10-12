/**
 * Bausteine der Anmeldeseite (Paket LG): Farbverlauf-Kopf, Clubroof-Logo und das Siegel
 * „Powered by Clubroof“. Der Verein erscheint mit seinem Verlauf, Clubroof selbst in seinen
 * Hausfarben (#002AFA → #00C3FF).
 */
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Honeycomb } from '@/components/honeycomb';
import { Text } from '@/components/app-text';
import { useTheme } from '@/lib/theme';

export const CLUBROOF_BLUE = '#002AFA';
export const CLUBROOF_CYAN = '#00C3FF';

/**
 * Kopf der Anmeldeseite im Plakat-Stil „Anstoß“: radialer Verlauf in den Farben des Vereins (bzw. Clubroof),
 * unten in den Hintergrund überblendet, dahinter das Waben-Muster; Inhalt liegt darüber.
 */
export function GradientHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={{ overflow: 'hidden' }}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <Defs>
          <RadialGradient
            id={id}
            cx="80"
            cy="0"
            r="120"
            gradientTransform="scale(1 0.6667)"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.anstoss.poster.from} />
            <Stop offset="0.45" stopColor={colors.anstoss.poster.to} />
            <Stop offset="1" stopColor={colors.background} />
          </RadialGradient>
          <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.4" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}f)`} />
      </Svg>
      <Honeycomb poster />
      {/* eigene Ebene über dem Hintergrund: absolut positionierte Flächen liegen sonst über dem Inhalt */}
      <View style={[style, { position: 'relative', zIndex: 1 }]}>{children}</View>
    </View>
  );
}

/**
 * Clubroof-Logo (Original-Vektor „ClubRoof.svg“): Dach mit C und R im Blauverlauf #002AFA → #00C3FF.
 * `mono` = weiß (auf dem Blauverlauf). `size` ist die Höhe.
 */
export function ClubroofLogo({ size = 40, mono }: { size?: number; mono?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg
      width={(size * 950) / 1035}
      height={size}
      viewBox="150 100 950 1035"
      accessibilityLabel="Clubroof"
    >
      {mono ? null : (
        <Defs>
          <LinearGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            x1="200"
            y1="1000"
            x2="1057"
            y2="627"
          >
            <Stop offset="0" stopColor={CLUBROOF_BLUE} />
            <Stop offset="1" stopColor={CLUBROOF_CYAN} />
          </LinearGradient>
        </Defs>
      )}
      <Path
        fill={mono ? '#FFFFFF' : `url(#${id})`}
        d="M 190.5,451 C 190.5,413 211,379 246,356 L 561,158 C 604,131 651,131 694,158 L 1014,365 C 1045,385 1063,418 1063,452 L 1063,538 C 1063,552 1051,561 1039,553 L 672,313 C 643,294 613,294 584,313 L 361,452 C 341,464 330,483 330,506 L 330,876 C 330,930 373,970 425,970 L 707,970 C 715,970 720,973 726,979 L 811,1071 C 821,1082 812,1094 800,1094 L 378,1094 C 276,1094 190.5,1013 190.5,918 Z"
      />
      <Path
        fill={mono ? '#FFFFFF' : `url(#${id})`}
        d="M 477,515.8 L 782,515.8 C 865,515.8 929.5,580 929.5,663.5 C 929.5,738 878,793 806.5,811 L 1057,1071 C 1067,1082 1058,1094 1047,1094 L 930,1094 C 909,1094 892,1087 876,1071 L 609,787 C 578,755 603,703 641,703 L 762,703 C 783,703 800,687 800,666 C 800,645 783,628.5 762,628.5 L 572,628.5 C 560,628.5 551.5,636 551.5,647 L 551.5,902 C 551.5,908 548,911.5 541,911.5 L 437,911.5 C 430,911.5 426.5,908 426.5,902 L 426.5,566 C 426.5,538 449,515.8 477,515.8 Z"
      />
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
