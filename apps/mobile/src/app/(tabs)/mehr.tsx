import { router } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '@/components/app-header';
import { Avatar, Button, Card, Chip, IconTile, ListRow, Screen, Section, T } from '@/components/ui';
import { TEAM_FUNCTION_LABELS } from '@/lib/labels';
import { useSignedIn } from '@/lib/session';

export default function MoreScreen() {
  const { me, signOut } = useSignedIn();
  const name = `${me.person.firstName} ${me.person.lastName}`;
  const children = me.managedPersons.filter((p) => p.relation === 'child');

  return (
    <Screen header={<AppHeader title="Mehr" />}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={name} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading">{name}</T>
          <T variant="caption">{me.user.email}</T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {me.roles.map((r) => (
              <Chip key={r.key + (r.scopeId ?? '')} label={r.name} />
            ))}
          </View>
        </View>
      </Card>

      <Section title="Meine Mannschaften">
        <Card>
          {me.teams.map((t, i) => {
            const person = me.managedPersons.find((p) => p.id === t.personId);
            return (
              <ListRow
                key={t.id + t.personId}
                first={i === 0}
                leading={<IconTile name="shirt-outline" />}
                title={`${t.badge} · ${t.name}`}
                subtitle={
                  t.functions.map((f) => TEAM_FUNCTION_LABELS[f]).join(', ') +
                  (person?.relation === 'child' ? ` (${person.firstName})` : '')
                }
              />
            );
          })}
        </Card>
      </Section>

      {children.length > 0 ? (
        <Section title="Meine Kinder">
          <Card>
            {children.map((c, i) => (
              <ListRow
                key={c.id}
                first={i === 0}
                leading={<Avatar name={`${c.firstName} ${c.lastName}`} />}
                title={`${c.firstName} ${c.lastName}`}
                subtitle="Du verwaltest Termine und Zusagen"
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <Card>
        <ListRow
          first
          leading={<IconTile name="notifications-outline" />}
          title="Benachrichtigungen"
          onPress={() => router.push('/notifications')}
        />
        {me.canAdminister ? (
          <ListRow
            leading={<IconTile name="shield-checkmark-outline" />}
            title="Verwaltungsmodus"
            subtitle="Folgt im nächsten Schritt"
          />
        ) : null}
      </Card>

      <Button
        label="Abmelden"
        variant="danger"
        icon="log-out-outline"
        onPress={() => void signOut()}
      />
    </Screen>
  );
}
