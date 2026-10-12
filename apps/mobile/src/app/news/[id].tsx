import type { NewsItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Button, ErrorNotice, GradientFill, Loading, Screen, T } from '@/components/ui';
import { formatLongDate, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { mediaUri } from '@/lib/upload';
import { useTheme } from '@/lib/theme';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const news = useQuery({ queryKey: ['news', id], queryFn: () => api<NewsItem>(`/news/${id}`) });
  const like = useMutation({
    mutationFn: (liked: boolean) =>
      api<NewsItem>(`/news/${id}/like`, { method: liked ? 'PUT' : 'DELETE' }),
    onSuccess: (item) => {
      queryClient.setQueryData(['news', id], item);
      void queryClient.invalidateQueries({ queryKey: ['news'], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
  const n = news.data;
  const [from, to] =
    n?.priority === 'urgent'
      ? colors.anstoss.amberUrgent
        ? colors.anstoss.amberGradient
        : (['#8A1C1C', '#3A0F0F'] as const)
      : n?.priority === 'important'
        ? (['#1E5FA8', '#0F2A4D'] as const)
        : ([colors.anstoss.poster.from, colors.anstoss.poster.to] as const);

  return (
    <Screen edges={[]} refreshing={news.isRefetching} onRefresh={() => news.refetch()}>
      {news.isPending ? <Loading /> : null}
      {news.error ? <ErrorNotice error={news.error} onRetry={() => news.refetch()} /> : null}
      {n ? (
        <>
          <View
            style={{
              minHeight: 200,
              borderRadius: 24,
              overflow: 'hidden',
              padding: 18,
              justifyContent: 'flex-end',
            }}
          >
            <GradientFill from={from} to={to} overlay={0.62} />
            {n.imageUrl ? (
              <>
                <Image
                  source={{ uri: mediaUri(n.imageUrl)! }}
                  accessibilityIgnoresInvertColors
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
                <GradientFill from="transparent" to="transparent" overlay={0.7} />
              </>
            ) : null}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <HeroLabel text={n.source.label} />
                {n.priority !== 'info' ? (
                  <HeroLabel text={n.priority === 'urgent' ? 'Dringend' : 'Wichtig'} />
                ) : null}
              </View>
              <T variant="headline" color="#FFFFFF" style={{ fontSize: 32, lineHeight: 34 }}>
                {n.title}
              </T>
            </View>
          </View>
          <T variant="caption">
            {`${formatLongDate(n.publishedAt)}, ${formatTime(n.publishedAt)} Uhr · ${n.viewCount} Aufrufe`}
          </T>
          <View style={{ gap: 14 }}>
            {n.body
              .split('\n')
              .filter(Boolean)
              .map((paragraph, i) => (
                <T key={i} style={{ fontSize: 16, lineHeight: 25 }}>
                  {paragraph}
                </T>
              ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Button
              label={n.likedByMe ? 'Gefällt mir' : 'Gefällt mir'}
              icon={n.likedByMe ? 'heart' : 'heart-outline'}
              variant={n.likedByMe ? 'primary' : 'outline'}
              loading={like.isPending}
              onPress={() => like.mutate(!n.likedByMe)}
            />
            <T variant="caption">
              {n.likeCount === 1 ? '1 Person gefällt das' : `${n.likeCount} Personen gefällt das`}
            </T>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

/** Beschriftung auf dem Bildkopf: weiße Pille bei 20 %, Großbuchstaben. */
function HeroLabel({ text }: { text: string }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 9,
        backgroundColor: 'rgba(255,255,255,0.2)',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1,
          color: '#FFFFFF',
          textTransform: 'uppercase',
        }}
      >
        {text}
      </Text>
    </View>
  );
}
