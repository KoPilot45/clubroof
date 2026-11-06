/**
 * Feste Farbe je Terminart (Paket DESIGN-HELL-TERMINKARTE-HERO): Datumskachel und Marke der Terminkarte.
 * Weißer Text steht darauf mit mindestens 4,5 : 1 (Test). Hell und dunkel sind gleich lesbar; im Dunkeln
 * bekommt die Kachel zusätzlich einen hellen Rand, damit sie sich von der Kartenfläche abhebt.
 */
export type EventTypeKey =
  | 'match'
  | 'training'
  | 'tournament'
  | 'team_event'
  | 'club_event'
  | 'meeting'
  | 'work_assignment';

export const EVENT_TYPE_COLORS: Record<EventTypeKey, { light: string; dark: string }> = {
  match: { light: '#0F5B3A', dark: '#0F5B3A' },
  training: { light: '#2F6FB0', dark: '#2F6FB0' },
  tournament: { light: '#7A3FA0', dark: '#7A3FA0' },
  team_event: { light: '#C2570C', dark: '#C2570C' },
  club_event: { light: '#B0206B', dark: '#B0206B' },
  meeting: { light: '#55606B', dark: '#55606B' },
  work_assignment: { light: '#8A6A00', dark: '#8A6A00' },
};

export function eventTypeColor(type: string, scheme: 'light' | 'dark'): string {
  return (EVENT_TYPE_COLORS[type as EventTypeKey] ?? EVENT_TYPE_COLORS.meeting)[scheme];
}
