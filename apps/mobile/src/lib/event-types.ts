import type { EventSummary } from '@clubroof/core';
import type { Theme } from '@/lib/theme';

/** Terminarten für Kalender und Legende (Farbe immer mit Beschriftung). */
export type EventKind = 'training' | 'match' | 'tournament' | 'team' | 'club';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  training: 'Training',
  match: 'Spiel',
  tournament: 'Turnier',
  team: 'Mannschaftstermin',
  club: 'Verein',
};

export function kindOf(e: Pick<EventSummary, 'type' | 'team'>): EventKind {
  if (e.type === 'training') return 'training';
  if (e.type === 'match') return 'match';
  if (e.type === 'tournament') return 'tournament';
  return e.team ? 'team' : 'club';
}

export function kindColor(kind: EventKind, colors: Theme['colors']): string {
  switch (kind) {
    case 'training':
      return colors.status.info.solid;
    case 'match':
      return colors.status.action.solid;
    case 'tournament':
      return colors.status.success.solid;
    case 'team':
      return colors.status.archived.solid;
    case 'club':
      // Neutral statt Vereinsfarbe – sonst bei grünen Vereinen nicht von „Turnier“ unterscheidbar
      return colors.onSurface;
  }
}
