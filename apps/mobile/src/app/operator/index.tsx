import type {
  ClubStatus,
  OperatorClub,
  OperatorInvite,
  OperatorInviteResult,
  OperatorOverview,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
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
import { useConfirmDelete } from '@/lib/confirm';
import { formatAgo } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';

const STATUS: Record<
  ClubStatus,
  { label: string; tone: 'success' | 'info' | 'urgent' | 'neutral' }
> = {
  setup: { label: 'Einrichtung', tone: 'info' },
  active: { label: 'Aktiv', tone: 'success' },
  suspended: { label: 'Gesperrt', tone: 'urgent' },
  archived: { label: 'Archiviert', tone: 'neutral' },
};

const INVITE_STATUS: Record<OperatorInvite['status'], string> = {
  open: 'Offen',
  used: 'Eingelöst',
  expired: 'Abgelaufen',
  revoked: 'Widerrufen',
};

/**
 * Betreiber-Konsole (Mandantenbetrieb): Vereine vorbereiten und sperren. Zeigt nur Kennzahlen,
 * nie Vereinsdaten. Rechte prüft der Server (`/operator/*`).
 */
export default function OperatorScreen() {
  const session = useSession();
  const { api } = session;
  const isOperator =
    session.status === 'signedIn'
      ? session.me.isOperator
      : session.status === 'noClub' && session.account.isOperator;
  const client = useQueryClient();
  const confirm = useConfirmDelete();
  const overview = useQuery({
    queryKey: ['operator', 'overview'],
    queryFn: () => api<OperatorOverview>('/operator/overview'),
    enabled: isOperator,
  });
  const [clubName, setClubName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<OperatorInviteResult | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: ['operator'] });
  const onError = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : t('Das hat nicht geklappt.'));

  const create = useMutation({
    mutationFn: () =>
      api<OperatorInviteResult>('/operator/setup-invites', {
        method: 'POST',
        body: { clubName, adminEmail },
      }),
    onSuccess: (r) => {
      setError(null);
      setFresh(r);
      setClubName('');
      setAdminEmail('');
      void refresh();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/operator/setup-invites/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError,
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: 'active' | 'suspended' | 'archived' }) =>
      api(`/operator/clubs/${v.id}/status`, { method: 'PUT', body: { status: v.status } }),
    onSuccess: refresh,
    onError,
  });

  if (!isOperator) return <Empty icon="lock-closed-outline" text="Kein Zugriff." />;

  const askStatus = (c: OperatorClub, status: 'suspended' | 'archived') =>
    confirm({
      name: c.name,
      title: status === 'suspended' ? t('Verein sperren?') : t('Verein archivieren?'),
      text:
        status === 'suspended'
          ? t(
              `„${c.name}“ wird gesperrt: Alle Mitglieder werden abgemeldet und können sich nicht mehr anmelden. Die Daten bleiben erhalten.`,
            )
          : t(
              `„${c.name}“ wird archiviert: kein Zugang mehr, Daten bleiben für die Aufbewahrungsfristen erhalten.`,
            ),
      confirmLabel: status === 'suspended' ? t('Sperren') : t('Archivieren'),
      onConfirm: () => setStatus.mutateAsync({ id: c.id, status }),
    });

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <T variant="caption">
        Du siehst hier nur Kennzahlen. Vereinsdaten sind für Betreiber nicht einsehbar.
      </T>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <Section title="Neuen Verein vorbereiten">
        <Card style={{ gap: 10 }}>
          <T variant="caption">
            Der Admin des Vereins bekommt einen Einrichtungscode per E-Mail und legt Verein und
            Zugang selbst an.
          </T>
          <TextField label="Name des Vereins" value={clubName} onChangeText={setClubName} />
          <TextField
            label="E-Mail-Adresse des Admins"
            value={adminEmail}
            onChangeText={setAdminEmail}
            kind="email"
          />
          <Button
            label="Code erzeugen und senden"
            icon="mail-outline"
            loading={create.isPending}
            disabled={clubName.trim().length < 2 || !adminEmail.includes('@')}
            onPress={() => create.mutate()}
          />
          {fresh ? (
            <View style={{ gap: 4 }}>
              <T variant="caption">
                {t(
                  `Code für ${fresh.invite.adminEmail} (nur jetzt sichtbar, auch per E-Mail gesendet):`,
                )}
              </T>
              <T variant="figure" selectable>
                {fresh.code}
              </T>
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Vereine">
        {overview.isPending ? <Loading /> : null}
        {overview.error ? (
          <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />
        ) : null}
        {overview.data ? (
          <Card>
            {overview.data.clubs.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                title={c.name}
                subtitle={
                  <T variant="caption">
                    {t(`${c.members} Mitglieder · ${c.teams} Mannschaften`)}
                    {c.lastLoginAt
                      ? ` · ${t('zuletzt angemeldet')} ${formatAgo(c.lastLoginAt)}`
                      : ''}
                  </T>
                }
                trailing={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Chip tone={STATUS[c.status].tone} label={t(STATUS[c.status].label)} />
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Button
                        label="Support"
                        variant="outline"
                        onPress={() =>
                          router.push({ pathname: '/operator/club', params: { id: c.id } })
                        }
                      />
                      {c.status === 'active' ? (
                        <Button
                          label="Sperren"
                          variant="outline"
                          onPress={() => askStatus(c, 'suspended')}
                        />
                      ) : null}
                      {c.status === 'suspended' || c.status === 'archived' ? (
                        <Button
                          label="Entsperren"
                          variant="outline"
                          onPress={() => setStatus.mutate({ id: c.id, status: 'active' })}
                        />
                      ) : null}
                      {c.status === 'suspended' ? (
                        <Button
                          label="Archivieren"
                          variant="outline"
                          onPress={() => askStatus(c, 'archived')}
                        />
                      ) : null}
                    </View>
                  </View>
                }
              />
            ))}
          </Card>
        ) : null}
      </Section>

      <Section title="Einrichtungscodes">
        {overview.data?.invites.length === 0 ? (
          <Empty icon="key-outline" text="Noch keine Einrichtungscodes." />
        ) : null}
        {overview.data?.invites.length ? (
          <Card>
            {overview.data.invites.map((i, idx) => (
              <ListRow
                key={i.id}
                first={idx === 0}
                title={i.clubNameHint}
                subtitle={`${i.adminEmail} · ${t(INVITE_STATUS[i.status])}`}
                trailing={
                  i.status === 'open' ? (
                    <Button
                      label="Widerrufen"
                      variant="outline"
                      onPress={() => revoke.mutate(i.id)}
                    />
                  ) : undefined
                }
              />
            ))}
          </Card>
        ) : null}
      </Section>
      {Platform.OS !== 'web' ? (
        <T variant="caption">Die Betreiber-Konsole ist für die Web-Verwaltung gedacht.</T>
      ) : null}
    </Screen>
  );
}
