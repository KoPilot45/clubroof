import type { MemberListItem, TeamAdminOverview } from '@clubroof/core';
import { router } from 'expo-router';
import { TeamWizard, type TeamWizardBackend } from '@/app/admin/team-new';
import { ThemeProvider } from '@/lib/theme';

const OVERVIEW: TeamAdminOverview = {
  current: { id: 'demo-season', name: 'Saison 2026/27' } as TeamAdminOverview['current'],
  next: null,
  teams: [],
  nextTeams: [],
  orgUnits: [
    { id: 'demo-youth', name: 'Jugend', canManage: true },
    { id: 'demo-seniors', name: 'Senioren', canManage: true },
  ],
};

const NAMES = ['Max Mustermann', 'Lena Beispiel', 'Tom Probst', 'Mia Demo', 'Jonas Muster'];
const MEMBERS: MemberListItem[] = NAMES.map((n, i) => {
  const [firstName, lastName] = n.split(' ') as [string, string];
  return {
    id: `demo-${i}`,
    firstName,
    lastName,
    memberNumber: `${1000 + i}`,
    status: 'active',
    teams: [],
    roles: [],
    hasAccount: false,
  };
});

/**
 * Vorführung der Mannschaftseinrichtung (ohne Speichern): derselbe Assistent wie in der Verwaltung,
 * erreichbar bei den Demo-Zugängen der Anmeldeseite.
 */
export default function DemoTeamSetupScreen() {
  const backend: TeamWizardBackend = {
    demo: true,
    overview: OVERVIEW,
    places: [{ label: 'Sportplatz am Wald' }, { label: 'Kabine 1 · Sportplatz am Wald' }],
    search: async (term) =>
      MEMBERS.filter((m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(term.toLowerCase()),
      ),
    create: async () => 'demo-team',
    finish: () => router.replace('/login'),
  };
  return (
    <ThemeProvider clubColor="green">
      <TeamWizard backend={backend} />
    </ThemeProvider>
  );
}
