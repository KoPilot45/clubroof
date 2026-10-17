import {
  at,
  fromIsoDate,
  type RefereeCollision,
  type RefereeDuty,
  type RefereeDutyResult,
  type RefereeLicenseStatus,
  type RefereeOverview,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { ChoiceCard, NumberStepper } from '@/components/wizard';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  DateTile,
  Empty,
  ErrorNotice,
  HeroCard,
  ListRow,
  Loading,
  MoreMenu,
  Screen,
  Section,
  T,
  TextField,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { formatDateTile, formatTime, todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { useConfirmDelete } from '@/lib/confirm';
import { t } from '@/lib/i18n';
import { Counted } from '@/lib/motion';

const LICENSE = {
  none: { label: 'Keine Lizenzangabe', tone: 'neutral' },
  ok: { label: 'Lizenz gültig', tone: 'success' },
  expiring: { label: 'Lizenz läuft bald ab', tone: 'action' },
  expired: { label: 'Lizenz abgelaufen', tone: 'urgent' },
} as const satisfies Record<RefereeLicenseStatus, { label: string; tone: string }>;

const deDate = (iso: string) => iso.split('-').reverse().join('.');
type Candidate = { personId: string; name: string };

/**
 * Schiedsrichter (Paket SR): Schiedsrichter werden vom Verband bei fremden Spielen eingesetzt. Jeder
 * Schiedsrichter trägt seine Einsätze selbst ein; die Verwaltung sieht das Schiedsrichter-Soll.
 */
export default function RefereesScreen() {
  const { api, me } = useSignedIn();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ['referees'],
    queryFn: () => api<RefereeOverview>('/referees'),
  });
  const refresh = (next?: RefereeOverview) => {
    if (next) queryClient.setQueryData(['referees'], next);
    void queryClient.invalidateQueries({ queryKey: ['referees'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );

  const o = data.data;
  return (
    <Screen edges={[]} refreshing={data.isRefetching} onRefresh={() => data.refetch()}>
      {data.isPending ? <Loading /> : null}
      {data.error ? <ErrorNotice error={data.error} onRetry={() => data.refetch()} /> : null}
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      {o?.isReferee && o.profile ? (
        <>
          <ProfileCard overview={o} onSaved={refresh} onError={fail} />
          <DutySection
            overview={o}
            timezone={me.club.timezone}
            onChanged={refresh}
            onError={fail}
          />
        </>
      ) : null}
      {o?.club ? <ClubSoll overview={o} onChanged={refresh} onError={fail} /> : null}
    </Screen>
  );
}

// ── Mein Profil ─────────────────────────────────────────────────────────────

function ProfileCard({
  overview,
  onSaved,
  onError,
}: {
  overview: RefereeOverview;
  onSaved: (next: RefereeOverview) => void;
  onError: (e: Error) => void;
}) {
  const { api, me } = useSignedIn();
  const p = overview.profile!;
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState(p.level ?? '');
  const [until, setUntil] = useState(p.licenseValidUntil ?? todayIso());
  const [hasLicense, setHasLicense] = useState(!!p.licenseValidUntil);
  const save = useMutation({
    mutationFn: () =>
      api<RefereeOverview>(`/referees/${me.person.id}`, {
        method: 'PATCH',
        body: { level: level.trim() || null, licenseValidUntil: hasLicense ? until : null },
      }),
    onSuccess: (next) => {
      setEditing(false);
      onSaved(next);
    },
    onError,
  });
  return (
    <Section title="Mein Profil">
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip tone="primary" label={p.level ?? 'Stufe offen'} />
          <Chip tone={LICENSE[p.licenseStatus].tone} label={LICENSE[p.licenseStatus].label} />
        </View>
        {p.licenseValidUntil ? (
          <T variant="caption">{t(`Lizenz gültig bis ${deDate(p.licenseValidUntil)}`)}</T>
        ) : null}
        {editing ? (
          <View style={{ gap: 12 }}>
            <TextField
              label="Stufe"
              value={level}
              onChangeText={setLevel}
              placeholder={t('z. B. Kreisliga')}
              maxLength={40}
            />
            <ChoiceChips
              label="Lizenz"
              options={[
                { value: 'yes', label: 'Mit Ablaufdatum' },
                { value: 'no', label: 'Keine Angabe' },
              ]}
              selected={[hasLicense ? 'yes' : 'no']}
              onToggle={(v) => setHasLicense(v === 'yes')}
            />
            {hasLicense ? (
              <DateStepper label="Lizenz gültig bis" value={until} onChange={setUntil} />
            ) : null}
            <Button
              label="Speichern"
              icon="checkmark"
              loading={save.isPending}
              onPress={() => save.mutate()}
            />
          </View>
        ) : (
          <Button
            label="Profil ändern"
            icon="create-outline"
            size="sm"
            variant="outline"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setEditing(true)}
          />
        )}
      </Card>
    </Section>
  );
}

// ── Meine Einsätze ──────────────────────────────────────────────────────────

function DutySection({
  overview,
  timezone,
  onChanged,
  onError,
}: {
  overview: RefereeOverview;
  timezone: string;
  onChanged: (next?: RefereeOverview) => void;
  onError: (e: Error) => void;
}) {
  const confirmDelete = useConfirmDelete();
  const { api } = useSignedIn();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('15:00');
  const [minutes, setMinutes] = useState('120');
  const [absence, setAbsence] = useState(false);
  const [collisions, setCollisions] = useState<RefereeCollision[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<RefereeDutyResult>('/referees/duties', {
        method: 'POST',
        body: {
          title: title.trim(),
          startsAt: at(fromIsoDate(date), time, timezone).toISOString(),
          durationMinutes: Number(minutes),
          location: location.trim() || null,
          createAbsence: absence,
        },
      }),
    onSuccess: (r) => {
      setCollisions(r.collisions);
      setAdding(false);
      setTitle('');
      setLocation('');
      setAbsence(false);
      onChanged(r.overview);
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<RefereeOverview>(`/referees/duties/${id}`, { method: 'DELETE' }),
    onSuccess: (next) => {
      setOpen(null);
      onChanged(next);
    },
    onError,
  });

  const now = new Date().toISOString();
  const upcoming = overview.mine.filter((d) => d.endsAt >= now);
  const past = overview.mine.filter((d) => d.endsAt < now);
  const row = (d: RefereeDuty, i: number) => (
    <View key={d.id}>
      <ListRow
        first={i === 0}
        leading={<DateTile {...formatDateTile(d.startsAt)} muted={d.endsAt < now} />}
        title={d.title}
        subtitle={[formatTime(d.startsAt), d.location].filter(Boolean).join(' · ')}
        trailing={d.absence ? <Chip tone="info" label="Abwesend" /> : null}
        onPress={() => setOpen(open === d.id ? null : d.id)}
      />
      {open === d.id ? (
        <View style={{ paddingBottom: 8 }}>
          <MoreMenu
            title={d.title}
            actions={[
              {
                label: 'Einsatz löschen',
                icon: 'trash-outline',
                danger: true,
                onPress: () =>
                  confirmDelete({ name: d.title, onConfirm: () => remove.mutate(d.id) }),
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
  return (
    <>
      <Section title="Meine Einsätze">
        <T variant="caption">
          Der Verband setzt dich bei fremden Spielen ein. Trage den Einsatz hier ein, damit er in
          deinem Kalender steht und Überschneidungen mit deinen Terminen auffallen.
        </T>
        {collisions && collisions.length > 0 ? (
          <Card style={{ gap: 6 }}>
            <Chip tone="action" icon="warning" label="Überschneidung mit eigenen Terminen" />
            {collisions.map((c) => (
              <T key={c.eventId} variant="caption">
                {`${formatTime(c.startsAt)} · ${c.title}`}
              </T>
            ))}
          </Card>
        ) : collisions ? (
          <Chip
            tone="success"
            icon="checkmark-circle"
            label="Einsatz gespeichert – keine Überschneidung"
          />
        ) : null}
        {adding ? (
          <Card style={{ gap: 12 }}>
            <TextField
              label="Spiel"
              value={title}
              onChangeText={setTitle}
              placeholder={t('z. B. SV Eichen – FC Nord, U13')}
              maxLength={120}
            />
            <TextField
              label="Ort"
              value={location}
              onChangeText={setLocation}
              placeholder={t('z. B. Sportplatz Eichen')}
              maxLength={120}
            />
            <DateStepper label="Datum" value={date} onChange={setDate} />
            <TimeStepper label="Beginn" value={time} onChange={setTime} />
            <ChoiceChips
              label="Dauer"
              options={['90', '120', '150', '180'].map((m) => ({ value: m, label: `${m} Min.` }))}
              selected={[minutes]}
              onToggle={setMinutes}
            />
            <ChoiceChips
              label="Abwesenheit"
              options={[
                { value: 'no', label: 'Nicht eintragen' },
                { value: 'yes', label: 'Für diesen Tag eintragen' },
              ]}
              selected={[absence ? 'yes' : 'no']}
              onToggle={(v) => setAbsence(v === 'yes')}
            />
            <Button
              label="Einsatz speichern"
              icon="checkmark"
              disabled={title.trim().length < 2}
              loading={create.isPending}
              onPress={() => create.mutate()}
            />
          </Card>
        ) : (
          <Button label="Einsatz eintragen" icon="add" onPress={() => setAdding(true)} />
        )}
        <Card>
          {upcoming.length === 0 ? (
            <Empty icon="flag-outline" text="Keine kommenden Einsätze eingetragen." />
          ) : (
            upcoming.map(row)
          )}
        </Card>
      </Section>
      {past.length > 0 ? (
        <Section title="Frühere Einsätze">
          <Card>{past.map(row)}</Card>
        </Section>
      ) : null}
    </>
  );
}

// ── Vereinsübersicht: Schiedsrichter-Soll ───────────────────────────────────

function ClubSoll({
  overview,
  onChanged,
  onError,
}: {
  overview: RefereeOverview;
  onChanged: (next?: RefereeOverview) => void;
  onError: (e: Error) => void;
}) {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const club = overview.club!;
  const [refs, setRefs] = useState(club.settings.requiredReferees);
  const [matches, setMatches] = useState(club.settings.requiredMatches);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [level, setLevel] = useState('');
  const [until, setUntil] = useState(todayIso());
  const [hasLicense, setHasLicense] = useState(true);
  const candidates = useQuery({
    queryKey: ['referees', 'candidates', q.trim()],
    queryFn: () => api<Candidate[]>(`/referees/candidates?q=${encodeURIComponent(q.trim())}`),
    enabled: q.trim().length >= 2 && !picked,
  });
  const saveSoll = useMutation({
    mutationFn: () =>
      api<RefereeOverview>('/referees/settings', {
        method: 'PUT',
        body: { requiredReferees: refs, requiredMatches: matches },
      }),
    onSuccess: onChanged,
    onError,
  });
  const add = useMutation({
    mutationFn: () =>
      api<RefereeOverview>('/referees', {
        method: 'POST',
        body: {
          personId: picked!.personId,
          level: level.trim() || null,
          licenseValidUntil: hasLicense ? until : null,
        },
      }),
    onSuccess: (next) => {
      setPicked(null);
      setQ('');
      setLevel('');
      onChanged(next);
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (v: { personId: string; active: boolean }) =>
      api<RefereeOverview>(`/referees/${v.personId}`, {
        method: 'PATCH',
        body: { active: v.active },
      }),
    onSuccess: onChanged,
    onError,
  });
  const soll = club.settings.requiredReferees;
  return (
    <>
      <HeroCard>
        <T variant="overline" color={colors.hero.onHero}>
          Schiedsrichter-Soll
        </T>
        <T variant="figure" color={colors.hero.onHero} style={{ fontSize: 44 }}>
          <Counted value={club.active} format={(n) => (soll > 0 ? `${n} / ${soll}` : String(n))} />
        </T>
        <T variant="label" color={colors.hero.onHero}>
          {soll === 0
            ? t('Noch kein Soll des Verbands eingetragen')
            : club.shortfall > 0
              ? t(`Es fehlen ${club.shortfall} aktive Schiedsrichter`)
              : t('Soll erfüllt')}
        </T>
      </HeroCard>

      <Section title="Schiedsrichter">
        <Card>
          {club.referees.length === 0 ? (
            <Empty icon="people-outline" text="Noch keine Schiedsrichter eingetragen." />
          ) : null}
          {club.referees.map((r, i) => (
            <ListRow
              key={r.personId}
              first={i === 0}
              strike={!r.active}
              title={r.name}
              subtitle={[
                r.level,
                r.licenseValidUntil
                  ? t(`Lizenz bis ${deDate(r.licenseValidUntil)}`)
                  : t('Keine Lizenzangabe'),
                club.settings.requiredMatches > 0
                  ? t(`Einsätze ${r.duties} von ${club.settings.requiredMatches}`)
                  : t(`Einsätze ${r.duties}`),
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Chip
                    tone={LICENSE[r.licenseStatus].tone}
                    label={LICENSE[r.licenseStatus].label}
                  />
                  {club.settings.requiredMatches > 0 && r.active ? (
                    <Chip
                      tone={r.dutiesOk ? 'success' : 'action'}
                      label={r.dutiesOk ? 'Pflichteinsätze erfüllt' : 'Pflichteinsätze offen'}
                    />
                  ) : null}
                </View>
              }
              onPress={() => toggle.mutate({ personId: r.personId, active: !r.active })}
            />
          ))}
        </Card>
        <T variant="caption">Antippen setzt einen Schiedsrichter aktiv oder inaktiv.</T>
      </Section>

      <Section title="Soll des Verbands">
        <Card style={{ gap: 16 }}>
          <T variant="caption">
            {club.seasonName
              ? t(`Pflichteinsätze gelten je Saison (${club.seasonName}).`)
              : t('Pflichteinsätze gelten je Saison.')}
          </T>
          <NumberStepper
            label="Aktive Schiedsrichter"
            value={refs}
            onChange={setRefs}
            min={0}
            max={99}
          />
          <NumberStepper
            label="Pflichteinsätze je Schiedsrichter"
            value={matches}
            onChange={setMatches}
            min={0}
            max={99}
          />
          <Button
            label="Soll speichern"
            icon="checkmark"
            loading={saveSoll.isPending}
            onPress={() => saveSoll.mutate()}
          />
        </Card>
      </Section>

      <Section title="Neuer Schiedsrichter">
        <Card style={{ gap: 12 }}>
          {picked ? (
            <>
              <ChoiceCard
                icon="person"
                title={picked.name}
                selected
                onPress={() => setPicked(null)}
              />
              <TextField
                label="Stufe (optional)"
                value={level}
                onChangeText={setLevel}
                placeholder={t('z. B. Kreisliga')}
                maxLength={40}
              />
              <ChoiceChips
                label="Lizenz"
                options={[
                  { value: 'yes', label: 'Mit Ablaufdatum' },
                  { value: 'no', label: 'Keine Angabe' },
                ]}
                selected={[hasLicense ? 'yes' : 'no']}
                onToggle={(v) => setHasLicense(v === 'yes')}
              />
              {hasLicense ? (
                <DateStepper label="Lizenz gültig bis" value={until} onChange={setUntil} />
              ) : null}
              <Button
                label="Hinzufügen"
                icon="add"
                loading={add.isPending}
                onPress={() => add.mutate()}
              />
            </>
          ) : (
            <>
              <TextField
                label="Mitglied suchen"
                value={q}
                onChangeText={setQ}
                placeholder={t('Name eingeben')}
              />
              {(candidates.data ?? []).map((c) => (
                <ChoiceCard
                  key={c.personId}
                  icon="person-add"
                  title={c.name}
                  selected={false}
                  onPress={() => setPicked(c)}
                />
              ))}
            </>
          )}
        </Card>
      </Section>
    </>
  );
}
