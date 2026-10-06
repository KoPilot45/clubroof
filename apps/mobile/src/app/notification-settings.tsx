import type { NotificationSettings, UpdateNotificationSettingsInput } from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Switch, View } from 'react-native';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  ErrorNotice,
  ListRow,
  Loading,
  Screen,
  Section,
  T,
  TeamBadge,
  TimeStepper,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { enablePush, pushState, type PushState } from '@/lib/push';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { t } from '@/lib/i18n';

type Mode = NotificationSettings['topics'][number]['mode'];
const MODES: {
  value: Mode;
  label: string;
  icon: 'phone-portrait-outline' | 'albums-outline' | 'close';
}[] = [
  { value: 'push', label: 'Push', icon: 'phone-portrait-outline' },
  { value: 'app', label: 'Nur App', icon: 'albums-outline' },
  { value: 'off', label: 'Aus', icon: 'close' },
];
const REMINDERS = [
  { value: '0', label: 'Aus' },
  { value: '2', label: '2 Std.' },
  { value: '6', label: '6 Std.' },
  { value: '24', label: '1 Tag' },
  { value: '48', label: '2 Tage' },
] as const;

export default function NotificationSettingsScreen() {
  const { api } = useSignedIn();
  const { colors, radii } = useTheme();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [quiet, setQuiet] = useState<NotificationSettings['quietHours'] | null>(null);
  const settings = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => api<NotificationSettings>('/me/notification-settings'),
  });
  const save = useMutation({
    mutationFn: (body: UpdateNotificationSettingsInput) =>
      api<NotificationSettings>('/me/notification-settings', { method: 'PUT', body }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['notification-settings'], data);
    },
    onError: (e) =>
      setError(e instanceof RequestError ? e.message : 'Die Einstellung wurde nicht gespeichert.'),
  });

  useEffect(() => {
    void pushState().then(setPush);
  }, []);
  useEffect(() => {
    if (settings.data) setQuiet(settings.data.quietHours);
  }, [settings.data]);

  if (settings.isPending) return <Loading />;
  if (settings.error)
    return <ErrorNotice error={settings.error} onRetry={() => settings.refetch()} />;
  const s = settings.data;
  const quietDirty =
    quiet && (quiet.start !== s.quietHours.start || quiet.end !== s.quietHours.end);
  // Schalter in Vereinsfarbe (Web braucht zusätzlich activeThumbColor)
  const switchColors = {
    trackColor: { true: colors.primary, false: colors.border },
    thumbColor: colors.surface,
    activeThumbColor: colors.surface,
  } as const;

  return (
    <Screen edges={[]}>
      <Card style={{ gap: 8 }}>
        <Chip tone="urgent" icon="warning" label="Dringendes kommt immer an" />
        <T variant="caption">
          Kurzfristige Absagen und dringende Vereinsnews erreichen dich unabhängig von diesen
          Einstellungen – auch in der Ruhezeit.
        </T>
      </Card>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}

      <Section title="Push auf diesem Gerät">
        <Card style={{ gap: 10 }}>
          {push === 'on' ? (
            <Chip tone="success" icon="checkmark-circle" label="Push ist aktiv" />
          ) : push === 'denied' ? (
            <T variant="caption">
              Push ist in den Systemeinstellungen des Handys ausgeschaltet. Dort kannst du es für
              Clubroof wieder erlauben.
            </T>
          ) : push === 'off' ? (
            <Button
              label="Push aktivieren"
              icon="notifications"
              onPress={() => void enablePush(api, true).then(setPush)}
            />
          ) : (
            <T variant="caption">
              Push-Nachrichten gibt es in der App auf dem Handy. Hier im Browser erscheinen alle
              Meldungen im Benachrichtigungs-Center.
            </T>
          )}
          <T variant="caption">
            {s.devices === 0
              ? 'Noch kein Gerät für Push angemeldet.'
              : s.devices === 1
                ? '1 Gerät für Push angemeldet.'
                : `${s.devices} Geräte für Push angemeldet.`}
          </T>
        </Card>
      </Section>

      <Section title="Themen">
        <Card>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', paddingBottom: 8 }}>
            {MODES.map((m) => (
              <View key={m.value} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Ionicons name={m.icon} size={14} color={colors.onSurfaceMuted} />
                <T variant="caption">{m.label}</T>
              </View>
            ))}
          </View>
          {s.topics.map((topic) => (
            <View
              key={topic.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <T variant="label" style={{ fontWeight: '700' }}>
                  {topic.label}
                </T>
                <T variant="caption" numberOfLines={2}>
                  {topic.description}
                </T>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                {MODES.map((m) => {
                  const active = topic.mode === m.value;
                  return (
                    <Pressable
                      key={m.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t(`${topic.label}: ${m.label}`)}
                      onPress={() => save.mutate({ topics: { [topic.key]: m.value } })}
                      style={{
                        width: 38,
                        height: 34,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? colors.primary : colors.surface,
                      }}
                    >
                      <Ionicons
                        name={m.icon}
                        size={16}
                        color={active ? colors.onPrimary : colors.onSurfaceMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </Card>
      </Section>

      {s.teams.length > 1 ? (
        <Section title="Mannschaften">
          <Card>
            <T variant="caption">
              Stummgeschaltete Mannschaften melden sich nur noch bei Dringendem.
            </T>
            {s.teams.map((team, i) => (
              <ListRow
                key={team.id}
                first={i === 0}
                leading={<TeamBadge badge={team.badge} />}
                title={team.name}
                subtitle={team.muted ? 'Stumm' : 'Alle Meldungen'}
                trailing={
                  <Switch
                    accessibilityLabel={t(`${team.name} benachrichtigen`)}
                    value={!team.muted}
                    {...switchColors}
                    onValueChange={(on) =>
                      save.mutate({
                        mutedTeamIds: on
                          ? s.teams.filter((t) => t.muted && t.id !== team.id).map((t) => t.id)
                          : [...s.teams.filter((t) => t.muted).map((t) => t.id), team.id],
                      })
                    }
                  />
                }
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Erinnerung an Zu- und Absagen">
        <Card style={{ gap: 8 }}>
          <T variant="caption">
            Wenn deine Rückmeldung (oder die deines Kindes) noch fehlt – so lange vor der Frist:
          </T>
          <ChoiceChips
            options={REMINDERS.map((r) => ({ ...r }))}
            selected={[String(s.reminderHours) as (typeof REMINDERS)[number]['value']]}
            onToggle={(v) => save.mutate({ reminderHours: Number(v) })}
          />
        </Card>
      </Section>

      <Section title="Ruhezeit">
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T variant="label" style={{ fontWeight: '700' }}>
                Kein Push in der Ruhezeit
              </T>
              <T variant="caption">Meldungen kommen danach gesammelt an.</T>
            </View>
            <Switch
              accessibilityLabel={t('Ruhezeit')}
              value={s.quietHours.enabled}
              {...switchColors}
              onValueChange={(enabled) => save.mutate({ quietHours: { ...s.quietHours, enabled } })}
            />
          </View>
          {s.quietHours.enabled && quiet ? (
            <>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TimeStepper
                    label="Von"
                    value={quiet.start}
                    step={30}
                    onChange={(start) => setQuiet({ ...quiet, start })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimeStepper
                    label="Bis"
                    value={quiet.end}
                    step={30}
                    onChange={(end) => setQuiet({ ...quiet, end })}
                  />
                </View>
              </View>
              {quietDirty ? (
                <Button
                  label="Ruhezeit speichern"
                  icon="checkmark"
                  loading={save.isPending}
                  onPress={() => save.mutate({ quietHours: { ...quiet, enabled: true } })}
                />
              ) : null}
            </>
          ) : null}
        </Card>
      </Section>
    </Screen>
  );
}
