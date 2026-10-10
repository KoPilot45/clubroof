import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { PublicShell } from '@/components/public-shell';
import { Button, Card, Chip, T } from '@/components/ui';
import { useTheme } from '@/lib/theme';

export type DemoStep = { title: string; content: ReactNode };

/**
 * Vorführung eines Einrichtungsablaufs in Formularschritten – ohne Funktion: nichts wird gespeichert, am Ende
 * erscheint „Einrichtungs-Demo abgeschlossen“ mit „Verlassen“. Nur für Entwicklung und Demo; die echten
 * Einrichtungsformulare (später mit dem Vereinszugang) nutzen dieselben Bausteine.
 */
export function DemoWizard({
  title,
  steps,
  club,
}: {
  title: string;
  steps: DemoStep[];
  club?: { shortName: string; logoUrl: string | null } | null;
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const last = step === steps.length - 1;

  if (done) {
    return (
      <PublicShell title="Einrichtungs-Demo abgeschlossen" club={club}>
        <Card style={{ gap: 14, alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.status.success.container,
            }}
          >
            <Ionicons name="checkmark" size={32} color={colors.status.success.onContainer} />
          </View>
          <T style={{ textAlign: 'center' }}>
            Das war die Vorführung. Es wurde nichts gespeichert. Mit dem Vereinszugang durchläufst
            du später die echten Einrichtungsformulare, die Aufbau und Funktionen der App festlegen.
          </T>
        </Card>
        <Button label="Verlassen" icon="exit-outline" onPress={() => router.replace('/login')} />
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={title}
      subtitle={`Schritt ${step + 1} von ${steps.length}: ${steps[step]!.title}`}
      club={club}
    >
      <Chip
        tone="info"
        icon="information-circle-outline"
        label="Demo – es wird nichts gespeichert"
      />
      <Card style={{ gap: 14 }}>{steps[step]!.content}</Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {step > 0 ? (
          <Button
            label="Zurück"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => setStep(step - 1)}
          />
        ) : (
          <Button
            label="Abbrechen"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => router.replace('/login')}
          />
        )}
        <Button
          label={last ? 'Demo abschließen' : 'Weiter'}
          icon={last ? 'checkmark' : undefined}
          style={{ flex: 1 }}
          onPress={() => (last ? setDone(true) : setStep(step + 1))}
        />
      </View>
    </PublicShell>
  );
}

/** Zeile „Beschriftung: Wert“ für die Zusammenfassung. */
export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T variant="caption">{label}</T>
      <T variant="label">{value || '–'}</T>
    </View>
  );
}
