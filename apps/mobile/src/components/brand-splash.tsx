import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { clubInitials } from '@/lib/format';
import { useBrand } from '@/lib/brand';
import { t } from '@/lib/i18n';
import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';
import { CLUBROOF_BLUE, CLUBROOF_CYAN, ClubroofLogo, GradientHeader } from './brand-header';
import { Honeycomb } from './honeycomb';
import { Text } from './app-text';
import { T, withAlpha } from './ui';

const nativeDriver = Platform.OS !== 'web';
const RING = 104;
const RING_R = 50;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;
const ARC = (46 / 300) * CIRCUMFERENCE;

/** Endlosschleife eines Werts von 0 nach 1 (steht still, wenn das Gerät „Bewegung reduzieren“ meldet). */
function useLoop(duration: number, reduce: boolean, delay = 0, yoyo = false) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) {
      value.setValue(0);
      return;
    }
    const step = (to: number) =>
      Animated.timing(value, {
        toValue: to,
        duration: yoyo ? duration / 2 : duration,
        easing: yoyo ? Easing.inOut(Easing.sin) : Easing.linear,
        useNativeDriver: nativeDriver,
      });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        yoyo ? Animated.sequence([step(1), step(0)]) : step(1),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, reduce, duration, delay, yoyo]);
  return value;
}

/** Wappen mit Ring: Grundring, ein laufender Strich und leichtes „Atmen“. */
function Emblem({ children, reduce }: { children: React.ReactNode; reduce: boolean }) {
  const spin = useLoop(2200, reduce);
  const breathe = useLoop(2800, reduce, 0, true);
  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill} aria-hidden>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_R}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.22}
          strokeWidth={2}
        />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              {
                rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '270deg'] }),
              },
            ],
          },
        ]}
      >
        <Svg width={RING} height={RING} aria-hidden>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={RING_R}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE - ARC}`}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={{
          transform: [
            { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** Drei Punkte, versetzt pulsierend, mit „Wird geladen“. */
function Dots({ color, reduce }: { color: string; reduce: boolean }) {
  const a = useLoop(1400, reduce, 0, true);
  const b = useLoop(1400, reduce, 200, true);
  const c = useLoop(1400, reduce, 400, true);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[a, b, c].map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: color,
            opacity: reduce ? 0.6 : v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [
              {
                translateY: reduce
                  ? 0
                  : v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Kleines Clubroof-Zeichen: abgerundetes Quadrat im Blauverlauf. */
function ClubroofChip({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} aria-hidden>
      <Defs>
        <LinearGradient id="chip" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={CLUBROOF_BLUE} />
          <Stop offset="1" stopColor={CLUBROOF_CYAN} />
        </LinearGradient>
      </Defs>
      <Rect width={size} height={size} rx={size * 0.28} fill="url(#chip)" />
    </Svg>
  );
}

/**
 * Ladebildschirm (Paket LD, Variante A „Wabenplakat“): Verlauf der Vereinsfarbe wie im Hero mit Waben, Wappen mit
 * laufendem Ring, Vereinsname, unten „Wird geladen“ und „Powered by Clubroof“. Ohne bekannten Verein (erster Start)
 * ist Clubroof die Marke: Blauverlauf, Clubroof-Logo, ohne „Powered by“. Hell läuft der Verlauf in den Hintergrund aus.
 */
export function BrandSplash() {
  const { colors, isDark } = useTheme();
  const brand = useBrand();
  const reduce = useReduceMotion();
  const label = t('Lädt');
  const lowColor = isDark ? withAlpha(colors.hero.onHero, 0.78) : colors.onSurfaceMuted;

  if (!brand) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={{ flex: 1, overflow: 'hidden' }}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden>
          <Defs>
            <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={CLUBROOF_BLUE} />
              <Stop offset="1" stopColor={CLUBROOF_CYAN} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#brand)" />
        </Svg>
        <Honeycomb poster />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            marginTop: -30,
          }}
        >
          <Emblem reduce={reduce}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <ClubroofLogo size={46} mono />
            </View>
          </Emblem>
          <T variant="headline" color="#FFFFFF" style={{ fontSize: 30 }} verbatim>
            Clubroof
          </T>
        </View>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 22,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Dots color="#FFFFFF" reduce={reduce} />
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{t('Wird geladen')}</Text>
        </View>
      </View>
    );
  }

  const name = brand.shortName;
  return (
    <GradientHeader
      containerStyle={{ flex: 1 }}
      style={{
        flex: 1,
        alignItems: 'center',
        // hell liegen Wappen, Name und Zeile im farbigen Kopf (Auslauf darunter), dunkel leicht über der Mitte
        justifyContent: isDark ? 'center' : 'flex-start',
        paddingTop: isDark ? 0 : 96,
        paddingHorizontal: 22,
      }}
    >
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={{
          flex: 1,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: isDark ? 'center' : 'flex-start',
          gap: 14,
          marginTop: isDark ? -30 : 0,
        }}
      >
        <Emblem reduce={reduce}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              shadowColor: '#000000',
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            <T variant="headline" color={colors.hero.to} style={{ fontSize: 25 }} verbatim>
              {clubInitials(name)}
            </T>
          </View>
        </Emblem>
        <T
          variant="headline"
          color={colors.hero.onHero}
          style={{ fontSize: 30, lineHeight: 32, textAlign: 'center' }}
          verbatim
        >
          {name}
        </T>
        <Text
          style={{
            fontSize: 12,
            textAlign: 'center',
            color: withAlpha(colors.hero.onHero, 0.86),
          }}
        >
          {t('Dein Verein unter einem Dach')}
        </Text>
      </View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 22,
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Dots color={isDark ? '#FFFFFF' : colors.primary} reduce={reduce} />
        <Text style={{ fontSize: 11, color: lowColor }}>{t('Wird geladen')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 }}>
          <Text style={{ fontSize: 10.5, letterSpacing: 0.4, color: lowColor }}>
            {t('Powered by')}
          </Text>
          <ClubroofChip size={14} />
          <Text
            style={{ fontSize: 12, fontWeight: '700', letterSpacing: 2.4, color: lowColor }}
            verbatim
          >
            CLUBROOF
          </Text>
        </View>
      </View>
    </GradientHeader>
  );
}

/** Blendet die App über 250 ms ein, wenn der Ladebildschirm endet (bei „Bewegung reduzieren“ sofort). */
export function FadeIn({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduce ? 0 : 250,
      useNativeDriver: nativeDriver,
    }).start();
  }, [opacity, reduce]);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
