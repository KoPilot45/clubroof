import type { TeamCandidate, TeamFunction, TeamManage, TeamManageMember } from '@clubroof/core';
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
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useToast } from '@/lib/toast';

type Assignable = Exclude<TeamFunction, 'coach'>;
const FUNCTIONS: { value: Assignable; label: string }[] = [
  { value: 'player', label: 'Spieler' },
  { value: 'assistant_coach', label: 'Co-Trainer' },
  { value: 'team_manager', label: 'Betreuer' },
];

/** Mannschaft bearbeiten: Kader, Co-Trainer/Betreuer, Kassenwart, Treffpunkt-Regeln, Spielplan. */
export default function ManageTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const manage = useQuery({
    queryKey: ['team-manage', id],
    queryFn: () => api<TeamManage>(`/teams/${id}/manage`),
  });
  const change = useMutation({
    mutationFn: (r: { path: string; method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) =>
      api<TeamManage>(`/teams/${id}/manage${r.path}`, { method: r.method, body: r.body }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['team-manage', id], data);
      for (const key of ['roster', 'team', 'jerseys', 'cash-treasurers'])
        void queryClient.invalidateQueries({ queryKey: [key, id] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Änderung konnte nicht gespeichert werden.',
      ),
  });
  const [editing, setEditing] = useState<string | null>(null);

  if (manage.isPending) return <Loading />;
  if (manage.error) return <ErrorNotice error={manage.error} onRetry={() => manage.refetch()} />;
  const m = manage.data;
  const staff = m.members.filter((x) => x.function !== 'player');
  const players = m.members.filter((x) => x.function === 'player');
  const row = (x: TeamManageMember, i: number) => (
    <View key={x.membershipId}>
      <ListRow
        first={i === 0}
        title={x.name}
        subtitle={
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <Chip tone="neutral" label={TEAM_FUNCTION_LABELS[x.function]} />
            {x.jerseyNumber != null ? (
              <Chip tone="neutral" label={`Nr. ${x.jerseyNumber}`} />
            ) : null}
            {x.isTreasurer ? <Chip icon="wallet-outline" label="Kassenwart" /> : null}
          </View>
        }
        onPress={
          m.canManageSquad && x.function !== 'coach'
            ? () => setEditing(editing === x.membershipId ? null : x.membershipId)
            : undefined
        }
      />
      {editing === x.membershipId ? (
        <MemberEditor
          member={x}
          busy={change.isPending}
          onSave={(body) => {
            change.mutate({ path: `/members/${x.membershipId}`, method: 'PATCH', body });
            setEditing(null);
          }}
          onRemove={() => {
            change.mutate({ path: `/members/${x.membershipId}`, method: 'DELETE' });
            setEditing(null);
          }}
          onTreasurer={() => router.push(`/teams/${id}/cash-treasurers`)}
        />
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} refreshing={manage.isRefetching} onRefresh={() => manage.refetch()}>
      <T variant="caption">
        {`${m.team.badge} · ${m.team.name}`} – Hier pflegst du Kader und Mannschaftsprofil. Den
        Trainer einer Mannschaft und die Vereinsrollen bestimmt die Vereinsverwaltung.
      </T>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {m.canManageSquad ? (
        <>
          <Section title="Trainerteam">
            <Card>{staff.map(row)}</Card>
          </Section>
          <Section title="Spieler">
            <Card>
              {players.length === 0 ? <T variant="caption">Noch keine Spieler im Kader.</T> : null}
              {players.map(row)}
            </Card>
          </Section>
          <AddPerson
            teamId={id}
            busy={change.isPending}
            onAdd={(body) => change.mutate({ path: '/members', method: 'POST', body })}
          />
          <Section title="Weitere Aufgaben">
            <Card>
              <ListRow
                first
                title="Kassenwart bestimmen"
                subtitle="Spieler oder Eltern der Mannschaft"
                onPress={() => router.push(`/teams/${id}/cash-treasurers`)}
              />
              <ListRow
                title="Rückennummern"
                subtitle="Nummern je Spiel oder fest vergeben"
                onPress={() => router.push(`/teams/${id}/jerseys`)}
              />
            </Card>
          </Section>
        </>
      ) : null}

      {m.canEditProfile ? (
        <>
          <ProfileEditor
            profile={m.profile}
            onSaved={() => {
              toast({ message: 'Mannschaftsprofil gespeichert' });
              void queryClient.invalidateQueries({ queryKey: ['team-manage', id] });
            }}
            teamId={id}
          />
          <Section title="Spielplan">
            <Card>
              <ListRow
                first
                title="Spielplan importieren"
                subtitle="DFBnet-Datei (CSV) → alle Spiele der Mannschaft automatisch anlegen"
                onPress={() => router.push(`/schedule-import?teamId=${id}`)}
              />
            </Card>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function MemberEditor({
  member,
  busy,
  onSave,
  onRemove,
  onTreasurer,
}: {
  member: TeamManageMember;
  busy: boolean;
  onSave: (body: { function: Assignable; jerseyNumber?: number | null }) => void;
  onRemove: () => void;
  onTreasurer: () => void;
}) {
  const [fn, setFn] = useState<Assignable>(member.function as Assignable);
  const [jersey, setJersey] = useState(
    member.jerseyNumber != null ? String(member.jerseyNumber) : '',
  );
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={{ padding: 12, gap: 10 }}>
      <ChoiceChips options={FUNCTIONS} selected={[fn]} onToggle={setFn} />
      {fn === 'player' ? (
        <TextField
          label="Rückennummer"
          kind="code"
          value={jersey}
          onChangeText={(v) => setJersey(v.replace(/\D/g, '').slice(0, 2))}
          maxLength={2}
        />
      ) : null}
      <Button
        label="Speichern"
        icon="checkmark"
        loading={busy}
        onPress={() =>
          onSave({
            function: fn,
            ...(fn === 'player' ? { jerseyNumber: jersey ? Number(jersey) : null } : {}),
          })
        }
      />
      <Button
        label="Kassenwart bestimmen"
        variant="outline"
        icon="wallet-outline"
        onPress={onTreasurer}
      />
      {member.isMe ? null : confirm ? (
        <Button label="Wirklich aus dem Kader nehmen" variant="danger" onPress={onRemove} />
      ) : (
        <Button label="Aus dem Kader nehmen" variant="outline" onPress={() => setConfirm(true)} />
      )}
    </View>
  );
}

function AddPerson({
  teamId,
  busy,
  onAdd,
}: {
  teamId: string;
  busy: boolean;
  onAdd: (body: { personId: string; function: Assignable; jerseyNumber?: number | null }) => void;
}) {
  const { api } = useSignedIn();
  const [q, setQ] = useState('');
  const [fn, setFn] = useState<Assignable>('player');
  const term = q.trim();
  const candidates = useQuery({
    queryKey: ['team-candidates', teamId, term],
    queryFn: () =>
      api<TeamCandidate[]>(`/teams/${teamId}/manage/candidates?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
  });
  return (
    <Section title="Person aus der Vereinsliste hinzufügen">
      <Card style={{ gap: 10 }}>
        <ChoiceChips options={FUNCTIONS} selected={[fn]} onToggle={setFn} />
        <TextField
          label="Suche"
          value={q}
          onChangeText={setQ}
          placeholder="Name oder Mitgliedsnummer"
        />
        {term.length >= 2 && candidates.data?.length === 0 ? (
          <T variant="caption">Niemand gefunden – oder schon im Kader.</T>
        ) : null}
        {(candidates.data ?? []).map((c, i) => (
          <ListRow
            key={c.personId}
            first={i === 0}
            title={c.name}
            subtitle={c.memberNumber ? `Nr. ${c.memberNumber}` : undefined}
            trailing={
              <Button
                label="Hinzufügen"
                size="sm"
                variant="tonal"
                loading={busy}
                onPress={() => {
                  onAdd({ personId: c.personId, function: fn });
                  setQ('');
                }}
              />
            }
          />
        ))}
      </Card>
    </Section>
  );
}

function ProfileEditor({
  profile,
  teamId,
  onSaved,
}: {
  profile: TeamManage['profile'];
  teamId: string;
  onSaved: () => void;
}) {
  const { api } = useSignedIn();
  const [match, setMatch] = useState(profile.matchMeetingMinutes?.toString() ?? '');
  const [training, setTraining] = useState(profile.trainingMeetingMinutes?.toString() ?? '');
  const [point, setPoint] = useState(profile.defaultMeetingPoint ?? '');
  const [aliases, setAliases] = useState(profile.importAliases.join(', '));
  const [position, setPosition] = useState(profile.leaguePosition?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 3);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/teams/${teamId}/profile`, {
        method: 'PUT',
        body: {
          matchMeetingMinutes: match ? Number(match) : null,
          trainingMeetingMinutes: training ? Number(training) : null,
          defaultMeetingPoint: point.trim() || null,
          leaguePosition: position ? Number(position) : null,
          importAliases: aliases
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
        },
      });
      onSaved();
    } catch (e) {
      setError(
        e instanceof RequestError ? e.message : 'Das Profil konnte nicht gespeichert werden.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Treffpunkt-Regeln und Profil">
      <Card style={{ gap: 12 }}>
        <T variant="caption">
          Aus diesen Regeln berechnet die App bei jedem neuen Spiel und Training die Treffzeit. Beim
          einzelnen Termin kannst du sie jederzeit überschreiben. Leer lassen = kein automatisches
          Treffen.
        </T>
        <TextField
          label="Treffen vor Spielbeginn (Minuten)"
          kind="code"
          value={match}
          onChangeText={(v) => setMatch(digits(v))}
          maxLength={3}
        />
        <TextField
          label="Treffen vor Trainingsbeginn (Minuten)"
          kind="code"
          value={training}
          onChangeText={(v) => setTraining(digits(v))}
          maxLength={3}
        />
        <TextField
          label="Standard-Treffpunkt"
          value={point}
          onChangeText={setPoint}
          placeholder="z. B. Vereinsheim"
          maxLength={120}
        />
        <TextField
          label="Tabellenplatz in der Liga (optional)"
          kind="code"
          value={position}
          onChangeText={(v) => setPosition(digits(v).slice(0, 2))}
          maxLength={2}
        />
        <TextField
          label="Schreibweisen im DFBnet (durch Komma getrennt)"
          value={aliases}
          onChangeText={setAliases}
          placeholder="z. B. SV Grün-Weiß II"
        />
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
        <Button label="Speichern" icon="checkmark" loading={busy} onPress={() => void save()} />
      </Card>
    </Section>
  );
}
