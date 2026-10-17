import { useSignedIn } from '@/lib/session';

/** Kleine, gut unterscheidbare Palette (höchstens 5), nach Reihenfolge der eigenen Mannschaften vergeben. */
const PALETTE = ['#5AA9FF', '#FF7AB8', '#FFB020', '#B28CFF', '#2EDB6B'] as const;

/**
 * Mannschaftsfarbe nur für Mehrfach-Zugehörige (Trainer mit B1 und C1, Eltern mit Kindern in E1 und F1):
 * je Person gleichbleibend, nach der Reihenfolge der eigenen Mannschaften. Wer nur einer Mannschaft angehört,
 * bekommt keine (null). Das Kürzel bleibt als Zweitmerkmal sichtbar – die Farbe ist nie die einzige Information.
 */
export function useTeamColorOf(): (teamId: string | null | undefined) => string | null {
  const { me } = useSignedIn();
  const ids = [...new Set(me.teams.map((t) => t.id))];
  return (teamId) => {
    if (!teamId || ids.length < 2) return null;
    const i = ids.indexOf(teamId);
    return i < 0 ? null : PALETTE[i % PALETTE.length]!;
  };
}

export function useTeamColor(teamId: string | null | undefined): string | null {
  return useTeamColorOf()(teamId);
}
