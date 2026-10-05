import {
  TEAM_TEMPLATE_INFO,
  type ParticipationMode,
  type TeamAdminOverview,
  type TeamDetailAdmin,
  type TeamTemplate,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, ChoiceChips, Chip, Loading, Screen, T, TextField } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { PARTICIPATION_OPTIONS } from '@/lib/team-labels';

export default function NewTeamScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api<TeamAdminOverview>('/admin/teams'),
  });
  const [name, setName] = useState('');
  const [badge, setBadge] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [league, setLeague] = useState('');
  const [unit, setUnit] = useState<string | null>(null);
  const [template, setTemplate] = useState<TeamTemplate>('classic');
  const [mode, setMode] = useState<ParticipationMode>('active_response');
  const [season, setSeason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const o = overview.data;
  const units = (o?.orgUnits ?? []).filter((u) => u.canManage);
  const unitId = unit ?? units[0]?.id ?? null;
  const seasonId = season ?? o?.current.id ?? null;

  const save = useMutation({
    mutationFn: () =>
      api<TeamDetailAdmin>('/admin/teams', {
        method: 'POST',
        body: {
          name: name.trim(),
          badge: badge.trim(),
          ageGroup: ageGroup.trim() || null,
          league: league.trim() || null,
          orgUnitId: unitId,
          template,
          participationMode: mode,
          seasonId,
        },
      }),
    onSuccess: (t) => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      router.replace(`/admin/team/${t.id}`);
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Mannschaft konnte nicht angelegt werden.',
      ),
  });

  if (!o) return <Loading />;
  return (
    <Screen edges={[]}>
      <Card style={{ gap: 12 }}>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="z. B. B-Jugend II"
          maxLength={60}
        />
        <TextField
          label="Kürzel"
          value={badge}
          onChangeText={setBadge}
          placeholder="z. B. B2"
          maxLength={6}
        />
        <TextField
          label="Altersklasse (optional)"
          value={ageGroup}
          onChangeText={setAgeGroup}
          placeholder="z. B. U17"
          maxLength={30}
        />
        <TextField label="Liga (optional)" value={league} onChangeText={setLeague} maxLength={80} />
      </Card>
      <Card style={{ gap: 12 }}>
        <ChoiceChips
          label="Bereich"
          options={units.map((u) => ({ value: u.id, label: u.name }))}
          selected={unitId ? [unitId] : []}
          onToggle={setUnit}
        />
        {o.next ? (
          <ChoiceChips
            label="Saison"
            options={[
              { value: o.current.id, label: `${o.current.name} (laufend)` },
              { value: o.next.id, label: `${o.next.name} (in Vorbereitung)` },
            ]}
            selected={seasonId ? [seasonId] : []}
            onToggle={setSeason}
          />
        ) : null}
        <ChoiceChips
          label="Vorlage"
          options={(Object.keys(TEAM_TEMPLATE_INFO) as TeamTemplate[]).map((k) => ({
            value: k,
            label: TEAM_TEMPLATE_INFO[k].name,
          }))}
          selected={[template]}
          onToggle={setTemplate}
        />
        <T variant="caption">{TEAM_TEMPLATE_INFO[template].description}</T>
        <ChoiceChips
          label="Teilnahme an Terminen"
          options={PARTICIPATION_OPTIONS}
          selected={[mode]}
          onToggle={setMode}
        />
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Button
        label="Mannschaft anlegen"
        icon="checkmark"
        disabled={name.trim().length < 2 || !badge.trim() || !unitId}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}
