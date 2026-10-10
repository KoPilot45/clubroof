import type { NewsItem } from '@clubroof/core';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { formatAgo } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { Card, Chip, Empty, IconTile, ListRow, T, TeamBadge, type IconName } from './ui';

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
      <Card
        style={{
          gap: 8,
          // Dringende News als Warnfläche (immer mit der Beschriftung „Dringend“ in der Kopfzeile)
          ...(item.priority === 'urgent'
            ? {
                backgroundColor: colors.status.urgent.container,
                borderColor: colors.status.urgent.solid,
                borderWidth: 1,
              }
            : {}),
        }}
      >
        <NewsSource item={item} />
        <T variant="heading">{item.title}</T>
        <T
          color={
            item.priority === 'urgent' ? colors.status.urgent.onContainer : colors.onSurfaceMuted
          }
          numberOfLines={2}
        >
          {item.teaser ?? item.body}
        </T>
        <T variant="caption">
          {item.viewCount} Aufrufe{item.likeCount ? ` · ${item.likeCount} gefällt das` : ''}
        </T>
      </Card>
    </Pressable>
  );
}

const NEWS_ICON: Record<NewsItem['priority'], IconName> = {
  urgent: 'warning',
  important: 'megaphone',
  info: 'newspaper',
};

/** News als Zeilen in einer Karte (Home, Verein): Icon-Kachel, Titel, Herkunft, Alter. */
export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <Card>
      {items.length === 0 ? (
        <Empty
          icon="newspaper-outline"
          text="Keine Neuigkeiten."
          hint="Neue Meldungen erscheinen hier und als Hinweis."
        />
      ) : null}
      {items.map((n, i) => (
        <ListRow
          key={n.id}
          first={i === 0}
          onPress={() => router.push(`/news/${n.id}`)}
          leading={<IconTile name={NEWS_ICON[n.priority]} tone={NEWS_TONE[n.priority]} />}
          title={n.title}
          subtitle={
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {n.source.type === 'team' ? (
                <TeamBadge badge={n.source.label} />
              ) : (
                <Chip tone="info" label={n.source.label} />
              )}
              {n.priority !== 'info' ? (
                <Chip
                  tone={NEWS_TONE[n.priority]}
                  label={n.priority === 'urgent' ? 'Dringend' : 'Wichtig'}
                />
              ) : null}
            </View>
          }
          trailing={<T variant="caption">{formatAgo(n.publishedAt)}</T>}
        />
      ))}
    </Card>
  );
}
