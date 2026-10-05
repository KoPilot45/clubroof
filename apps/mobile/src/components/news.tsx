import type { NewsItem } from '@clubroof/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Card, Chip, T, TeamBadge } from './ui';

export const NEWS_TONE = { urgent: 'urgent', important: 'action', info: 'info' } as const;

export function NewsSource({ item }: { item: NewsItem }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {item.source.type === 'team' ? (
        <TeamBadge badge={item.source.label} />
      ) : (
        <Chip tone="info" label={item.source.label} />
      )}
      {item.priority !== 'info' ? (
        <Chip
          tone={NEWS_TONE[item.priority]}
          label={item.priority === 'urgent' ? 'Dringend' : 'Wichtig'}
        />
      ) : null}
      <T variant="caption">{formatAgo(item.publishedAt)}</T>
    </View>
  );
}

/** News als Karte in Listen; öffnet die Detailseite. */
export function NewsCard({ item }: { item: NewsItem }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/news/${item.id}`)} accessibilityRole="button">
      <Card style={{ gap: 8 }}>
        <NewsSource item={item} />
        <T variant="heading">{item.title}</T>
        <T color={colors.onSurfaceMuted} numberOfLines={2}>
          {item.teaser ?? item.body}
        </T>
        <T variant="caption">
          {item.viewCount} Aufrufe{item.likeCount ? ` · ${item.likeCount} gefällt das` : ''}
        </T>
      </Card>
    </Pressable>
  );
}
