import { TINT_KEYS } from '@clubroof/design-tokens';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import {
  Button,
  Card,
  Chip,
  HeroCard,
  IconTile,
  ListRow,
  Screen,
  Section,
  T,
} from '@/components/ui';
import { useTheme } from '@/lib/theme';

/**
 * Bausteine des „Neuen Looks“ auf einer Seite (Vorlage und Sichtprüfung, nicht verlinkt):
 * Aufruf über /bausteine. Beispieltexte sind frei erfunden.
 */
export default function Bausteine() {
  const { colors } = useTheme();
  const onHero = colors.hero.onHero;
  return (
    <Screen header={<AppHeader title="Hallo, Maximilian-Alexander von Hohenzollern-Sigmaringen" />}>
      <HeroCard>
        <T variant="overline" color={onHero}>
          Nächstes Spiel
        </T>
        <T variant="headline" color={onHero} numberOfLines={2}>
          SV Grün-Weiß – Sportfreunde Nordhausen
        </T>
        <T variant="figure" color={onHero} style={{ fontSize: 40 }}>
          2 T 4 Std
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Zusagen" variant="hero" icon="checkmark" onPress={() => undefined} />
          <Button label="Unsicher" variant="heroOutline" onPress={() => undefined} />
        </View>
      </HeroCard>

      <Section title="Karten und Listen">
        <Card>
          <ListRow
            first
            leading={<IconTile name="football-outline" tone="green" />}
            title="Lange Zeilen brechen auf zwei Zeilen um, statt Bedienelemente zu verdrängen und dann abzuschneiden"
            subtitle="Untertitel"
            onPress={() => undefined}
          />
          <ListRow
            leading={<IconTile name="calendar-outline" tone="blue" />}
            title="Termine"
            subtitle="Training und Spiele"
            trailing={<Chip label="Abgesagt" tone="urgent" icon="close-circle" />}
            onPress={() => undefined}
          />
        </Card>
      </Section>

      <Section title="Pastell und Status">
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {TINT_KEYS.map((k) => (
              <IconTile key={k} name="star-outline" tone={k} size="lg" />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="Heimspiel" size="md" />
            <Chip label="Dringend" tone="urgent" icon="alert-circle" size="md" />
            <Chip label="Erledigt" tone="success" icon="checkmark-circle" />
            <Chip label="Training" tone="blue" />
          </View>
        </Card>
      </Section>

      <Section title="Buttons">
        <Card style={{ gap: 10 }}>
          <Button label="Speichern" icon="save-outline" onPress={() => undefined} />
          <Button label="Abbrechen" variant="outline" onPress={() => undefined} />
          <Button label="Löschen" variant="danger" onPress={() => undefined} />
          <Button label="Dezent" variant="tonal" size="sm" onPress={() => undefined} />
        </Card>
      </Section>
    </Screen>
  );
}
