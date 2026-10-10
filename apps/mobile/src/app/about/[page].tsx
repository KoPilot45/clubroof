import { Stack, useLocalSearchParams } from 'expo-router';
import { Card, Notice, Screen, Section, T } from '@/components/ui';
import { ABOUT_PAGES, type AboutPageKey } from '@/lib/about-content';

/** Textseiten unter „Mehr → Über Clubroof“: AGB, Datenschutz, Impressum, Changelog. */
export default function AboutPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const content = ABOUT_PAGES[page as AboutPageKey];
  if (!content) {
    return (
      <Screen edges={[]}>
        <T>Diese Seite gibt es nicht.</T>
      </Screen>
    );
  }
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: content.title }} />
      {page !== 'changelog' ? (
        <Notice
          tone="info"
          icon="document-text-outline"
          title="Beispielinhalt"
          text="Dieser Text ist ein Platzhalter und wird vor dem Start durch die geprüfte Fassung ersetzt."
        />
      ) : null}
      <T variant="caption">{content.intro}</T>
      {content.sections.map((s) => (
        <Section key={s.heading} title={s.heading}>
          <Card>
            <T>{s.text}</T>
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
