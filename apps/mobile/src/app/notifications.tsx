import type { NotificationItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  SwipeRow,
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

  const readAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
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
  const groups = groupItems(items);
  const unread = (list.data ?? []).some((n) => !n.readAt);

  return (
    <Screen edges={[]} refreshing={list.isRefetching} onRefresh={() => list.refetch()}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label="Alle gelesen"
          icon="checkmark-done"
          variant="outline"
          style={{ flex: 1 }}
          disabled={!unread}
          loading={readAll.isPending}
          onPress={() => readAll.mutate()}
        />
        <Button
          label="Einstellungen"
          icon="settings-outline"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push('/notification-settings')}
        />
      </View>
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
                minHeight: 44,
                justifyContent: 'center',
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
      {list.error ? <ErrorNotice error={list.error} onRetry={() => list.refetch()} /> : null}
      {list.data && items.length === 0 ? (
        <Card>
          <Empty icon="notifications-off-outline" text="Keine Benachrichtigungen." />
        </Card>
      ) : null}
      {groups.map((group) => (
        <Section key={group.title} title={group.title}>
          <Card>
            {group.items.map((n, i) => {
              const level = LEVEL[n.level];
              return (
                <SwipeRowOrPlain key={n.id} unread={!n.readAt} onRead={() => markRead.mutate(n.id)}>
                  <ListRow
                    first={i === 0}
                    leading={<IconTile name={level.icon} tone={level.tone} />}
                    title={(n.readAt ? '' : '● ') + n.title}
                    subtitle={n.body ?? undefined}
                    trailing={<Chip tone="neutral" label={formatAgo(n.createdAt)} />}
                    onPress={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                      if (n.link && n.link !== '/notifications') openLink(n.link);
                    }}
                  />
                </SwipeRowOrPlain>
              );
            })}
          </Card>
        </Section>
      ))}
    </Screen>
  );
}

/** Ungelesene Benachrichtigung: nach links wischen markiert sie als gelesen. */
function SwipeRowOrPlain({
  unread,
  onRead,
  children,
}: {
  unread: boolean;
  onRead: () => void;
  children: React.ReactNode;
}) {
  if (!unread) return <>{children}</>;
  return (
    <SwipeRow label="Gelesen" icon="checkmark-done" onAction={onRead}>
      {children}
    </SwipeRow>
  );
}

/** Ungelesenes Dringendes zuerst, dann Heute / Gestern / Früher (Konzept §10). */
function groupItems(items: NotificationItem[], now = new Date()) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  const yesterday = today - 24 * 60 * 60 * 1000;
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const urgent = sorted.filter((n) => n.level === 'urgent' && !n.readAt);
  const rest = sorted.filter((n) => !urgent.includes(n));
  const at = (n: NotificationItem) => new Date(n.createdAt).getTime();
  return [
    { title: 'Dringend', items: urgent },
    { title: 'Heute', items: rest.filter((n) => at(n) >= today) },
    { title: 'Gestern', items: rest.filter((n) => at(n) >= yesterday && at(n) < today) },
    { title: 'Früher', items: rest.filter((n) => at(n) < yesterday) },
  ].filter((g) => g.items.length > 0);
}
