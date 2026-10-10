/**
 * Assistent „Mannschaft anlegen“ (Paket E): 11 Schritte in der Vereinsfarbe, ein Thema pro Seite. Angelegt wird erst
 * im letzten Schritt – bis dahin entstehen keine halben Daten; der Zwischenstand bleibt auf dem Gerät.
 */
import {
  TEAM_TEMPLATE_INFO,
  type MemberListItem,
  type ParticipationMode,
  type TeamAdminOverview,
  type TeamDetailAdmin,
  type TeamTemplate,
} from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ChoiceCard, NumberStepper, WizardShell, useWizardDraft } from '@/components/wizard';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  Loading,
  T,
  TextField,
  type IconName,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { PARTICIPATION_OPTIONS } from '@/lib/team-labels';
import { t } from '@/lib/i18n';

const TOTAL = 11;

type Person = { id: string; name: string };
export type Draft = {
  name: string;
  badge: string;
  unitId: string | null;
  seasonId: string | null;
  ageGroup: string;
  league: string;
  template: TeamTemplate;
  mode: ParticipationMode;
  coaches: Person[];
  players: Person[];
  trainingDeadline: number | null;
  matchDeadline: number | null;
  meetingPoint: string;
  trainingMeeting: number | null;
  matchMeeting: number | null;
  aliases: string;
};

const INITIAL: Draft = {
  name: '',
  badge: '',
  unitId: null,
  seasonId: null,
  ageGroup: '',
  league: '',
  template: 'classic',
  mode: 'active_response',
  coaches: [],
  players: [],
  trainingDeadline: null,
  matchDeadline: null,
  meetingPoint: '',
  trainingMeeting: null,
  matchMeeting: null,
  aliases: '',
};

const MODE_ICON: Record<ParticipationMode, IconName> = {
  auto_accept: 'checkmark-done',
  active_response: 'hand-left',
  absences_only: 'airplane',
};
const MODE_TEXT: Record<ParticipationMode, string> = {
  auto_accept: 'Alle gelten als zugesagt, bis jemand absagt – gut für feste Gruppen',
  active_response: 'Jede Person sagt zu oder ab – der Trainer sieht, wer noch fehlt',
  absences_only: 'Nur Abwesenheiten werden gemeldet – am wenigsten Aufwand',
};
const TEMPLATE_ICON: Record<TeamTemplate, IconName> = {
  performance: 'trophy',
  classic: 'football',
  youth: 'happy',
  leisure: 'cafe',
};

/** Was der Assistent vom Server braucht – echt (angemeldet) oder als Vorführung ohne Speichern. */
export type TeamWizardBackend = {
  demo?: boolean;
  overview: TeamAdminOverview | undefined;
  places: { label: string }[];
  search: (term: string) => Promise<MemberListItem[]>;
  /** legt die Mannschaft an; gibt die ID zurück (wirft nur, wenn die Mannschaft selbst fehlschlug) */
  create: (d: Draft, unitId: string | null, seasonId: string) => Promise<string>;
  /** Abschluss: zur Mannschaft bzw. in der Vorführung zurück zur Anmeldung */
  finish: (teamId: string) => void;
};

