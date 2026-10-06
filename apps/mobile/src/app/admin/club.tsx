import { Ionicons } from '@expo/vector-icons';
import type {
  ClubColorKey,
  ClubSettings,
  OrgUnitKind,
  UpdateClubInput,
  UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { ClubColorPicker, ORG_UNIT_KIND_LABELS } from '@/components/club-color';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Crest,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { clubInitials } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri, pickFile } from '@/lib/upload';

export default function ClubSettingsScreen() {
  const { api, me, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLogo = async (imageId: string | null) => {
    await api('/club/logo', { method: 'PUT', body: { imageId } });
    await refresh();
    void queryClient.invalidateQueries();
  };

  const upload = async () => {
    setError(null);
    try {
      const file = await pickFile('image');
      if (!file) return;
      setBusy(true);
      const image = await api<UploadedImage>('/media', {
        method: 'POST',
        body: { purpose: 'logo', fileName: file.name, dataBase64: file.dataBase64 },
      });
      await setLogo(image.id);
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'Das Logo konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Section title="Vereinslogo">
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
          {me.club.logoUrl ? (
            <Image
              source={{ uri: mediaUri(me.club.logoUrl)! }}
              accessibilityLabel="Aktuelles Vereinslogo"
              style={{ width: 120, height: 132 }}
              resizeMode="contain"
            />
          ) : (
            <Crest initials={clubInitials(me.club.shortName)} size={110} />
          )}
          <T variant="heading">{me.club.name}</T>
          <T variant="caption" style={{ textAlign: 'center' }}>
            {me.club.logoUrl
              ? 'Das Logo erscheint oben in der App bei allen Mitgliedern.'
              : 'Noch kein Logo – die App zeigt ein Wappen mit den Initialen.'}
          </T>
        </Card>
        {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
        <View style={{ gap: 10 }}>
          <Button
            label="Logo hochladen"
            icon="image-outline"
            loading={busy}
            onPress={() => void upload()}
          />
          {me.club.logoUrl ? (
            <Button label="Logo entfernen" variant="outline" onPress={() => void setLogo(null)} />
          ) : null}
          <T variant="caption">
            Am besten ein quadratisches PNG mit transparentem Hintergrund, höchstens 5 MB.
          </T>
        </View>
      </Section>
      <ClubForm />
    </Screen>
  );
}

/** Name, Design, Bereiche und Sicherheitsvorgabe des Vereins. */
function ClubForm() {
  const { api, refresh } = useSignedIn();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin', 'club'],
    queryFn: () => api<ClubSettings>('/admin/club'),
  });
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState<ClubColorKey>('green');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitKind, setUnitKind] = useState<OrgUnitKind>('youth');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.name);
    setShortName(settings.data.shortName);
    setColor(settings.data.colorTheme);
  }, [settings.data]);

  const onDone = (data: ClubSettings) => {
    setError(null);
    queryClient.setQueryData(['admin', 'club'], data);
    // Name und Farbe erscheinen sofort in der ganzen App
    void refresh();
  };
  const onError = (e: Error) =>
    setError(e instanceof RequestError ? e.message : 'Die Änderung hat nicht geklappt.');

  const save = useMutation({
    mutationFn: (body: UpdateClubInput) =>
      api<ClubSettings>('/admin/club', { method: 'PATCH', body }),
    onSuccess: (data) => {
      onDone(data);
      setSaved(true);
    },
    onError,
  });
  const unit = useMutation({
    mutationFn: (v: { method: 'POST' | 'PATCH' | 'DELETE'; id?: string; body?: object }) =>
      api<ClubSettings>(v.id ? `/admin/org-units/${v.id}` : '/admin/org-units', {
        method: v.method,
        body: v.body,
      }),
    onSuccess: (data) => {
      onDone(data);
      setUnitName('');
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });
    },
    onError,
  });

  if (settings.isPending) return <Loading />;
  if (settings.error)
    return <ErrorNotice error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const dirty =
    name.trim() !== s.name || shortName.trim() !== s.shortName || color !== s.colorTheme;

  return (
    <>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Section title="Name & Design">
        <Card style={{ gap: 14 }}>
          <TextField
            label="Vereinsname"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setSaved(false);
            }}
            maxLength={100}
          />
          <TextField
            label="Kurzname (Kopfzeile, Wappen)"
            value={shortName}
            onChangeText={(v) => {
              setShortName(v);
              setSaved(false);
            }}
            maxLength={40}
          />
          <ClubColorPicker
            value={color}
            onChange={(c) => {
              setColor(c);
              setSaved(false);
            }}
          />
          <Button
            label="Speichern"
            icon="checkmark"
            disabled={!dirty || name.trim().length < 3 || shortName.trim().length < 2}
            loading={save.isPending}
            onPress={() =>
              save.mutate({
                name: name.trim(),
                shortName: shortName.trim(),
                colorTheme: color,
              })
            }
          />
          {saved && !dirty ? (
            <Chip
              tone="success"
              icon="checkmark-circle"
              label="Gespeichert – gilt für alle Mitglieder."
            />
          ) : null}
        </Card>
      </Section>

      <Section title="Bereiche">
        <Card>
          {s.orgUnits.map((u, i) =>
            editing?.id === u.id ? (
              <View key={u.id} style={{ gap: 8, paddingVertical: 8 }}>
                <TextField
                  label="Neuer Name"
                  value={editing.name}
                  onChangeText={(v) => setEditing({ id: u.id, name: v })}
                  maxLength={50}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button
                    label="Übernehmen"
                    style={{ flex: 1 }}
                    disabled={editing.name.trim().length < 2}
                    loading={unit.isPending}
                    onPress={() =>
                      unit.mutate({
                        method: 'PATCH',
                        id: u.id,
                        body: { name: editing.name.trim() },
                      })
                    }
                  />
                  <Button
                    label="Abbrechen"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => setEditing(null)}
                  />
                </View>
              </View>
            ) : (
              <ListRow
                key={u.id}
                first={i === 0}
                title={u.name}
                subtitle={`${ORG_UNIT_KIND_LABELS[u.kind]} · ${u.teams === 1 ? '1 Mannschaft' : `${u.teams} Mannschaften`}`}
                trailing={
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <IconAction
                      icon="pencil"
                      label={`${u.name} umbenennen`}
                      onPress={() => setEditing({ id: u.id, name: u.name })}
                    />
                    {u.teams === 0 ? (
                      <IconAction
                        icon="trash-outline"
                        label={`${u.name} löschen`}
                        onPress={() => unit.mutate({ method: 'DELETE', id: u.id })}
                      />
                    ) : null}
                  </View>
                }
              />
            ),
          )}
        </Card>
        <Card style={{ gap: 12 }}>
          <T variant="label">Bereich hinzufügen</T>
          <TextField
            label="Name"
            value={unitName}
            onChangeText={setUnitName}
            maxLength={50}
            placeholder="z. B. Walking Football"
          />
          <ChoiceChips
            options={(Object.keys(ORG_UNIT_KIND_LABELS) as OrgUnitKind[]).map((k) => ({
              value: k,
              label: ORG_UNIT_KIND_LABELS[k],
            }))}
            selected={[unitKind]}
            onToggle={setUnitKind}
          />
          <Button
            label="Bereich anlegen"
            icon="add"
            variant="outline"
            disabled={unitName.trim().length < 2}
            loading={unit.isPending && !editing}
            onPress={() =>
              unit.mutate({ method: 'POST', body: { name: unitName.trim(), kind: unitKind } })
            }
          />
        </Card>
      </Section>

      <Section title="Sicherheit">
        <Card style={{ gap: 10 }}>
          <T variant="label" style={{ fontWeight: '700' }}>
            2-Faktor-Anmeldung für die Verwaltung
          </T>
          <T variant="caption">
            Wenn eingeschaltet, brauchen alle mit Verwaltungsrechten (Vorstand, Admins,
            Jugendleitung …) die 2-Faktor-Anmeldung, bevor sie Mitgliederdaten bearbeiten können.
          </T>
          <Chip
            tone={s.requireTwoFactor ? 'success' : 'neutral'}
            icon={s.requireTwoFactor ? 'shield-checkmark' : 'shield-outline'}
            label={s.requireTwoFactor ? 'Pflicht für die Verwaltung' : 'Freiwillig'}
          />
          {s.requireTwoFactor || s.canRequireTwoFactor ? (
            <Button
              label={s.requireTwoFactor ? 'Pflicht aufheben' : 'Zur Pflicht machen'}
              variant="outline"
              loading={save.isPending}
              onPress={() => save.mutate({ requireTwoFactor: !s.requireTwoFactor })}
            />
          ) : (
            <>
              <T variant="caption">
                Richte zuerst selbst die 2-Faktor-Anmeldung ein – so sperrst du dich nicht aus.
              </T>
              <Button
                label="Zu Konto & Einstellungen"
                variant="outline"
                icon="key-outline"
                onPress={() => router.push('/account')}
              />
            </>
          )}
        </Card>
      </Section>
    </>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: 'pencil' | 'trash-outline';
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={{ padding: 6 }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={icon === 'pencil' ? colors.primaryText : colors.onSurfaceMuted}
      />
    </Pressable>
  );
}
