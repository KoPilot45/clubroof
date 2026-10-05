import type { AdminTeam, TeamAdminOverview } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { toGermanDate } from '@/lib/dates';
import { useSignedIn } from '@/lib/session';

function TeamList({ teams, editable }: { teams: AdminTeam[]; editable: boolean }) {
  const units = [...new Map(teams.map((t) => [t.orgUnit.id, t.orgUnit])).values()];
  return (
    <>
      {units.map((u) => (
        <Card key={u.id}>
          <T variant="label" style={{ marginBottom: 4 }}>
            {u.name}
          </T>
          {teams
            .filter((t) => t.orgUnit.id === u.id)
            .map((t, i) => (
              <ListRow
                key={t.id}
                first={i === 0}
                leading={<TeamBadge badge={t.badge} />}
                title={t.name}
                subtitle={`${t.players} Spieler · ${t.staff} im Trainerteam${t.league ? ` · ${t.league}` : ''}`}
                onPress={
                  editable && t.canManage ? () => router.push(`/admin/team/${t.id}`) : undefined
                }
              />
            ))}
        </Card>
      ))}
    </>
  );
}

export default function TeamsAdminScreen() {
  const { api, me, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const [copy, setCopy] = useState<'staff' | 'all'>('staff');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api<TeamAdminOverview>('/admin/teams'),
  });
  const done = (data: TeamAdminOverview) => {
    setError(null);
    setConfirm(false);
    queryClient.setQueryData(['admin', 'teams'], data);
  };
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
  const prepare = useMutation({
    mutationFn: () =>
      api<TeamAdminOverview>('/admin/seasons/next', {
        method: 'POST',
        body: { copyPlayers: copy === 'all' },
      }),
    onSuccess: done,
    onError: fail,
  });
  const start = useMutation({
    mutationFn: (seasonId: string) =>
      api<TeamAdminOverview>(`/admin/seasons/${seasonId}/start`, { method: 'POST' }),
    onSuccess: (data) => {
      done(data);
      void refresh();
      void queryClient.invalidateQueries();
    },
    onError: fail,
  });

  if (overview.isPending) return <Loading />;
  if (overview.error)
    return <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />;
  const o = overview.data;

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {o.orgUnits.some((u) => u.canManage) ? (
        <Button
          label="Mannschaft anlegen"
          icon="add-circle"
          onPress={() => router.push('/admin/team-new')}
        />
      ) : null}
      <Section title={`Saison ${o.current.name} (laufend)`}>
        <TeamList teams={o.teams} editable />
      </Section>

      {me.admin.planSeason ? (
        <Section title="Saisonwechsel">
          {!o.next ? (
            <Card style={{ gap: 10 }}>
              <T>
                Bereite die nächste Saison vor: Alle Mannschaften werden mit Modulen, Fristen,
                Trainerteams und Zusatzaufgaben (z. B. Kassenwart) übernommen. Die laufende Saison
                bleibt unverändert, bis du die neue startest.
              </T>
              <ChoiceChips
                label="Spielerinnen und Spieler"
                options={[
                  { value: 'staff', label: 'Neu zuordnen (Jahrgangswechsel)' },
                  { value: 'all', label: 'Übernehmen' },
                ]}
                selected={[copy]}
                onToggle={setCopy}
              />
              <Button
                label="Nächste Saison vorbereiten"
                icon="calendar"
                loading={prepare.isPending}
                onPress={() => prepare.mutate()}
              />
            </Card>
          ) : (
            <>
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <T variant="heading" style={{ flex: 1 }}>
                    Saison {o.next.name}
                  </T>
                  <Chip tone="action" label="In Vorbereitung" />
                </View>
                <T variant="caption">
                  Beginnt am {toGermanDate(o.next.startsOn)}. Kader planst du unter Verwaltung →
                  Mitglieder: Mannschaften der neuen Saison sind dort mit „(Saison {o.next.name})“
                  gekennzeichnet.
                </T>
              </Card>
              <TeamList teams={o.nextTeams} editable />
              {confirm ? (
                <Card style={{ gap: 10 }}>
                  <T>
                    Mit dem Start wird {o.next.name} zur laufenden Saison. Mannschaftskassen,
                    Mannschaftsdokumente und künftige Termine gehen auf die neuen Mannschaften über.
                    Zuordnungen und Aufgaben der alten Saison enden. Das lässt sich nicht rückgängig
                    machen.
                  </T>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      style={{ flex: 1 }}
                      label="Abbrechen"
                      variant="outline"
                      onPress={() => setConfirm(false)}
                    />
                    <Button
                      style={{ flex: 1 }}
                      label="Jetzt starten"
                      variant="danger"
                      loading={start.isPending}
                      onPress={() => start.mutate(o.next!.id)}
                    />
                  </View>
                </Card>
              ) : (
                <Button
                  label={`Saison ${o.next.name} starten`}
                  icon="play-circle"
                  onPress={() => setConfirm(true)}
                />
              )}
            </>
          )}
        </Section>
      ) : null}
    </Screen>
  );
}
