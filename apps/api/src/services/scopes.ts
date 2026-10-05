/**
 * Geltungsbereiche (Verein → Bereich → Mannschaft) für Inhalte wie News, Umfragen und Dokumente:
 * Beschriftung, Prüfziel für Rechte und die Bereiche, in denen ein Recht gilt.
 */
import {
  can,
  type AccessTarget,
  type Permission,
  type ScopeType,
  type UploadTarget,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError, forbidden } from '../errors';

type TeamRow = typeof s.teams.$inferSelect;

/** „B1 · B-Jugend“, aber „1. Mannschaft“ statt „1. · 1. Mannschaft“ */
export const teamLabel = (t: { badge: string; name: string }) =>
  t.name.startsWith(t.badge) ? t.name : `${t.badge} · ${t.name}`;

export type ScopeContext = {
  units: (typeof s.orgUnits.$inferSelect)[];
  teams: TeamRow[];
};

export async function loadScopeContext(db: Db, actor: Actor): Promise<ScopeContext> {
  const [units, teams] = await Promise.all([
    db
      .select()
      .from(s.orgUnits)
      .where(eq(s.orgUnits.clubId, actor.club.id))
      .orderBy(asc(s.orgUnits.sortOrder)),
    db
      .select({ team: s.teams })
      .from(s.teams)
      .innerJoin(s.seasons, eq(s.seasons.id, s.teams.seasonId))
      .where(and(eq(s.teams.clubId, actor.club.id), eq(s.seasons.isCurrent, true)))
      .orderBy(asc(s.teams.sortOrder))
      .then((rows) => rows.map((r) => r.team)),
  ]);
  return { units, teams };
}

export function targetOf(
  ctx: ScopeContext,
  type: ScopeType,
  id: string | null,
): AccessTarget | null {
  if (type === 'club') return {};
  if (type === 'org_unit') return ctx.units.some((u) => u.id === id) ? { orgUnitId: id } : null;
  const team = ctx.teams.find((t) => t.id === id);
  return team ? { teamId: team.id, orgUnitId: team.orgUnitId } : null;
}

export function labelOf(ctx: ScopeContext, type: ScopeType, id: string | null): string {
  if (type === 'club') return 'Verein';
  if (type === 'org_unit') return ctx.units.find((u) => u.id === id)?.name ?? 'Bereich';
  const team = ctx.teams.find((t) => t.id === id);
  return team ? teamLabel(team) : 'Mannschaft';
}

/** Alle Bereiche, in denen das Recht gilt (Verein, Bereiche, Mannschaften der laufenden Saison). */
export function targetsWith(
  actor: Actor,
  ctx: ScopeContext,
  permission: Permission,
): UploadTarget[] {
  const all: { type: ScopeType; id: string | null }[] = [
    { type: 'club', id: null },
    ...ctx.units.map((u) => ({ type: 'org_unit' as const, id: u.id })),
    ...ctx.teams.map((t) => ({ type: 'team' as const, id: t.id })),
  ];
  return all
    .filter((sc) => can(actor.grants, permission, targetOf(ctx, sc.type, sc.id)!))
    .map((sc) => ({ ...sc, label: labelOf(ctx, sc.type, sc.id) }));
}

/** Prüft Bereich und Recht für einen neuen Inhalt; gibt die normalisierte `scopeId` zurück. */
export function requireScope(
  actor: Actor,
  ctx: ScopeContext,
  permission: Permission,
  scopeType: ScopeType,
  scopeId: string | null | undefined,
  message: string,
): { scopeId: string | null; target: AccessTarget } {
  const id = scopeType === 'club' ? null : (scopeId ?? null);
  const target = targetOf(ctx, scopeType, id);
  if (!target) throw new HttpError(400, 'invalid_scope', 'Unbekannter Bereich.');
  if (!can(actor.grants, permission, target)) throw forbidden(message);
  return { scopeId: id, target };
}
