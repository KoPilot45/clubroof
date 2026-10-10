import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Empty, Screen, Section, T, TextField } from '@/components/ui';
import { WelcomeTour } from '@/components/welcome-tour';
import { HELP_SECTIONS, type HelpAudience } from '@/lib/help-content';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

/** Hilfe & Anleitung: Fragen und Antworten, passend zur Rolle; mit Suche. */
export default function HelpScreen() {
  const { me } = useSignedIn();
  const [tour, setTour] = useState(false);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const own = me.person.id;
  const audiences = new Set<HelpAudience>(['all']);
  if (me.managedPersons.some((p) => p.relation === 'child')) audiences.add('parent');
  if (me.teams.some((t) => t.personId === own && t.functions.some((f) => f !== 'player')))
    audiences.add('coach');
  if (me.roles.some((r) => r.key === 'treasurer') || audiences.has('coach'))
    audiences.add('treasurer');
  if (me.roles.some((r) => r.key === 'club_member')) audiences.add('member');
  if (me.canAdminister) audiences.add('admin');

  const q = query.trim().toLowerCase();
  const sections = HELP_SECTIONS.filter((s) => audiences.has(s.audience))
    .map((s) => ({
      ...s,
      entries: s.entries.filter(
        (e) => !q || e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q),
      ),
    }))
    .filter((s) => s.entries.length > 0);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  return (
    <Screen edges={[]}>
      <WelcomeTour me={me} visible={tour} onClose={() => setTour(false)} />
      <Button
        label="Willkommens-Tour ansehen"
        icon="play-circle-outline"
        variant="tonal"
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => setTour(true)}
      />
      <T variant="caption">
        So funktioniert die App. Tippe auf eine Frage, um die Antwort zu lesen – oder suche nach
        einem Stichwort. Fragen zum Verein selbst beantworten dir die Ansprechpartner.
      </T>
      <TextField
        label="Suchen"
        value={query}
        onChangeText={setQuery}
        placeholder={t('z. B. Abwesenheit, Kasse, Push …')}
      />
      {sections.length === 0 ? (
        <Card>
          <Empty
            icon="search-outline"
            text="Dazu habe ich nichts gefunden. Versuche ein anderes Stichwort."
          />
        </Card>
      ) : null}
      {sections.map((s) => (
        <Section key={s.id} title={s.title}>
          <Card
            style={
              s.id === 'start'
                ? { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer }
                : undefined
            }
          >
            {s.entries.map((e, i) => {
              const expanded = open.has(e.id) || !!q;
              return (
                <View
                  key={e.id}
                  style={{
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    paddingVertical: 4,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => toggle(e.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                    }}
                  >
                    <T variant="label" style={{ flex: 1 }}>
                      {e.question}
                    </T>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.onSurfaceMuted}
                    />
                  </Pressable>
                  {expanded ? (
                    <View style={{ gap: 10, paddingBottom: 10 }}>
                      <T variant="body" selectable>
                        {e.answer}
                      </T>
                      {e.link ? (
                        <Button
                          label={e.link.label}
                          icon="arrow-forward"
                          variant="tonal"
                          size="sm"
                          style={{ alignSelf: 'flex-start' }}
                          onPress={() => router.push(e.link!.href as never)}
                        />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </Section>
      ))}
      <Card style={{ gap: 8 }}>
        <T variant="section">Noch Fragen?</T>
        <T variant="caption">
          Deine Trainerin oder dein Trainer und die Ansprechpartner des Vereins helfen dir gern
          weiter.
        </T>
        <Button
          label="Ansprechpartner anzeigen"
          icon="people-outline"
          variant="outline"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => router.push('/contacts')}
        />
      </Card>
    </Screen>
  );
}