export default function NewTeamScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api<TeamAdminOverview>('/admin/teams'),
  });
  const places = useQuery({
    queryKey: ['meeting-places'],
    queryFn: () => api<{ label: string }[]>('/meeting-places'),
  });
  const backend: TeamWizardBackend = {
    overview: overview.data,
    places: places.data ?? [],
    search: (term) =>
      api<MemberListItem[]>(`/admin/members?status=active&q=${encodeURIComponent(term)}`),
    create: async (d, unitId, seasonId) => {
      const team = await api<TeamDetailAdmin>('/admin/teams', {
        method: 'POST',
        body: {
          name: d.name.trim(),
          badge: d.badge.trim(),
          ageGroup: d.ageGroup.trim() || null,
          league: d.league.trim() || null,
          orgUnitId: unitId,
          template: d.template,
          participationMode: d.mode,
          seasonId,
        },
      });
      try {
        await api(`/teams/${team.id}/profile`, {
          method: 'PUT',
          body: {
            defaultMeetingPoint: d.meetingPoint.trim() || null,
            trainingMeetingMinutes: d.trainingMeeting,
            matchMeetingMinutes: d.matchMeeting,
            trainingDeadlineHours: d.trainingDeadline,
            matchDeadlineHours: d.matchDeadline,
            importAliases: d.aliases
              .split(/[;\n]/)
              .map((a) => a.trim())
              .filter(Boolean)
              .slice(0, 10),
          },
        });
        for (const [people, fn] of [
          [d.coaches, 'coach'],
          [d.players, 'player'],
        ] as const) {
          for (const p of people) {
            await api(`/admin/members/${p.id}/memberships`, {
              method: 'POST',
              body: { teamId: team.id, function: fn },
            });
          }
        }
      } catch {
        // Mannschaft steht, Rest lässt sich in der Verwaltung ergänzen
      }
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      return team.id;
    },
    finish: (id) => router.replace(`/admin/team/${id}`),
  };
  return <TeamWizard backend={backend} />;
}

