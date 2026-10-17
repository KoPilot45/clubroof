import { useSignedIn } from '@/lib/session';
import { useTheme } from '@/lib/theme';

/** Kleine, gut unterscheidbare Palette (höchstens 5), nach Reihenfolge der eigenen Mannschaften vergeben. */
const PALETTE = ['#5AA9FF', '#FF7AB8', '#FFB020', '#B28CFF', '#2EDB6B'] as const;
/** Hell: dunkler, damit Kürzel und Wochentag auf Pastell mindestens 4,5 : 1 erreichen. */
const PALETTE_LIGHT = ['#1F5FB8', '#B4156B', '#A84B00', '#6B46C1', '#1A7237'] as const;

/**
 * Mannschaftsfarbe nur für Mehrfach-Zugehörige (Trainer mit B1 und C1, Eltern mit Kindern in E1 und F1):
 * je Person gleichbleibend, nach der Reihenfolge der eigenen Mannschaften. Wer nur einer Mannschaft angehört,
 * bekommt keine (null). Das Kürzel bleibt als Zweitmerkmal sichtbar – die Farbe ist nie die einzige Information.
 */
export function useTeamColorOf(): (teamId: string | null | undefined) => string | null {
  const { me } = useSignedIn();
  const { isDark } = useTheme();
  const palette = isDark ? PALETTE : PALETTE_LIGHT;
  const ids = [...new Set(me.teams.map((t) => t.id))];
  return (teamId) => {
    if (!teamId || ids.length < 2) return null;
    const i = ids.indexOf(teamId);
    return i < 0 ? null : palette[i % palette.length]!;
  };
}

export function useTeamColor(teamId: string | null | undefined): string | null {
  return useTeamColorOf()(teamId);
}
