import type { ContactGroup } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { ContactActions } from '@/components/contact';
import { Avatar, Card, ErrorNotice, Loading, Screen, Section, T } from '@/components/ui';
import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

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
      {groups.error ? <ErrorNotice error={groups.error} onRetry={() => groups.refetch()} /> : null}
      {groups.data?.map((g) => (
        <Section key={g.title} title={g.title}>
          <Card>
            {g.contacts.map((c, i) => (
              <View
                key={c.personId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
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
                </View>
                <ContactActions name={c.name} phone={c.phone} email={c.email} />
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
