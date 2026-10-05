import type { UploadedImage } from '@clubroof/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { Button, Card, Chip, Crest, Screen, T } from '@/components/ui';
import { RequestError } from '@/lib/api';
import { clubInitials } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
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
    </Screen>
  );
}
