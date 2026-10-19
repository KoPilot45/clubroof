/** Bereiche der Rollenmatrix (Paket ROLLEN-VERWALTUNG): jedes Recht gehört zu genau einem Bereich. */
import { ALL_PERMISSIONS } from '@clubroof/core';

export const ROLE_AREAS = [
  { key: 'club', label: 'Verein' },
  { key: 'members', label: 'Mitglieder' },
  { key: 'sport', label: 'Sport' },
  { key: 'events', label: 'Termine' },
  { key: 'cash', label: 'Kasse' },
  { key: 'ops', label: 'Betrieb' },
] as const;
export type RoleArea = (typeof ROLE_AREAS)[number]['key'];

export function areaOf(permission: string): RoleArea {
  if (permission.startsWith('members.')) return 'members';
  if (permission.startsWith('teams.') || permission.startsWith('squad.')) return 'sport';
  if (
    permission.startsWith('events.') ||
    permission.startsWith('attendance.') ||
    permission.startsWith('absences.')
  )
    return 'events';
  if (permission.startsWith('cash.') || permission.startsWith('clubcash.')) return 'cash';
  if (
    permission.startsWith('facilities.') ||
    permission.startsWith('documents.') ||
    permission.startsWith('helpers.') ||
    permission.startsWith('referees.')
  )
    return 'ops';
  // Verein & System, Kommunikation (News, Umfragen, Forum), Archiv
  return 'club';
}

/** voll = alle Rechte des Bereichs, teilweise = einige, keine */
export function coverage(permissions: string[], area: RoleArea): 'full' | 'partial' | 'none' {
  const all = ALL_PERMISSIONS.filter((p) => areaOf(p) === area);
  const have = all.filter((p) => permissions.includes(p)).length;
  return have === 0 ? 'none' : have === all.length ? 'full' : 'partial';
}
