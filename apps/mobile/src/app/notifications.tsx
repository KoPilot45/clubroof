import type { NotificationItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import {
  Card,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  type IconName,
} from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { openLink } from '@/lib/links';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const LEVEL = {
  urgent: { tone: 'urgent', icon: 'warning', label: 'Dringend' },
  important: { tone: 'info', icon: 'star', label: 'Wichtig' },
  action: { tone: 'action', icon: 'clipboard', label: 'Aktion' },
  info: { tone: 'archived', icon: 'information-circle', label: 'Info' },
} as const satisfies Record<
  NotificationItem['level'],
  { tone: string; icon: IconName; label: string }
>;

const FILTERS = [
  ['all', 'Alle'],
  ['unread', 'Ungelesen'],
  ['action', 'Aktionen'],
  ['team', 'Team'],
  ['verein', 'Verein'],
  ['verwaltung', 'Verwaltung'],
] as const;

export default function NotificationsScreen() {
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationItem[]>('/notifications'),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });

  const items = (list.data ?? []).filter((n) =>
    filter === 'all'
      ? true
      : filter === 'unread'
        ? !n.readAt
        : filter === 'action'
          ? n.level === 'action'
          : n.category === filter,
  );
  // Dringendes zuerst, dann nach Zeit (Konzept §10)
  items.sort(
    (a, b) =>
      Number(b.level === 'urgent') - Number(a.level === 'urgent') ||
      b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {FILTERS.map(([key, label]) => {
          const active = key === filter;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.surface,
              }}
            >
              <Chip tone={active ? 'primary' : 'neutral'} label={label} />
            </Pressable>
          );
        })}
      </ScrollView>
      {list.isPending ? <Loading /> : null}
      {list.error ? (
        <ErrorNotice message={list.error.message} onRetry={() => list.refetch()} />
      ) : null}
      {list.data ? (
        <Card>
          {items.length === 0 ? (
            <Empty icon="notifications-off-outline" text="Keine Benachrichtigungen." />
          ) : null}
          {items.map((n, i) => {
            const level = LEVEL[n.level];
            return (
              <ListRow
                key={n.id}
                first={i === 0}
                leading={<IconTile name={level.icon} tone={level.tone} />}
                title={(n.readAt ? '' : '● ') + n.title}
                subtitle={n.body ?? undefined}
                trailing={<Chip tone="neutral" label={formatAgo(n.createdAt)} />}
                onPress={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  if (n.link) openLink(n.link);
                }}
              />
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
