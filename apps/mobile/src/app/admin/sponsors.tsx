import {
  SPONSOR_AD_MAX,
  SPONSOR_LABELS,
  type AdminSponsor,
  type AdminSponsors,
  type SponsorInput,
  type UploadedImage,
} from '@clubroof/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ReorderList } from '@/components/reorder';
import { AdTag, SponsorLogo } from '@/components/sponsor-ads';
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
  Sheet,
  T,
  TextField,
  Toggle,
  PageAction,
} from '@/components/ui';
import { RequestError } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { pickFile } from '@/lib/upload';
import { useConfirmDelete } from '@/lib/confirm';
import { t } from '@/lib/i18n';

const STATUS = {
  active: { label: 'Läuft', tone: 'success' },
  planned: { label: 'Geplant', tone: 'info' },
  expired: { label: 'Abgelaufen', tone: 'archived' },
} as const;

type Form = {
  id: string | null;
  name: string;
  slogan: string;
  description: string;
  linkUrl: string;
  advertise: boolean;
  hideForYouth: boolean;
  hasStart: boolean;
  startsOn: string;
  hasEnd: boolean;
  endsOn: string;
  logo: { id: string; name: string } | null;
  logoDark: { id: string; name: string } | null;
  removeLogo: boolean;
  removeLogoDark: boolean;
};
const empty = (): Form => ({
  id: null,
  name: '',
  slogan: '',
  description: '',
  linkUrl: '',
  advertise: false,
  hideForYouth: false,
  hasStart: false,
  startsOn: todayIso(),
  hasEnd: false,
  endsOn: todayIso(),
  logo: null,
  logoDark: null,
  removeLogo: false,
  removeLogoDark: false,
});

/**
 * Sponsoren pflegen (Vereinsadministration, SP2): Reihenfolge ziehen, Logo, Slogan, Text, Link, Laufzeit und je
 * Sponsor die Werbung in der App.
 */
