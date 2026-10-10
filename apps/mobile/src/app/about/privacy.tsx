import { router } from 'expo-router';
import { Card, IconTile, ListRow, Notice, Screen, Section, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

/** Privatsphäre-Einstellungen: bündelt die Stellen, an denen man selbst über seine Daten bestimmt. */
export default function PrivacyScreen() {
  const { me } = useSignedIn();
  return (
    <Screen edges={[]}>
      <T variant="caption">
        Hier findest du alles, womit du selbst bestimmst, wer was von dir sieht und wie die App dich
        erreicht.
      </T>
      <Section title="Wer sieht was?">
        <Card>
          <ListRow
            first
            leading={<IconTile name="eye" tone="blue" />}
            title="Sichtbarkeit meiner Kontaktdaten"
            subtitle="Telefon und E-Mail für Mannschaft, Trainer oder niemanden"
            onPress={() => router.push(`/profile/${me.person.id}`)}
          />
          <ListRow
            leading={<IconTile name="notifications" tone="pink" />}
            title="Benachrichtigungen"
            subtitle="Worüber und wie du informiert wirst"
            onPress={() => router.push('/notification-settings')}
          />
        </Card>
      </Section>
      <Section title="Sicherheit">
        <Card>
          <ListRow
            first
            leading={<IconTile name="lock-closed" tone="violet" />}
            title="Passwort, 2-Faktor und App-Sperre"
            subtitle="Dein Konto zusätzlich schützen"
            onPress={() => router.push('/account')}
          />
        </Card>
      </Section>
      <Section title="Mehr erfahren">
        <Card>
          <ListRow
            first
            leading={<IconTile name="document-text" tone="green" />}
            title="Datenschutzerklärung"
            subtitle="Welche Daten wir verarbeiten und warum"
            onPress={() => router.push('/about/datenschutz')}
          />
        </Card>
      </Section>
      <Notice
        tone="info"
        icon="download-outline"
        title="Daten herunterladen und Konto löschen"
        text="Diese Funktionen folgen. Bis dahin wende dich bitte an deinen Verein oder den Support."
      />
    </Screen>
  );
}
