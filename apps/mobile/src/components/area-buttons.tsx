import { Ionicons } from '@/components/icon';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/app-text';
import type { IconName } from '@/components/ui';
import { canOpenAdmin, canOpenClubCash } from '@/lib/areas';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Hervorgehobener Zugang zu einem eigenen Bereich (Verwaltung violett, Vereinskasse blau). */
function AreaButton({
  tone,
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  tone: 'violet' | 'blue';
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const c = colors.tints[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 96,
        padding: 14,
        gap: 6,
        borderRadius: 22,
        backgroundColor: c.container,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Ionicons name={icon} size={26} color={c.onContainer} />
        {badge ? (
          <View
            style={{
              minWidth: 24,
              height: 24,
              paddingHorizontal: 6,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.status.action.container,
            }}
          >
            <Text
              verbatim
              style={{ fontSize: 12, fontWeight: '800', color: colors.status.action.onContainer }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <View>
        <Text style={{ fontSize: 16, fontWeight: '800', color: c.onContainer }}>{title}</Text>
        <Text style={{ fontSize: 12, color: c.onContainer }} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Zugänge zu den eigenen Bereichen unter dem Profil in „Ich“ (Paket ICH-VERWALTUNGSZUGAENGE): Admin-Verwaltung (violett)
 * und Vereinskasse (blau), jeweils nur mit Berechtigung – dieselbe Prüfung wie in „Verein → Meine Vereinsaufgaben“
 * (`canOpenAdmin`, `canOpenClubCash`). Ohne Recht entfällt die Zeile samt Lücke. Rechte prüft der Server.
 */
export function AreaButtons({ adminBadge }: { adminBadge?: string }) {
  const { me } = useSignedIn();
  const admin = canOpenAdmin(me);
  const cash = canOpenClubCash(me);
  if (!admin && !cash) return null;
  return (
    <View testID="area-buttons" style={{ flexDirection: 'row', gap: 12 }}>
      {admin ? (
        <AreaButton
          tone="violet"
          icon="shield-checkmark"
          title="Admin-Verwaltung"
          subtitle="Mitglieder, Sport, Inhalte, Verein"
          badge={adminBadge}
          onPress={() => router.push('/admin')}
        />
      ) : null}
      {cash ? (
        <AreaButton
          tone="blue"
          icon="wallet"
          title="Vereinskasse"
          subtitle="Buchung, Beiträge, Planung, Auswertung"
          onPress={() => router.push('/club-cash')}
        />
      ) : null}
    </View>
  );
}