export function TeamWizard({ backend }: { backend: TeamWizardBackend }) {
  const {
    state: d,
    patch,
    loaded,
    clear,
  } = useWizardDraft(backend.demo ? 'team-wizard-demo' : 'team-wizard', INITIAL);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const o = backend.overview;
  if (!o || !loaded) return <Loading />;
  const units = o.orgUnits.filter((u) => u.canManage);
  const unitId =
    d.unitId && units.some((u) => u.id === d.unitId) ? d.unitId : (units[0]?.id ?? null);
  const seasonId = d.seasonId ?? o.current.id;

  const go = (n: number) => {
    setError(null);
    setStep(n);
  };
  const back = () => (step === 1 ? router.back() : go(step - 1));
  const next = () => go(step + 1);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await backend.create(d, unitId, seasonId);
      clear();
      setCreatedId(id);
    } catch (e) {
      setError(
        e instanceof RequestError ? e.message : 'Die Mannschaft konnte nicht angelegt werden.',
      );
    } finally {
      setBusy(false);
    }
  };

  const shell = { step, total: TOTAL, onBack: back, onNext: next, error } as const;
  const aliasCount = d.aliases.split(/[;\n]/).filter((a) => a.trim()).length;

  if (createdId)
    return (
      <WizardShell
        title="Mannschaft angelegt"
        explanation="Das Wichtigste steht. Sinnvolle nächste Schritte – alles lässt sich später in der Verwaltung ändern."
        nextLabel={backend.demo ? 'Verlassen' : 'Zur Mannschaft'}
        onNext={() => backend.finish(createdId)}
      >
        {backend.demo ? null : (
          <View style={{ gap: 10 }}>
            <ChoiceCard
              icon="calendar"
              title="Erstes Training anlegen"
              text="Mit Treffpunkt und Antwortfrist der Mannschaft"
              selected={false}
              onPress={() => router.replace(`/teams/${createdId}/event-new`)}
            />
            <ChoiceCard
              icon="cloud-download"
              title="Spielplan importieren"
              text="Aus dem DFBnet"
              selected={false}
              onPress={() => router.replace('/schedule-import')}
            />
            <ChoiceCard
              icon="mail"
              title="Eltern und Spieler einladen"
              text="Einladungslinks für den Zugang"
              selected={false}
              onPress={() => router.replace('/admin/invites')}
            />
          </View>
        )}
      </WizardShell>
    );

  if (step === 1)
    return (
      <WizardShell
        {...shell}
        title="Wie heißt die Mannschaft?"
        explanation="Der Name steht in Terminen und Listen, das Kürzel auf den Kacheln."
        nextDisabled={d.name.trim().length < 2 || !d.badge.trim()}
      >
        <View style={{ gap: 12 }}>
          <TextField
            label="Name"
            value={d.name}
            onChangeText={(name) => patch({ name })}
            placeholder={t('z. B. B-Jugend II')}
            maxLength={60}
          />
          <TextField
            label="Kürzel"
            value={d.badge}
            onChangeText={(badge) => patch({ badge })}
            placeholder={t('z. B. B2')}
            maxLength={6}
          />
        </View>
      </WizardShell>
    );

  if (step === 2)
    return (
      <WizardShell
        {...shell}
        title="Zu welchem Bereich gehört sie?"
        explanation="Der Bereich bestimmt, wer die Mannschaft verwalten darf."
        nextDisabled={!unitId}
        hint={o.next ? undefined : 'Die Saison lässt sich später in der Verwaltung wechseln.'}
      >
        <View style={{ gap: 10 }}>
          {units.map((u) => (
            <ChoiceCard
              key={u.id}
              icon="git-network"
              title={u.name}
              selected={unitId === u.id}
              onPress={() => patch({ unitId: u.id })}
            />
          ))}
          {o.next ? (
            <>
              <T variant="section">Saison</T>
              <ChoiceCard
                icon="calendar"
                title={`${o.current.name} (laufend)`}
                selected={seasonId === o.current.id}
                onPress={() => patch({ seasonId: o.current.id })}
              />
              <ChoiceCard
                icon="calendar-outline"
                title={`${o.next.name} (in Vorbereitung)`}
                selected={seasonId === o.next.id}
                onPress={() => patch({ seasonId: o.next!.id })}
              />
            </>
          ) : null}
        </View>
      </WizardShell>
    );

  if (step === 3)
    return (
      <WizardShell
        {...shell}
        title="Altersklasse und Liga"
        explanation="Beides ist freiwillig und erscheint in der Mannschaftsübersicht."
        onSkip={next}
      >
        <View style={{ gap: 12 }}>
          <TextField
            label="Altersklasse"
            value={d.ageGroup}
            onChangeText={(ageGroup) => patch({ ageGroup })}
            placeholder={t('z. B. U17')}
            maxLength={30}
          />
          <TextField
            label="Liga"
            value={d.league}
            onChangeText={(league) => patch({ league })}
            maxLength={80}
          />
        </View>
      </WizardShell>
    );

  if (step === 4)
    return (
      <WizardShell
        {...shell}
        title="Welche Vorlage passt?"
        explanation="Die Vorlage schaltet passende Funktionen für die Mannschaft ein."
        hint="Funktionen änderst du später unter Mannschaft › Module."
      >
        <View style={{ gap: 10 }}>
          {(Object.keys(TEAM_TEMPLATE_INFO) as TeamTemplate[]).map((k) => (
            <ChoiceCard
              key={k}
              icon={TEMPLATE_ICON[k]}
              title={TEAM_TEMPLATE_INFO[k].name}
              text={TEAM_TEMPLATE_INFO[k].description}
              selected={d.template === k}
              onPress={() => patch({ template: k })}
            />
          ))}
        </View>
      </WizardShell>
    );

  if (step === 5)
    return (
      <WizardShell
        {...shell}
        title="Wie nehmen Spieler an Terminen teil?"
        explanation="Das gilt für Training und Spiele und lässt sich je Termin anpassen."
      >
        <View style={{ gap: 10 }}>
          {PARTICIPATION_OPTIONS.map((p) => (
            <ChoiceCard
              key={p.value}
              icon={MODE_ICON[p.value]}
              title={p.label}
              text={MODE_TEXT[p.value]}
              selected={d.mode === p.value}
              onPress={() => patch({ mode: p.value })}
            />
          ))}
        </View>
      </WizardShell>
    );

  if (step === 6)
    return (
      <WizardShell
        {...shell}
        title="Wer trainiert die Mannschaft?"
        explanation="Trainer sehen Kader und Rückmeldungen und können Termine anlegen."
        onSkip={next}
      >
        <PersonPicker
          search={backend.search}
          demo={backend.demo}
          selected={d.coaches}
          exclude={d.players}
          onChange={(coaches) => patch({ coaches })}
        />
      </WizardShell>
    );

  if (step === 7)
    return (
      <WizardShell
        {...shell}
        title="Wer spielt in der Mannschaft?"
        explanation="Suche Mitglieder und füge sie dem Kader hinzu. Weitere Personen kannst du später ergänzen oder importieren."
        onSkip={next}
      >
        <PersonPicker
          search={backend.search}
          demo={backend.demo}
          selected={d.players}
          exclude={d.coaches}
          onChange={(players) => patch({ players })}
        />
      </WizardShell>
    );

  if (step === 8)
    return (
      <WizardShell
        {...shell}
        title="Bis wann sollen Spieler antworten?"
        explanation="Die Frist gilt getrennt für Training und Spiele, in Stunden vor Beginn. Ohne Frist ist die Antwort bis zum Termin möglich."
        hint="Fristen ändern sich später im Mannschaftsprofil."
        onSkip={next}
      >
        <Card style={{ gap: 16 }}>
          <DeadlineRow
            label="Training"
            value={d.trainingDeadline}
            onChange={(trainingDeadline) => patch({ trainingDeadline })}
          />
          <DeadlineRow
            label="Spiele"
            value={d.matchDeadline}
            onChange={(matchDeadline) => patch({ matchDeadline })}
          />
        </Card>
      </WizardShell>
    );

  if (step === 9)
    return (
      <WizardShell
        {...shell}
        title="Treffpunkt und Treffzeit"
        explanation="Der Standard-Treffpunkt und die Minuten vor Beginn werden bei neuen Terminen vorbelegt."
        onSkip={next}
      >
        <View style={{ gap: 14 }}>
          <TextField
            label="Treffpunkt"
            value={d.meetingPoint}
            onChangeText={(meetingPoint) => patch({ meetingPoint })}
            placeholder={t('z. B. Eingang Kabinengang')}
            maxLength={120}
          />
          {backend.places.length > 0 ? (
            <View style={{ gap: 8 }}>
              <T variant="caption">Vorschläge aus eurer Vereinseinrichtung</T>
              <ChoiceChips
                label="Treffpunkt wählen"
                options={backend.places.map((p) => ({ value: p.label, label: p.label }))}
                selected={d.meetingPoint ? [d.meetingPoint] : []}
                onToggle={(meetingPoint) => patch({ meetingPoint })}
              />
            </View>
          ) : null}
          <Card style={{ gap: 16 }}>
            <MinutesRow
              label="Training: Treffen vor Beginn"
              value={d.trainingMeeting}
              onChange={(trainingMeeting) => patch({ trainingMeeting })}
            />
            <MinutesRow
              label="Spiele: Treffen vor Beginn"
              value={d.matchMeeting}
              onChange={(matchMeeting) => patch({ matchMeeting })}
            />
          </Card>
        </View>
      </WizardShell>
    );

  if (step === 10)
    return (
      <WizardShell
        {...shell}
        title="Name im DFBnet"
        explanation="Heißt die Mannschaft im Spielplan anders, trage die Schreibweisen ein – getrennt mit Semikolon. So ordnet der Spielplan-Import Spiele richtig zu."
        onSkip={next}
      >
        <TextField
          label="Weitere Schreibweisen"
          value={d.aliases}
          onChangeText={(aliases) => patch({ aliases })}
          placeholder={t('z. B. SV Grün-Weiß B2; SV GW II')}
        />
      </WizardShell>
    );

  return (
    <WizardShell
      {...shell}
      step={11}
      title="Alles bereit?"
      explanation="Prüfe die Angaben. Erst jetzt wird die Mannschaft angelegt."
      nextLabel="Mannschaft anlegen"
      onNext={() => void create()}
      busy={busy}
    >
      <Card style={{ gap: 8 }}>
        <T variant="title">{d.name.trim()}</T>
        <T variant="caption" verbatim>
          {[
            d.badge.trim(),
            d.ageGroup.trim(),
            d.league.trim(),
            units.find((u) => u.id === unitId)?.name,
          ]
            .filter(Boolean)
            .join(' · ')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip tone="primary" label={TEAM_TEMPLATE_INFO[d.template].name} />
          <Chip
            tone="neutral"
            label={PARTICIPATION_OPTIONS.find((p) => p.value === d.mode)?.label ?? ''}
          />
          <Chip tone="neutral" label={t('Trainer: {0}').replace('{0}', String(d.coaches.length))} />
          <Chip tone="neutral" label={t('Kader: {0}').replace('{0}', String(d.players.length))} />
          {aliasCount > 0 ? (
            <Chip
              tone="neutral"
              label={t('DFBnet-Namen: {0}').replace('{0}', String(aliasCount))}
            />
          ) : null}
        </View>
      </Card>
    </WizardShell>
  );
}

function DeadlineRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {value === null ? (
        <View style={{ gap: 8 }}>
          <T variant="label" style={{ fontWeight: '700' }}>
            {label}
          </T>
          <Button
            label="Frist festlegen"
            icon="time-outline"
            variant="outline"
            onPress={() => onChange(label === 'Training' ? 3 : 24)}
          />
        </View>
      ) : (
        <>
          <NumberStepper label={label} value={value} min={1} max={336} onChange={onChange} />
          <T variant="caption">{t('Stunden vor Beginn')}</T>
          <Button label="Keine Frist" variant="tonal" onPress={() => onChange(null)} />
        </>
      )}
    </View>
  );
}

function MinutesRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return value === null ? (
    <View style={{ gap: 8 }}>
      <T variant="label" style={{ fontWeight: '700' }}>
        {label}
      </T>
      <Button label="Treffzeit festlegen" variant="outline" onPress={() => onChange(30)} />
    </View>
  ) : (
    <View style={{ gap: 8 }}>
      <NumberStepper label={label} value={value} min={0} max={300} onChange={onChange} />
      <Button label="Kein automatisches Treffen" variant="tonal" onPress={() => onChange(null)} />
    </View>
  );
}

/** Mitglieder suchen und auswählen (noch ohne Mannschaft – gespeichert wird erst am Ende). */
function PersonPicker({
  selected,
  exclude,
  onChange,
  search,
  demo,
}: {
  search: (term: string) => Promise<MemberListItem[]>;
  demo?: boolean;
  selected: Person[];
  exclude: Person[];
  onChange: (p: Person[]) => void;
}) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const results = useQuery({
    queryKey: ['admin', 'members', 'wizard', demo ? 'demo' : 'live', term],
    queryFn: () => search(term),
    enabled: term.length >= 2,
  });
  const taken = new Set([...selected, ...exclude].map((p) => p.id));
  const hits = (results.data ?? []).filter((m) => !taken.has(m.id)).slice(0, 8);
  return (
    <View style={{ gap: 12 }}>
      <TextField
        label="Mitglied suchen"
        value={q}
        onChangeText={setQ}
        placeholder={t('Name oder Mitgliedsnummer')}
      />
      {hits.map((m) => (
        <ChoiceCard
          key={m.id}
          icon="person-add"
          title={`${m.firstName} ${m.lastName}`}
          text={m.memberNumber ?? undefined}
          selected={false}
          onPress={() => {
            onChange([...selected, { id: m.id, name: `${m.firstName} ${m.lastName}` }]);
            setQ('');
          }}
        />
      ))}
      {selected.length > 0 ? (
        <T variant="section">{`${t('Ausgewählt')} (${selected.length})`}</T>
      ) : null}
      {selected.map((p) => (
        <ChoiceCard
          key={p.id}
          icon="person"
          title={p.name}
          selected
          multi
          onPress={() => onChange(selected.filter((s) => s.id !== p.id))}
        />
      ))}
    </View>
  );
}
