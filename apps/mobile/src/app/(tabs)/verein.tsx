import type { EventSummary, NewsItem } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { EventRow } from '@/components/events';
import {
  Card,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const TONE = { urgent: 'urgent', important: 'action', info: 'info' } as const;

function NewsCard({ item }: { item: NewsItem }) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {item.source.type === 'team' ? (
            <TeamBadge badge={item.source.label} />
          ) : (
            <Chip tone="info" label={item.source.label} />
          )}
          {item.priority !== 'info' ? (
            <Chip
              tone={TONE[item.priority]}
              label={item.priority === 'urgent' ? 'Dringend' : 'Wichtig'}
            />
          ) : null}
          <T variant="caption">{formatAgo(item.publishedAt)}</T>
        </View>
        <T variant="heading">{item.title}</T>
        <T color={colors.onSurfaceMuted} numberOfLines={open ? undefined : 2}>
          {open ? item.body : (item.teaser ?? item.body)}
        </T>
        <T variant="caption">
          {item.viewCount} Aufrufe{item.likeCount ? ` · ${item.likeCount} gefällt das` : ''}
        </T>
      </Card>
    </Pressable>
  );
}

export default function ClubScreen() {
  const { api } = useSignedIn();
  const news = useQuery({ queryKey: ['news'], queryFn: () => api<NewsItem[]>('/news') });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api<EventSummary[]>('/events') });
  const clubEvents = (events.data ?? []).filter((e) => e.team === null);

  return (
    <Screen
      header={<AppHeader title="Verein" subtitle="Das Vereinsleben auf einen Blick" />}
      refreshing={news.isRefetching}
      onRefresh={() => {
        void news.refetch();
        void events.refetch();
      }}
    >
      <Section title="Veranstaltungen & Termine">
        <Card>
          {events.isPending ? <Loading /> : null}
          {events.data && clubEvents.length === 0 ? (
            <Empty icon="calendar-outline" text="Keine Vereinstermine in den nächsten Wochen." />
          ) : null}
          {clubEvents.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} />
          ))}
        </Card>
      </Section>

      <Section title="Vereinsnews">
        {news.isPending ? <Loading /> : null}
        {news.error ? (
          <ErrorNotice message={news.error.message} onRetry={() => news.refetch()} />
        ) : null}
        {news.data?.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </Section>
    </Screen>
  );
}
