import {
  isGuardianRaise,
  type ChildAccessInfo,
  type GuardianAccess,
  type InviteLink,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { LinkCard } from '@/components/invite-link';
import {
  Button,
  Card,
  Chip,
  Dialog,
  ErrorNotice,
  Loading,
  Notice,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { ChoiceCard } from '@/components/wizard';
import { RequestError } from '@/lib/api';
import { toGermanDate } from '@/lib/dates';
import { ACCESS_LEVELS, accessTitle } from '@/lib/guardian-access';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';

const SELF_LEVEL_HINT =
  'Das Konto gehört dem Kind. Ihr könnt die Stufe jederzeit senken; wieder erhöhen geht nur mit Zustimmung des Kindes.';

/** Eltern: eigenen Zugang für ein Kind einrichten und die Stufe verwalten. */
export default function ChildAccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const key = ['child-access', id];
  const info = useQuery({
    queryKey: key,
    queryFn: () => api<ChildAccessInfo>(`/me/children/${id}/access`),
  });
  const [error, setError] = useState<string | null>(null);
  const done = (data: ChildAccessInfo) => {
    setError(null);
    queryClient.setQueryData(key, data);
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  };
  const fail = (e: unknown) =>
    setError(e instanceof RequestError ? e.message : 'Die Änderung wurde nicht gespeichert.');

  const [confirm, setConfirm] = useState<GuardianAccess | null>(null);
  const change = useMutation({
    mutationFn: (access: GuardianAccess) =>
      api<ChildAccessInfo>(`/me/children/${id}/access`, { method: 'PUT', body: { access } }),
    onSuccess: done,
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: () => api(`/me/children/${id}/access/invitation`, { method: 'DELETE' }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: fail,
  });

  if (info.isPending) return <Loading />;
  if (info.error) return <ErrorNotice error={info.error} onRetry={() => info.refetch()} />;
  const c = info.data;
  const pick = (a: GuardianAccess) => {
    if (a === c.access) return;
    // Stufe 3: Eltern verlieren den Zugriff – erst nach Bestätigung
    if (a === 'none') setConfirm(a);
    else change.mutate(a);
  };

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 8 }}>
        <T variant="title">{c.name}</T>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {c.account === 'active' ? (
            <Chip
              tone="success"
              icon="checkmark-circle"
              label={t(`Aktiv · ${t(accessTitle(c.access))}`)}
            />
          ) : c.account === 'invited' ? (
            <Chip tone="action" icon="mail-outline" label="Eingeladen" />
          ) : (
            <Chip tone="neutral" label="Kein eigener Zugang" />
          )}
        </View>
        {c.changedAt ? (
          <T variant="caption">
            {t(`Stufe geändert am ${toGermanDate(c.changedAt.slice(0, 10))}`)}
          </T>
        ) : null}
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      {c.account === 'none' ? (
        <InviteSteps childId={id} name={c.name} onSent={() => void info.refetch()} />
      ) : null}

      {c.account === 'invited' ? (
        <Section title="Einladung">
          <Card style={{ gap: 10 }}>
            <T>
              {t(
                `Die Einladung an ${c.invitedEmail} ist offen. Sobald ${c.name.split(' ')[0]} sie annimmt, gilt: ${c.invitedAccess ? t(accessTitle(c.invitedAccess)) : ''}.`,
              )}
            </T>
            <Button
              label="Einladung widerrufen"
              variant="danger"
              icon="close-circle-outline"
              loading={revoke.isPending}
              onPress={() => revoke.mutate()}
            />
          </Card>
        </Section>
      ) : null}

      {c.account === 'active' ? (
        <Section title="Stufe ändern">
          {c.requestedAccess ? (
            <Notice
              tone="action"
              icon="hourglass-outline"
              title="Wartet auf Zustimmung"
              text={t(
                `Ihr habt „${t(accessTitle(c.requestedAccess))}“ angefragt. ${c.name.split(' ')[0]} entscheidet in der App.`,
              )}
            />
          ) : null}
          <View style={{ gap: 10 }}>
            {ACCESS_LEVELS.map((l) => (
              <ChoiceCard
                key={l.value}
                icon={l.icon}
                title={l.title}
                text={l.parents}
                selected={c.access === l.value}
                badge={
                  c.access !== l.value && isGuardianRaise(c.access, l.value)
                    ? 'Mit Zustimmung'
                    : undefined
                }
                onPress={() => pick(l.value)}
              />
            ))}
          </View>
          <T variant="caption" style={{ marginTop: 10 }}>
            {SELF_LEVEL_HINT}
          </T>
        </Section>
      ) : null}

      <Dialog
        visible={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Zugriff endet"
        text={t(
          `Ihr seht und tut danach nichts mehr für ${c.name.split(' ')[0]}. Das Kind taucht bei euch nicht mehr auf. Wieder mitsehen geht nur, wenn das Kind es erlaubt.`,
        )}
        confirmLabel="Zugriff beenden"
        icon="eye-off-outline"
        loading={change.isPending}
        onConfirm={() => {
          if (confirm) change.mutate(confirm);
          setConfirm(null);
        }}
      />
    </Screen>
  );
}