export default function AdminSponsorsScreen() {
  const confirmDelete = useConfirmDelete();
  const { colors } = useTheme();
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: ['admin', 'sponsors'],
    queryFn: () => api<AdminSponsors>('/admin/sponsors'),
  });
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'logoDark' | null>(null);
  const done = (next: AdminSponsors) => {
    setError(null);
    queryClient.setQueryData(['admin', 'sponsors'], next);
    void queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    void queryClient.invalidateQueries({ queryKey: ['sponsor-ads'] });
  };
  const fail = (e: Error) =>
    setError(
      e instanceof RequestError ? e.message : 'Das hat nicht geklappt. Bitte versuche es erneut.',
    );

  const save = useMutation({
    mutationFn: (f: Form) => {
      const body: SponsorInput & { removeLogo?: boolean; removeLogoDark?: boolean } = {
        name: f.name.trim(),
        slogan: f.slogan.trim() || null,
        description: f.description.trim() || null,
        linkUrl: f.linkUrl.trim() || null,
        advertise: f.advertise,
        hideForYouth: f.advertise && f.hideForYouth,
        startsOn: f.hasStart ? f.startsOn : null,
        endsOn: f.hasEnd ? f.endsOn : null,
        logoImageId: f.logo?.id ?? null,
        logoDarkImageId: f.logoDark?.id ?? null,
        removeLogo: f.removeLogo,
        removeLogoDark: f.removeLogoDark,
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

  const upload = async (kind: 'logo' | 'logoDark') => {
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
        ...(kind === 'logo' ? { removeLogo: false } : { removeLogoDark: false }),
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
      slogan: s.slogan ?? '',
      description: s.description ?? '',
      linkUrl: s.linkUrl ?? '',
      advertise: s.advertise,
      hideForYouth: s.hideForYouth,
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
      {error && !form ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
      <T variant="caption">
        {t(
          `Werbung läuft für ${data.data.advertising} von ${list.length} Sponsoren. Die App zeigt bis zu ${SPONSOR_AD_MAX} davon zufällig.`,
        )}
      </T>

      <Section title="Sponsoren">
        <Card>
          {list.length === 0 ? (
            <Empty icon="heart-outline" text="Noch keine Sponsoren angelegt." />
          ) : (
            <ReorderList
              keys={list.map((s) => s.id)}
              rowHeight={72}
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
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <Chip
                          tone={s.advertise ? 'primary' : 'neutral'}
                          label={s.advertise ? 'Werbung an' : 'keine Werbung'}
                        />
                        {s.hideForYouth ? <Chip tone="neutral" label="nicht Jugend" /> : null}
                      </View>
                    </Pressable>
                    {s.status !== 'active' ? (
                      <Chip tone={STATUS[s.status].tone} label={STATUS[s.status].label} />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t('Bearbeiten')}: ${s.name}`}
                      onPress={() => edit(s)}
                      style={{
                        width: 44,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="create-outline" size={22} color={colors.primaryText} />
                    </Pressable>
                    {handle}
                  </View>
                );
              }}
            />
          )}
        </Card>
        <T variant="caption">Ziehe die Einträge am Griff, um die Reihenfolge zu ändern.</T>
        <PageAction>
          <Button label="Sponsor anlegen" icon="add" onPress={() => setForm(empty())} />
        </PageAction>
      </Section>

      {/* Bearbeiten in einem Fenster statt unter der Liste */}
      <Sheet
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Sponsor bearbeiten' : 'Sponsor anlegen'}
      >
        {form ? (
          <>
            {error ? <Chip tone="urgent" icon="alert-circle" label={error} /> : null}
            <TextField
              label="Name"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              maxLength={80}
            />
            <TextField
              label="Slogan (eine Zeile)"
              value={form.slogan}
              onChangeText={(slogan) => setForm({ ...form, slogan })}
              maxLength={80}
            />
            <TextField
              label="Text für die Detailseite"
              value={form.description}
              onChangeText={(description) => setForm({ ...form, description })}
              maxLength={1000}
              multiline
            />
            <TextField
              label="Link (https://…)"
              value={form.linkUrl}
              onChangeText={(linkUrl) => setForm({ ...form, linkUrl })}
              maxLength={300}
              kind="url"
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
              <T variant="label">Logo für den Dunkelmodus (optional)</T>
              {form.logoDark ? (
                <Chip tone="success" icon="image" label={form.logoDark.name} />
              ) : null}
              <Button
                label={form.logoDark ? 'Anderes Logo wählen' : 'Logo wählen'}
                icon="moon-outline"
                size="sm"
                variant="outline"
                style={{ alignSelf: 'flex-start' }}
                loading={uploading === 'logoDark'}
                onPress={() => void upload('logoDark')}
              />
            </View>

            <View style={{ gap: 10 }}>
              <T variant="section">Werbung in der App</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <T style={{ flex: 1 }}>Als Werbung anzeigen</T>
                <Toggle
                  label="Als Werbung anzeigen"
                  value={form.advertise}
                  onChange={(advertise) => setForm({ ...form, advertise })}
                />
              </View>
              {form.advertise ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <T style={{ flex: 1 }}>Nicht bei Jugendspielern anzeigen</T>
                  <Toggle
                    label="Nicht bei Jugendspielern anzeigen"
                    value={form.hideForYouth}
                    onChange={(hideForYouth) => setForm({ ...form, hideForYouth })}
                  />
                </View>
              ) : null}
              <T variant="caption">
                Auch ohne Werbung bleibt der Sponsor in der Übersicht sichtbar.
              </T>
              {form.advertise ? (
                <View style={{ gap: 6 }}>
                  <T variant="label">Vorschau</T>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      padding: 12,
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: colors.anstoss.cardBorder,
                      backgroundColor: colors.anstoss.card,
                    }}
                  >
                    <SponsorLogo
                      sponsor={{
                        id: 'preview',
                        name: form.name || 'Name',
                        slogan: null,
                        description: null,
                        linkUrl: null,
                        logoUrl: null,
                        logoDarkUrl: null,
                        startsOn: null,
                        endsOn: null,
                      }}
                      size={52}
                      inner={32}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T variant="overline">Unterstützt von</T>
                      <T variant="headline" numberOfLines={1} verbatim style={{ fontSize: 21 }}>
                        {form.name || 'Name'}
                      </T>
                      {form.slogan ? (
                        <T variant="caption" numberOfLines={1} verbatim>
                          {form.slogan}
                        </T>
                      ) : null}
                    </View>
                    <AdTag label={data.data.label} />
                  </View>
                </View>
              ) : null}
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
                  onPress={() =>
                    confirmDelete({
                      name: form.name,
                      archive: true,
                      onConfirm: () => remove.mutate(form.id!),
                    })
                  }
                />
              ) : null}
            </View>
          </>
        ) : null}
      </Sheet>

      <Section title="Kennzeichnung">
        <Card style={{ gap: 12 }}>
          <T variant="caption">So steht es in der Werbung.</T>
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
