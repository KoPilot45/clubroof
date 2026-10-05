import type { ModuleLevel, ModuleState } from './modules';
import type { ScopeType } from './scopes';

export type ModuleSetting = {
  moduleKey: string;
  scopeType: ScopeType;
  scopeId: string | null;
  state: ModuleState;
  level: ModuleLevel;
  config: Record<string, unknown>;
};

export type ResolvedModule = {
  enabled: boolean;
  state: ModuleState;
  level: ModuleLevel;
  config: Record<string, unknown>;
};

/**
 * Ermittelt die wirksame Modulkonfiguration nach dem Vererbungsprinzip (Konzept §8):
 * Verein → Bereich → Mannschaft. Die spezifischste Ebene gewinnt – außer eine höhere Ebene
 * hat das Modul gesperrt (`locked`) oder nicht aktiviert; dann ist es darunter nicht nutzbar.
 */
export function resolveModule(
  settings: readonly ModuleSetting[],
  moduleKey: string,
  target: { orgUnitId?: string | null; teamId?: string | null } = {},
): ResolvedModule {
  const forKey = settings.filter((s) => s.moduleKey === moduleKey);
  const club = forKey.find((s) => s.scopeType === 'club');
  const orgUnit = target.orgUnitId
    ? forKey.find((s) => s.scopeType === 'org_unit' && s.scopeId === target.orgUnitId)
    : undefined;
  const team = target.teamId
    ? forKey.find((s) => s.scopeType === 'team' && s.scopeId === target.teamId)
    : undefined;

  const chain = [club, orgUnit, team].filter((s): s is ModuleSetting => s !== undefined);
  if (chain.length === 0) {
    return { enabled: false, state: 'available', level: 'off', config: {} };
  }

  let config: Record<string, unknown> = {};
  let effective: ModuleSetting = chain[0]!;
  for (const setting of chain) {
    config = { ...config, ...setting.config };
    effective = setting;
    if (setting.state !== 'enabled') break;
  }

  const enabled = effective.state === 'enabled' && effective.level !== 'off';
  return { enabled, state: effective.state, level: effective.level, config };
}
