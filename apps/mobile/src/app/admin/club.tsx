import type { ClubSettings, UpdateClubInput, UploadedImage } from '@clubroof/core';
import { normalizeClubCode, type ClubColorKey } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Columns } from '@/components/columns';
import { ClubColorPicker } from '@/components/club-color';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Crest,
  ErrorNotice,
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
    <Screen edges={[]} wide>
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
      <Columns min={440}>
        <View style={{ gap: 18 }}>
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
                letterSpacing={3}
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
                Jugendleitung …) die 2-Faktor-Anmeldung, bevor sie Mitgliederdaten bearbeiten
                können.
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
        </View>
        <ClubDetails settings={s} saving={save.isPending} onSave={(body) => save.mutate(body)} />
      </Columns>
    </>
  );
}

/** Anschrift, Kontakt und Standard der Kontaktdaten – für Spendenbescheinigungen, Impressum und neue Personen. */
function ClubDetails({
  settings: s,
  saving,
  onSave,
}: {
  settings: ClubSettings;
  saving: boolean;
  onSave: (body: UpdateClubInput) => void;
}) {
  const [year, setYear] = useState(s.foundedYear?.toString() ?? '');
  const [street, setStreet] = useState(s.street ?? '');
  const [zip, setZip] = useState(s.postalCode ?? '');
  const [city, setCity] = useState(s.city ?? '');
  const [email, setEmail] = useState(s.email ?? '');
  const [phone, setPhone] = useState(s.phone ?? '');
  const [site, setSite] = useState(s.website ?? '');
  const [visibility, setVisibility] = useState(s.defaultContactVisibility);
  const dirty =
    year !== (s.foundedYear?.toString() ?? '') ||
    street !== (s.street ?? '') ||
    zip !== (s.postalCode ?? '') ||
    city !== (s.city ?? '') ||
    email !== (s.email ?? '') ||
    phone !== (s.phone ?? '') ||
    site !== (s.website ?? '') ||
    visibility !== s.defaultContactVisibility;
  return (
    <Section title="Angaben zum Verein">
      <Card style={{ gap: 14 }}>
        <T variant="caption">
          Die Anschrift steht auf Spendenbescheinigungen, Kontakt und Webseite im Impressum.
        </T>
        <TextField
          label="Gründungsjahr"
          kind="code"
          value={year}
          onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
          maxLength={4}
        />
        <TextField
          label="Straße und Hausnummer"
          value={street}
          onChangeText={setStreet}
          maxLength={120}
        />
        <TextField
          label="Postleitzahl"
          kind="code"
          value={zip}
          onChangeText={(v) => setZip(v.replace(/\D/g, '').slice(0, 5))}
          maxLength={5}
        />
        <TextField label="Ort" value={city} onChangeText={setCity} maxLength={80} />
        <TextField
          label="Kontakt-E-Mail"
          kind="email"
          value={email}
          onChangeText={setEmail}
          maxLength={120}
        />
        <TextField label="Telefon" value={phone} onChangeText={setPhone} maxLength={40} />
        <TextField label="Webseite" value={site} onChangeText={setSite} maxLength={200} />
        <ChoiceChips
          label="Sichtbarkeit der Kontaktdaten neuer Personen"
          options={[
            { value: 'club' as const, label: 'Alle im Verein' },
            { value: 'team_and_coaches' as const, label: 'Mannschaft und Trainer' },
            { value: 'coaches_only' as const, label: 'Nur Trainer' },
          ]}
          selected={[visibility]}
          onToggle={setVisibility}
        />
        <T variant="caption">
          Das ist der Standard für neu angelegte Personen; jede Person ändert ihn für sich im
          Profil.
        </T>
        <Button
          label="Speichern"
          icon="checkmark"
          disabled={!dirty}
          loading={saving}
          onPress={() =>
            onSave({
              foundedYear: year ? Number(year) : null,
              street: street.trim() || null,
              postalCode: zip.trim() || null,
              city: city.trim() || null,
              email: email.trim() || null,
              phone: phone.trim() || null,
              website: site.trim() || null,
              defaultContactVisibility: visibility,
            })
          }
        />
      </Card>
    </Section>
  );
}
