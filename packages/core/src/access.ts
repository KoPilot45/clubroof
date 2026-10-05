import type { Permission } from './permissions';
import type { ScopeType } from './scopes';

/**
 * Rechteprüfung. Eine Rolle gilt in ihrem Geltungsbereich und allem darunter:
 * Verein → Bereich → Mannschaft.
 */

export type Grant = {
  permissions: readonly string[];
  scopeType: ScopeType;
  scopeId: string | null;
};

/** Ziel einer Prüfung. Ohne Angaben wird auf Vereinsebene geprüft. */
export type AccessTarget = {
  teamId?: string | null;
  orgUnitId?: string | null;
};

export function can(
  grants: readonly Grant[],
  permission: Permission,
  target: AccessTarget = {},
): boolean {
  return grants.some((g) => {
    if (!g.permissions.includes(permission)) return false;
    switch (g.scopeType) {
      case 'club':
        return true;
      case 'org_unit':
        return g.scopeId !== null && g.scopeId === target.orgUnitId;
      case 'team':
        return g.scopeId !== null && g.scopeId === target.teamId;
    }
  });
}

/** Alle Mannschaften bzw. Bereiche, für die eine Berechtigung gilt (`'all'` bei Vereinsebene). */
export function scopesWith(
  grants: readonly Grant[],
  permission: Permission,
): { all: boolean; orgUnitIds: string[]; teamIds: string[] } {
  const result = { all: false, orgUnitIds: [] as string[], teamIds: [] as string[] };
  for (const g of grants) {
    if (!g.permissions.includes(permission)) continue;
    if (g.scopeType === 'club') result.all = true;
    else if (g.scopeType === 'org_unit' && g.scopeId) result.orgUnitIds.push(g.scopeId);
    else if (g.scopeType === 'team' && g.scopeId) result.teamIds.push(g.scopeId);
  }
  return result;
}
