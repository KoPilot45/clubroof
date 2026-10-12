import type { ClubSettings, UpdateClubInput, UploadedImage } from '@clubroof/core';
import { normalizeClubCode, type ClubColorKey } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { ClubColorPicker } from '@/components/club-color';
import { PosterMark } from '@/components/poster-mark';
import { useTheme } from '@/lib/theme';
import {
  Button,
  Card,
  Chip,
  Crest,
  ErrorNotice,
  GradientFill,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { mediaUri, pickFile } from '@/lib/upload';
import { t } from '@/lib/i18n';

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
              accessibilityLabel={t('Aktuelles Vereinslogo')}
              style={{ width: 120, height: 132 }}
              resizeMode="contain"
            />
          ) : (
            <Crest initials={me.club.shortCode} size={110} />
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
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin', 'club'],
    queryFn: () => api<ClubSettings>('/admin/club'),
  });
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState<ClubColorKey>('green');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.name);
    setShortName(settings.data.shortName);
    setCode(settings.data.shortCode);
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
  if (settings.isPending) return <Loading />;
  if (settings.error)
    return <ErrorNotice error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const dirty =
    name.trim() !== s.name ||
    shortName.trim() !== s.shortName ||
    code !== s.shortCode ||
    color !== s.colorTheme;

  return (
    <>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <Section title="Vorschau">
        <View
          style={{
            height: 190,
            borderRadius: 24,
            overflow: 'hidden',
            justifyContent: 'flex-end',
            padding: 16,
            backgroundColor: colors.anstoss.poster.to,
          }}
        >
          <GradientFill from={colors.anstoss.poster.from} to={colors.background} vertical />
          <PosterMark code={code} />
          <T variant="headline" color={colors.hero.onHero} style={{ fontSize: 28 }} verbatim>
            {shortName || s.shortName}
          </T>
        </View>
        <T variant="caption">
          Mit 2 Zeichen wird das Kürzel größer, mit 4 kleiner – immer vollständig sichtbar.
        </T>
      </Section>

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
          <TextField
            label="Kürzel (2 bis 4 Zeichen)"
            value={code}
            onChangeText={(v) => {
              setCode(normalizeClubCode(v));
              setSaved(false);
            }}
            maxLength={4}
            hint="Das Kürzel steht groß im Plakat auf der Startseite und ersetzt das Wappen, solange kein Logo hochgeladen ist."
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
            disabled={
              !dirty || name.trim().length < 3 || shortName.trim().length < 2 || code.length < 2
            }
            loading={save.isPending}
            onPress={() =>
              save.mutate({
                name: name.trim(),
                shortName: shortName.trim(),
                shortCode: code,
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
