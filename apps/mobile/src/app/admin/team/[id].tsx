import {
  TEAM_TEMPLATE_INFO,
  type ParticipationMode,
  type TeamDetailAdmin,
  type TeamModule,
  type TeamTemplate,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { PARTICIPATION_OPTIONS } from '@/lib/team-labels';

export default function TeamAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const team = useQuery({
    queryKey: ['admin', 'team', id],
    queryFn: () => api<TeamDetailAdmin>(`/admin/teams/${id}`),
  });
  if (team.isPending) return <Loading />;
  if (team.error)
    return <ErrorNotice message={team.error.message} onRetry={() => team.refetch()} />;
  return <Editor team={team.data} />;
}

function Editor({ team }: { team: TeamDetailAdmin }) {
  const { api, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const [name, setName] = useState(team.name);
  const [badge, setBadge] = useState(team.badge);
  const [ageGroup, setAgeGroup] = useState(team.ageGroup ?? '');
  const [league, setLeague] = useState(team.league ?? '');
  const [template, setTemplate] = useState<TeamTemplate>(team.template);
  const [mode, setMode] = useState<ParticipationMode>(team.participationMode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const key = ['admin', 'team', team.id];
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');

  const save = useMutation({
    mutationFn: () =>
      api<TeamDetailAdmin>(`/admin/teams/${team.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          badge: badge.trim(),
          ageGroup: ageGroup.trim() || null,
          league: league.trim() || null,
          template,
          participationMode: mode,
        },
      }),
    onSuccess: (data) => {
      setError(null);
      setSaved(true);
      queryClient.setQueryData(key, data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });
      void refresh();
    },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (m: TeamModule) =>
      api<TeamModule[]>(`/admin/teams/${team.id}/modules/${m.key}`, {
        method: 'PUT',
        body: { enabled: !m.enabled },
      }),
    onSuccess: (modules) => {
      setError(null);
      queryClient.setQueryData(key, { ...team, modules });
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api<void>(`/admin/teams/${team.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      router.back();
    },
    onError: fail,
  });

  return (
    <Screen edges={[]}>
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <TeamBadge badge={team.badge} />
        <View style={{ flex: 1 }}>
          <T variant="heading">{team.name}</T>
          <T variant="caption">
            {team.orgUnit.name} · {team.players} Spieler · {team.staff} im Trainerteam
          </T>
        </View>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <Section title="Stammdaten">
        <Card style={{ gap: 12 }}>
          <TextField
            label="Name"
            value={name}
            onChangeText={(v) => (setName(v), setSaved(false))}
            maxLength={60}
          />
          <TextField
            label="Kürzel"
            value={badge}
            onChangeText={(v) => (setBadge(v), setSaved(false))}
            maxLength={6}
          />
          <TextField
            label="Altersklasse"
            value={ageGroup}
            onChangeText={(v) => (setAgeGroup(v), setSaved(false))}
            maxLength={30}
          />
          <TextField
            label="Liga"
            value={league}
            onChangeText={(v) => (setLeague(v), setSaved(false))}
            maxLength={80}
          />
          <ChoiceChips
            label="Vorlage"
            options={(Object.keys(TEAM_TEMPLATE_INFO) as TeamTemplate[]).map((k) => ({
              value: k,
              label: TEAM_TEMPLATE_INFO[k].name,
            }))}
            selected={[template]}
            onToggle={(v) => (setTemplate(v), setSaved(false))}
          />
          <ChoiceChips
            label="Teilnahme an Terminen"
            options={PARTICIPATION_OPTIONS}
            selected={[mode]}
            onToggle={(v) => (setMode(v), setSaved(false))}
          />
          {saved ? <Chip tone="success" icon="checkmark-circle" label="Gespeichert" /> : null}
          <Button
            label="Speichern"
            icon="checkmark"
            disabled={name.trim().length < 2 || !badge.trim()}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </Card>
      </Section>

      <Section title="Module der Mannschaft">
        <Card style={{ gap: 12 }}>
          {team.modules.map((m) => (
            <View key={m.key} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="body" style={{ fontWeight: '700' }}>
                  {m.name}
                </T>
                <T variant="caption">
                  {!m.clubEnabled
                    ? 'Im Verein ausgeschaltet'
                    : m.enabled
                      ? `Aktiv${m.inherited ? ' (vom Verein)' : ''}`
                      : 'Aus'}
                </T>
              </View>
              <Button
                label={m.enabled ? 'Ausschalten' : 'Einschalten'}
                variant="outline"
                disabled={!m.clubEnabled && !m.enabled}
                loading={toggle.isPending && toggle.variables?.key === m.key}
                onPress={() => toggle.mutate(m)}
              />
            </View>
          ))}
        </Card>
      </Section>

      {team.players === 0 && team.staff === 0 ? (
        <Button
          label="Mannschaft löschen"
          variant="danger"
          icon="trash-outline"
          loading={remove.isPending}
          onPress={() => remove.mutate()}
        />
      ) : null}
    </Screen>
  );
}
