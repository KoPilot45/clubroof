import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { QrScanner } from '@/components/qr-scanner';
import { Button, Card, Chip, Screen, T, TextField } from '@/components/ui';

/** Einladungscode oder -link aus dem Eingabefeld bzw. QR-Code: der Teil nach „/join/“ bzw. der Code selbst. */
export function parseInviteCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const fromLink = /\/join\/([A-Za-z0-9_-]{8,})/.exec(text);
  const code = (fromLink?.[1] ?? text).replace(/\s+/g, '');
  return /^[A-Za-z0-9_-]{8,}$/.test(code) ? code : null;
}

/** Einladung einlösen (Paket LG): QR-Code scannen oder Code bzw. Link eingeben, dann weiter zur Einladung. */
export default function JoinCodeScreen() {
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  const [scanning, setScanning] = useState(scan === '1' && Platform.OS !== 'web');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = (input: string) => {
    const code = parseInviteCode(input);
    if (!code) {
      setError(
        'Das ist kein gültiger Einladungscode. Prüfe den Code oder den Link und versuche es erneut.',
      );
      setScanning(false);
      return;
    }
    router.replace(`/join/${code}`);
  };

  return (
    <Screen edges={[]}>
      {scanning ? (
        <Card>
          <QrScanner onScan={go} onClose={() => setScanning(false)} />
        </Card>
      ) : (
        <Card style={{ gap: 12 }}>
          <T>
            Gib den Einladungscode ein oder füge den Link aus deiner Einladung ein. Du bekommst ihn
            von deinem Verein per E-Mail, Nachricht oder als QR-Code.
          </T>
          <TextField
            label="Einladungscode oder Link"
            value={value}
            onChangeText={(v) => {
              setValue(v);
              setError(null);
            }}
            kind="url"
            onSubmit={() => go(value)}
          />
          {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
          <Button
            label="Weiter"
            icon="arrow-forward"
            disabled={!value.trim()}
            onPress={() => go(value)}
          />
          <View style={{ gap: 6 }}>
            {Platform.OS !== 'web' ? (
              <Button
                label="QR-Code scannen"
                icon="qr-code-outline"
                variant="outline"
                onPress={() => setScanning(true)}
              />
            ) : (
              <T variant="caption">
                Das Scannen eines QR-Codes ist in der App auf dem Handy möglich.
              </T>
            )}
          </View>
        </Card>
      )}
    </Screen>
  );
}