/** Drei Schritte: E-Mail des Kindes, Stufe wählen, Einladung senden. */
function InviteSteps({
  childId,
  name,
  onSent,
}: {
  childId: string;
  name: string;
  onSent: () => void;
}) {
  const { api } = useSignedIn();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<GuardianAccess>('manage');
  const [link, setLink] = useState<InviteLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = name.split(' ')[0];
  const invite = useMutation({
    mutationFn: (send: boolean) =>
      api<InviteLink>(`/me/children/${childId}/access/invitation`, {
        method: 'POST',
        body: { email: email.trim(), access, send },
      }),
    onSuccess: (data) => {
      setError(null);
      setLink(data);
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Die Einladung wurde nicht erstellt.'),
  });
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  if (link)
    return (
      <Section title="Einladung bereit">
        <Card style={{ gap: 12 }}>
          <T>{t(`${first} öffnet den Link und legt ein eigenes Passwort fest.`)}</T>
          <LinkCard link={link} title={t(`Einladung für ${first}`)} />
          <Button label="Fertig" onPress={onSent} />
        </Card>
      </Section>
    );

  return (
    <Section title="Eigenen Zugang einrichten">
      <T variant="caption">{t(`Schritt ${step} von 3`)}</T>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {step === 1 ? (
        <Card style={{ gap: 12 }}>
          <T>
            {t(
              `${first} bekommt ein eigenes Konto mit einer eigenen E-Mail-Adresse. Nicht eure: Jede Adresse gehört zu genau einem Konto.`,
            )}
          </T>
          <TextField
            label="E-Mail-Adresse des Kindes"
            value={email}
            onChangeText={setEmail}
            kind="email"
            maxLength={120}
          />
          <Button label="Weiter" disabled={!valid} onPress={() => setStep(2)} />
        </Card>
      ) : null}
      {step === 2 ? (
        <View style={{ gap: 10 }}>
          {ACCESS_LEVELS.map((l) => (
            <ChoiceCard
              key={l.value}
              icon={l.icon}
              title={l.title}
              text={l.parents}
              selected={access === l.value}
              badge={l.value === 'manage' ? 'Standard' : undefined}
              onPress={() => setAccess(l.value)}
            />
          ))}
          <T variant="caption">Ihr könnt die Stufe später jederzeit senken.</T>
          <Button label="Weiter" onPress={() => setStep(3)} />
          <Button label="Zurück" variant="outline" onPress={() => setStep(1)} />
        </View>
      ) : null}
      {step === 3 ? (
        <Card style={{ gap: 12 }}>
          <T variant="label">{email.trim()}</T>
          <T>{accessTitle(access)}</T>
          {access === 'none' ? (
            <T variant="caption">
              {t(
                `Ihr seht und tut danach nichts mehr für ${first}. Wieder mitsehen geht nur, wenn das Kind es erlaubt.`,
              )}
            </T>
          ) : null}
          <Button
            label="Einladung per E-Mail senden"
            icon="mail-outline"
            loading={invite.isPending}
            onPress={() => invite.mutate(true)}
          />
          <Button
            label="Nur Link und QR-Code zeigen"
            variant="outline"
            icon="qr-code-outline"
            loading={invite.isPending}
            onPress={() => invite.mutate(false)}
          />
          <Button label="Zurück" variant="outline" onPress={() => setStep(2)} />
        </Card>
      ) : null}
    </Section>
  );
}
