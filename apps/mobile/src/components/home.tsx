/**
 * Bausteine der Startseite im neuen Look: Spiele zum Wischen, Band „Offen“, „Deine Woche“,
 * Schnellzugriff (docs/DESIGNSYSTEM.md › Seiten › Home).
 */
import type {
  ActionItem,
  Birthday,
  EventSummary,
  MeResponse,
  TileInfo,
  TileInfoEntry,
} from '@clubroof/core';
import type { TintKey } from '@clubroof/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { EventRow, ResponseControls } from '@/components/events';
import { Text } from '@/components/app-text';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Crest,
  Empty,
  HeroCard,
  IconTile,
  Section,
  Sheet,
  shadowStyle,
  T,
  type IconName,
} from '@/components/ui';
import { clubInitials, formatDay, formatRemaining, formatTime } from '@/lib/format';
import { openLink } from '@/lib/links';
import { MATCH_KIND_LABELS } from '@/lib/labels';
import { QUICK_LINKS, defaultQuickLinks, quickLinksFor, routeOf } from '@/lib/quick-links';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const CARD_GAP = 12;

/** Breite einer wischbaren Karte: 306, auf schmalen Geräten so, dass die nächste Karte herausragt. */
function useCardWidth(max: number, peek = 60, gutter = 20) {
  const { width } = useWindowDimensions();
  return Math.min(max, Math.max(240, width - gutter - peek));
}

