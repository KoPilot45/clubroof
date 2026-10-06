import {
  CONTACT_VISIBILITIES,
  PLAYER_POSITIONS,
  PREFERRED_FEET,
  type ContactVisibility,
  type PersonProfile,
  type PreferredFoot,
  type UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ChoiceChips,
  ErrorNotice,
  IconTile,
  ListRow,
  Loading,
  Screen,
  Section,
  Stat,
  T,
  TeamBadge,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatShortDate, plural } from '@/lib/format';
import { CONTACT_VISIBILITY_LABELS, FOOT_LABELS, TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { pickFile } from '@/lib/upload';

function EditForm({ profile, onDone }: { profile: PersonProfile; onDone: () => void }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(profile.contact?.phone ?? '');
  const [email, setEmail] = useState(profile.contact?.email ?? '');
  const [position, setPosition] = useState<string | null>(profile.position);
  const [foot, setFoot] = useState<PreferredFoot | null>(profile.preferredFoot);
  const [visibility, setVisibility] = useState<ContactVisibility>(
    profile.contactVisibility ?? 'team_and_coaches',
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api<PersonProfile>(`/persons/${profile.personId}`, {
        method: 'PATCH',
        body: {
          phone: phone.trim() || null,
          email: email.trim() || null,
          position,
          preferredFoot: foot,
          contactVisibility: visibility,
        },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', profile.personId], data);
      for (const key of ['roster', 'contacts'])
        void queryClient.invalidateQueries({ queryKey: [key] });
      onDone();
    },
    onError: (e) =>
      setError(
        e instanceof RequestError && e.code === 'validation'
          ? 'Bitte prüfe die E-Mail-Adresse und die Telefonnummer.'
          : e instanceof RequestError
            ? e.message
            : 'Das Profil konnte nicht gespeichert werden.',
      ),
  });

  return (
    <>
      <Card style={{ gap: 14 }}>
        <T variant="heading">Spielerdaten</T>
        <ChoiceChips
          label="Position"
          options={PLAYER_POSITIONS.map((p) => ({ value: p, label: p }))}
          selected={position ? [position as (typeof PLAYER_POSITIONS)[number]] : []}
          onToggle={(p) => setPosition(position === p ? null : p)}
        />
        <ChoiceChips
          label="Starker Fuß"
          options={PREFERRED_FEET.map((f) => ({ value: f, label: FOOT_LABELS[f] }))}
          selected={foot ? [foot] : []}
          onToggle={(f) => setFoot(foot === f ? null : f)}
        />
      </Card>
      <Card style={{ gap: 14 }}>
        <T variant="heading">Kontakt</T>
        <TextField
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          placeholder="z. B. 0151 1234567"
          maxLength={30}
        />
        <TextField
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="name@beispiel.de"
          maxLength={120}
        />
        <ChoiceChips
          label="Kontaktdaten sichtbar für"
          options={CONTACT_VISIBILITIES.map((v) => ({
            value: v,
            label: CONTACT_VISIBILITY_LABELS[v],
          }))}
          selected={[visibility]}
          onToggle={setVisibility}
        />
        <T variant="caption">
          Trainerteam und Mitgliederverwaltung sehen Kontaktdaten immer, damit sie dich erreichen
          können.
        </T>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} label="Abbrechen" variant="outline" onPress={onDone} />
        <Button
          style={{ flex: 1 }}
          label="Speichern"
          icon="checkmark"
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      </View>
    </>
  );
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api<PersonProfile>(`/persons/${id}`),
  });
  const p = query.data;

  return (
    <Screen edges={[]} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      {query.isPending ? <Loading /> : null}
      {query.error ? (
        <ErrorNotice message={query.error.message} onRetry={() => query.refetch()} />
      ) : null}
      {p ? (
        <>
          <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Avatar name={`${p.firstName} ${p.lastName}`} size={64} uri={p.avatarUrl} />
              {p.canEdit ? <PhotoButton profile={p} /> : null}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <T variant="title">
                {p.firstName} {p.lastName}
              </T>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[...new Set(p.teams.map((t) => TEAM_FUNCTION_LABELS[t.function]))].map((f) => (
                  <Chip key={f} label={f} />
                ))}
                {p.relation === 'child' ? <Chip tone="info" label="Dein Kind" /> : null}
              </View>
            </View>
          </Card>

          {editing ? (
            <EditForm profile={p} onDone={() => setEditing(false)} />
          ) : (
            <>
              <Card style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <T variant="heading">Verfügbarkeit</T>
                  {p.availability.available ? (
                    <Chip tone="success" icon="checkmark" label="Verfügbar" />
                  ) : (
                    <Chip tone="info" label="Nicht verfügbar" />
                  )}
                </View>
                {!p.availability.available && p.availability.reason ? (
                  <T variant="caption">
                    {p.availability.reason}
                    {p.availability.until ? ` bis ${formatShortDate(p.availability.until)}` : ''}
                  </T>
                ) : null}
              </Card>

              {p.stats ? (
                <Section title="Saison">
                  <Card style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <Stat
                        value={p.stats.trainingRate === null ? '–' : `${p.stats.trainingRate} %`}
                        label="Trainingsquote"
                      />
                      <Stat
                        value={`${p.stats.trainingsAttended}/${p.stats.trainings}`}
                        label="Trainings"
                      />
                      <Stat value={p.stats.matches} label="Spiele dabei" />
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Stat value={p.stats.appearances} label="Einsätze" />
                      <Stat value={p.stats.goals} label="Tore" />
                      <Stat value={p.stats.assists} label="Vorlagen" />
                    </View>
                    {p.stats.byTeam.length > 1
                      ? p.stats.byTeam.map((t) => (
                          <T key={t.teamId} variant="caption">
                            {t.badge}: {t.trainingsAttended} von {t.trainings} Trainings ·{' '}
                            {plural(t.matches, 'Spiel', 'Spiele')}
                          </T>
                        ))
                      : null}
                  </Card>
                </Section>
              ) : null}

              <Section title="Mannschaften">
                <Card>
                  {p.teams.map((t, i) => (
                    <ListRow
                      key={t.id + t.function}
                      first={i === 0}
                      leading={<TeamBadge badge={t.badge} />}
                      title={t.name}
                      subtitle={
                        TEAM_FUNCTION_LABELS[t.function] + (t.isPrimary ? '' : ' · Zusatzteam')
                      }
                      trailing={
                        t.jerseyNumber !== null ? (
                          <T variant="heading" color={colors.primaryText}>
                            #{t.jerseyNumber}
                          </T>
                        ) : null
                      }
                    />
                  ))}
                </Card>
              </Section>

              <Card>
                <ListRow
                  first
                  leading={<IconTile name="football-outline" />}
                  title="Position"
                  trailing={<T variant="label">{p.position ?? '–'}</T>}
                />
                <ListRow
                  leading={<IconTile name="footsteps-outline" />}
                  title="Starker Fuß"
                  trailing={
                    <T variant="label">{p.preferredFoot ? FOOT_LABELS[p.preferredFoot] : '–'}</T>
                  }
                />
                {p.contactVisibility ? (
                  <ListRow
                    leading={<IconTile name="eye-outline" />}
                    title="Kontaktdaten sichtbar für"
                    trailing={
                      <T variant="label">{CONTACT_VISIBILITY_LABELS[p.contactVisibility]}</T>
                    }
                  />
                ) : null}
              </Card>

              {p.contact && (p.contact.email || p.contact.phone) ? (
                <Section title="Kontakt">
                  <Card style={{ gap: 8 }}>
                    {p.contact.phone ? (
                      <Pressable
                        accessibilityRole="link"
                        onPress={() =>
                          void Linking.openURL(`tel:${p.contact!.phone!.replace(/\s/g, '')}`)
                        }
                      >
                        <T color={colors.primaryText} style={{ fontWeight: '700' }}>
                          {p.contact.phone}
                        </T>
                      </Pressable>
                    ) : null}
                    {p.contact.email ? (
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => void Linking.openURL(`mailto:${p.contact!.email!}`)}
                      >
                        <T color={colors.primaryText} style={{ fontWeight: '700' }}>
                          {p.contact.email}
                        </T>
                      </Pressable>
                    ) : null}
                  </Card>
                </Section>
              ) : null}

              {p.canEdit ? (
                <Button
                  label="Profil bearbeiten"
                  icon="create-outline"
                  onPress={() => setEditing(true)}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

/** Profilfoto hochladen oder entfernen (eigenes Profil oder Kind). */
function PhotoButton({ profile }: { profile: PersonProfile }) {
  const { api, refresh } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (remove: boolean) => {
    setError(null);
    try {
      let avatarImageId: string | null = null;
      if (!remove) {
        const file = await pickFile('image');
        if (!file) return;
        setBusy(true);
        avatarImageId = (
          await api<UploadedImage>('/media', {
            method: 'POST',
            body: { purpose: 'avatar', fileName: file.name, dataBase64: file.dataBase64 },
          })
        ).id;
      }
      setBusy(true);
      const updated = await api<PersonProfile>(`/persons/${profile.personId}`, {
        method: 'PATCH',
        body: { avatarImageId },
      });
      queryClient.setQueryData(['profile', profile.personId], updated);
      if (profile.relation === 'self') await refresh();
      void queryClient.invalidateQueries({ queryKey: ['roster'] });
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das Foto wurde nicht gespeichert.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void save(false)}
        hitSlop={6}
      >
        <T variant="caption" color={colors.primaryText} style={{ fontWeight: '700' }}>
          {busy ? 'Speichert …' : profile.avatarUrl ? 'Foto ändern' : 'Foto hinzufügen'}
        </T>
      </Pressable>
      {profile.avatarUrl && !busy ? (
        <Pressable accessibilityRole="button" onPress={() => void save(true)} hitSlop={6}>
          <T variant="caption">Entfernen</T>
        </Pressable>
      ) : null}
      {error ? (
        <T variant="caption" color={colors.status.urgent.onContainer}>
          {error}
        </T>
      ) : null}
    </>
  );
}
