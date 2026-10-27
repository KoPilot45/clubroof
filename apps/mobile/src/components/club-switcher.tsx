import type { AccountClub } from '@clubroof/core';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@/components/icon';
import { RequestError } from '@/lib/api';
import { t } from '@/lib/i18n';
import { mediaUri } from '@/lib/upload';
import { useOutbox } from '@/lib/outbox';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { ClubLogo, Crest, T } from './ui';

/**
 * Vereinslogo (oder Wappen) in Kopfzeile und Seitenleiste. Hat das Konto mehr als einen Verein, überlagert ein
 * kleines Wechsel-Symbol das Logo unten rechts; ein Tipp öffnet die Vereinsauswahl. Bei nur einem Verein bleibt
 * alles wie bisher.
 */
export function ClubMark({ size, crestSize }: { size: number; crestSize?: number }) {
  const session = useSession();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const me = session.me;
  if (!me) return null;
  const mark = me.club.logoUrl ? (
    <ClubLogo uri={mediaUri(me.club.logoUrl)!} size={size} />
  ) : (
    <Crest initials={me.club.shortCode} size={crestSize ?? size} />
  );
  if (me.clubs.length < 2) return mark;
  const others = me.clubs.reduce((sum, c) => sum + (c.active ? 0 : c.unread), 0);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Verein wechseln')}
        onPress={() => setOpen(true)}
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      >
        {mark}
        <View
          style={{
            position: 'absolute',
            right: -6,
            bottom: -6,
            width: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        >
          <Ionicons name="swap-horizontal" size={13} color={colors.onPrimary} />
        </View>
        {others > 0 ? (
          <View
            style={{
              position: 'absolute',
              right: -4,
              top: -4,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.status.urgent.container,
              borderWidth: 2,
              borderColor: colors.status.urgent.onContainer,
            }}
          />
        ) : null}
      </Pressable>
      <ClubPicker visible={open} onClose={() => setOpen(false)} clubs={me.clubs} />
    </>
  );
}

function ClubPicker({
  visible,
  onClose,
  clubs,
}: {
  visible: boolean;
  onClose: () => void;
  clubs: AccountClub[];
}) {
  const { colors, radii } = useTheme();
  const { switchClub } = useSession();
  const queued = useOutbox();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choose = async (club: AccountClub) => {
    if (club.active) return onClose();
    // Noch nicht gesendete Antworten gehören zum bisherigen Verein und gingen sonst verloren
    if (queued.length > 0) {
      setError(
        t('Es warten noch nicht gesendete Antworten. Bitte verbinde dich erst mit dem Internet.'),
      );
      return;
    }
    setBusy(club.id);
    setError(null);
    try {
      await switchClub(club.id);
      onClose();
    } catch (e) {
      setError(e instanceof RequestError ? e.message : t('Das hat nicht geklappt.'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
          backgroundColor: colors.anstoss.scrimDialog,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Schließen')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '80%',
            borderRadius: radii.xxl,
            padding: 20,
            gap: 12,
            backgroundColor: colors.anstoss.sheet,
            borderWidth: 1,
            borderColor: colors.anstoss.sheetBorder,
          }}
        >
          <T variant="headline" accessibilityRole="header">
            Verein wählen
          </T>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {clubs.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                accessibilityState={{ selected: c.active }}
                disabled={busy !== null}
                onPress={() => void choose(c)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: radii.lg,
                  backgroundColor: c.active ? colors.primaryContainer : 'transparent',
                  opacity: busy && busy !== c.id ? 0.5 : 1,
                }}
              >
                {c.logoUrl ? (
                  <ClubLogo uri={mediaUri(c.logoUrl)!} size={36} />
                ) : (
                  <Crest initials={c.shortCode} size={34} />
                )}
                <T style={{ flex: 1 }} verbatim>
                  {c.name}
                </T>
                {c.active ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primaryText} />
                ) : c.unread > 0 ? (
                  <View
                    style={{
                      minWidth: 22,
                      paddingHorizontal: 6,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.status.urgent.container,
                    }}
                    accessibilityLabel={t(`${c.unread} ungelesene Meldungen`)}
                  >
                    <T variant="caption" color={colors.status.urgent.onContainer} verbatim>
                      {String(c.unread)}
                    </T>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          {error ? <T color={colors.status.urgent.onContainer}>{error}</T> : null}
        </View>
      </View>
    </Modal>
  );
}
