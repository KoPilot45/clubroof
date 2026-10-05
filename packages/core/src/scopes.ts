/** Geltungsbereiche für Rollen, Module, News, Dokumente usw. Vererbung: Verein → Bereich → Mannschaft. */
export const SCOPE_TYPES = ['club', 'org_unit', 'team'] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];
