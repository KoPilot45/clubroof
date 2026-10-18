/**
 * Aufstellungsplaner (Paket AUF): Spielfeld mit Formationen für 7er, 9er und 11er, Bank ohne feste Zahl und Kaderleiste
 * mit Trainingsbeteiligung. Spieler werden gezogen (Maus, Finger) oder per Antippen gesetzt. Nur für das Trainerteam;
 * Spieler und Eltern sehen die veröffentlichte Aufstellung schreibgeschützt (siehe `components/lineup/lineup-view`).
 */
import {
  FORMATIONS,
  LINEUP_SIZES,
  attendanceLevel,
  boardFromEntries,
  boardToEntries,
  changeFormation,
  findFormation,
  movePlayer,
  placedIds,
  type Board,
  type BoardPlace,
  type LineupSize,
  type MatchSheet,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/app-text';
import { DndProvider, DropZone, useDndState, type DragData } from '@/components/lineup/dnd';
import {
  AttendanceBars,
  BenchTile,
  Disc,
  Ghost,
  Pitch,
  SquadCard,
  Strip,
  percentText,
  playerFromCandidate,
  useLevelColor,
  type PlannerPlayer,
} from '@/components/lineup/parts';
import {
  Button,
  Card,
  Chip,
  EdgeHint,
  ErrorNotice,
  HeroCard,
  Loading,
  Screen,
  Section,
  Segment,
  Sheet,
  T,
  Toggle,
  withAlpha,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/format';
import { hapticSelect } from '@/lib/haptics';
import { useIsDesktop } from '@/lib/layout';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';

const place = (id: string): BoardPlace => {
  if (id === 'pool') return { kind: 'pool' };
  const [kind, index] = id.split(':');
  return { kind: kind === 's' ? 'slot' : 'bench', index: Number(index) };
};

export default function LineupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useSignedIn();
  const sheet = useQuery({
    queryKey: ['match', id],
    queryFn: () => api<MatchSheet>(`/events/${id}/match`),
  });
  if (sheet.isPending) return <Loading />;
  if (sheet.error) return <ErrorNotice error={sheet.error} onRetry={() => sheet.refetch()} />;
  return <Planner sheet={sheet.data} />;
}

/** Spielerliste, wie der Server sie kennt; Einträge außerhalb der Kandidaten bleiben erhalten. */
function buildPlayers(sheet: MatchSheet): Map<string, PlannerPlayer> {
  const players = new Map<string, PlannerPlayer>();
  for (const c of sheet.candidates ?? []) players.set(c.personId, playerFromCandidate(c));
  for (const e of sheet.lineup?.entries ?? []) {
    if (players.has(e.personId)) continue;
    const parts = e.name.split(' ');
    players.set(e.personId, {
      id: e.personId,
      name: e.name,
      last: parts.slice(1).join(' ') || e.name,
      number: e.jerseyNumber,
      abbr: null,
      position: e.position,
      status: 'yes',
      reason: null,
      attendance: null,
    });
  }
  return players;
}

function Planner({ sheet }: { sheet: MatchSheet }) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const players = useMemo(() => buildPlayers(sheet), [sheet]);
  const initial = useMemo(
    () =>
      boardFromEntries(
        (sheet.lineup?.entries ?? []).map((e) => ({
          personId: e.personId,
          role: e.role,
          slot: e.slot,
        })),
        sheet.lineup?.size ?? null,
        sheet.lineup?.formation ?? null,
        sheet.suggestedSize,
      ),
    // nur beim Öffnen: später gespeicherte Stände ersetzen das Brett nicht
    [],
  );
  const [board, setBoard] = useState<Board>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [sel, setSel] = useState<{ src: string; personId: string } | null>(null);
  const [sort, setSort] = useState<'att' | 'nr'>('att');
  const [error, setError] = useState<string | null>(null);
  const [leave, setLeave] = useState<{ action: unknown } | null>(null);
  const dirty = JSON.stringify(board) !== saved;

  const formation = findFormation(board.size, board.formation) ?? FORMATIONS[board.size][0]!;
  const placed = placedIds(board);
  const sorted = (list: PlannerPlayer[]) =>
    [...list].sort(
      sort === 'att'
        ? (a, b) =>
            (b.attendance?.percent ?? -1) - (a.attendance?.percent ?? -1) ||
            (a.number ?? 99) - (b.number ?? 99)
        : (a, b) => (a.number ?? 99) - (b.number ?? 99),
    );
  const all = [...players.values()];
  const available = sorted(all.filter((p) => p.status !== 'no' && !placed.has(p.id)));
  const unavailable = sorted(all.filter((p) => p.status === 'no'));
  const startersCount = board.slots.filter(Boolean).length;
  const benchCount = board.bench.filter(Boolean).length;
  const missing = board.slots.length - startersCount;

  const move = (src: string, dst: string, personId: string) => {
    setBoard((b) => movePlayer(b, place(src), place(dst), personId));
    setSel(null);
  };

  // Antippen als Alternative zum Ziehen: Spieler wählen, dann Platz oder Bankplatz antippen
  const tapSlot = (kind: 's' | 'b', index: number) => {
    const id = `${kind}:${index}`;
    const here = kind === 's' ? board.slots[index] : board.bench[index];
    hapticSelect();
    if (sel && sel.src === id) return setSel(null);
    if (sel) return move(sel.src, id, sel.personId);
    if (here) setSel({ src: id, personId: here });
  };
  const tapCard = (p: PlannerPlayer) => {
    hapticSelect();
    if (sel && sel.src !== 'pool') {
      // gewählte Position bekommt den Spieler aus dem Kader, der bisherige geht in den Kader zurück
      return move('pool', sel.src, p.id);
    }
    setSel(sel?.personId === p.id ? null : { src: 'pool', personId: p.id });
  };
  const pickFromList = (p: PlannerPlayer) => {
    hapticSelect();
    setSel({ src: 'pool', personId: p.id });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const save = useMutation({
    mutationFn: (publish: boolean) =>
      api<MatchSheet>(`/events/${sheet.eventId}/lineup`, {
        method: 'PUT',
        body: {
          publish,
          size: board.size,
          formation: board.formation,
          entries: boardToEntries(board).map((e) => ({
            ...e,
            jerseyNumber: sheet.jerseyMode ? (players.get(e.personId)?.number ?? null) : null,
          })),
        },
      }),
    onSuccess: (data, publish) => {
      queryClient.setQueryData(['match', sheet.eventId], data);
      void queryClient.invalidateQueries({ queryKey: ['event', sheet.eventId] });
      setError(null);
      setSaved(JSON.stringify(board));
      if (publish) router.back();
      else toast({ message: t('Entwurf gespeichert') });
    },
    onError: (e) =>
      setError(
        e instanceof RequestError ? e.message : 'Die Aufstellung konnte nicht gespeichert werden.',
      ),
  });

  // Verlassen mit ungespeicherten Änderungen: Speichern, Verwerfen oder Bleiben
  const leaveGuard = useRef({ dirty, saving: false });
  leaveGuard.current = { dirty, saving: save.isPending };
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!leaveGuard.current.dirty || leaveGuard.current.saving) return;
        e.preventDefault();
        setLeave({ action: e.data.action });
      }),
    [navigation],
  );
  const proceed = () => {
    const action = leave?.action;
    setLeave(null);
    setSaved(JSON.stringify(board));
    // nach dem Zustandswechsel verlassen
    setTimeout(() => navigation.dispatch(action as never), 0);
  };

  const visibility = useMutation({
    mutationFn: (on: boolean) =>
      api(`/teams/${sheet.team.id}/profile`, { method: 'PUT', body: { lineupVisible: on } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['match', sheet.eventId] }),
    onError: () => setError('Die Einstellung konnte nicht gespeichert werden.'),
  });
  const visible = visibility.isPending ? !!visibility.variables : !!sheet.lineupVisible;

  return (
    <DndProvider
      renderGhost={(d) => <Ghost drag={d} />}
      onDrop={(d: DragData, target) => {
        if (target) move(d.src, target, d.personId);
      }}
    >
      <Screen flushTop scrollRef={scrollRef}>
        <Stage
          sheet={sheet}
          board={board}
          formation={formation}
          players={players}
          available={available}
          unavailable={unavailable}
          sel={sel}
          sort={sort}
          onSort={setSort}
          onSize={(size) => {
            setSel(null);
            setBoard((b) => changeFormation(b, size));
          }}
          onFormation={(key) => {
            setSel(null);
            setBoard((b) => changeFormation(b, b.size, key));
          }}
          onSlot={(i) => tapSlot('s', i)}
          onBench={(i) => tapSlot('b', i)}
          onCard={tapCard}
          starters={startersCount}
          bench={benchCount}
          missing={missing}
          saving={save.isPending ? save.variables : undefined}
          onSave={(publish) => save.mutate(publish)}
          published={!!sheet.lineup?.published}
          error={error}
        />

        <Section title="Kader im Detail">
          <DetailList
            players={sorted(all.filter((p) => p.status !== 'no'))}
            unavailable={unavailable}
            board={board}
            sel={sel}
            sort={sort}
            onSort={setSort}
            onPick={pickFromList}
          />
        </Section>

        <Section title="Einstellung">
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <T style={{ flex: 1, fontWeight: '600' }}>
                Aufstellung für Spieler und Eltern sichtbar
              </T>
              <Toggle
                label="Aufstellung für Spieler und Eltern sichtbar"
                value={visible}
                onChange={(on) => visibility.mutate(on)}
              />
            </View>
            <T variant="caption">
              {visible
                ? 'Nach dem Veröffentlichen sichtbar für Trainerteam, Spieler und Eltern'
                : 'Nach dem Veröffentlichen sichtbar nur für das Trainerteam'}
            </T>
          </Card>
        </Section>
      </Screen>

      <Sheet visible={!!leave} onClose={() => setLeave(null)} title={t('Änderungen speichern?')}>
        <T>Die Aufstellung hat Änderungen, die noch nicht gespeichert sind.</T>
        <Button
          label="Entwurf speichern"
          icon="save-outline"
          loading={save.isPending}
          onPress={() =>
            save.mutate(false, {
              onSuccess: () => proceed(),
            })
          }
        />
        <Button label="Verwerfen" variant="danger" onPress={proceed} />
        <Button label="Bleiben" variant="tonal" onPress={() => setLeave(null)} />
      </Sheet>
    </DndProvider>
  );
}

