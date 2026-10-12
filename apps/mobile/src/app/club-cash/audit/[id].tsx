import type { ClubAuditDetail, ClubAuditFinding } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  HeroCard,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatEuro } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const KIND_LABEL: Record<ClubAuditFinding['kind'], string> = {
  pending: 'Offen',
  checked: 'In Ordnung',
  objection: 'Beanstandet',
  note: 'Vermerk',
};

/** Eine Prüfung: Stichproben abhaken oder beanstanden, Vermerke, Prüfbericht abgeben und öffnen. */
export default function AuditDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const key = ['club-audits', id];
  const data = useQuery({
    queryKey: key,
    queryFn: () => api<ClubAuditDetail>(`/club-cash/audits/${id}`),
  });
  const audits = useQuery({
    queryKey: ['club-audits'],
    queryFn: () => api<{ canAudit: boolean }>('/club-cash/audits'),
  });
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState('5');
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [conclusion, setConclusion] = useState('');

  const done = (d: ClubAuditDetail) => {
    setError(null);
    queryClient.setQueryData(key, d);
    void queryClient.invalidateQueries({ queryKey: ['club-audits'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );
  const post = useMutation({
    mutationFn: (v: { path: string; body: object }) =>
      api<ClubAuditDetail>(`/club-cash/audits/${id}/${v.path}`, { method: 'POST', body: v.body }),
    onSuccess: (d) => {
      done(d);
      setText('');
      setNote('');
      setOpen(null);
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (findingId: string) =>
      api<ClubAuditDetail>(`/club-cash/audits/${id}/findings/${findingId}`, { method: 'DELETE' }),
    onSuccess: done,
    onError: fail,
  });
  const report = (format: 'csv' | 'pdf') =>
    void api<{ url: string }>(`/club-cash/audits/${id}/report-link?format=${format}`)
      .then(({ url }) => Linking.openURL(url))
      .catch(fail);

  const d = data.data;
  if (data.isPending) return <Loading />;
  if (data.error || !d) return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const editable = d.status === 'open' && !!audits.data?.canAudit;
  const sampleCount = Number(count);

  const findingCard = (f: ClubAuditFinding) => (
    <Card key={f.id} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
          {f.entry ? f.entry.purpose : (f.text ?? '')}
        </T>
        <Chip
          tone={
            f.kind === 'objection'
              ? 'urgent'
              : f.kind === 'checked'
                ? 'success'
                : f.kind === 'pending'
                  ? 'action'
                  : 'neutral'
          }
          label={t(KIND_LABEL[f.kind])}
        />
      </View>
      {f.entry ? (
        <T variant="caption">
          {[
            f.entry.bookedOn.split('-').reverse().join('.'),
            `${f.entry.kind === 'expense' ? '−' : '+'}${formatEuro(f.entry.amountCents)}`,
            f.entry.fundName,
            f.entry.accountName,
            f.entry.categoryName,
            f.entry.counterparty,
            f.entry.receiptNo ? `${t('Beleg')} ${f.entry.receiptNo}` : t('ohne Belegnummer'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </T>
      ) : null}
      {f.entry && f.text ? <T variant="caption">{f.text}</T> : null}
      {f.entry?.receiptUrl ? (
        <Button
          label="Beleg ansehen"
          icon="document-attach-outline"
          size="sm"
          variant="outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => void Linking.openURL(f.entry!.receiptUrl!)}
        />
      ) : null}
      {editable && f.entry ? (
        open === f.id ? (
          <View style={{ gap: 8 }}>
            <TextField
              label="Vermerk (bei Beanstandung nötig)"
              value={text}
              onChangeText={setText}
              maxLength={500}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="In Ordnung"
                icon="checkmark"
                style={{ flex: 1 }}
                loading={post.isPending}
                onPress={() =>
                  post.mutate({
                    path: 'findings',
                    body: { kind: 'checked', entryId: f.entry!.id, text: text.trim() || null },
                  })
                }
              />
              <Button
                label="Beanstanden"
                icon="warning"
                variant="danger"
                style={{ flex: 1 }}
                disabled={text.trim().length < 3}
                loading={post.isPending}
                onPress={() =>
                  post.mutate({
                    path: 'findings',
                    body: { kind: 'objection', entryId: f.entry!.id, text: text.trim() },
                  })
                }
              />
            </View>
          </View>
        ) : (
          <Button
            label={f.kind === 'pending' ? 'Prüfen' : 'Ergebnis ändern'}
            size="sm"
            variant="tonal"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              setOpen(f.id);
              setText(f.text ?? '');
            }}
          />
        )
      ) : null}
      {editable && f.kind === 'note' ? (
        <Button
          label="Vermerk entfernen"
          size="sm"
          variant="outline"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => remove.mutate(f.id)}
        />
      ) : null}
    </Card>
  );

  const entries = d.findings.filter((f) => f.kind !== 'note');
  const notes = d.findings.filter((f) => f.kind === 'note');

  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          {`${t('Prüfung')} ${d.year} · ${d.fundName}`}
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 40 }}>
          {d.pending > 0 ? t(`${d.pending} offen`) : t(`${d.checked} geprüft`)}
        </T>
        <T variant="caption" color={colors.hero.onHero}>
          {[
            d.status === 'submitted' ? t('Bericht abgegeben') : t('In Arbeit'),
            t(`${d.objections} Beanstandungen`),
            t(`${d.entryCount} Buchungen im Prüfumfang`),
          ].join(' · ')}
        </T>
      </HeroCard>

      {editable ? (
        <Section title="Stichproben">
          <Card style={{ gap: 10 }}>
            <T variant="caption">
              Die App zieht zufällige Buchungen des Prüfjahrs, die noch nicht ausgewählt sind.
            </T>
            <TextField label="Anzahl" value={count} onChangeText={setCount} />
            <Button
              label="Stichproben ziehen"
              icon="shuffle"
              disabled={!(sampleCount >= 1 && sampleCount <= 50)}
              loading={post.isPending && !open}
              onPress={() => post.mutate({ path: 'sample', body: { count: sampleCount } })}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Buchungen">
        {entries.length === 0 ? (
          <Card>
            <Empty icon="search-outline" text="Noch keine Stichprobe." />
          </Card>
        ) : null}
        {entries.map(findingCard)}
      </Section>

      <Section title="Vermerke">
        {notes.map(findingCard)}
        {editable ? (
          <Card style={{ gap: 10 }}>
            <TextField label="Neuer Vermerk" value={note} onChangeText={setNote} maxLength={500} />
            <Button
              label="Vermerk speichern"
              icon="add"
              variant="outline"
              disabled={note.trim().length < 3}
              onPress={() =>
                post.mutate({ path: 'findings', body: { kind: 'note', text: note.trim() } })
              }
            />
          </Card>
        ) : notes.length === 0 ? (
          <Card>
            <T variant="caption">Keine Vermerke.</T>
          </Card>
        ) : null}
      </Section>

      {editable ? (
        <Section title="Prüfbericht abgeben">
          <Card style={{ gap: 10 }}>
            <T variant="caption">
              Beschreibe das Ergebnis der Prüfung. Danach ist der Bericht abgegeben und nicht mehr
              änderbar; er ist die Grundlage der Entlastung.
            </T>
            <TextField
              label="Ergebnis der Prüfung"
              value={conclusion}
              onChangeText={setConclusion}
              maxLength={2000}
            />
            <Button
              label="Prüfbericht abgeben"
              icon="checkmark-done"
              disabled={conclusion.trim().length < 10 || d.pending > 0}
              loading={post.isPending && !open}
              onPress={() =>
                post.mutate({ path: 'submit', body: { conclusion: conclusion.trim() } })
              }
            />
            {d.pending > 0 ? (
              <T variant="caption">{t(`Es sind noch ${d.pending} Stichproben offen.`)}</T>
            ) : null}
          </Card>
        </Section>
      ) : d.conclusion ? (
        <Section title="Ergebnis der Prüfung">
          <Card>
            <T>{d.conclusion}</T>
          </Card>
        </Section>
      ) : null}

      <Section title="Prüfbericht">
        <View style={{ gap: 10 }}>
          <Button
            label="Als PDF öffnen"
            icon="document-text-outline"
            onPress={() => report('pdf')}
          />
          <Button
            label="Als CSV für Excel"
            icon="download-outline"
            variant="outline"
            onPress={() => report('csv')}
          />
        </View>
      </Section>
    </Screen>
  );
}
