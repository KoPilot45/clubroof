import type { NewsItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Image, View } from 'react-native';
import { NewsSource } from '@/components/news';
import { Button, Card, ErrorNotice, Loading, Screen, T } from '@/components/ui';
import { formatLongDate, formatTime } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { mediaUri } from '@/lib/upload';
import { useTheme } from '@/lib/theme';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { radii } = useTheme();
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

  return (
    <Screen edges={[]} refreshing={news.isRefetching} onRefresh={() => news.refetch()}>
      {news.isPending ? <Loading /> : null}
      {news.error ? <ErrorNotice error={news.error} onRetry={() => news.refetch()} /> : null}
      {n ? (
        <>
          {n.imageUrl ? (
            <Image
              source={{ uri: mediaUri(n.imageUrl)! }}
              accessibilityIgnoresInvertColors
              style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radii.lg }}
            />
          ) : null}
          <View style={{ gap: 10 }}>
            <NewsSource item={n} />
            <T variant="display">{n.title}</T>
            <T variant="caption">
              {formatLongDate(n.publishedAt)}, {formatTime(n.publishedAt)} Uhr · {n.viewCount}{' '}
              Aufrufe
            </T>
          </View>
          <Card style={{ gap: 12 }}>
            {n.body
              .split('\n')
              .filter(Boolean)
              .map((paragraph, i) => (
                <T key={i}>{paragraph}</T>
              ))}
          </Card>
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
