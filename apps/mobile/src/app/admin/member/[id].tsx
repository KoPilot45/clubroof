import type {
  MemberDetail,
  MembershipStatus,
  RoleCatalog,
  ScopeType,
  TeamFunction,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import {
  Avatar,
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
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { parseGermanDate, toGermanDate } from '@/lib/dates';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { teamTitle } from '@/lib/team-labels';

const STATUS: Record<MembershipStatus, { label: string; tone: 'success' | 'neutral' | 'urgent' }> =
  {
    active: { label: 'Aktiv', tone: 'success' },
    inactive: { label: 'Passiv', tone: 'neutral' },
    left: { label: 'Ausgetreten', tone: 'urgent' },
  };

type Request = { path: string; method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown };

export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const member = useQuery({
    queryKey: ['admin', 'member', id],
    queryFn: () => api<MemberDetail>(`/admin/members/${id}`),
  });
  const catalog = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => api<RoleCatalog>('/admin/roles'),
    enabled: !!member.data && (member.data.can.manageMembers || member.data.can.manageRoles),
  });
  const change = useMutation({
    mutationFn: (r: Request) =>
      api<MemberDetail>(`/admin/members/${id}${r.path}`, { method: r.method, body: r.body }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['admin', 'member', id], data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Änderung konnte nicht gespeichert werden.',
      ),
  });

  if (member.isPending) return <Loading />;
  if (member.error) return <ErrorNotice error={member.error} onRetry={() => member.refetch()} />;
  const m = member.data;
  const run = (r: Request) => change.mutate(r);

  return (
    <Screen edges={[]} refreshing={member.isRefetching} onRefresh={() => member.refetch()}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={`${m.firstName} ${m.lastName}`} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading">
            {m.firstName} {m.lastName}
          </T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Chip tone={STATUS[m.status].tone} label={STATUS[m.status].label} />
            {m.memberNumber ? <Chip tone="neutral" label={`Nr. ${m.memberNumber}`} /> : null}
            <Chip
              tone="neutral"
              icon="phone-portrait-outline"
              label={m.hasAccount ? 'App-Zugang' : 'ohne App'}
            />
          </View>
        </View>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <MasterData
        member={m}
        onSave={(body) => run({ path: '', method: 'PATCH', body })}
        busy={change.isPending}
      />

      {m.guardians.length || m.children.length ? (
        <Card>
          {[
            ...m.guardians.map((g) => ({ ...g, rel: 'Elternteil' })),
            ...m.children.map((c) => ({ ...c, rel: 'Kind' })),
          ].map((p, i) => (
            <ListRow
              key={p.id}
              first={i === 0}
              title={p.name}
              subtitle={p.rel}
              onPress={() => router.push(`/admin/member/${p.id}`)}
            />
          ))}
        </Card>
      ) : null}

      <Section title="Mannschaften">
        <Card>
          {m.memberships.length === 0 ? (
            <T variant="caption">Keiner Mannschaft zugeordnet.</T>
          ) : null}
          {m.memberships.map((ms, i) => (
            <ListRow
              key={ms.id}
              first={i === 0}
              leading={<TeamBadge badge={ms.team.badge} />}
              title={ms.team.name}
              subtitle={[
                TEAM_FUNCTION_LABELS[ms.function],
                ms.jerseyNumber ? `Nr. ${ms.jerseyNumber}` : null,
                `${ms.upcoming ? 'ab dem' : 'seit dem'} ${toGermanDate(ms.validFrom)}`,
                ms.upcoming ? '(nächste Saison)' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                m.can.manageMembers ? (
                  <Button
                    label="Beenden"
                    variant="outline"
                    onPress={() => run({ path: `/memberships/${ms.id}`, method: 'DELETE' })}
                  />
                ) : undefined
              }
            />
          ))}
        </Card>
        {m.can.manageMembers && m.status !== 'left' && catalog.data ? (
          <AddMembership
            catalog={catalog.data}
            busy={change.isPending}
            onAdd={(body) => run({ path: '/memberships', method: 'POST', body })}
          />
        ) : null}
      </Section>

      <Section title="Rollen & Zusatzaufgaben">
        <Card>
          {m.roles.length === 0 ? <T variant="caption">Keine Rollen vergeben.</T> : null}
          {m.roles.map((r, i) => (
            <ListRow
              key={r.id}
              first={i === 0}
              title={r.roleName}
              subtitle={r.scopeLabel}
              trailing={
                m.can.manageRoles ? (
                  <Button
                    label="Entziehen"
                    variant="outline"
                    onPress={() => run({ path: `/roles/${r.id}`, method: 'DELETE' })}
                  />
                ) : undefined
              }
            />
          ))}
        </Card>
        {m.can.manageRoles && m.status !== 'left' && catalog.data ? (
          <AddRole
            catalog={catalog.data}
            busy={change.isPending}
            onAdd={(body) => run({ path: '/roles', method: 'POST', body })}
          />
        ) : null}
      </Section>

      {m.can.manageMembers && m.status !== 'left' ? (
        <StatusActions
          status={m.status}
          busy={change.isPending}
          onChange={(status) => run({ path: '', method: 'PATCH', body: { status } })}
        />
      ) : null}
      {m.can.manageMembers && m.status === 'left' ? (
        <Button
          label="Wieder aufnehmen"
          variant="outline"
          onPress={() => run({ path: '', method: 'PATCH', body: { status: 'active' } })}
        />
      ) : null}
    </Screen>
  );
}

