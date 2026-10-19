import type { TeamCash, TreasurerCandidates } from '@clubroof/core';
import { router } from 'expo-router';
import { TeamCashWizard, type TeamCashWizardBackend } from '@/app/teams/[id]/cash-setup';
import { ThemeProvider } from '@/lib/theme';

const CASH = {
  team: { id: 'demo-team', name: 'B-Jugend', badge: 'B1' },
  config: { fines: true, drinks: true },
  fineCatalog: [],
  treasurers: [],
} as unknown as TeamCash;

const CANDIDATES: TreasurerCandidates = {
  treasurers: [],
  candidates: [
    { personId: 'demo-1', name: 'Max Mustermann', relation: 'Trainer' },
    { personId: 'demo-2', name: 'Lena Beispiel', relation: 'Elternteil' },
  ],
};

/** Vorführung der Mannschaftskasse-Einrichtung (ohne Speichern). */
export default function DemoTeamCashSetupScreen() {
  const backend: TeamCashWizardBackend = {
    demo: true,
    teamId: 'demo-team',
    cash: CASH,
    candidates: CANDIDATES,
    api: async () => ({}) as never,
    finish: () => router.replace('/login'),
  };
  return (
    <ThemeProvider clubColor="green">
      <TeamCashWizard backend={backend} />
    </ThemeProvider>
  );
}
