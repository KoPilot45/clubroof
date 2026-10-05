import type { ParticipationMode } from '@clubroof/core';

export const PARTICIPATION_OPTIONS: { value: ParticipationMode; label: string }[] = [
  { value: 'auto_accept', label: 'Automatisch zugesagt' },
  { value: 'active_response', label: 'Aktive Zu-/Absage' },
  { value: 'absences_only', label: 'Nur Abwesenheiten' },
];