function MasterData({
  member: m,
  onSave,
  busy,
}: {
  member: MemberDetail;
  onSave: (body: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(m.firstName);
  const [lastName, setLastName] = useState(m.lastName);
  const [birth, setBirth] = useState(toGermanDate(m.birthDate));
  const [email, setEmail] = useState(m.email ?? '');
  const [phone, setPhone] = useState(m.phone ?? '');
  const [number, setNumber] = useState(m.memberNumber ?? '');
  const birthDate = parseGermanDate(birth);

  if (!editing) {
    return (
      <Card>
        <ListRow first title="Geburtsdatum" subtitle={toGermanDate(m.birthDate) || '–'} />
        <ListRow title="E-Mail" subtitle={m.email ?? '–'} />
        <ListRow title="Telefon" subtitle={m.phone ?? '–'} />
        <ListRow title="Mitglied seit" subtitle={toGermanDate(m.memberSince) || '–'} />
        {m.can.manageMembers ? (
          <Button
            label="Stammdaten bearbeiten"
            variant="outline"
            icon="create-outline"
            onPress={() => setEditing(true)}
          />
        ) : null}
      </Card>
    );
  }
  const invalid = !firstName.trim() || !lastName.trim() || birthDate === undefined;
  return (
    <Card style={{ gap: 12 }}>
      <TextField label="Vorname" value={firstName} onChangeText={setFirstName} maxLength={60} />
      <TextField label="Nachname" value={lastName} onChangeText={setLastName} maxLength={60} />
      <TextField
        label="Geburtsdatum (TT.MM.JJJJ)"
        value={birth}
        onChangeText={setBirth}
        maxLength={10}
      />
      <TextField label="E-Mail" value={email} onChangeText={setEmail} maxLength={120} />
      <TextField label="Telefon" value={phone} onChangeText={setPhone} maxLength={30} />
      <TextField label="Mitgliedsnummer" value={number} onChangeText={setNumber} maxLength={30} />
      {birthDate === undefined ? <Chip tone="action" label="Datum bitte als TT.MM.JJJJ" /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label="Abbrechen"
          variant="outline"
          onPress={() => setEditing(false)}
        />
        <Button
          style={{ flex: 1 }}
          label="Speichern"
          icon="checkmark"
          disabled={invalid}
          loading={busy}
          onPress={() => {
            onSave({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              birthDate,
              email: email.trim() || null,
              phone: phone.trim() || null,
              memberNumber: number.trim() || null,
            });
            setEditing(false);
          }}
        />
      </View>
    </Card>
  );
}

function AddMembership({
  catalog,
  onAdd,
  busy,
}: {
  catalog: RoleCatalog;
  onAdd: (body: { teamId: string; function: TeamFunction; jerseyNumber: number | null }) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [fn, setFn] = useState<TeamFunction>('player');
  const [jersey, setJersey] = useState('');
  if (!open)
    return (
      <Button
        label="Mannschaft zuordnen"
        variant="outline"
        icon="add"
        onPress={() => setOpen(true)}
      />
    );
  const number = jersey.trim() ? Number(jersey) : null;
  return (
    <Card style={{ gap: 12 }}>
      <ChoiceChips
        label="Mannschaft"
        options={catalog.teams.map((t) => ({ value: t.id, label: teamTitle(t) }))}
        selected={teamId ? [teamId] : []}
        onToggle={setTeamId}
      />
      <ChoiceChips
        label="Funktion"
        options={(Object.keys(TEAM_FUNCTION_LABELS) as TeamFunction[]).map((f) => ({
          value: f,
          label: TEAM_FUNCTION_LABELS[f],
        }))}
        selected={[fn]}
        onToggle={setFn}
      />
      {fn === 'player' ? (
        <TextField
          label="Rückennummer (optional)"
          value={jersey}
          onChangeText={setJersey}
          maxLength={2}
        />
      ) : null}
      <Button
        label="Zuordnen"
        icon="checkmark"
        disabled={!teamId || (number !== null && !(number >= 1 && number <= 99))}
        loading={busy}
        onPress={() => {
          onAdd({ teamId: teamId!, function: fn, jerseyNumber: fn === 'player' ? number : null });
          setOpen(false);
        }}
      />
    </Card>
  );
}

function AddRole({
  catalog,
  onAdd,
  busy,
}: {
  catalog: RoleCatalog;
  onAdd: (body: { roleKey: string; scopeType: ScopeType; scopeId: string | null }) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  if (!open)
    return (
      <Button
        label="Rolle oder Aufgabe vergeben"
        variant="outline"
        icon="key"
        onPress={() => setOpen(true)}
      />
    );
  const role = catalog.roles.find((r) => r.key === roleKey);
  const scopes = role
    ? catalog.scopes.filter(
        (sc) =>
          (sc.type === 'club' && role.key !== 'coach') ||
          (role.key !== 'fulladmin' && sc.type === role.defaultScope),
      )
    : [];
  const key = (sc: { type: ScopeType; id: string | null }) => `${sc.type}:${sc.id ?? ''}`;
  const chosen =
    scopes.find((sc) => key(sc) === scope) ?? (scopes.length === 1 ? scopes[0] : undefined);
  return (
    <Card style={{ gap: 12 }}>
      <ChoiceChips
        label="Rolle / Aufgabe"
        options={catalog.roles.map((r) => ({ value: r.key, label: r.name }))}
        selected={roleKey ? [roleKey] : []}
        onToggle={(v) => {
          setRoleKey(v);
          setScope(null);
        }}
      />
      {role?.description ? <T variant="caption">{role.description}</T> : null}
      {scopes.length > 1 ? (
        <ChoiceChips
          label="Gilt für"
          options={scopes.map((sc) => ({ value: key(sc), label: sc.label }))}
          selected={chosen ? [key(chosen)] : []}
          onToggle={setScope}
        />
      ) : null}
      <Button
        label="Vergeben"
        icon="checkmark"
        disabled={!role || !chosen}
        loading={busy}
        onPress={() => {
          onAdd({ roleKey: role!.key, scopeType: chosen!.type, scopeId: chosen!.id });
          setOpen(false);
        }}
      />
    </Card>
  );
}

function StatusActions({
  status,
  onChange,
  busy,
}: {
  status: MembershipStatus;
  onChange: (status: MembershipStatus) => void;
  busy: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card style={{ gap: 10 }}>
      <ChoiceChips
        label="Mitgliedsstatus"
        options={[
          { value: 'active', label: 'Aktiv' },
          { value: 'inactive', label: 'Passiv / Fördermitglied' },
        ]}
        selected={[status]}
        onToggle={(v: MembershipStatus) => v !== status && onChange(v)}
      />
      {confirm ? (
        <>
          <T variant="caption">
            Beim Austritt werden alle Mannschaftszuordnungen beendet, Rollen entzogen und der
            App-Zugang gesperrt. Die Daten bleiben für die Vereinsunterlagen erhalten.
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              label="Zurück"
              variant="outline"
              onPress={() => setConfirm(false)}
            />
            <Button
              style={{ flex: 1 }}
              label="Austritt bestätigen"
              variant="danger"
              loading={busy}
              onPress={() => {
                onChange('left');
                setConfirm(false);
              }}
            />
          </View>
        </>
      ) : (
        <Button
          label="Austritt eintragen"
          variant="danger"
          icon="exit-outline"
          onPress={() => setConfirm(true)}
        />
      )}
    </Card>
  );
}
