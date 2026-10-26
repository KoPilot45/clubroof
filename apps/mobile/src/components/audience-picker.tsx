/**
 * „Für wen?“ bei Veranstaltungen (Paket ZE): ein Knopf öffnet ein Auswahlfenster (Reiter Mannschaften / Personen,
 * Suche, Häkchen); die Auswahl steht als kompakte Chips mit „×“, ab vier gekürzt zu „+ 3 weitere“. Die
 * Personensuche sehen nur Berechtigte (Datensparsamkeit).
 */
import type { ClubTeamGroup, MemberListItem } from '@clubroof/core';
import { Ionicons } from '@/components/icon';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, ChoiceChips, Sheet, T, TextField } from '@/components/ui';
import { t } from '@/lib/i18n';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export type Audience = { teamIds: string[]; personIds: string[] };

function Check({
  on,
  label,
  sub,
  onPress,
}: {
  on: boolean;
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: 48,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <Ionicons
        name={on ? 'checkbox' : 'square-outline'}
        size={24}
        color={on ? colors.primaryText : colors.onSurfaceMuted}
      />
      <View style={{ flex: 1 }}>
        <T variant="label" verbatim>
          {label}
        </T>
        {sub ? (
          <T variant="caption" verbatim>
            {sub}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

export function AudiencePicker({
  value,
  onChange,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
}) {
  const { api, me } = useSignedIn();
  const { colors, radii } = useTheme();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'teams' | 'persons'>('teams');
  const [search, setSearch] = useState('');
  // Namen der gewählten Personen merken, damit die Chips auch nach dem Schließen etwas zeigen
  const [personNames, setPersonNames] = useState<Record<string, string>>({});
  const canPersons = me.admin.readMembers;

  const teams = useQuery({
    queryKey: ['club-teams'],
    queryFn: () => api<ClubTeamGroup[]>('/club/teams'),
    enabled: open,
  });
  const people = useQuery({
    queryKey: ['audience-persons', search],
    queryFn: () =>
      api<MemberListItem[]>(`/admin/members?status=active&q=${encodeURIComponent(search.trim())}`),
    enabled: open && tab === 'persons' && canPersons && search.trim().length >= 2,
  });
  const allTeams = (teams.data ?? []).flatMap((g) => g.teams);
  const teamLabel = (id: string) => {
    const x = allTeams.find((y) => y.id === id) ?? me.teams.find((y) => y.id === id);
    return x ? ('badge' in x ? x.badge : id) : id.slice(0, 4);
  };

  const toggleTeam = (id: string) =>
    onChange({
      ...value,
      teamIds: value.teamIds.includes(id)
        ? value.teamIds.filter((x) => x !== id)
        : [...value.teamIds, id],
    });
  const togglePerson = (p: MemberListItem) => {
    setPersonNames((n) => ({ ...n, [p.id]: `${p.firstName} ${p.lastName}` }));
    onChange({
      ...value,
      personIds: value.personIds.includes(p.id)
        ? value.personIds.filter((x) => x !== p.id)
        : [...value.personIds, p.id],
    });
  };

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...value.teamIds.map((id) => ({
      key: `t${id}`,
      label: teamLabel(id),
      remove: () => toggleTeam(id),
    })),
    ...value.personIds.map((id) => ({
      key: `p${id}`,
      label: personNames[id] ?? t('Person'),
      remove: () => onChange({ ...value, personIds: value.personIds.filter((x) => x !== id) }),
    })),
  ];
  const shown = chips.length > 4 ? chips.slice(0, 3) : chips;
  const more = chips.length - shown.length;

  return (
    <View style={{ gap: 8 }}>
      <Button
        label="Mannschaften oder Personen auswählen"
        icon="people-outline"
        variant="outline"
        onPress={() => setOpen(true)}
      />
      {chips.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {shown.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`${c.label} ${t('entfernen')}`}
              onPress={c.remove}
              style={{
                minHeight: 36,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 12,
                paddingRight: 8,
                borderRadius: radii.pill,
                backgroundColor: colors.primaryContainer,
              }}
            >
              <T
                variant="caption"
                color={colors.onPrimaryContainer}
                verbatim
                style={{ fontWeight: '700' }}
              >
                {c.label}
              </T>
              <Ionicons name="close" size={16} color={colors.onPrimaryContainer} />
            </Pressable>
          ))}
          {more > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(true)}
              style={{
                minHeight: 36,
                justifyContent: 'center',
                paddingHorizontal: 12,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceVariant,
              }}
            >
              <T variant="caption" style={{ fontWeight: '700' }}>
                {t(`+ ${more} weitere`)}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={t('Für wen?')}>
        {canPersons ? (
          <ChoiceChips
            options={[
              { value: 'teams' as const, label: 'Mannschaften' },
              { value: 'persons' as const, label: 'Personen' },
            ]}
            selected={[tab]}
            onToggle={setTab}
          />
        ) : null}
        {tab === 'persons' && canPersons ? (
          <>
            <TextField
              label="Person suchen"
              value={search}
              onChangeText={setSearch}
              placeholder={t('Name oder Mitgliedsnummer')}
            />
            {search.trim().length < 2 ? (
              <T variant="caption">Mindestens zwei Buchstaben eingeben.</T>
            ) : null}
            {(people.data ?? []).slice(0, 30).map((p) => (
              <Check
                key={p.id}
                on={value.personIds.includes(p.id)}
                label={`${p.firstName} ${p.lastName}`}
                sub={p.teams.map((x) => x.badge).join(' · ') || undefined}
                onPress={() => togglePerson(p)}
              />
            ))}
          </>
        ) : (
          (teams.data ?? []).map((g) => (
            <View key={g.orgUnit.id}>
              <T variant="overline" verbatim>
                {g.orgUnit.name}
              </T>
              {g.teams.map((x) => (
                <Check
                  key={x.id}
                  on={value.teamIds.includes(x.id)}
                  label={`${x.badge} · ${x.name}`}
                  onPress={() => toggleTeam(x.id)}
                />
              ))}
            </View>
          ))
        )}
        <Button label="Fertig" icon="checkmark" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}
