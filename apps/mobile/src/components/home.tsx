/**
 * Bausteine der Startseite im neuen Look: Spiele zum Wischen, Band „Offen“, „Deine Woche“,
 * Schnellzugriff (docs/DESIGNSYSTEM.md › Seiten › Home).
 */
import type {
  ActionItem,
  Birthday,
  ClubOverview,
  EventSummary,
  MeResponse,
  NewsItem,
  TileInfo,
  TileInfoEntry,
} from '@clubroof/core';
import type { TintKey } from '@clubroof/design-tokens';
import { Ionicons } from '@/components/icon';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type ScrollViewProps,
  type NativeSyntheticEvent,
} from 'react-native';
import { EventRow, ResponseControls } from '@/components/events';
import { HeroAnswer } from '@/components/event-answer';
import { useTeamColorOf } from '@/lib/team-colors';
import { Text } from '@/components/app-text';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Crest,
  EdgeHint,
  Empty,
  GradientFill,
  HeroCard,
  IconTile,
  ListRow,
  Section,
  Sheet,
  shadowStyle,
  T,
  TileGrid,
  withAlpha,
  type IconName,
} from '@/components/ui';
import { clubInitials, formatAgo, formatDay, formatRemaining, formatTime } from '@/lib/format';
import { Counted, PressScale, useCountUp } from '@/lib/motion';
import { t } from '@/lib/i18n';
import { ReorderList } from '@/components/reorder';
import { openLink } from '@/lib/links';
import { MATCH_KIND_LABELS } from '@/lib/labels';
import { QUICK_LINKS, defaultQuickLinks, quickLinksFor, routeOf } from '@/lib/quick-links';
import { useIsDesktop } from '@/lib/layout';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

const CARD_GAP = 12;

/** Breite einer wischbaren Karte: 306, auf schmalen Geräten so, dass die nächste Karte herausragt. */
export function useCardWidth(max: number, peek = 60, gutter = 20) {
  const { width } = useWindowDimensions();
  return Math.min(max, Math.max(240, width - gutter - peek));
}

/**
 * Waagerechte Leiste, die über den Seitenrand hinausläuft; solange sie nach rechts weitergeht, sitzt ganz
 * rechts am Bildschirm ein dezenter Pfeil (Paket AP). `bleed` = Seitenrand der Seite, der aufgehoben wird.
 */
export function EdgeScroll({
  bleed,
  children,
  onOffset,
  ...rest
}: ScrollViewProps & { bleed: number; onOffset?: (x: number) => void }) {
  const desktop = useIsDesktop();
  const [more, setMore] = useState(true);
  const box = useRef({ view: 0, content: 0, offset: 0 });
  const update = () => {
    const { view, content, offset } = box.current;
    setMore(content > 0 && view > 0 && offset + view < content - 12);
  };
  return (
    // Desktop (Paket DT): in Spalten kein Ausbluten über den Seitenrand
    <View style={{ marginHorizontal: desktop ? 0 : -bleed }}>
      <ScrollView
        {...rest}
        contentContainerStyle={[
          rest.contentContainerStyle,
          desktop ? { paddingHorizontal: 0 } : null,
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={(e) => {
          box.current.view = e.nativeEvent.layout.width;
          update();
        }}
        onContentSizeChange={(content) => {
          box.current.content = content;
          update();
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const x = e.nativeEvent.contentOffset.x;
          box.current.offset = x;
          update();
          onOffset?.(x);
        }}
      >
        {children}
      </ScrollView>
      <EdgeHint visible={more} />
    </View>
  );
}

/** Querliste aus einrastenden Karten (Breite `width`). */
export function Swipe({
  width,
  children,
  onIndex,
}: {
  width: number;
  children: React.ReactNode;
  onIndex?: (i: number) => void;
}) {
  // Desktop (Paket DT3): Karten umbrechen statt am Rand abgeschnitten zu werden
  if (useIsDesktop())
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, paddingVertical: 6 }}>
        {children}
      </View>
    );
  return (
    <EdgeScroll
      bleed={20}
      snapToInterval={width + CARD_GAP}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 20, gap: CARD_GAP, paddingVertical: 6 }}
      onOffset={onIndex ? (x) => onIndex(Math.round(x / (width + CARD_GAP))) : undefined}
    >
      {children}
    </EdgeScroll>
  );
}

