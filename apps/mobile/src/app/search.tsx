import type { SearchResponse } from '@clubroof/core';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import {
  Avatar,
  Card,
  Chip,
  DateTile,
  Empty,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { formatDateTile } from '@/lib/format';
import { formatAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Globale Suche (Lupe in der Kopfzeile): Termine, Mitglieder, News und Mannschaften. */
export default function SearchScreen() {
  const { api } = useSignedIn();
  const { colors, sizes } = useTheme();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  // Kurz warten, bis die Eingabe ruht
  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const enabled = q.length >= 2;
  const result = useQuery({
    queryKey: ['search', q],
    queryFn: () => api<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
    enabled,
  });
  const data = result.data;
  const total = data
    ? data.events.length + data.members.length + data.news.length + data.teams.length
    : 0;

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: sizes.input,
          paddingHorizontal: 16,
          borderRadius: 999,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="search-outline" size={20} color={colors.onSurfaceMuted} />
        <TextInput
          autoFocus
          accessibilityLabel={t('Suche')}
          value={input}
          onChangeText={setInput}
          placeholder={t('Termine, Mitglieder, News …')}
          placeholderTextColor={colors.onSurfaceMuted}
          returnKeyType="search"
          maxLength={60}
          style={{ flex: 1, minHeight: sizes.input, color: colors.onSurface, fontSize: 16 }}
        />
      </View>

      {!enabled ? (
        <Empty
          icon="search-outline"
          text="Was suchst du?"
          hint="Suche nach Terminen, Mitgliedern, News und Mannschaften."
        />
      ) : null}
      {enabled && result.isPending ? <Loading /> : null}
      {result.error ? <ErrorNotice error={result.error} onRetry={() => result.refetch()} /> : null}
      {enabled && data && total === 0 ? (
        <Empty
          icon="sad-outline"
          text="Nichts gefunden"
          hint="Prüfe die Schreibweise oder suche nach einem kürzeren Begriff."
        />
      ) : null}

      {data && data.events.length > 0 ? (
        <Section title="Termine">
          <Card>
            {data.events.map((e, i) => (
              <ListRow
                key={e.id}
                first={i === 0}
                onPress={() => router.push(`/events/${e.id}`)}
                leading={
                  <DateTile {...formatDateTile(e.startsAt)} muted={e.status === 'cancelled'} />
                }
                title={e.title}
                strike={e.status === 'cancelled'}
                subtitle={
                  e.teamBadge ? (
                    <View style={{ flexDirection: 'row' }}>
                      <TeamBadge badge={e.teamBadge} />
                    </View>
                  ) : (
                    'Verein'
                  )
                }
                trailing={
                  e.status === 'cancelled' ? (
                    <Chip tone="urgent" icon="close-circle" label="Abgesagt" />
                  ) : null
                }
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {data && data.members.length > 0 ? (
        <Section title="Mitglieder">
          <Card>
            {data.members.map((m, i) => (
              <ListRow
                key={m.personId}
                first={i === 0}
                onPress={() => router.push(`/profile/${m.personId}`)}
                leading={<Avatar name={m.name} size={40} />}
                title={m.name}
                subtitle={m.teamBadges.join(' · ') || undefined}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {data && data.news.length > 0 ? (
        <Section title="News">
          <Card>
            {data.news.map((n, i) => (
              <ListRow
                key={n.id}
                first={i === 0}
                onPress={() => router.push(`/news/${n.id}`)}
                leading={<IconTile name="newspaper" tone="blue" />}
                title={n.title}
                subtitle={n.source}
                trailing={<T variant="caption">{formatAgo(n.publishedAt)}</T>}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {data && data.teams.length > 0 ? (
        <Section title="Mannschaften">
          <Card>
            {data.teams.map((tm, i) => (
              <ListRow
                key={tm.id}
                first={i === 0}
                onPress={() => router.push(`/club-team/${tm.id}`)}
                leading={<IconTile name="shirt-outline" tone="green" />}
                title={tm.name}
                subtitle={[tm.badge, tm.league].filter(Boolean).join(' · ')}
              />
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}
