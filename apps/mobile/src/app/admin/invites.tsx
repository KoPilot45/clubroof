import type { InviteLink, InviteOverview, InvitePerson, JoinRequestItem } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
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

type Tab = 'requests' | 'links' | 'people';

async function share(url: string, title: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    return 'Link kopiert';
  }
  await Share.share({ message: `${title}: ${url}` });
  return null;
}

function LinkCard({ link, title }: { link: InviteLink; title: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      <View
        style={{ backgroundColor: '#FFFFFF', padding: 10, borderRadius: 12 }}
        accessibilityLabel={`QR-Code: ${title}`}
      >
        <SvgXml xml={link.qrSvg} width={200} height={200} />
      </View>
      <T variant="caption" style={{ textAlign: 'center' }}>
        {link.url}
      </T>
      <T variant="caption">gültig bis {toGermanDate(link.expiresAt.slice(0, 10))}</T>
      <Button
        label={copied ?? (Platform.OS === 'web' ? 'Link kopieren' : 'Link teilen')}
        variant="outline"
        icon="share-outline"
        onPress={() => void share(link.url, title).then(setCopied)}
      />
    </View>
  );
}

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

export default function InvitesScreen() {
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
    return <ErrorNotice message={overview.error.message} onRetry={() => overview.refetch()} />;
  const o = overview.data;

  return (
    <Screen edges={[]} refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <ChoiceChips
        options={[
          { value: 'requests', label: `Anfragen (${o.requests.length})` },
          { value: 'links', label: 'Mannschafts-Links' },
          { value: 'people', label: `Ohne Zugang (${o.people.length})` },
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
            <Section key={t.id} title={`${t.badge} · ${t.name}`}>
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
                      onPress={() => teamLink.mutate({ teamId: t.id, revoke: true })}
                    />
                  ) : null}
                </View>
              </Card>
            </Section>
          ))}
        </>
      ) : null}

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
