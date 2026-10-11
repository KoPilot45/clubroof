/**
 * Newsticker im Verein-Tab (Paket MS): die letzten drei Vereinsnews als Slides, damit Titel
 * vollständig lesbar sind. Wechselt alle 5 Sekunden, hält beim Berühren an und steht bei
 * eingestellter Bewegungsreduzierung still (dann nur Punkte zum Umschalten).
 */
import type { NewsItem } from '@clubroof/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, View } from 'react-native';
import { Card, Chip, T, TeamBadge } from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';

const INTERVAL = 5000;

export function ClubNewsTicker({ items }: { items: NewsItem[] }) {
  const { colors } = useTheme();
  const slides = items.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const show = (next: number) => {
    if (reduceMotion) {
      setIndex(next);
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setIndex(next);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };
  const latest = useRef({ index, count: slides.length, show });
  latest.current = { index, count: slides.length, show };
  useEffect(() => {
    if (paused || reduceMotion || slides.length < 2) return;
    const timer = setInterval(() => {
      const { index: i, count, show: go } = latest.current;
      go((i + 1) % count);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [paused, reduceMotion, slides.length]);

  if (slides.length === 0) return null;
  const current = Math.min(index, slides.length - 1);
  const n = slides[current]!;
  return (
    <Card style={{ gap: 10, minHeight: 132 }}>
      <Pressable
        accessibilityRole="button"
        testID="ticker-slide"
        accessibilityLabel={n.title}
        onPressIn={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={() => router.push(`/news/${n.id}`)}
        style={{ gap: 8 }}
      >
        <Animated.View style={{ gap: 8, opacity }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {n.priority === 'urgent' ? (
              <Chip tone="urgent" icon="warning" label="Dringend" />
            ) : null}
            {n.source.type === 'team' ? (
              <TeamBadge badge={n.source.label} />
            ) : (
              <Chip tone="info" label={n.source.label} />
            )}
            <T variant="caption">{formatAgo(n.publishedAt)}</T>
          </View>
          <T variant="headline" numberOfLines={3} style={{ fontSize: 19, lineHeight: 24 }}>
            {n.title}
          </T>
        </Animated.View>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row' }}>
          {slides.map((s, i) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1} / ${slides.length}`}
              onPress={() => show(i)}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={{
                  width: i === current ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === current ? colors.primary : colors.border,
                }}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/news')}
          hitSlop={8}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <T variant="label" color={colors.primaryText} style={{ fontWeight: '700' }}>
            Alle anzeigen ›
          </T>
        </Pressable>
      </View>
    </Card>
  );
}
