import {
  SPONSOR_LABELS,
  SPONSOR_SCOPES,
  SPONSOR_SCOPE_LABEL,
  SPONSOR_TIERS,
  SPONSOR_TIER_LABEL,
  type AdminSponsor,
  type AdminSponsors,
  type SponsorInput,
  type SponsorScope,
  type SponsorTier,
  type UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ReorderList } from '@/components/reorder';
import {
  Button,
  Card,
  ChoiceChips,
  Chip,
  DateStepper,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  Section,
  T,
  TextField,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { pickFile } from '@/lib/upload';
import { t } from '@/lib/i18n';

const STATUS = {
  active: { label: 'Läuft', tone: 'success' },
  planned: { label: 'Geplant', tone: 'info' },
  expired: { label: 'Abgelaufen', tone: 'archived' },
} as const;

type Form = {
  id: string | null;
  name: string;
  tier: SponsorTier;
  linkUrl: string;
  scope: SponsorScope;
  hasStart: boolean;
  startsOn: string;
  hasEnd: boolean;
  endsOn: string;
  logo: { id: string; name: string } | null;
  banner: { id: string; name: string } | null;
  removeLogo: boolean;
  removeBanner: boolean;
};
const empty = (): Form => ({
  id: null,
  name: '',
  tier: 'partner',
  linkUrl: '',
  scope: 'club',
  hasStart: false,
  startsOn: todayIso(),
  hasEnd: false,
  endsOn: todayIso(),
  logo: null,
  banner: null,
  removeLogo: false,
  removeBanner: false,
});

/** Sponsoren pflegen (Vereinsadministration): Reihenfolge ziehen, Bilder, Link, Stufe, Laufzeit, Zuordnung. */
export default function AdminSponsorsScreen() {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['admin', 'sponsors'],
    queryFn: () => api<AdminSponsors>('/admin/sponsors'),
  });
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null);
  const done = (next: AdminSponsors) => {
    setError(null);
    queryClient.setQueryData(['admin', 'sponsors'], next);
    void queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    void queryClient.invalidateQueries({ queryKey: ['sponsor-banner'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );

  const save = useMutation({
    mutationFn: (f: Form) => {
      const body: SponsorInput & { removeLogo?: boolean; removeBanner?: boolean } = {
        name: f.name.trim(),
        tier: f.tier,
        linkUrl: f.linkUrl.trim() || null,
        scope: f.scope,
        startsOn: f.hasStart ? f.startsOn : null,
        endsOn: f.hasEnd ? f.endsOn : null,
        logoImageId: f.logo?.id ?? null,
        bannerImageId: f.banner?.id ?? null,
        removeLogo: f.removeLogo,
        removeBanner: f.removeBanner,
      };
      return f.id
        ? api<AdminSponsors>(`/admin/sponsors/${f.id}`, { method: 'PATCH', body })
        : api<AdminSponsors>('/admin/sponsors', { method: 'POST', body });
    },
    onSuccess: (next) => {
      setForm(null);
      done(next);
    },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<AdminSponsors>(`/admin/sponsors/${id}`, { method: 'DELETE' }),
    onSuccess: (next) => {
      setForm(null);
      done(next);
    },
    onError: fail,
  });
  const order = useMutation({
    mutationFn: (ids: string[]) =>
      api<AdminSponsors>('/admin/sponsors/order', { method: 'PUT', body: { ids } }),
    onSuccess: done,
    onError: fail,
  });
  const label = useMutation({
    mutationFn: (value: string) =>
      api<AdminSponsors>('/admin/sponsors/label', { method: 'PUT', body: { label: value } }),
    onSuccess: done,
    onError: fail,
  });

  const upload = async (kind: 'logo' | 'banner') => {
    try {
      const file = await pickFile('image');
      if (!file || !form) return;
      setUploading(kind);
      const image = await api<UploadedImage>('/media', {
        method: 'POST',
        body: { purpose: 'sponsor', fileName: file.name, dataBase64: file.dataBase64 },
      });
      setForm({
        ...form,
        [kind]: { id: image.id, name: file.name },
        ...(kind === 'logo' ? { removeLogo: false } : { removeBanner: false }),
      });
    } catch (e) {
      fail(e as Error);
    } finally {
      setUploading(null);
    }
  };

  const edit = (s: AdminSponsor) =>
    setForm({
      ...empty(),
      id: s.id,
      name: s.name,
      tier: s.tier,
      linkUrl: s.linkUrl ?? '',
      scope: s.scope,
      hasStart: !!s.startsOn,
      startsOn: s.startsOn ?? todayIso(),
      hasEnd: !!s.endsOn,
      endsOn: s.endsOn ?? todayIso(),
    });

  if (data.isPending) return <Loading />;
  if (data.error || !data.data)
    return <ErrorNotice error={data.error} onRetry={() => data.refetch()} />;
  const list = data.data.sponsors;
  const byId = new Map(list.map((s) => [s.id, s]));

  return (
    <Screen edges={[]}>
      {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <T variant="caption">
        Banner sind immer gekennzeichnet, nichts wird ausgewertet, und sie erscheinen nie in
        Anmeldung, Kasse oder Chat und nie bei Minderjährigen.
      </T>

      <Section title="Sponsoren">
        <Card>
          {list.length === 0 ? (
            <Empty icon="heart-outline" text="Noch keine Sponsoren angelegt." />
          ) : (
            <ReorderList
              keys={list.map((s) => s.id)}
              rowHeight={64}
              onChange={(ids) => order.mutate(ids)}
              renderRow={(id, handle) => {
                const s = byId.get(id)!;
                return (
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={s.name}
                      onPress={() => edit(s)}
                      style={{ flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' }}
                    >
                      <T variant="label" numberOfLines={1} style={{ fontWeight: '700' }} verbatim>
                        {s.name}
                      </T>
                      <T variant="caption" numberOfLines={1}>
                        {`${t(SPONSOR_TIER_LABEL[s.tier])} · ${t(SPONSOR_SCOPE_LABEL[s.scope])}`}
                      </T>
                    </Pressable>
                    <Chip tone={STATUS[s.status].tone} label={STATUS[s.status].label} />
                    {handle}
                  </View>
                );
              }}
            />
          )}
        </Card>
        <T variant="caption">Ziehe die Einträge am Griff, um die Reihenfolge zu ändern.</T>
        {!form ? (
          <Button label="Sponsor anlegen" icon="add" onPress={() => setForm(empty())} />
        ) : null}
      </Section>

      {form ? (
        <Section title={form.id ? 'Sponsor bearbeiten' : 'Sponsor anlegen'}>
          <Card style={{ gap: 12 }}>
            <TextField
              label="Name"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              maxLength={80}
            />
            <ChoiceChips
              label="Stufe"
              options={SPONSOR_TIERS.map((v) => ({ value: v, label: SPONSOR_TIER_LABEL[v] }))}
              selected={[form.tier]}
              onToggle={(tier) => setForm({ ...form, tier })}
            />
            <TextField
              label="Link (https://…)"
              value={form.linkUrl}
              onChangeText={(linkUrl) => setForm({ ...form, linkUrl })}
              maxLength={300}
              kind="url"
            />
            <ChoiceChips
              label="Zuordnung"
              options={SPONSOR_SCOPES.map((v) => ({ value: v, label: SPONSOR_SCOPE_LABEL[v] }))}
              selected={[form.scope]}
              onToggle={(scope) => setForm({ ...form, scope })}
            />
            <ChoiceChips
              label="Beginn"
              options={[
                { value: 'no', label: 'Sofort' },
                { value: 'yes', label: 'Ab Datum' },
              ]}
              selected={[form.hasStart ? 'yes' : 'no']}
              onToggle={(v) => setForm({ ...form, hasStart: v === 'yes' })}
            />
            {form.hasStart ? (
              <DateStepper
                label="Läuft ab"
                value={form.startsOn}
                onChange={(startsOn) => setForm({ ...form, startsOn })}
              />
            ) : null}
            <ChoiceChips
              label="Ende"
              options={[
                { value: 'no', label: 'Unbefristet' },
                { value: 'yes', label: 'Bis Datum' },
              ]}
              selected={[form.hasEnd ? 'yes' : 'no']}
              onToggle={(v) => setForm({ ...form, hasEnd: v === 'yes' })}
            />
            {form.hasEnd ? (
              <DateStepper
                label="Läuft bis einschließlich"
                value={form.endsOn}
                onChange={(endsOn) => setForm({ ...form, endsOn })}
              />
            ) : null}
            <View style={{ gap: 8 }}>
              <T variant="label">Logo</T>
              {form.logo ? <Chip tone="success" icon="image" label={form.logo.name} /> : null}
              <Button
                label={form.logo ? 'Anderes Logo wählen' : 'Logo wählen'}
                icon="image-outline"
                size="sm"
                variant="outline"
                style={{ alignSelf: 'flex-start' }}
                loading={uploading === 'logo'}
                onPress={() => void upload('logo')}
              />
            </View>
            <View style={{ gap: 8 }}>
              <T variant="label">Banner (breites Bild, etwa 4:1)</T>
              {form.banner ? <Chip tone="success" icon="image" label={form.banner.name} /> : null}
              <Button
                label={form.banner ? 'Anderes Banner wählen' : 'Banner wählen'}
                icon="images-outline"
                size="sm"
                variant="outline"
                style={{ alignSelf: 'flex-start' }}
                loading={uploading === 'banner'}
                onPress={() => void upload('banner')}
              />
            </View>
            <Button
              label="Speichern"
              icon="checkmark"
              disabled={form.name.trim().length < 2}
              loading={save.isPending}
              onPress={() => save.mutate(form)}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                label="Abbrechen"
                variant="tonal"
                style={{ flex: 1 }}
                onPress={() => setForm(null)}
              />
              {form.id ? (
                <Button
                  label="Löschen"
                  icon="trash-outline"
                  variant="danger"
                  style={{ flex: 1 }}
                  loading={remove.isPending}
                  onPress={() => remove.mutate(form.id!)}
                />
              ) : null}
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="Kennzeichnung">
        <Card style={{ gap: 12 }}>
          <T variant="caption">So steht es über jedem Banner.</T>
          <ChoiceChips
            label="Kennzeichnung"
            options={SPONSOR_LABELS.map((v) => ({ value: v, label: v }))}
            selected={[data.data.label]}
            onToggle={(v) => label.mutate(v)}
          />
        </Card>
      </Section>
    </Screen>
  );
}
