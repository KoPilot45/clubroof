import type { WikiOverview } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  Card,
  Empty,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  TextField,
} from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { t } from '@/lib/i18n';
import { useMarkSeen } from '@/lib/tile-info';

export default function WikiScreen() {
  const { api } = useSignedIn();
  useMarkSeen('wiki');
  const [q, setQ] = useState('');
  const wiki = useQuery({ queryKey: ['wiki'], queryFn: () => api<WikiOverview>('/wiki') });
  if (wiki.isPending) return <Loading />;
  if (wiki.error) return <ErrorNotice error={wiki.error} onRetry={() => wiki.refetch()} />;
  const w = wiki.data;
  const needle = q.trim().toLowerCase();
  const pages = w.pages.filter(
    (p) =>
      !needle || p.title.toLowerCase().includes(needle) || p.excerpt.toLowerCase().includes(needle),
  );
  return (
    <Screen edges={[]} refreshing={wiki.isRefetching} onRefresh={() => wiki.refetch()}>
      <TextField label="Suchen" value={q} onChangeText={setQ} placeholder={t('z. B. Schlüssel')} />
      {w.canEdit ? (
        <Button label="Artikel schreiben" icon="add" onPress={() => router.push('/wiki/new')} />
      ) : null}
      {pages.length === 0 ? (
        <Card>
          <Empty icon="book-outline" text="Nichts gefunden." />
        </Card>
      ) : null}
      {w.categories.map((c) => {
        const inCat = pages.filter((p) => p.category === c);
        if (inCat.length === 0) return null;
        return (
          <Section key={c} title={c}>
            <Card>
              {inCat.map((p, i) => (
                <ListRow
                  key={p.id}
                  first={i === 0}
                  title={p.title}
                  subtitle={p.excerpt}
                  onPress={() => router.push(`/wiki/${p.id}`)}
                />
              ))}
            </Card>
          </Section>
        );
      })}
    </Screen>
  );
}
