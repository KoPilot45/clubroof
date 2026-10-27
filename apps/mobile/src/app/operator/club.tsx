import type { AdminRecoveryInfo, SupportView } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';

/**
 * Support-Ansicht eines Vereins (Betreiber): schreibgeschützt und nur mit Freigabe des Vereins. Dazu die
 * Admin-Wiederherstellung für Vereine, in denen kein Admin mehr erreichbar ist.
 */
export default function OperatorClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSession();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const view = useQuery({
    queryKey: ['operator', 'support', id],
    queryFn: () => api<SupportView>(`/operator/clubs/${id}/support`),
    retry: false,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['operator', 'support', id] });
  const onError = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : t('Das hat nicht geklappt.'));
  const start = useMutation({
    mutationFn: () =>
      api<AdminRecoveryInfo>(`/operator/clubs/${id}/admin-recovery`, {
        method: 'POST',
        body: { firstName: first, lastName: last, email, note },
      }),
    onSuccess: () => {
      setError(null);
      setFirst('');
      setLast('');
      setEmail('');
      setNote('');
      void refresh();
    },
    onError,
  });
  const complete = useMutation({
    mutationFn: (rid: string) =>
      api<AdminRecoveryInfo>(`/operator/admin-recoveries/${rid}/complete`, { method: 'POST' }),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError,
  });

  const notGranted =
    view.error instanceof RequestError && view.error.code === 'support_not_granted';
  return (
    <Screen edges={[]} refreshing={view.isRefetching} onRefresh={() => view.refetch()}>
      {view.isPending ? <Loading /> : null}
      {notGranted ? (
        <Empty
          icon="lock-closed-outline"
          text="Der Verein hat den Support-Zugriff nicht freigegeben. Bitte einen Admin des Vereins, ihn unter Verwaltung › Verein › Support freizugeben."
        />
      ) : view.error ? (
        <ErrorNotice error={view.error} onRetry={() => view.refetch()} />
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {view.data ? (
        <>
          <Section title={view.data.club.name}>
            <Card style={{ gap: 4 }}>
              <T>
                {t(
                  `${view.data.counts.members} Mitglieder · ${view.data.counts.teams} Mannschaften`,
                )}
              </T>
              <T variant="caption">
                {t(
                  `Zeitzone ${view.data.club.timezone} · 2-Faktor für Verwaltung ${view.data.club.requireTwoFactor ? 'verlangt' : 'nicht verlangt'}`,
                )}
              </T>
            </Card>
          </Section>
          <Section title="Admins und Vorstand">
            <Card>
              {view.data.admins.map((a, i) => (
                <ListRow
                  key={`${a.name}-${i}`}
                  first={i === 0}
                  title={a.name}
                  subtitle={`${a.email ?? '–'} · ${
                    a.hasAccount
                      ? a.lastLoginAt
                        ? t(`zuletzt angemeldet ${formatDay(a.lastLoginAt)}`)
                        : t('noch nie angemeldet')
                      : t('ohne Zugang')
                  }`}
                />
              ))}
            </Card>
          </Section>
          <Section title="Funktionen">
            <Card style={{ gap: 4 }}>
              {view.data.modules.map((m) => (
                <T key={m.key} variant="caption" verbatim>
                  {`${m.key}: ${m.state}`}
                </T>
              ))}
            </Card>
          </Section>
          <Section title="Letzte Änderungen">
            <Card>
              {view.data.audit.map((a, i) => (
                <ListRow
                  key={`${a.at}-${i}`}
                  first={i === 0}
                  title={a.label}
                  subtitle={`${formatDay(a.at)}, ${formatTime(a.at)} Uhr · ${a.actor ?? 'System'}`}
                />
              ))}
            </Card>
          </Section>
          {view.data.recoveries.length ? (
            <Section title="Angekündigte Admin-Wiederherstellung">
              <Card>
                {view.data.recoveries.map((r, i) => (
                  <ListRow
                    key={r.id}
                    first={i === 0}
                    title={r.name}
                    subtitle={`${r.email} · ${
                      r.status === 'objected'
                        ? t('Widerspruch eingelegt')
                        : r.status === 'ready'
                          ? t('Frist abgelaufen')
                          : t(
                              `frühestens ${formatDay(r.notBefore)}, ${formatTime(r.notBefore)} Uhr`,
                            )
                    }`}
                    trailing={
                      r.status === 'ready' ? (
                        <Button
                          label="Einladung senden"
                          loading={complete.isPending}
                          onPress={() => complete.mutate(r.id)}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}

      <Section title="Admin-Wiederherstellung">
        <Card style={{ gap: 10 }}>
          <T variant="caption">
            Nur wenn kein Admin des Vereins mehr erreichbar ist und du die Berechtigung außerhalb
            der App geprüft hast. Der Verein bekommt eine Ankündigung und kann 48 Stunden
            widersprechen; erst danach geht die Einladung raus.
          </T>
          <TextField label="Vorname" value={first} onChangeText={setFirst} maxLength={60} />
          <TextField label="Nachname" value={last} onChangeText={setLast} maxLength={60} />
          <TextField label="E-Mail-Adresse" kind="email" value={email} onChangeText={setEmail} />
          <TextField
            label="Wie wurde die Berechtigung geprüft?"
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
          />
          <Button
            label="Wiederherstellung ankündigen"
            loading={start.isPending}
            disabled={!first.trim() || !last.trim() || !email.includes('@') || !note.trim()}
            onPress={() => start.mutate()}
          />
        </Card>
      </Section>
    </Screen>
  );
}
