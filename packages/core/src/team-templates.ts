import type { TeamTemplate } from './domain';
import type { ModuleLevel } from './modules';

/** Voreinstellung eines Mannschaftsmoduls beim Anlegen einer Mannschaft. */
export type TemplateModule = {
  moduleKey: string;
  state: 'enabled' | 'available';
  level: ModuleLevel;
  config: Record<string, unknown>;
};

/**
 * Mannschaftsvorlagen (Mappe S. 10, Konzept §8): leistungsorientiert, klassisch, Jugend, Freizeit.
 * Sie legen fest, welche Mannschaftsmodule zu Beginn aktiv sind; alles bleibt später änderbar.
 */
export const TEAM_TEMPLATE_INFO: Record<TeamTemplate, { name: string; description: string }> = {
  performance: {
    name: 'Leistungsorientiert',
    description: 'Statistik, Kader & Aufstellung, Strafenkatalog, feste Rückennummern',
  },
  classic: { name: 'Klassisch', description: 'Statistik, Getränkekasse, Rückennummern je Spiel' },
  youth: { name: 'Jugend', description: 'Elternzugänge, einfache Statistik, ohne Strafen' },
  leisure: { name: 'Freizeit', description: 'Termine und Getränkekasse, ohne Statistik' },
};

export function templateModules(template: TeamTemplate): TemplateModule[] {
  const m = (
    moduleKey: string,
    state: 'enabled' | 'available',
    level: ModuleLevel = state === 'enabled' ? 'basic' : 'off',
    config: Record<string, unknown> = {},
  ): TemplateModule => ({ moduleKey, state, level, config });
  switch (template) {
    case 'performance':
      return [
        m('statistics', 'enabled', 'extended'),
        m('team_cash', 'enabled', 'basic', { fines: true, drinks: true }),
        m('jersey_numbers', 'enabled', 'basic', { mode: 'season' }),
        m('squad', 'enabled', 'extended', { lineups: true }),
      ];
    case 'classic':
      return [
        m('statistics', 'enabled'),
        m('team_cash', 'enabled', 'basic', { fines: false, drinks: true }),
        m('jersey_numbers', 'enabled', 'basic', { mode: 'match' }),
      ];
    case 'leisure':
      return [
        m('statistics', 'available'),
        m('team_cash', 'enabled', 'basic', { fines: false, drinks: true }),
        m('jersey_numbers', 'available'),
      ];
    case 'youth':
      return [
        m('statistics', 'enabled'),
        m('team_cash', 'available', 'basic', { fines: false, drinks: false }),
        m('jersey_numbers', 'enabled', 'basic', { mode: 'match' }),
        m('parent_access', 'enabled'),
      ];
  }
}
