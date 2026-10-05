import type { PersonProfile } from '@clubroof/core';
import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Card, Empty, ErrorNotice, Loading, Screen, Section, Stat, T } from '@/components/ui';
import { plural } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** „Meine Statistik“: Saisonwerte für mich und meine Kinder. */
export default function MyStatsScreen() {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const results = useQueries({
    queries: me.managedPersons.map((p) => ({
      queryKey: ['profile', p.id],
      queryFn: () => api<PersonProfile>(`/persons/${p.id}`),
    })),
  });
  const loading = results.some((r) => r.isPending);
  const error = results.find((r) => r.error)?.error;

  return (
    <Screen
      edges={[]}
      refreshing={results.some((r) => r.isRefetching)}
      onRefresh={() => results.forEach((r) => void r.refetch())}
    >
      <T variant="caption">
        Saisonwerte aus Trainings und Spielen, in denen du bzw. dein Kind gemeldet war.
      </T>
      {loading ? <Loading /> : null}
      {error ? <ErrorNotice message={error.message} /> : null}
      {results.map((r, i) => {
        const p = r.data;
        if (!p) return null;
        return (
          <Section
            key={p.personId}
            title={me.managedPersons[i]!.relation === 'self' ? 'Ich' : p.firstName}
          >
            <Card style={{ gap: 12 }}>
              {p.stats ? (
                <>
                  <View style={{ flexDirection: 'row' }}>
                    <Stat
                      value={p.stats.trainingRate === null ? '–' : `${p.stats.trainingRate} %`}
                      label="Trainingsquote"
                    />
                    <Stat
                      value={`${p.stats.trainingsAttended}/${p.stats.trainings}`}
                      label="Trainings"
                    />
                    <Stat value={p.stats.matches} label="Spiele dabei" />
                  </View>
                  {p.stats.byTeam.map((t) => (
                    <View key={t.teamId} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <T variant="label">{t.badge}</T>
                        <T variant="label">
                          {t.trainings ? Math.round((t.trainingsAttended / t.trainings) * 100) : 0}{' '}
                          %
                        </T>
                      </View>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.surfaceVariant,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${t.trainings ? Math.round((t.trainingsAttended / t.trainings) * 100) : 0}%`,
                            height: '100%',
                            backgroundColor: colors.primaryText,
                          }}
                        />
                      </View>
                      <T variant="caption">
                        {t.trainingsAttended} von {t.trainings} Trainings ·{' '}
                        {plural(t.matches, 'Spiel', 'Spiele')}
                      </T>
                    </View>
                  ))}
                </>
              ) : (
                <Empty
                  icon="bar-chart-outline"
                  text={
                    me.managedPersons[i]!.relation === 'self'
                      ? 'Du bist in keiner Mannschaft als Spieler gemeldet.'
                      : 'Noch keine Daten.'
                  }
                />
              )}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(`/profile/${p.personId}`)}
              >
                <T variant="label" color={colors.primaryText}>
                  Zum Profil ›
                </T>
              </Pressable>
            </Card>
          </Section>
        );
      })}
    </Screen>
  );
}
