import type { CalendarFeed } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { Button, Card, Chip, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { formatAgo } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Termine als Abo im eigenen Kalender (Google, Apple, Outlook). */
export default function CalendarScreen() {
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const feed = useQuery({
    queryKey: ['calendar'],
    queryFn: () => api<CalendarFeed>('/me/calendar'),
  });
  const change = useMutation({
    mutationFn: (method: 'POST' | 'DELETE') => api<CalendarFeed>('/me/calendar', { method }),
    onSuccess: () => {
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  if (feed.isPending) return <Loading />;
  if (feed.error)
    return <ErrorNotice message={feed.error.message} onRetry={() => feed.refetch()} />;
  const url = feed.data.url;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 8 }}>
        <T variant="heading">Kalender abonnieren</T>
        <T variant="caption">
          Deine Termine (und die deiner Kinder) sowie die Vereinstermine erscheinen automatisch in
          deinem Kalender – Änderungen und Absagen inklusive. Teilnehmerlisten werden nicht
          übertragen.
        </T>
      </Card>
      {url ? (
        <>
          <Card style={{ gap: 10 }}>
            <T variant="label">Dein persönlicher Link</T>
            <View
              style={{
                padding: 10,
                borderRadius: radii.md,
                backgroundColor: colors.background,
              }}
            >
              <T variant="caption" selectable>
                {url}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label={copied ? 'Kopiert' : 'Link kopieren'}
                icon={copied ? 'checkmark' : 'copy-outline'}
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => void Clipboard.setStringAsync(url).then(() => setCopied(true))}
              />
              {Platform.OS !== 'web' ? (
                <Button
                  label="Im Kalender öffnen"
                  icon="calendar"
                  style={{ flex: 1 }}
                  onPress={() => void Linking.openURL(url.replace(/^https?:/, 'webcal:'))}
                />
              ) : null}
            </View>
            {feed.data.lastAccessAt ? (
              <Chip
                tone="success"
                icon="sync"
                label={`Zuletzt abgerufen ${formatAgo(feed.data.lastAccessAt)}`}
              />
            ) : (
              <Chip tone="neutral" label="Noch nicht abgerufen" />
            )}
          </Card>
          <Section title="So geht's">
            <Card style={{ gap: 6 }}>
              <T variant="caption">
                • iPhone/Mac: „Im Kalender öffnen“ antippen und das Abo bestätigen.
              </T>
              <T variant="caption">
                • Google Kalender: am PC unter „Weitere Kalender → Per URL“ den Link einfügen.
              </T>
              <T variant="caption">
                • Outlook: „Kalender hinzufügen → Aus dem Internet abonnieren“.
              </T>
              <T variant="caption">
                Der Link ist geheim. Wurde er weitergegeben, erzeuge einfach einen neuen.
              </T>
            </Card>
          </Section>
          <Button
            label="Neuen Link erzeugen"
            icon="refresh"
            variant="outline"
            loading={change.isPending && change.variables === 'POST'}
            onPress={() => change.mutate('POST')}
          />
          <Button
            label="Abo beenden"
            variant="danger"
            loading={change.isPending && change.variables === 'DELETE'}
            onPress={() => change.mutate('DELETE')}
          />
        </>
      ) : (
        <Button
          label="Abo-Link erstellen"
          icon="link"
          loading={change.isPending}
          onPress={() => change.mutate('POST')}
        />
      )}
    </Screen>
  );
}