// ── Bühne: Spielkarte bis Buttons (kompakte Abstände, damit alles bei 844 pt Höhe zugleich sichtbar bleibt) ──────

function StageLabel({ title, info, inline }: { title: string; info?: string; inline?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: inline ? 'flex-start' : 'space-between',
        gap: 8,
        flexShrink: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 3, height: 13, borderRadius: 2, backgroundColor: colors.primary }} />
        <T variant="section" style={{ fontSize: 13, lineHeight: 15, letterSpacing: 1.2 }}>
          {title}
        </T>
      </View>
      {info ? <T variant="caption">{info}</T> : null}
    </View>
  );
}

function SortSwitch({ sort, onSort }: { sort: 'att' | 'nr'; onSort: (s: 'att' | 'nr') => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {(
        [
          ['att', 'Beteiligung'],
          ['nr', 'Nummer'],
        ] as const
      ).map(([key, label]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityState={{ selected: sort === key }}
          onPress={() => onSort(key)}
          style={{
            minHeight: 32,
            justifyContent: 'center',
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: sort === key ? colors.primary : colors.anstoss.overlay,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: sort === key ? colors.onPrimary : colors.onSurfaceMuted,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FormationStrip({
  size,
  active,
  onPick,
}: {
  size: LineupSize;
  active: string;
  onPick: (key: string) => void;
}) {
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  const xs = useRef<Record<string, number>>({});
  const width = useRef(0);
  const [more, setMore] = useState(true);
  const box = useRef({ content: 0, x: 0 });
  useEffect(() => {
    const left = xs.current[active];
    if (left !== undefined)
      ref.current?.scrollTo({ x: Math.max(0, left - width.current / 2 + 40), animated: true });
  }, [active, size]);
  return (
    <View style={{ marginHorizontal: -22 }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        onContentSizeChange={(w) => {
          box.current.content = w;
          setMore(box.current.x + width.current < w - 12);
        }}
        onScroll={(e) => {
          box.current.x = e.nativeEvent.contentOffset.x;
          setMore(box.current.x + width.current < box.current.content - 12);
        }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingRight: 48 }}
      >
        {FORMATIONS[size].map((f) => {
          const on = f.key === active;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onLayout={(e) => {
                xs.current[f.key] = e.nativeEvent.layout.x;
              }}
              onPress={() => {
                if (!on) hapticSelect();
                onPick(f.key);
              }}
              style={{
                minHeight: 38,
                justifyContent: 'center',
                paddingHorizontal: 15,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.anstoss.fieldBorder,
                backgroundColor: on ? withAlpha(colors.primary, 0.12) : colors.anstoss.card,
              }}
            >
              <T
                variant="figure"
                style={{ fontSize: 17, lineHeight: 20 }}
                color={on ? colors.primaryText : colors.onSurfaceMuted}
              >
                {t(f.key)}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>
      <EdgeHint visible={more} />
    </View>
  );
}

function Stage(props: {
  sheet: MatchSheet;
  board: Board;
  formation: ReturnType<typeof findFormation> & object;
  players: Map<string, PlannerPlayer>;
  available: PlannerPlayer[];
  unavailable: PlannerPlayer[];
  sel: { src: string; personId: string } | null;
  sort: 'att' | 'nr';
  onSort: (s: 'att' | 'nr') => void;
  onSize: (s: LineupSize) => void;
  onFormation: (key: string) => void;
  onSlot: (i: number) => void;
  onBench: (i: number) => void;
  onCard: (p: PlannerPlayer) => void;
  starters: number;
  bench: number;
  missing: number;
  saving?: boolean;
  onSave: (publish: boolean) => void;
  published: boolean;
  error: string | null;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const { hover } = useDndState();
  const { sheet, board, sel } = props;
  const desktop = useIsDesktop();
  const on = colors.hero.onHero;
  const selectedPlayer = sel ? props.players.get(sel.personId) : null;
  const selSlot = sel?.src.startsWith('s:') ? Number(sel.src.slice(2)) : null;
  // Desktop-Ansicht (Paket DT): links Kopf, Spielform und Spielfeld, rechts Bank, Kader und Speichern
  if (desktop)
    return (
      <View style={{ flexDirection: 'row', gap: 22, paddingTop: 6, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <HeroCard compact>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Zurück')}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.28)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <T variant="overline" color={on}>
                  {`${t('Aufstellung')} · ${sheet.team.badge}`}
                </T>
                <T
                  variant="headline"
                  color={on}
                  numberOfLines={1}
                  verbatim
                  style={{ fontSize: 22, lineHeight: 24 }}
                >
                  {`${sheet.isHome ? 'vs.' : '@'} ${sheet.opponentName}`}
                </T>
                <T variant="caption" color={on} numberOfLines={1} verbatim>
                  {`${formatDay(sheet.startsAt)} · ${formatTime(sheet.startsAt)} ${t('Uhr')}`}
                </T>
              </View>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center' }}>
                  <T variant="figure" color={on} style={{ fontSize: 26, lineHeight: 28 }} verbatim>
                    {`${props.starters}/${board.slots.length}`}
                  </T>
                  <T variant="caption" color={on}>
                    Startelf
                  </T>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <T variant="figure" color={on} style={{ fontSize: 26, lineHeight: 28 }} verbatim>
                    {String(props.bench)}
                  </T>
                  <T variant="caption" color={on}>
                    Bank
                  </T>
                </View>
              </View>
            </View>
          </HeroCard>

          <Segment
            options={LINEUP_SIZES.map((s) => ({ value: String(s), label: `${s}er` }))}
            value={String(board.size)}
            onChange={(v) => props.onSize(Number(v) as LineupSize)}
          />
          <FormationStrip size={board.size} active={board.formation} onPick={props.onFormation} />

          <Pitch
            formation={props.formation}
            slots={board.slots}
            players={props.players}
            selectedSlot={selSlot}
            hoverId={hover}
            onSlot={props.onSlot}
            showDots
          />
          {selectedPlayer ? (
            <View
              accessibilityRole="alert"
              style={{
                borderRadius: 12,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: withAlpha(colors.status.action.solid, 0.14),
              }}
            >
              <T variant="caption" color={colors.status.action.onContainer}>
                {t(`${selectedPlayer.name} gewählt. Tippe auf eine Position oder einen Bankplatz.`)}
              </T>
            </View>
          ) : null}
        </View>
        <View style={{ width: 460, gap: 6 }}>
          <StageLabel title="Bank" info={t(`${props.bench} Spieler · ein Platz bleibt frei`)} />
          <Strip id="bench" over={hover?.startsWith('b:')}>
            {board.bench.map((id, i) => (
              <BenchTile
                key={`${i}-${id ?? 'frei'}`}
                index={i}
                player={id ? (props.players.get(id) ?? null) : null}
                selected={sel?.src === `b:${i}`}
                over={hover === `b:${i}`}
                onPress={props.onBench}
              />
            ))}
          </Strip>

          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <StageLabel inline title="Kader" info={t(`${props.available.length} verfügbar`)} />
            <SortSwitch sort={props.sort} onSort={props.onSort} />
          </View>
          <DropZone id="pool">
            {(over) => (
              <Strip id="rail" over={over}>
                {props.available.length === 0 ? (
                  <T variant="caption" style={{ paddingVertical: 14, paddingRight: 40 }}>
                    Alle verfügbaren Spieler sind eingeplant. Ziehe einen Spieler hierher, um ihn
                    aus der Aufstellung zu nehmen.
                  </T>
                ) : null}
                {props.available.map((p) => (
                  <SquadCard
                    key={p.id}
                    player={p}
                    selected={sel?.src === 'pool' && sel.personId === p.id}
                    onPress={() => props.onCard(p)}
                  />
                ))}
                {props.unavailable.map((p) => (
                  <SquadCard key={p.id} player={p} disabled />
                ))}
              </Strip>
            )}
          </DropZone>

          {props.error ? <Chip tone="urgent" icon="alert-circle" label={props.error} /> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label="Entwurf speichern"
              variant="outline"
              style={{ flex: 0.85 }}
              loading={props.saving === false}
              onPress={() => props.onSave(false)}
            />
            <Button
              label={props.published ? 'Änderungen veröffentlichen' : 'Veröffentlichen'}
              icon="send"
              style={{ flex: 1 }}
              loading={props.saving === true}
              disabled={props.starters === 0}
              onPress={() => {
                if (props.missing > 0)
                  toast({
                    message:
                      props.missing === 1
                        ? t('Noch 1 Position frei')
                        : t(`Noch ${props.missing} Positionen frei`),
                  });
                props.onSave(true);
              }}
            />
          </View>
        </View>
      </View>
    );
  return (
    <View style={{ gap: 6, paddingTop: 6 }}>
      <HeroCard compact>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Zurück')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.28)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <T variant="overline" color={on}>
              {`${t('Aufstellung')} · ${sheet.team.badge}`}
            </T>
            <T
              variant="headline"
              color={on}
              numberOfLines={1}
              verbatim
              style={{ fontSize: 22, lineHeight: 24 }}
            >
              {`${sheet.isHome ? 'vs.' : '@'} ${sheet.opponentName}`}
            </T>
            <T variant="caption" color={on} numberOfLines={1} verbatim>
              {`${formatDay(sheet.startsAt)} · ${formatTime(sheet.startsAt)} ${t('Uhr')}`}
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <T variant="figure" color={on} style={{ fontSize: 26, lineHeight: 28 }} verbatim>
                {`${props.starters}/${board.slots.length}`}
              </T>
              <T variant="caption" color={on}>
                Startelf
              </T>
            </View>
            <View style={{ alignItems: 'center' }}>
              <T variant="figure" color={on} style={{ fontSize: 26, lineHeight: 28 }} verbatim>
                {String(props.bench)}
              </T>
              <T variant="caption" color={on}>
                Bank
              </T>
            </View>
          </View>
        </View>
      </HeroCard>

      <Segment
        options={LINEUP_SIZES.map((s) => ({ value: String(s), label: `${s}er` }))}
        value={String(board.size)}
        onChange={(v) => props.onSize(Number(v) as LineupSize)}
      />
      <FormationStrip size={board.size} active={board.formation} onPick={props.onFormation} />

      <Pitch
        formation={props.formation}
        slots={board.slots}
        players={props.players}
        selectedSlot={selSlot}
        hoverId={hover}
        onSlot={props.onSlot}
        showDots
      />
      {selectedPlayer ? (
        <View
          accessibilityRole="alert"
          style={{
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: withAlpha(colors.status.action.solid, 0.14),
          }}
        >
          <T variant="caption" color={colors.status.action.onContainer}>
            {t(`${selectedPlayer.name} gewählt. Tippe auf eine Position oder einen Bankplatz.`)}
          </T>
        </View>
      ) : null}

      <StageLabel title="Bank" info={t(`${props.bench} Spieler · ein Platz bleibt frei`)} />
      <Strip id="bench" over={hover?.startsWith('b:')}>
        {board.bench.map((id, i) => (
          <BenchTile
            key={`${i}-${id ?? 'frei'}`}
            index={i}
            player={id ? (props.players.get(id) ?? null) : null}
            selected={sel?.src === `b:${i}`}
            over={hover === `b:${i}`}
            onPress={props.onBench}
          />
        ))}
      </Strip>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <StageLabel inline title="Kader" info={t(`${props.available.length} verfügbar`)} />
        <SortSwitch sort={props.sort} onSort={props.onSort} />
      </View>
      <DropZone id="pool">
        {(over) => (
          <Strip id="rail" over={over}>
            {props.available.length === 0 ? (
              <T variant="caption" style={{ paddingVertical: 14, paddingRight: 40 }}>
                Alle verfügbaren Spieler sind eingeplant. Ziehe einen Spieler hierher, um ihn aus
                der Aufstellung zu nehmen.
              </T>
            ) : null}
            {props.available.map((p) => (
              <SquadCard
                key={p.id}
                player={p}
                selected={sel?.src === 'pool' && sel.personId === p.id}
                onPress={() => props.onCard(p)}
              />
            ))}
            {props.unavailable.map((p) => (
              <SquadCard key={p.id} player={p} disabled />
            ))}
          </Strip>
        )}
      </DropZone>

      {props.error ? <Chip tone="urgent" icon="alert-circle" label={props.error} /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          label="Entwurf speichern"
          variant="outline"
          style={{ flex: 0.85 }}
          loading={props.saving === false}
          onPress={() => props.onSave(false)}
        />
        <Button
          label={props.published ? 'Änderungen veröffentlichen' : 'Veröffentlichen'}
          icon="send"
          style={{ flex: 1 }}
          loading={props.saving === true}
          disabled={props.starters === 0}
          onPress={() => {
            if (props.missing > 0)
              toast({
                message:
                  props.missing === 1
                    ? t('Noch 1 Position frei')
                    : t(`Noch ${props.missing} Positionen frei`),
              });
            props.onSave(true);
          }}
        />
      </View>
    </View>
  );
}

// ── Kader im Detail ───────────────────────────────────────────────────────────

function DetailList({
  players,
  unavailable,
  board,
  sel,
  sort,
  onSort,
  onPick,
}: {
  players: PlannerPlayer[];
  unavailable: PlannerPlayer[];
  board: Board;
  sel: { src: string; personId: string } | null;
  sort: 'att' | 'nr';
  onSort: (s: 'att' | 'nr') => void;
  onPick: (p: PlannerPlayer) => void;
}) {
  const { colors } = useTheme();
  const levelColor = useLevelColor();
  const where = new Map<string, string>();
  board.slots.forEach((id) => id && where.set(id, 'Startelf'));
  board.bench.forEach((id) => id && where.set(id, 'Bank'));
  const total = (p: PlannerPlayer) => p.attendance?.weeks.reduce((n, w) => n + w.total, 0) ?? 0;
  const got = (p: PlannerPlayer) => p.attendance?.weeks.reduce((n, w) => n + w.attended, 0) ?? 0;

  const row = (p: PlannerPlayer, na: boolean, first: boolean) => {
    const loc = where.get(p.id);
    const dim = na || !!loc;
    const selected = sel?.src === 'pool' && sel.personId === p.id;
    const chip = na
      ? { label: p.reason ?? 'Nicht verfügbar', tone: 'urgent' as const }
      : loc
        ? { label: loc, tone: 'primary' as const }
        : p.status === 'maybe'
          ? { label: 'Unsicher', tone: 'action' as const }
          : p.status === 'pending'
            ? { label: 'Offen', tone: 'neutral' as const }
            : { label: 'Zugesagt', tone: 'success' as const };
    return (
      <Pressable
        key={p.id}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${t('einplanen')}`}
        disabled={dim}
        onPress={() => onPick(p)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: colors.anstoss.divider,
          opacity: dim ? 0.5 : 1,
          backgroundColor: selected ? withAlpha(colors.status.action.solid, 0.12) : 'transparent',
        }}
      >
        <Disc size={36} number={p.number} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T variant="label" numberOfLines={1} verbatim style={{ fontWeight: '700' }}>
            {p.name}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {p.position ? <T variant="caption">{t(p.position)}</T> : null}
            <Chip tone={chip.tone} label={chip.label} />
          </View>
        </View>
        {p.attendance ? (
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            <AttendanceBars attendance={p.attendance} height={20} />
            <Text
              verbatim
              style={{
                fontSize: 10.5,
                fontWeight: '700',
                color: levelColor(attendanceLevel(p.attendance.percent)),
              }}
            >
              {total(p) ? `${got(p)}/${total(p)} · ${percentText(p)}` : '–'}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Card style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <T variant="caption" style={{ flex: 1 }}>
          Trainingsbeteiligung der letzten 4 Wochen · ab 75 % · 50–74 % · unter 50 %
        </T>
        <SortSwitch sort={sort} onSort={onSort} />
      </View>
      {players.map((p, i) => row(p, false, i === 0))}
      {unavailable.length ? (
        <>
          <T variant="overline" style={{ paddingTop: 10 }}>
            Nicht verfügbar
          </T>
          {unavailable.map((p, i) => row(p, true, i === 0))}
        </>
      ) : null}
    </Card>
  );
}
