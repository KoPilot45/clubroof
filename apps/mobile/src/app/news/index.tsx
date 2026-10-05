import type { NewsItem } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { NewsCard } from '@/components/news';
import { Empty, ErrorNotice, Loading, Screen } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

export default function NewsListScreen() {
  const { api } = useSignedIn();
  const news = useQuery({ queryKey: ['news'], queryFn: () => api<NewsItem[]>('/news') });
  return (
    <Screen edges={[]} refreshing={news.isRefetching} onRefresh={() => news.refetch()}>
      {news.isPending ? <Loading /> : null}
      {news.error ? (
        <ErrorNotice message={news.error.message} onRetry={() => news.refetch()} />
      ) : null}
      {news.data?.length === 0 ? <Empty icon="newspaper-outline" text="Noch keine News." /> : null}
      {news.data?.map((n) => (
        <NewsCard key={n.id} item={n} />
      ))}
    </Screen>
  );
}