// ── Spiele zum Wischen ────────────────────────────────────────────────────────

export function MatchCarousel({ matches, club }: { matches: EventSummary[]; club: string }) {
  const width = useCardWidth(306);
  const [index, setIndex] = useState(0);
  const { colors } = useTheme();
  const desktopRow = useIsDesktop();
  if (matches.length === 0)
    return (
      <Empty
        icon="football-outline"
        text="Kein Spiel in Sicht"
        hint="Neue Spiele erscheinen hier, sobald sie angesetzt sind."
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
      {matches.length > 1 && !desktopRow ? (
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
      <View style={{ gap: 10 }}>
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
      </View>
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
  const { api } = useSignedIn();
  const [editing, setEditing] = useState(false);
  const links = quickLinksFor(me);
  return (
    <Section title="Schnellzugriff">
      <TileGrid
        items={[
          ...links.map((l) => {
            const hint = chipHint(info[l.key]);
            return {
              key: l.key,
              label: l.label,
              icon: l.icon,
              tint: l.tint,
              badge: hint?.text,
              hint: info[l.key]?.hint,
              onPress: () => router.push(routeOf(l, me) as never),
            };
          }),
          {
            key: 'add',
            label: 'Hinzufügen',
            icon: 'add' as const,
            add: true,
            onPress: () => setEditing(true),
          },
        ]}
      />
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
  const linkOf = (key: string) => QUICK_LINKS.find((l) => l.key === key)!;
  const rest = available.filter((l) => !selected.includes(l.key));
  return (
    <Sheet visible={visible} onClose={onClose} title="Schnellzugriff anpassen">
      <T variant="caption">
        Ziehe die Einträge am Griff in deine Reihenfolge. Was oben steht, erreichst du auf der
        Startseite zuerst.
      </T>
      <ReorderList
        keys={selected}
        onChange={setSelected}
        rowHeight={52}
        renderRow={(key, handle) => {
          const l = linkOf(key);
          return (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <IconTile name={l.icon} tone={l.tint} />
              <T variant="label" style={{ flex: 1, fontWeight: '700' }}>
                {l.label}
              </T>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: true }}
                accessibilityLabel={l.label}
                onPress={() => toggle(key)}
                hitSlop={8}
              >
                <Ionicons name="checkbox" size={24} color={colors.primaryText} />
              </Pressable>
              {handle}
            </View>
          );
        }}
      />
      {rest.length > 0 ? <T variant="overline">Weitere Möglichkeiten</T> : null}
      <View style={{ gap: 2 }}>
        {rest.map((l, i) => (
          <Pressable
            key={l.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
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
            <Ionicons name="square-outline" size={24} color={colors.onSurfaceMuted} />
          </Pressable>
        ))}
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

// ── Plakat „Nächstes Spiel“ (Stil „Anstoß“) ───────────────────────────────────

/** Kalendertage bis zum Beginn (Vereinszeit), 0 = heute */
function daysUntil(iso: string): number {
  const dayOf = (d: Date) =>
    new Date(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d) + 'T00:00:00Z',
    ).getTime();
  return Math.max(0, Math.round((dayOf(new Date(iso)) - dayOf(new Date())) / 86_400_000));
}

/** Eine Seite des Plakats: Countdown, Paarung und Ort eines Spiels (oder der Hinweis ohne Spiel). */
function PosterSlide({
  event,
  club,
  hasTeam,
  width,
  clubName,
  overview,
}: {
  event: EventSummary | undefined;
  club: string;
  hasTeam: boolean;
  width: number;
  clubName: string;
  overview: ClubOverview | null;
}) {
  const { colors } = useTheme();
  const days = event ? daysUntil(event.startsAt) : 0;
  const counted = useCountUp(days);
  const on = colors.hero.onHero;
  const soft = withAlpha(on, 0.82);
  return (
    <View style={{ width, paddingHorizontal: 22, paddingTop: 38, gap: 10 }}>
      {event ? (
        <View style={{ gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={event.title}
            onPress={() => router.push(`/events/${event.id}`)}
            style={{ gap: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  flexShrink: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 999,
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11.5,
                    fontWeight: '800',
                    letterSpacing: 1,
                    color: colors.onPrimary,
                    textTransform: 'uppercase',
                  }}
                >
                  {[
                    t(event.type === 'tournament' ? 'Nächstes Spielfest' : 'Nächstes Spiel'),
                    event.team?.name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: colors.anstoss.posterAccent,
                  flexShrink: 0,
                }}
              >
                {`${t('Zum Spiel')} ›`}
              </Text>
            </View>
            {days > 0 ? (
              <T
                variant="figure"
                color={on}
                style={{ fontSize: 108, lineHeight: 103, letterSpacing: -1 }}
              >
                {counted}
                <T variant="headline" color={on} style={{ fontSize: 32, letterSpacing: 2 }}>
                  {` ${t(days === 1 ? 'Tag' : 'Tage').toUpperCase()}`}
                </T>
              </T>
            ) : (
              <T variant="figure" color={on} style={{ fontSize: 84, lineHeight: 88 }}>
                {t('Heute').toUpperCase()}
              </T>
            )}
            {event.match ? (
              <T variant="headline" color={on} style={{ fontSize: 32, lineHeight: 34 }}>
                {`${club}${event.team ? ` ${event.team.badge}` : ''}\n`}
                <T variant="headline" color={colors.anstoss.posterAccent} style={{ fontSize: 32 }}>
                  vs.
                </T>
                {` ${event.match.opponentName}`}
              </T>
            ) : (
              <T
                variant="headline"
                color={on}
                numberOfLines={3}
                style={{ fontSize: 32, lineHeight: 34 }}
              >
                {event.title}
              </T>
            )}
            <T color={soft} style={{ fontSize: 13.5, lineHeight: 20, marginTop: 4 }}>
              {[
                formatDay(event.startsAt),
                `${formatTime(event.startsAt)} ${t('Uhr')}`,
                event.location,
                event.match
                  ? [
                      event.match.isHome ? t('Heimspiel') : t('Auswärts'),
                      t(MATCH_KIND_LABELS[event.match.kind]),
                    ].join(' · ')
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </T>
          </Pressable>
          <HeroAnswer event={event} />
        </View>
      ) : hasTeam ? (
        <View style={{ gap: 8 }}>
          <T variant="headline" color={on} style={{ fontSize: 32, lineHeight: 34 }}>
            Kein Spiel in Sicht
          </T>
          <T color={soft}>Neue Spiele erscheinen hier, sobald sie angesetzt sind.</T>
        </View>
      ) : (
        // Ohne Mannschaft und ohne Termin: kleine Vereinsübersicht (Entscheidung Vorstand 14.10.)
        <View style={{ gap: 12, alignItems: 'flex-start' }}>
          <T variant="overline" color={soft}>
            Dein Verein
          </T>
          <T variant="headline" color={on} style={{ fontSize: 32, lineHeight: 34 }}>
            {clubName}
          </T>
          {overview ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignSelf: 'stretch' }}>
              {(
                [
                  ['Mitglieder', overview.members],
                  ['Abteilungen', overview.departments],
                  ['Mannschaften', overview.teams],
                  ['Spiele diese Woche', overview.matchesThisWeek],
                ] as [string, number][]
              ).map(([label, value]) => (
                <View key={label} style={{ minWidth: '40%', flexGrow: 1 }}>
                  <T variant="figure" color={on} style={{ fontSize: 34, lineHeight: 36 }}>
                    <Counted value={value} />
                  </T>
                  <T variant="caption" color={soft}>
                    {label}
                  </T>
                </View>
              ))}
            </View>
          ) : (
            <T color={soft}>Schau dich im Verein um: Mannschaften, Termine und Neuigkeiten.</T>
          )}
          <Button
            label="Alle Mannschaften ansehen"
            variant="heroOutline"
            size="sm"
            onPress={() => router.push('/club-teams')}
          />
          <T variant="caption" color={soft}>
            Du bist keiner Mannschaft zugeordnet.
          </T>
        </View>
      )}
    </View>
  );
}

/**
 * Blickfang der Startseite: großes Plakat; nach links wischen zeigt die nächsten drei Spiele
 * (Pager-Punkte und „Spiel 1 von 3 · wischen“ unten). Darüber die Kopfzeile.
 * Ohne Spiel steht hier „Kein Spiel in Sicht“, ohne Mannschaft die kleine Vereinsübersicht.
 */
export function HomePoster({
  header,
  events,
  club,
  hasTeam,
  clubName,
  overview,
  onCurrent,
}: {
  header: React.ReactNode;
  events: EventSummary[];
  club: string;
  hasTeam: boolean;
  clubName: string;
  overview: ClubOverview | null;
  /** meldet den sichtbaren Termin, damit Personenkarten und Rückmeldung demselben Termin folgen (U05) */
  onCurrent?: (index: number) => void;
}) {
  const { colors } = useTheme();
  const desktop = useIsDesktop();
  const [width, setWidth] = useState(0);
  const [raw, setRaw] = useState(1);
  const scroller = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const slides = events.slice(0, 3);
  const n = slides.length;
  const loop = n > 1;
  // Endlosschleife: letzte Karte vor die erste, erste hinter die letzte setzen; am Rand unsichtbar springen
  const items = loop
    ? [slides[n - 1]!, ...slides, slides[0]!]
    : slides.length
      ? slides
      : [undefined];
  const current = loop ? (((raw - 1) % n) + n) % n : 0;
  useEffect(() => {
    onCurrent?.(current);
  }, [current, onCurrent]);
  useEffect(() => {
    if (loop && width > 0) scroller.current?.scrollTo({ x: width, animated: false });
  }, [loop, width, n]);
  const settle = (x: number) => {
    if (!loop || width <= 0) return;
    const i = Math.round(x / width);
    if (i === 0) scroller.current?.scrollTo({ x: n * width, animated: false });
    else if (i === n + 1) scroller.current?.scrollTo({ x: width, animated: false });
  };
  const next = () => scroller.current?.scrollTo({ x: (raw + 1) * width, animated: true });
  return (
    <HeroCard poster style={{ marginHorizontal: desktop ? -28 : -22 }}>
      <View
        style={{
          minHeight: desktop && !hasTeam ? 330 : 400,
          paddingBottom: slides.length > 0 ? 30 : 0,
        }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {header}
        {width > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={loop}
            scrollEventThrottle={32}
            onScrollBeginDrag={() => {
              dragging.current = true;
            }}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setRaw(Math.round(x / width));
              // Pfeil oder Programm: am Rand der Klone sofort springen (beim Ziehen erst nach dem Loslassen)
              if (!dragging.current) settle(x);
            }}
            onScrollEndDrag={(e) => {
              dragging.current = false;
              settle(e.nativeEvent.contentOffset.x);
            }}
            onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
          >
            {items.map((ev, i) => (
              <PosterSlide
                key={`${ev?.id ?? 'leer'}-${i}`}
                event={ev}
                club={club}
                hasTeam={hasTeam}
                width={width}
                clubName={clubName}
                overview={overview}
              />
            ))}
          </ScrollView>
        ) : null}
        {slides[current] ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('Spiel ansehen')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.push(`/events/${slides[current]!.id}`)}
            style={{
              position: 'absolute',
              right: 22,
              bottom: 0,
              height: 30,
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.hero.onHero }}>
              {`${t('Spiel ansehen')} ›`}
            </Text>
          </Pressable>
        ) : null}
        {loop ? (
          <>
            {/* Punkte in eigener Zeile unter dem Inhalt: überlagern weder Legende noch Kader-Link */}
            <View
              testID="poster-dots"
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 22,
                right: 22,
                bottom: 0,
                height: 30,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {slides.map((ev, i) => (
                <View
                  key={ev.id}
                  style={{
                    width: i === current ? 22 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === current ? colors.primary : colors.anstoss.textTertiary,
                    opacity: i === current ? 1 : 0.5,
                  }}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Nächstes Spiel')}
              onPress={next}
              style={{
                position: 'absolute',
                right: 10,
                top: 128,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.28)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.16)',
              }}
            >
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </Pressable>
          </>
        ) : null}
      </View>
    </HeroCard>
  );
}

// ── Personenkarten, Zusage, Woche, Neuigkeiten, Geburtstage ───────────────────

const STATUS_WORD: Record<string, string> = {
  pending: 'Zusage offen',
  yes: 'Nimmt teil',
  maybe: 'Unsicher',
  no: 'Nimmt nicht teil',
};

/** Pro Person (ich, meine Kinder) eine Karte mit dem Stand der Rückmeldung zum nächsten Spiel. */
export function PersonStatusCards({ event }: { event: EventSummary }) {
  const { colors } = useTheme();
  const teamColorOf = useTeamColorOf();
  const list = event.myResponses;
  if (list.length === 0 || (list.length === 1 && list[0]!.relation === 'self')) return null;
  const open = event.deadline && new Date(event.deadline) > new Date();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {list.map((r) => {
        const key =
          r.status === 'yes' || r.status === 'no' || r.status === 'maybe' ? r.status : 'pending';
        const tone =
          key === 'yes'
            ? { fill: colors.primary, text: colors.primaryText, on: colors.onPrimary }
            : key === 'no'
              ? {
                  fill: colors.status.urgent.solid,
                  text: colors.status.urgent.onContainer,
                  on: colors.status.urgent.onSolid,
                }
              : {
                  fill: colors.status.action.solid,
                  text: colors.status.action.onContainer,
                  on: colors.status.action.onSolid,
                };
        return (
          <View
            key={r.personId}
            accessible
            accessibilityLabel={`${r.firstName}, ${t(STATUS_WORD[key]!)}`}
            style={{
              flexGrow: 1,
              flexBasis: '40%',
              borderRadius: 22,
              padding: 14,
              gap: 8,
              backgroundColor: colors.anstoss.card,
              borderWidth: 1,
              borderColor: colors.anstoss.cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tone.fill,
                }}
              >
                <Text verbatim style={{ fontSize: 13, fontWeight: '800', color: tone.on }}>
                  {r.firstName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text
                  numberOfLines={1}
                  verbatim
                  style={{ fontSize: 14, fontWeight: '700', color: colors.onSurface }}
                >
                  {r.firstName}
                </Text>
                {event.team ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {teamColorOf(event.team.id) ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: teamColorOf(event.team.id)!,
                        }}
                      />
                    ) : null}
                    <T variant="caption" verbatim style={{ fontSize: 12 }}>
                      {event.team.badge}
                    </T>
                  </View>
                ) : null}
              </View>
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: tone.text }}>
                {STATUS_WORD[key]}
              </Text>
              {/* jede Karte nennt Termin und Datum selbst – sie folgt dem Plakat, bleibt aber für sich lesbar */}
              <T variant="caption" numberOfLines={1} verbatim style={{ fontSize: 12 }}>
                {event.match ? `vs. ${event.match.opponentName}` : event.title}
              </T>
              <T variant="caption" style={{ fontSize: 12 }}>
                {key === 'pending' && open
                  ? `${formatDay(event.startsAt)} · ${formatRemaining(event.deadline!)}`
                  : formatDay(event.startsAt)}
              </T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** „Zusage für Leon“: Überschrift mit Frist und die drei Antwort-Pillen. */
export function ResponseBlock({ event }: { event: EventSummary }) {
  const { colors } = useTheme();
  const list = event.myResponses;
  if (list.length === 0) return null;
  const only = list.length === 1 ? list[0]! : null;
  const title = !only
    ? 'Zusagen'
    : only.relation === 'self'
      ? 'Deine Zusage'
      : `Zusage für ${only.firstName}`;
  const open = event.deadline && new Date(event.deadline) > new Date();
  return (
    <Section title={title}>
      {open ? (
        <T
          variant="caption"
          color={colors.primaryText}
          style={{ fontSize: 12.5, fontWeight: '700', marginTop: -6 }}
        >
          {`Absagefrist: ${formatRemaining(event.deadline!)}`}
        </T>
      ) : null}
      <ResponseControls event={event} />
    </Section>
  );
}

/** „Diese Woche“: dieselbe Terminkarte wie in allen Listen (Antwort, Summenzeile, Teilnehmer). */
export function WeekTickets({ week }: { week: EventSummary[] }) {
  return (
    <Section title="Diese Woche" action="Alle anzeigen" onAction={() => router.push('/termine')}>
      {week.length === 0 ? (
        <Empty
          icon="calendar-outline"
          text="Diese Woche stehen keine Termine an."
          hint="Im Kalender siehst du, was danach kommt."
        />
      ) : (
        <View style={{ gap: 10 }}>
          {week.map((e, i) => (
            <EventRow key={e.id} event={e} first={i === 0} />
          ))}
        </View>
      )}
    </Section>
  );
}

/** Neuigkeiten als Bildkarten (280 × 170) zum Wischen; Dringendes in Rot bzw. Bernstein. */
export function NewsCards({ items }: { items: NewsItem[] }) {
  const { colors } = useTheme();
  if (items.length === 0)
    return (
      <Empty
        icon="newspaper-outline"
        text="Keine Neuigkeiten."
        hint="Neue Meldungen erscheinen hier und als Hinweis."
      />
    );
  return (
    <EdgeScroll bleed={22} contentContainerStyle={{ paddingHorizontal: 22, gap: 12 }}>
      {items.map((n) => {
        const [from, to] =
          n.priority === 'urgent'
            ? colors.anstoss.amberUrgent
              ? colors.anstoss.amberGradient
              : (['#8A1C1C', '#3A0F0F'] as const)
            : n.priority === 'important'
              ? (['#1E5FA8', '#0F2A4D'] as const)
              : ([colors.anstoss.poster.from, colors.anstoss.poster.to] as const);
        const label =
          n.priority === 'urgent'
            ? 'Dringend'
            : n.priority === 'important'
              ? 'Wichtig'
              : n.source.label;
        return (
          <PressScale
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={`${t(label)}, ${n.title}`}
            onPress={() => router.push(`/news/${n.id}`)}
            style={{
              width: 280,
              height: 170,
              borderRadius: 24,
              overflow: 'hidden',
              padding: 16,
              justifyContent: 'flex-end',
            }}
          >
            <GradientFill from={from} to={to} overlay={0.62} />
            <View style={{ gap: 3 }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  borderRadius: 999,
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 1,
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </Text>
              </View>
              <T
                variant="headline"
                color="#FFFFFF"
                numberOfLines={3}
                style={{ fontSize: 23, lineHeight: 25, marginTop: 5 }}
              >
                {n.title}
              </T>
              <T color="#D5E3DA" style={{ fontSize: 12 }}>
                {`${n.source.label} · ${t(formatAgo(n.publishedAt))}`}
              </T>
            </View>
          </PressScale>
        );
      })}
    </EdgeScroll>
  );
}

/** Geburtstage der Woche (eigene und die der Mannschaften, soweit freigegeben). */
export function BirthdayCard({ birthdays }: { birthdays: Birthday[] }) {
  const { colors } = useTheme();
  if (birthdays.length === 0) return null;
  const today = birthdays.some((b) => b.inDays === 0);
  return (
    <Section title={today ? 'Heute Geburtstag' : 'Bald Geburtstag'}>
      <Card list>
        {birthdays.map((b, i) => (
          <ListRow
            key={b.personId}
            first={i === 0}
            leading={
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.status.action.solid,
                }}
              >
                <Text verbatim style={{ fontWeight: '800', color: colors.status.action.onSolid }}>
                  {b.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
            }
            title={b.inDays === 0 ? `${b.name} hat heute Geburtstag` : `${b.name} · ${b.day}`}
            subtitle={b.teamBadge}
            trailing={<Ionicons name="gift-outline" size={22} color={colors.primaryText} />}
          />
        ))}
      </Card>
    </Section>
  );
}