/** Querliste, die über den Seitenrand hinausläuft und an Karten einrastet. */
function Swipe({
  width,
  children,
  onIndex,
}: {
  width: number;
  children: React.ReactNode;
  onIndex?: (i: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={width + CARD_GAP}
      decelerationRate="fast"
      style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: CARD_GAP, paddingVertical: 6 }}
      scrollEventThrottle={32}
      onScroll={
        onIndex
          ? (e: NativeSyntheticEvent<NativeScrollEvent>) =>
              onIndex(Math.round(e.nativeEvent.contentOffset.x / (width + CARD_GAP)))
          : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

// ── Spiele zum Wischen ────────────────────────────────────────────────────────

export function MatchCarousel({
  matches,
  club,
  hasTeam,
}: {
  matches: EventSummary[];
  club: string;
  /** Person gehört zu mindestens einer Mannschaft */
  hasTeam: boolean;
}) {
  const width = useCardWidth(306);
  const [index, setIndex] = useState(0);
  const { colors } = useTheme();
  if (matches.length === 0)
    return hasTeam ? (
      <Empty
        icon="football-outline"
        text="Kein Spiel in Sicht"
        hint="Neue Spiele erscheinen hier, sobald sie angesetzt sind."
      />
    ) : (
      <Empty
        icon="people-outline"
        text="Noch keine Mannschaft"
        hint="Sobald du einer Mannschaft zugeordnet bist, siehst du hier das nächste Spiel."
        action={{ label: 'Alle Mannschaften ansehen', onPress: () => router.push('/club-teams') }}
      />
    );
  const current = Math.min(index, matches.length - 1);
  return (
    <View style={{ gap: 8 }}>
      <Swipe width={width} onIndex={setIndex}>
        {matches.map((m) => (
          <MatchCard key={m.id} event={m} width={width} club={club} />
        ))}
      </Swipe>
      {matches.length > 1 ? (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {matches.map((m, i) => (
              <View
                key={m.id}
                style={{
                  width: i === current ? 20 : 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: i === current ? colors.primary : colors.border,
                }}
              />
            ))}
          </View>
          <T variant="caption">{`Nächste Spiele · ${current + 1} von ${matches.length}`}</T>
        </View>
      ) : null}
    </View>
  );
}

function MatchCard({ event, width, club }: { event: EventSummary; width: number; club: string }) {
  const { colors } = useTheme();
  const on = colors.hero.onHero;
  const pill = 'rgba(255,255,255,0.18)';
  const isHome = event.match?.isHome ?? event.title.includes('unserer Anlage');
  const opponent = event.match?.opponentName ?? null;
  const ourName = `${club}${event.team ? ` ${event.team.badge}` : ''}`;
  const kind = event.match ? MATCH_KIND_LABELS[event.match.kind] : null;
  const tag =
    event.type === 'tournament'
      ? 'Spielfest'
      : [isHome ? 'Heimspiel' : 'Auswärts', kind].filter(Boolean).join(' · ');
  const deadline =
    event.deadline && new Date(event.deadline) > new Date()
      ? `Absagefrist: ${formatRemaining(event.deadline)}`
      : null;
  return (
    <HeroCard style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={event.title}
        onPress={() => router.push(`/events/${event.id}`)}
        style={{ gap: 12 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <View
            style={{
              flexShrink: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              backgroundColor: pill,
              paddingVertical: 3,
              paddingLeft: 3,
              paddingRight: 10,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Crest initials={clubInitials(club)} size={16} />
            </View>
            <Text
              numberOfLines={1}
              style={{ flexShrink: 1, color: on, fontSize: 12, fontWeight: '700' }}
            >
              {event.team ? event.team.name : club}
            </Text>
          </View>
          <View
            style={{
              borderRadius: 999,
              backgroundColor: on,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: colors.hero.from, fontSize: 11, fontWeight: '700' }}
            >
              {tag}
            </Text>
          </View>
        </View>

        {opponent ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-around',
            }}
          >
            <Side label={ourName}>
              <Crest initials={clubInitials(club)} size={30} />
            </Side>
            <T variant="headline" color={on} style={{ fontSize: 20, marginTop: 10 }}>
              vs.
            </T>
            <Side label={opponent}>
              <Ionicons name="shield-outline" size={24} color={colors.hero.from} />
            </Side>
          </View>
        ) : (
          <T
            variant="headline"
            color={on}
            numberOfLines={2}
            style={{ fontSize: 26, lineHeight: 30 }}
          >
            {event.title}
          </T>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <T color={on} variant="label" numberOfLines={2} style={{ flex: 1, fontWeight: '400' }}>
            {[formatDay(event.startsAt), formatTime(event.startsAt), event.location]
              .filter(Boolean)
              .join(' · ')}
          </T>
          <T variant="figure" color={on} style={{ fontSize: 18 }}>
            {formatRemaining(event.startsAt)}
          </T>
        </View>
        {deadline ? (
          <T variant="caption" color={on}>
            {deadline}
          </T>
        ) : null}
      </Pressable>
      {/* bei ungleich hohen Karten steht die Zu-/Absage immer unten */}
      <View style={{ marginTop: 'auto' }}>
        <ResponseControls event={event} tone="hero" />
      </View>
    </HeroCard>
  );
}

function Side({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, width: 110 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
      <T
        variant="section"
        color={colors.hero.onHero}
        numberOfLines={2}
        style={{ textAlign: 'center', fontSize: 14, lineHeight: 17 }}
      >
        {label}
      </T>
    </View>
  );
}

// ── Band „Offen“ ──────────────────────────────────────────────────────────────

const ACTION_ICON: Record<ActionItem['kind'], IconName> = {
  attendance: 'calendar',
  poll: 'stats-chart',
  approval: 'checkmark-done',
  task: 'clipboard',
};
const ACTION_TINT: Record<ActionItem['kind'], TintKey> = {
  attendance: 'blue',
  poll: 'violet',
  approval: 'green',
  task: 'orange',
};

export function OpenBand({ actions }: { actions: ActionItem[] }) {
  const width = useCardWidth(232, 70);
  const { colors, radii, isDark, elevation } = useTheme();
  const [poll, setPoll] = useState<ActionItem | null>(null);
  if (actions.length === 0)
    return (
      <Section title="Offen">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile name="checkmark-done" tone="success" />
            <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
              Alles erledigt – nichts offen.
            </T>
          </View>
        </Card>
      </Section>
    );
  // Die Aktion mit der nächsten Frist ist die dringendste
  const urgent = actions
    .filter((a) => a.dueAt)
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))[0];
  return (
    <Section title="Offen">
      <Swipe width={width}>
        {actions.map((a) => {
          const isUrgent = a.id === urgent?.id;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={() => (a.options?.length ? setPoll(a) : openLink(a.link))}
              style={{
                width,
                minHeight: 108,
                gap: 10,
                padding: 14,
                borderRadius: radii.xl,
                backgroundColor: colors.surfaceRaised,
                borderWidth: isUrgent ? 2 : isDark ? 1 : 0,
                borderColor: isUrgent ? colors.status.action.solid : colors.border,
                ...(isDark ? null : shadowStyle(elevation.card)),
              }}
            >
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <IconTile name={ACTION_ICON[a.kind]} tone={ACTION_TINT[a.kind]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="label" numberOfLines={2} style={{ fontWeight: '700' }}>
                    {a.title}
                  </T>
                  {a.subtitle ? (
                    <T variant="caption" numberOfLines={2}>
                      {a.subtitle}
                    </T>
                  ) : null}
                </View>
              </View>
              {a.dueAt ? (
                <Chip
                  tone={isUrgent ? 'action' : 'neutral'}
                  icon="time-outline"
                  label={formatRemaining(a.dueAt)}
                />
              ) : null}
            </Pressable>
          );
        })}
      </Swipe>
      <PollSheet action={poll} onClose={() => setPoll(null)} />
    </Section>
  );
}

/** Umfrage direkt von der Startseite beantworten (Konzept §3). */
function PollSheet({ action, onClose }: { action: ActionItem | null; onClose: () => void }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const vote = useMutation({
    mutationFn: (optionId: string) =>
      api(`/polls/${action!.id}/vote`, { method: 'PUT', body: { optionId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      void queryClient.invalidateQueries({ queryKey: ['polls'] });
      const id = action!.id;
      onClose();
      router.push(`/polls/${id}`);
    },
  });
  return (
    <Sheet visible={!!action} onClose={onClose} title={action?.title}>
      {action?.subtitle ? <T variant="caption">{action.subtitle}</T> : null}
      {action ? (
        <ChoiceChips
          options={(action.options ?? []).map((o) => ({ value: o.id, label: o.label }))}
          selected={vote.variables ? [vote.variables] : []}
          onToggle={(id) => !vote.isPending && vote.mutate(id)}
        />
      ) : null}
      {vote.error ? <Chip tone="urgent" icon="alert-circle" label={vote.error.message} /> : null}
      {action ? (
        <Button
          label="Zur Umfrage"
          variant="outline"
          onPress={() => {
            onClose();
            openLink(action.link);
          }}
        />
      ) : null}
    </Sheet>
  );
}

// ── Deine Woche ───────────────────────────────────────────────────────────────

export function WeekCard({ week, birthdays }: { week: EventSummary[]; birthdays: Birthday[] }) {
  const { colors } = useTheme();
  const birthdayLine = birthdays
    .map((b) => (b.inDays === 0 ? `${b.name} heute 🎉` : `${b.name} ${b.day}`))
    .join(' · ');
  return (
    <Section title="Deine Woche" action="Alle anzeigen" onAction={() => router.push('/termine')}>
      <Card>
        {week.length === 0 ? (
          <Empty
            icon="calendar-outline"
            text="Diese Woche stehen keine Termine an."
            hint="Im Kalender siehst du, was danach kommt."
          />
        ) : null}
        {week.map((e, i) => (
          <EventRow key={e.id} event={e} first={i === 0} />
        ))}
        {birthdays.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: week.length ? 8 : 0,
              paddingTop: week.length ? 10 : 0,
              borderTopWidth: week.length ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            <Ionicons name="gift-outline" size={16} color={colors.onSurfaceMuted} />
            <T variant="caption" style={{ flex: 1 }}>
              {birthdayLine}
            </T>
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

// ── Schnellzugriff ────────────────────────────────────────────────────────────

/** Kleiner Hinweis oben rechts am Chip: Zähler, sonst „neu“ – aus den Kachel-Infos der Bereiche. */
function chipHint(entry: TileInfoEntry | undefined): { text: string; count: boolean } | null {
  if (!entry) return null;
  if (entry.badge) return { text: String(entry.badge), count: true };
  if (entry.hint && /\bneu\b|\bnew\b/i.test(entry.hint)) return { text: 'neu', count: false };
  return null;
}

export function QuickAccess({
  me,
  info,
  onSaved,
}: {
  me: MeResponse;
  /** Hinweise je Schlüssel des Schnellzugriffs (Zähler, „neu“) */
  info: TileInfo;
  onSaved: () => Promise<void>;
}) {
  const { colors, isDark, elevation } = useTheme();
  const { api } = useSignedIn();
  const [editing, setEditing] = useState(false);
  const links = quickLinksFor(me);
  return (
    <Section title="Schnellzugriff">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 6 }}
      >
        {links.map((l) => (
          <Pressable
            key={l.key}
            accessibilityRole="button"
            onPress={() => router.push(routeOf(l, me) as never)}
            accessibilityLabel={[l.label, info[l.key]?.hint].filter(Boolean).join(', ')}
            style={{
              height: 46,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 6,
              paddingRight: 16,
              borderRadius: 23,
              backgroundColor: colors.surfaceRaised,
              ...(isDark
                ? { borderWidth: 1, borderColor: colors.border }
                : shadowStyle(elevation.control)),
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.tints[l.tint].container,
              }}
            >
              <Ionicons name={l.icon} size={18} color={colors.tints[l.tint].onContainer} />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '700' }}>
              {l.label}
            </Text>
            {(() => {
              const hint = chipHint(info[l.key]);
              return hint ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -2,
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.status.action.container,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: colors.status.action.onContainer,
                    }}
                  >
                    {hint.text}
                  </Text>
                </View>
              ) : null;
            })()}
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditing(true)}
          style={{
            height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            borderRadius: 23,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.onSurfaceMuted,
          }}
        >
          <Ionicons name="add" size={18} color={colors.onSurfaceMuted} />
          <Text style={{ color: colors.onSurfaceMuted, fontSize: 14, fontWeight: '700' }}>
            Hinzufügen
          </Text>
        </Pressable>
      </ScrollView>
      <QuickAccessEditor
        me={me}
        visible={editing}
        onClose={() => setEditing(false)}
        onSave={async (keys) => {
          await api('/me/preferences', { method: 'PUT', body: { quickLinks: keys } });
          await onSaved();
          setEditing(false);
        }}
      />
    </Section>
  );
}

function QuickAccessEditor({
  me,
  visible,
  onClose,
  onSave,
}: {
  me: MeResponse;
  visible: boolean;
  onClose: () => void;
  onSave: (keys: string[] | null) => Promise<void>;
}) {
  const { colors } = useTheme();
  const available = QUICK_LINKS.filter((l) => l.available(me));
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (keys: string[] | null) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(keys);
    } catch {
      setError('Die Auswahl konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };
  // Beim Öffnen mit der aktuellen Auswahl beginnen
  const [wasVisible, setWasVisible] = useState(false);
  if (visible && !wasVisible) {
    setWasVisible(true);
    setSelected(quickLinksFor(me).map((l) => l.key));
  } else if (!visible && wasVisible) setWasVisible(false);
  const toggle = (key: string) =>
    setSelected((cur) =>
      cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key].slice(0, 12),
    );
  return (
    <Sheet visible={visible} onClose={onClose} title="Schnellzugriff anpassen">
      <T variant="caption">
        Wähle, was auf deiner Startseite ganz oben erreichbar sein soll. Die Reihenfolge ergibt sich
        aus deiner Auswahl.
      </T>
      <View style={{ gap: 2 }}>
        {available.map((l, i) => {
          const on = selected.includes(l.key);
          return (
            <Pressable
              key={l.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(l.key)}
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <IconTile name={l.icon} tone={l.tint} />
              <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
                {l.label}
              </T>
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={24}
                color={on ? colors.primaryText : colors.onSurfaceMuted}
              />
            </Pressable>
          );
        })}
      </View>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          style={{ flex: 1 }}
          label="Zurücksetzen"
          variant="outline"
          disabled={saving || me.user.quickLinks === null}
          onPress={() => void run(null)}
        />
        <Button
          style={{ flex: 1 }}
          label="Speichern"
          loading={saving}
          onPress={() => void run(selected)}
        />
      </View>
      <T variant="caption">{`Standard für dich: ${defaultQuickLinks(me)
        .map((k) => QUICK_LINKS.find((l) => l.key === k)?.label)
        .join(' · ')}`}</T>
    </Sheet>
  );
}
