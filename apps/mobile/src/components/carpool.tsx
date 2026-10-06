import type { Carpool, EventDetail } from '@clubroof/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { RequestError } from '@/lib/api';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { Button, Card, ChoiceChips, Chip, Section, T, TextField } from './ui';
import { t } from '@/lib/i18n';

type Call = { path: string; method: 'PUT' | 'DELETE'; body?: unknown };

/** Fahrgemeinschaften zu Auswärtsspielen und Turnieren. */
export function CarpoolSection({ event }: { event: EventDetail }) {
  const { api, me } = useSignedIn();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const c = event.carpool!;
  const [offering, setOffering] = useState(false);
  const [seats, setSeats] = useState('3');
  const [note, setNote] = useState('');
  const run = useMutation({
    mutationFn: (v: Call) => api<Carpool>(v.path, { method: v.method, body: v.body }),
    onSuccess: (carpool) => {
      queryClient.setQueryData<EventDetail>(['event', event.id], (old) =>
        old ? { ...old, carpool } : old,
      );
      setOffering(false);
    },
  });
  const free = c.offers.reduce((sum, o) => sum + o.free, 0);
  const myOffer = c.offers.find((o) => o.mine);
  const riding = (personId: string) =>
    c.offers.find((o) => o.passengers.some((p) => p.personId === personId));
  const looking = (personId: string) => c.requests.some((r) => r.personId === personId);
  const nameOf = (personId: string, firstName: string) =>
    personId === me.person.id ? 'Ich' : firstName;

  return (
    <Section title="Fahrgemeinschaften">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Chip
            tone={free > 0 ? 'success' : 'archived'}
            icon="car-outline"
            label={
              c.offers.length === 0
                ? 'Noch keine Fahrten'
                : `${c.offers.length} ${c.offers.length === 1 ? 'Auto' : 'Autos'} · ${free} frei`
            }
          />
          {c.requests.length ? (
            <Chip tone="action" label={`${c.requests.length} suchen eine Mitfahrt`} />
          ) : null}
        </View>

        {c.offers.map((o) => (
          <View
            key={o.id}
            style={{ gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T variant="label" style={{ fontWeight: '700', flex: 1 }}>
                {o.mine ? 'Ich fahre' : o.driverName}
              </T>
              <Chip
                tone={o.free ? 'success' : 'archived'}
                label={o.free ? `${o.free} von ${o.seats} frei` : 'Voll'}
              />
            </View>
            {o.note ? <T variant="caption">{o.note}</T> : null}
            {o.passengers.length ? (
              <T variant="caption">Dabei: {o.passengers.map((p) => p.name).join(', ')}</T>
            ) : null}
            {c.open ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {c.riders.map((r) => {
                  const car = riding(r.personId);
                  if (car?.id === o.id)
                    return (
                      <Button
                        key={r.personId}
                        label={`${nameOf(r.personId, r.firstName)}: austragen`}
                        size="sm"
                        variant="outline"
                        onPress={() =>
                          run.mutate({
                            path: `/carpool/offers/${o.id}/passengers/${r.personId}`,
                            method: 'DELETE',
                          })
                        }
                      />
                    );
                  if (o.mine || !o.free) return null;
                  return (
                    <Button
                      key={r.personId}
                      label={
                        nameOf(r.personId, r.firstName) === 'Ich'
                          ? 'Mitfahren'
                          : `${r.firstName} fährt mit`
                      }
                      icon="car-outline"
                      size="sm"
                      variant="tonal"
                      onPress={() =>
                        run.mutate({
                          path: `/carpool/offers/${o.id}/passengers/${r.personId}`,
                          method: 'PUT',
                        })
                      }
                    />
                  );
                })}
                {o.canWithdraw ? (
                  <Button
                    label={o.mine ? 'Angebot zurückziehen' : 'Entfernen'}
                    size="sm"
                    variant="danger"
                    onPress={() =>
                      run.mutate({ path: `/carpool/offers/${o.id}`, method: 'DELETE' })
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ))}

        {c.requests.length ? (
          <View
            style={{ gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <T variant="overline">Mitfahrt gesucht</T>
            {c.requests.map((r) => (
              <T key={r.personId} variant="caption">
                {r.name}
                {r.note ? ` – ${r.note}` : ''}
              </T>
            ))}
          </View>
        ) : null}

        {c.open && offering ? (
          <View
            style={{ gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <ChoiceChips
              label="Freie Plätze"
              options={['1', '2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v }))}
              selected={[seats]}
              onToggle={setSeats}
            />
            <TextField
              label="Hinweis (optional)"
              placeholder={t('z. B. Abfahrt 13:15 am Vereinsheim')}
              value={note}
              onChangeText={setNote}
              maxLength={120}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                style={{ flex: 1 }}
                label="Abbrechen"
                variant="outline"
                onPress={() => setOffering(false)}
              />
              <Button
                style={{ flex: 1 }}
                label="Fahrt anbieten"
                loading={run.isPending}
                onPress={() =>
                  run.mutate({
                    path: `/events/${event.id}/carpool/offer`,
                    method: 'PUT',
                    body: { seats: Number(seats), note: note.trim() || null },
                  })
                }
              />
            </View>
          </View>
        ) : c.open ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {!myOffer ? (
              <Button
                label="Ich fahre"
                icon="car"
                size="sm"
                variant="tonal"
                onPress={() => setOffering(true)}
              />
            ) : null}
            {c.riders
              .filter((r) => !riding(r.personId))
              .map((r) => {
                const on = looking(r.personId);
                const who = nameOf(r.personId, r.firstName);
                return (
                  <Button
                    key={r.personId}
                    label={
                      on
                        ? `${who === 'Ich' ? 'Suche' : `Suche für ${who}`} beenden`
                        : who === 'Ich'
                          ? 'Mitfahrt suchen'
                          : `Mitfahrt für ${who} suchen`
                    }
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      run.mutate({
                        path: `/events/${event.id}/carpool/requests/${r.personId}`,
                        method: 'PUT',
                        body: { looking: !on },
                      })
                    }
                  />
                );
              })}
          </View>
        ) : null}
        {run.error ? (
          <Chip
            tone="urgent"
            icon="alert-circle"
            label={
              run.error instanceof RequestError ? run.error.message : 'Das hat nicht geklappt.'
            }
          />
        ) : null}
      </Card>
    </Section>
  );
}
