import type { ClubCash, MemberListItem } from '@clubroof/core';
import { router } from 'expo-router';
import { CashWizard, type CashWizardBackend } from '@/app/club-cash/setup';
import { ThemeProvider } from '@/lib/theme';

const CASH: ClubCash = {
  level: 'full',
  canManage: true,
  canManageFunds: true,
  canAudit: false,
  canChangeSettings: true,
  visibility: 'treasury',
  nonprofit: null,
  year: new Date().getFullYear(),
  funds: [],
  units: [],
  fundId: null,
  accounts: [],
  categories: [],
  costCenters: [],
  areaTotals: [],
  totalBalanceCents: 0,
  recent: [],
};

const NAMES = ['Max Mustermann', 'Lena Beispiel', 'Tom Probst'];
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
    avatarUrl: null,
  };
});

/** Vorführung der Kasseneinrichtung (ohne Speichern): derselbe Assistent wie in der Vereinskasse. */
export default function DemoCashSetupScreen() {
  const backend: CashWizardBackend = {
    demo: true,
    cash: CASH,
    search: async (term) =>
      MEMBERS.filter((m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(term.toLowerCase()),
      ),
    api: async () => ({}) as never,
    finish: () => router.replace('/login'),
  };
  return (
    <ThemeProvider clubColor="green">
      <CashWizard backend={backend} />
    </ThemeProvider>
  );
}
