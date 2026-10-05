import type { EditorialNews, EditorialOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
} from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';

const STATUS = {
  draft: { label: 'Entwurf', tone: 'neutral' },
  pending_approval: { label: 'Wartet auf Freigabe', tone: 'action' },
  published: { label: 'Veröffentlicht', tone: 'success' },
  archived: { label: 'Zurückgezogen', tone: 'neutral' },
} as const;

function NewsRow({ item, first }: { item: EditorialNews; first: boolean }) {
  return (
    <ListRow
      first={first}
      title={item.title}
      subtitle={
        <View style={{ gap: 4, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Chip tone={STATUS[item.status].tone} label={STATUS[item.status].label} />
            <Chip tone="neutral" label={item.scope.label} />
            {item.reviewNote ? (
              <Chip tone="urgent" icon="chatbox-ellipses" label="Rückmeldung" />
            ) : null}
          </View>
        </View>
      }
      trailing={undefined}
      onPress={() => router.push(`/admin/news/${item.id}`)}
    />
  );
}

export default function EditorialScreen() {
  const { api } = useSignedIn();
  const overview = useQuery({
    queryKey: ['editorial'],
    queryFn: () => api<EditorialOverview>('/editorial/news'),
  });
  const o = overview.data;
  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {overview.isPending ? <Loading /> : null}
      {overview.error ? (
        <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />
      ) : null}
      {o ? (
        <>
          {o.scopes.length ? (
            <Button
              label="Neue News schreiben"
              icon="create"
              onPress={() => router.push('/admin/news/new')}
            />
          ) : null}
          {o.toApprove.length ? (
            <Section title={`Wartet auf deine Freigabe (${o.toApprove.length})`}>
              <Card>
                {o.toApprove.map((n, i) => (
                  <ListRow
                    key={n.id}
                    first={i === 0}
                    title={n.title}
                    subtitle={`${n.scope.label} · von ${n.author ?? 'unbekannt'} · ${formatAgo(n.updatedAt)}`}
                    onPress={() => router.push(`/admin/news/${n.id}`)}
                  />
                ))}
              </Card>
            </Section>
          ) : null}
          <Section title="Meine Entwürfe und Einreichungen">
            {o.mine.length === 0 ? (
              <Empty icon="document-text-outline" text="Keine offenen Entwürfe." />
            ) : null}
            {o.mine.length ? (
              <Card>
                {o.mine.map((n, i) => (
                  <NewsRow key={n.id} item={n} first={i === 0} />
                ))}
              </Card>
            ) : null}
          </Section>
          {o.published.length ? (
            <Section title="Zuletzt veröffentlicht">
              <Card>
                {o.published.map((n, i) => (
                  <NewsRow key={n.id} item={n} first={i === 0} />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
