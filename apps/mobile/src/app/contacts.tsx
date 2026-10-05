import type { ContactGroup } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { Linking, Pressable, View } from 'react-native';
import { Avatar, Card, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

function ContactLink({ label, href }: { label: string; href: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(href)} hitSlop={4}>
      <T variant="label" color={colors.primaryText}>
        {label}
      </T>
    </Pressable>
  );
}

export default function ContactsScreen() {
  const { api } = useSignedIn();
  const { colors } = useTheme();
  const groups = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api<ContactGroup[]>('/club/contacts'),
  });
  return (
    <Screen edges={[]} refreshing={groups.isRefetching} onRefresh={() => groups.refetch()}>
      {groups.isPending ? <Loading /> : null}
      {groups.error ? (
        <ErrorNotice message={groups.error.message} onRetry={() => groups.refetch()} />
      ) : null}
      {groups.data?.map((g) => (
        <Section key={g.title} title={g.title}>
          <Card>
            {g.contacts.map((c, i) => (
              <View
                key={c.personId}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <Avatar name={c.name} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="label" style={{ fontWeight: '700' }}>
                    {c.name}
                  </T>
                  <T variant="caption">{c.functions.join(' · ')}</T>
                  {c.email ? <ContactLink label={c.email} href={`mailto:${c.email}`} /> : null}
                  {c.phone ? (
                    <ContactLink label={c.phone} href={`tel:${c.phone.replace(/\s/g, '')}`} />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ))}
      <T variant="caption">
        Kontaktdaten von Trainerinnen und Trainern anderer Mannschaften erscheinen nur, wenn sie sie
        für den ganzen Verein freigegeben haben.
      </T>
    </Screen>
  );
}
