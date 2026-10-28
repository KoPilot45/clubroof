import type {
  AccountLinkPreview,
  InviteLink,
  InviteOverview,
  InvitePerson,
  JoinRequestItem,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { QrScanner } from '@/components/qr-scanner';
import { LinkCard } from '@/components/invite-link';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { toGermanDate } from '@/lib/dates';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { teamTitle } from '@/lib/team-labels';
import { useConfirmDelete } from '@/lib/confirm';

type Tab = 'requests' | 'links' | 'people' | 'account';

function RequestCard({ r, onDone }: { r: JoinRequestItem; onDone: (o: InviteOverview) => void }) {
  const { api } = useSignedIn();
  const [person, setPerson] = useState<string>('new');
  const [child, setChild] = useState<string>('new');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      api<InviteOverview>(`/join-requests/${r.id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: approve
          ? {
              personId: person === 'new' ? null : person,
              childPersonId: child === 'new' ? null : child,
            }
          : { note: note.trim() || null },
      }),
    onSuccess: onDone,
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });
  const matchOptions = (list: JoinRequestItem['matches']) => [
    { value: 'new', label: 'Neu anlegen' },
    ...list.map((m) => ({
      value: m.personId,
      label: `${m.name}${m.birthDate ? ` · ${toGermanDate(m.birthDate)}` : ''}`,
    })),
  ];
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TeamBadge badge={r.team.badge} />
        <T variant="heading" style={{ flex: 1 }}>
          {r.name}
        </T>
        <T variant="caption">{formatAgo(r.createdAt)}</T>
      </View>
      <T variant="caption">
        {r.relation === 'parent'
          ? `Elternteil · meldet ${r.child?.name}${r.child?.birthDate ? ` (${toGermanDate(r.child.birthDate)})` : ''} an`
          : `Spieler${r.birthDate ? ` · geb. ${toGermanDate(r.birthDate)}` : ''}`}
        {` · ${r.email}`}
      </T>
      {r.message ? <T>„{r.message}“</T> : null}
      {r.matches.length ? (
        <ChoiceChips
          label="Bereits im Verein erfasst?"
          options={matchOptions(r.matches)}
          selected={[person]}
          onToggle={setPerson}
        />
      ) : null}
      {r.childMatches.length ? (
        <ChoiceChips
          label="Kind bereits erfasst?"
          options={matchOptions(r.childMatches)}
          selected={[child]}
          onToggle={setChild}
        />
      ) : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {rejecting ? (
        <>
          <TextField
            label="Hinweis an die Person (optional)"
            value={note}
            onChangeText={setNote}
            maxLength={300}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              label="Zurück"
              variant="outline"
              onPress={() => setRejecting(false)}
            />
            <Button
              style={{ flex: 1 }}
              label="Ablehnen"
              variant="danger"
              loading={decide.isPending}
              onPress={() => decide.mutate(false)}
            />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            style={{ flex: 1 }}
            label="Freigeben"
            icon="checkmark"
            loading={decide.isPending}
            onPress={() => decide.mutate(true)}
          />
          <Button
            style={{ flex: 1 }}
            label="Ablehnen"
            variant="outline"
            onPress={() => setRejecting(true)}
          />
        </View>
      )}
    </Card>
  );
}

function PersonRow({ p }: { p: InvitePerson }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(p.email ?? '');
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: (send: boolean) =>
      api<InviteLink>('/invitations/person', {
        method: 'POST',
        body: { personId: p.personId, email: email.trim() || null, send },
      }),
    onSuccess: (l, send) => {
      setLink(l);
      setInfo(send ? `E-Mail an ${email.trim()} verschickt.` : null);
      void queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (e) => setInfo(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });
  return (
    <View style={{ gap: 8, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <T variant="body" style={{ fontWeight: '700' }}>
            {p.name}
          </T>
          <T variant="caption">
            {p.context}
            {p.invitedAt ? ` · eingeladen ${formatAgo(p.invitedAt)}` : ''}
          </T>
        </View>
        {!open ? (
          <Button
            label={p.invitedAt ? 'Erneut' : 'Einladen'}
            variant="outline"
            onPress={() => setOpen(true)}
          />
        ) : null}
      </View>
      {open ? (
        <>
          <TextField
            label="E-Mail-Adresse"
            kind="email"
            value={email}
            onChangeText={setEmail}
            maxLength={120}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              style={{ flex: 1 }}
              label="Per E-Mail senden"
              icon="mail"
              disabled={!email.includes('@')}
              loading={invite.isPending && invite.variables === true}
              onPress={() => invite.mutate(true)}
            />
            <Button
              style={{ flex: 1 }}
              label="Link/QR zeigen"
              variant="outline"
              loading={invite.isPending && invite.variables === false}
              onPress={() => invite.mutate(false)}
            />
          </View>
          {info ? <Chip tone="info" label={info} /> : null}
          {link ? <LinkCard link={link} title={`Einladung für ${p.name}`} /> : null}
        </>
      ) : null}
    </View>
  );
}

/** Konto ohne Verein aufnehmen: Code (oder QR-Code) des Kontos eingeben, Namen prüfen, Mannschaft wählen. */
function AttachAccount({ teams }: { teams: InviteOverview['teams'] }) {
  const { api } = useSignedIn();
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<AccountLinkPreview | null>(null);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [teamId, setTeamId] = useState<string | null>(teams.length === 1 ? teams[0]!.id : null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.');
  const clean = (v: string) => v.replace('clubroof-konto:', '').trim();

  const lookup = useMutation({
    mutationFn: (raw: string) =>
      api<AccountLinkPreview>(`/account-links/${encodeURIComponent(clean(raw))}`),
    onSuccess: (p, raw) => {
      setError(null);
      setCode(clean(raw));
      setPreview(p);
      const [f = '', ...rest] = p.displayName.split(' ');
      setFirst(f);
      setLast(rest.join(' '));
    },
    onError: fail,
  });
  const attach = useMutation({
    mutationFn: () =>
      api('/members/attach-account', {
        method: 'POST',
        body: { code, firstName: first.trim(), lastName: last.trim(), teamId },
      }),
    onSuccess: () => setDone(true),
    onError: fail,
  });

  if (done)
    return (
      <Card style={{ gap: 10 }}>
        <Chip tone="success" icon="checkmark-circle" label="Konto aufgenommen." />
        <Button
          label="Weiteres Konto aufnehmen"
          variant="outline"
          onPress={() => {
            setDone(false);
            setPreview(null);
            setCode(null);
            setInput('');
          }}
        />
      </Card>
    );
  return (
    <Card style={{ gap: 12 }}>
      <T variant="caption">
        Wer schon ein Konto, aber noch keinen Verein hat, zeigt dir den Code oder QR-Code aus der
        App. Gib ihn hier ein oder scanne ihn.
      </T>
      {!preview ? (
        scanning ? (
          <QrScanner
            onScan={(data) => {
              setScanning(false);
              setInput(clean(data));
              lookup.mutate(data);
            }}
            onClose={() => setScanning(false)}
          />
        ) : (
          <>
            <TextField
              label="Code des Kontos"
              value={input}
              onChangeText={setInput}
              kind="code"
              onSubmit={() => lookup.mutate(input)}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Platform.OS !== 'web' ? (
                <Button
                  style={{ flex: 1 }}
                  label="Scannen"
                  variant="outline"
                  icon="qr-code-outline"
                  onPress={() => setScanning(true)}
                />
              ) : null}
              <Button
                style={{ flex: 1 }}
                label="Prüfen"
                loading={lookup.isPending}
                disabled={input.trim().length < 8}
                onPress={() => lookup.mutate(input)}
              />
            </View>
          </>
        )
      ) : (
        <>
          <T>{`${preview.displayName} · ${preview.email}`}</T>
          <TextField label="Vorname" value={first} onChangeText={setFirst} maxLength={60} />
          <TextField label="Nachname" value={last} onChangeText={setLast} maxLength={60} />
          {teams.length ? (
            <ChoiceChips
              label="Mannschaft"
              options={teams.map((t2) => ({ value: t2.id, label: `${t2.badge} ${t2.name}` }))}
              selected={teamId ? [teamId] : []}
              onToggle={(v) => setTeamId(v)}
            />
          ) : null}
          <Button
            label="In den Verein aufnehmen"
            icon="person-add-outline"
            loading={attach.isPending}
            disabled={!first.trim() || !last.trim()}
            onPress={() => attach.mutate()}
          />
        </>
      )}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
    </Card>
  );
}

export default function InvitesScreen() {
  const confirmDelete = useConfirmDelete();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('requests');
  const [error, setError] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<InviteOverview>('/invitations'),
  });
  const setData = (o: InviteOverview) => {
    setError(null);
    queryClient.setQueryData(['invitations'], o);
  };
  const teamLink = useMutation({
    mutationFn: (v: { teamId: string; revoke: boolean }) =>
      api<InviteLink | void>(`/teams/${v.teamId}/invite-link`, {
        method: v.revoke ? 'DELETE' : 'POST',
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['invitations'] }),
    onError: (e) => setError(e instanceof RequestError ? e.message : 'Das hat nicht geklappt.'),
  });

  if (overview.isPending) return <Loading />;
  if (overview.error)
    return <ErrorNotice error={overview.error} onRetry={() => overview.refetch()} />;
  const o = overview.data;

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <ChoiceChips
        options={[
          { value: 'requests', label: `Anfragen (${o.requests.length})` },
          { value: 'links', label: 'Mannschafts-Links' },
          { value: 'people', label: `Ohne Zugang (${o.people.length})` },
          { value: 'account', label: 'Konto aufnehmen' },
        ]}
        selected={[tab]}
        onToggle={setTab}
      />
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {tab === 'requests' ? (
        o.requests.length ? (
          o.requests.map((r) => <RequestCard key={r.id} r={r} onDone={setData} />)
        ) : (
          <Empty icon="checkmark-done-outline" text="Keine offenen Beitrittsanfragen." />
        )
      ) : null}

      {tab === 'links' ? (
        <>
          <T variant="caption">
            Ein Mannschafts-Link (oder QR-Code als Aushang) lässt neue Spieler und Eltern eine
            Beitrittsanfrage stellen. Du gibst jede Anfrage frei. Ein neuer Link macht den alten
            ungültig.
          </T>
          {o.teams.map((t) => (
            <Section key={t.id} title={teamTitle(t)}>
              <Card style={{ gap: 10 }}>
                {t.link ? (
                  <>
                    <LinkCard link={t.link} title={`Beitritt ${t.name}`} />
                    <T variant="caption" style={{ textAlign: 'center' }}>
                      {t.link.uses} Anfragen freigegeben
                    </T>
                  </>
                ) : (
                  <T variant="caption">Kein aktiver Link.</T>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    style={{ flex: 1 }}
                    label={t.link ? 'Neuer Link' : 'Link erstellen'}
                    icon="qr-code-outline"
                    loading={
                      teamLink.isPending &&
                      teamLink.variables?.teamId === t.id &&
                      !teamLink.variables.revoke
                    }
                    onPress={() => teamLink.mutate({ teamId: t.id, revoke: false })}
                  />
                  {t.link ? (
                    <Button
                      style={{ flex: 1 }}
                      label="Zurückziehen"
                      variant="outline"
                      onPress={() =>
                        confirmDelete({
                          title: 'Wirklich zurückziehen?',
                          confirmLabel: 'Zurückziehen',
                          name: teamTitle(t),
                          text: `Der Beitrittslink für „${teamTitle(t)}“ wird ungültig.`,
                          onConfirm: () => teamLink.mutate({ teamId: t.id, revoke: true }),
                        })
                      }
                    />
                  ) : null}
                </View>
              </Card>
            </Section>
          ))}
        </>
      ) : null}

      {tab === 'account' ? <AttachAccount teams={o.teams} /> : null}

      {tab === 'people' ? (
        o.people.length ? (
          <Card>
            {o.people.map((p) => (
              <PersonRow key={p.personId} p={p} />
            ))}
          </Card>
        ) : (
          <Empty icon="people-outline" text="Alle Personen haben bereits einen App-Zugang." />
        )
      ) : null}
    </Screen>
  );
}
