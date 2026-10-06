import type { ParticipationMode } from '@clubroof/core';

export const PARTICIPATION_OPTIONS: { value: ParticipationMode; label: string }[] = [
  { value: 'auto_accept', label: 'Automatisch zugesagt' },
  { value: 'active_response', label: 'Aktive Zu-/Absage' },
  { value: 'absences_only', label: 'Nur Abwesenheiten' },
];

/** „B1 · B-Jugend“, aber „2. Mannschaft“ statt „2. · 2. Mannschaft“. */
export function teamTitle(t: { badge: string; name: string }): string {
  const badge = t.badge.replace(/\.$/, '');
  return t.name.startsWith(badge) ? t.name : `${t.badge} · ${t.name}`;
}
