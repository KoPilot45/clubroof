/**
 * Sponsoren-Container (Paket SP2): kompakte Zeile als Wischelement unter den Neuigkeiten (Home, Verein) bzw. den
 * Kacheln (Team). Zeigt bis zu drei zufällige Sponsoren mit Werbung, immer gekennzeichnet und ohne Auswertung
 * (nichts wird gezählt). Alle 6 Sekunden gleitet die nächste Folie ein; das pausiert beim Berühren und Wischen, im
 * Hintergrund und bei „Bewegung reduzieren“ (dann nur Wischen). Nie in Anmeldung, Kasse, Chat oder Kinderdaten.
 */
import type { SponsorAds, SponsorItem } from '@clubroof/core';
import { Ionicons } from '@/components/icon';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Crest, T, withAlpha } from '@/components/ui';
import { clubInitials } from '@/lib/format';
import { useReduceMotion } from '@/lib/motion';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { mediaUri } from '@/lib/upload';

/** Dauer, bis die nächste Folie einrutscht. */
export const SPONSOR_INTERVAL_MS = 6000;

/** Öffnet den Link des Sponsors im Browser (nur https). */
export function openSponsor(s: Pick<SponsorItem, 'linkUrl'>) {
  if (s.linkUrl?.startsWith('https://')) void Linking.openURL(s.linkUrl);
}

// ── Startwert der Auswahl: je App-Sitzung stabil, beim Ziehen zum Aktualisieren neu ──────────────────
const newSeed = () => Math.random().toString(36).slice(2, 10);
let seed = newSeed();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Neue Auswahl (Ziehen zum Aktualisieren): neuer Startwert, die Container laden neu. */
export function refreshSponsorAds(queryClient: QueryClient) {
  seed = newSeed();
  listeners.forEach((fn) => fn());
  void queryClient.invalidateQueries({ queryKey: ['sponsor-ads'] });
}

/** Logo des Sponsors (im Dunkelmodus das eigene Logo, falls vorhanden) oder Initialen. */
export function SponsorLogo({
  sponsor,
  size,
  inner,
}: {
  sponsor: SponsorItem;
  size: number;
  /** Größe des Logos bzw. der Initialen innerhalb der weißen Kachel */
  inner: number;
}) {
  const { isDark } = useTheme();
  const uri = mediaUri((isDark && sponsor.logoDarkUrl) || sponsor.logoUrl);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.29),
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={{ width: inner, height: inner }}
        />
      ) : (
        <Crest initials={clubInitials(sponsor.name)} size={inner} />
      )}
    </View>
  );
}

/** „Anzeige“-Kennzeichnung. */
export function AdTag({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: withAlpha(colors.onSurface, 0.35),
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          fontWeight: '800',
          letterSpacing: 1,
          color: colors.onSurfaceMuted,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function AdRow({ sponsor, label }: { sponsor: SponsorItem; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${sponsor.name}`}
      onPress={() => router.push(`/sponsor/${sponsor.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <SponsorLogo sponsor={sponsor} size={52} inner={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="overline" color={colors.anstoss.textTertiary}>
          Unterstützt von
        </T>
        <T variant="headline" numberOfLines={1} verbatim style={{ fontSize: 21, lineHeight: 23 }}>
          {sponsor.name}
        </T>
        {sponsor.slogan ? (
          <T variant="caption" numberOfLines={1} verbatim>
            {sponsor.slogan}
          </T>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <AdTag label={label} />
        <Ionicons name="chevron-forward" size={20} color={colors.anstoss.textTertiary} />
      </View>
    </Pressable>
  );
}

/** Sponsoren mit Werbung für diese Sitzung (leer, wenn das Modul aus ist oder niemand wirbt). */
function useSponsorAds() {
  const { api, me } = useSignedIn();
  const enabled = me.clubModules.includes('sponsors');
  const current = useSyncExternalStore(subscribe, () => seed);
  const ads = useQuery({
    queryKey: ['sponsor-ads', current],
    queryFn: () => api<SponsorAds>(`/sponsors/ads?seed=${current}`),
    enabled,
    staleTime: 10 * 60_000,
  });
  return { enabled, ads };
}

/**
 * Gibt es etwas anzuzeigen? Bildschirme rendern den Container nur dann, damit keine leere Fläche mit
 * Seitenabstand entsteht.
 */
export function useHasSponsorAds(): boolean {
  const { enabled, ads } = useSponsorAds();
  return enabled && (ads.data?.sponsors.length ?? 0) > 0;
}

/** Wischelement mit Pager-Punkten; ohne werbende Sponsoren erscheint nichts. */
export function SponsorAdContainer() {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const { enabled, ads } = useSponsorAds();
  const list = ads.data?.sponsors ?? [];
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  // Takt: letzte Bewegung oder Berührung; gepausiert, solange der Finger auf dem Container liegt
  const last = useRef(Date.now());
  const touching = useRef(false);
  const active = useRef(true);
  const at = useRef(0);
  at.current = index;
  const n = list.length;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      active.current = s === 'active';
      last.current = Date.now();
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (n < 2 || reduce || width === 0) return;
    const timer = setInterval(() => {
      if (touching.current || !active.current) return;
      if (Date.now() - last.current < SPONSOR_INTERVAL_MS - 50) return;
      last.current = Date.now();
      scroller.current?.scrollTo({ x: ((at.current + 1) % n) * width, animated: true });
    }, 500);
    return () => clearInterval(timer);
  }, [n, reduce, width]);

  if (!enabled || n === 0) return null;
  const label = ads.data!.label;
  return (
    <View style={{ gap: 12 }}>
      <View
        onTouchStart={() => {
          touching.current = true;
          last.current = Date.now();
        }}
        onTouchEnd={() => {
          touching.current = false;
          last.current = Date.now();
        }}
        onTouchCancel={() => {
          touching.current = false;
          last.current = Date.now();
        }}
        style={{
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: colors.anstoss.card,
          borderWidth: 1,
          borderColor: colors.anstoss.cardBorder,
        }}
      >
        <ScrollView
          ref={scroller}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          horizontal
          pagingEnabled
          scrollEnabled={n > 1}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
          }}
          onMomentumScrollEnd={() => {
            last.current = Date.now();
          }}
          onScrollBeginDrag={() => {
            last.current = Date.now();
          }}
        >
          {list.map((sp) => (
            <View key={sp.id} style={{ width: width || undefined }}>
              <AdRow sponsor={sp} label={label} />
            </View>
          ))}
        </ScrollView>
      </View>
      {n > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {list.map((sp, i) => (
            <View
              key={sp.id}
              style={{
                width: i === Math.min(index, n - 1) ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === Math.min(index, n - 1) ? colors.primary : colors.anstoss.textTertiary,
                opacity: i === Math.min(index, n - 1) ? 1 : 0.5,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Für Bildschirme mit „Ziehen zum Aktualisieren“: neue Auswahl anstoßen. */
export function useRefreshSponsorAds() {
  const queryClient = useQueryClient();
  return () => refreshSponsorAds(queryClient);
}
