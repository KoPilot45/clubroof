/**
 * Sponsoren-Modul (Paket SPO, optional): Die Vereinsadministration pflegt Sponsoren mit Logo,
 * Banner, Link, Stufe, Laufzeit und Zuordnung. Banner stehen gekennzeichnet auf Startseite,
 * Spieltag und Terminlisten, dazu die Seite „Unsere Sponsoren“. Keine Auswertung (nichts wird
 * gezählt), nie bei Minderjährigen; Anmeldung, Kasse und Chat haben gar keinen Platz dafür.
 */
import {
  SPONSOR_LABELS,
  SPONSOR_SCOPES,
  SPONSOR_TIERS,
  calendarDayOf,
  toIsoDate,
  type AdminSponsor,
  type AdminSponsors,
  type SponsorBanner,
  type SponsorInput,
  type SponsorItem,
  type SponsorPage,
  type SponsorPlacement,
  type SponsorScope,
  type SponsorStatus,
  type SponsorTier,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { mediaReference } from './uploads';

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));

/** Minderjährige sehen keine Werbung (Jugendschutz, Datensparsamkeit). */
function isMinor(actor: Actor, now: Date): boolean {
  const born = actor.person.birthDate;
  if (!born) return false;
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - 18);
  return born > toIsoDate(limit);
}

function statusOf(
  row: { startsOn: string | null; endsOn: string | null },
  day: string,
): SponsorStatus {
  if (row.startsOn && row.startsOn > day) return 'planned';
  if (row.endsOn && row.endsOn < day) return 'expired';
  return 'active';
}

const toItem = (row: typeof s.sponsors.$inferSelect, actor: Actor, now: Date): SponsorItem => ({
  id: row.id,
  name: row.name,
  tier: row.tier as SponsorTier,
  linkUrl: row.linkUrl,
  logoUrl: resolveMediaUrl(actor.links, row.logoRef, now),
  bannerUrl: resolveMediaUrl(actor.links, row.bannerRef, now),
  scope: row.scope as SponsorScope,
  startsOn: row.startsOn,
  endsOn: row.endsOn,
});

/** Laufende Sponsoren, die zu dieser Person passen (Verein für alle, Jugend/Senioren je Bereich). */
async function eligible(db: Db, actor: Actor, now: Date) {
  if (!moduleEnabled(actor, 'sponsors') || isMinor(actor, now)) return [];
  const day = today(actor, now);
  const units = actor.orgUnitIds.length
    ? await db
        .select({ kind: s.orgUnits.kind })
        .from(s.orgUnits)
        .where(inArray(s.orgUnits.id, actor.orgUnitIds))
    : [];
  const kinds = new Set(units.map((u) => u.kind));
  const rows = await db
    .select()
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id))
    .orderBy(asc(s.sponsors.sortOrder), asc(s.sponsors.createdAt));
  return rows.filter(
    (r) =>
      statusOf(r, day) === 'active' &&
      (r.scope === 'club' ||
        (r.scope === 'youth' && kinds.has('youth')) ||
        (r.scope === 'seniors' && kinds.has('seniors'))),
  );
}

export async function getSponsorPage(db: Db, actor: Actor, now: Date): Promise<SponsorPage> {
  const rows = await eligible(db, actor, now);
  return { label: actor.club.sponsorLabel, sponsors: rows.map((r) => toItem(r, actor, now)) };
}

const PLACEMENT_OFFSET: Record<SponsorPlacement, number> = { home: 0, match: 1, events: 2 };

/** Ein Banner für den Platz; wechselt alle sechs Stunden reihum – ohne zu zählen, was angezeigt wird. */
export async function getSponsorBanner(
  db: Db,
  actor: Actor,
  placement: SponsorPlacement,
  now: Date,
): Promise<SponsorBanner> {
  const rows = (await eligible(db, actor, now)).filter((r) => r.bannerRef || r.logoRef);
  if (rows.length === 0) return { label: actor.club.sponsorLabel, sponsor: null };
  const slot = Math.floor(now.getTime() / (6 * 3_600_000)) + PLACEMENT_OFFSET[placement];
  return {
    label: actor.club.sponsorLabel,
    sponsor: toItem(rows[slot % rows.length]!, actor, now),
  };
}

// ── Pflege (Vereinsadministration) ──────────────────────────────────────────

function requireAdmin(actor: Actor) {
  if (!moduleEnabled(actor, 'sponsors'))
    throw new HttpError(404, 'module_off', 'Das Sponsoren-Modul ist nicht aktiviert.');
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Sponsoren pflegt die Vereinsadministration.');
}

export async function listAdminSponsors(db: Db, actor: Actor, now: Date): Promise<AdminSponsors> {
  requireAdmin(actor);
  const day = today(actor, now);
  const rows = await db
    .select()
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id))
    .orderBy(asc(s.sponsors.sortOrder), asc(s.sponsors.createdAt));
  return {
    label: actor.club.sponsorLabel,
    sponsors: rows.map((r): AdminSponsor => ({
      ...toItem(r, actor, now),
      status: statusOf(r, day),
    })),
  };
}

function checkInput(input: SponsorInput) {
  if (!SPONSOR_TIERS.includes(input.tier))
    throw new HttpError(400, 'invalid_tier', 'Unbekannte Stufe.');
  if (!SPONSOR_SCOPES.includes(input.scope))
    throw new HttpError(400, 'invalid_scope', 'Unbekannte Zuordnung.');
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn)
    throw new HttpError(400, 'invalid_range', 'Das Ende liegt vor dem Beginn.');
  if (input.linkUrl) {
    const url = (() => {
      try {
        return new URL(input.linkUrl);
      } catch {
        return null;
      }
    })();
    if (!url || url.protocol !== 'https:')
      throw new HttpError(400, 'invalid_link', 'Der Link muss mit https:// beginnen.');
  }
}

async function refs(db: Db, actor: Actor, input: SponsorInput) {
  return {
    logoRef: input.logoImageId
      ? await mediaReference(db, actor, input.logoImageId, 'sponsor')
      : undefined,
    bannerRef: input.bannerImageId
      ? await mediaReference(db, actor, input.bannerImageId, 'sponsor')
      : undefined,
  };
}

async function audit(db: Db, actor: Actor, id: string, label: string, now: Date) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'sponsors.updated',
    entityType: 'sponsor',
    entityId: id,
    data: { label },
    createdAt: now,
  });
}

export async function createSponsor(
  db: Db,
  actor: Actor,
  input: SponsorInput,
  now: Date,
): Promise<AdminSponsors> {
  requireAdmin(actor);
  checkInput(input);
  const { logoRef, bannerRef } = await refs(db, actor, input);
  const existing = await db
    .select({ id: s.sponsors.id })
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id));
  const [row] = await db
    .insert(s.sponsors)
    .values({
      clubId: actor.club.id,
      name: input.name.trim(),
      tier: input.tier,
      linkUrl: input.linkUrl ?? null,
      logoRef: logoRef ?? null,
      bannerRef: bannerRef ?? null,
      scope: input.scope,
      startsOn: input.startsOn ?? null,
      endsOn: input.endsOn ?? null,
      sortOrder: existing.length,
      createdAt: now,
    })
    .returning({ id: s.sponsors.id });
  await audit(db, actor, row!.id, `Sponsor angelegt: ${input.name.trim()}`, now);
  return listAdminSponsors(db, actor, now);
}

export async function updateSponsor(
  db: Db,
  actor: Actor,
  id: string,
  input: SponsorInput & { removeLogo?: boolean; removeBanner?: boolean },
  now: Date,
): Promise<AdminSponsors> {
  requireAdmin(actor);
  checkInput(input);
  const [row] = await db
    .select()
    .from(s.sponsors)
    .where(and(eq(s.sponsors.id, id), eq(s.sponsors.clubId, actor.club.id)));
  if (!row) throw notFound('Der Sponsor');
  const { logoRef, bannerRef } = await refs(db, actor, input);
  await db
    .update(s.sponsors)
    .set({
      name: input.name.trim(),
      tier: input.tier,
      linkUrl: input.linkUrl ?? null,
      scope: input.scope,
      startsOn: input.startsOn ?? null,
      endsOn: input.endsOn ?? null,
      ...(logoRef !== undefined ? { logoRef } : input.removeLogo ? { logoRef: null } : {}),
      ...(bannerRef !== undefined ? { bannerRef } : input.removeBanner ? { bannerRef: null } : {}),
    })
    .where(eq(s.sponsors.id, id));
  await audit(db, actor, id, `Sponsor geändert: ${input.name.trim()}`, now);
  return listAdminSponsors(db, actor, now);
}

export async function deleteSponsor(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<AdminSponsors> {
  requireAdmin(actor);
  const [row] = await db
    .select()
    .from(s.sponsors)
    .where(and(eq(s.sponsors.id, id), eq(s.sponsors.clubId, actor.club.id)));
  if (!row) throw notFound('Der Sponsor');
  await db.delete(s.sponsors).where(eq(s.sponsors.id, id));
  await audit(db, actor, id, `Sponsor gelöscht: ${row.name}`, now);
  return listAdminSponsors(db, actor, now);
}

/** Reihenfolge (Ziehen in der Verwaltung): `ids` in der gewünschten Folge. */
export async function setOrder(
  db: Db,
  actor: Actor,
  ids: string[],
  now: Date,
): Promise<AdminSponsors> {
  requireAdmin(actor);
  const rows = await db
    .select({ id: s.sponsors.id })
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id));
  const known = new Set(rows.map((r) => r.id));
  if (
    ids.length !== known.size ||
    ids.some((i) => !known.has(i)) ||
    new Set(ids).size !== ids.length
  )
    throw new HttpError(400, 'invalid_order', 'Die Reihenfolge passt nicht zu den Sponsoren.');
  for (const [index, id] of ids.entries())
    await db.update(s.sponsors).set({ sortOrder: index }).where(eq(s.sponsors.id, id));
  await audit(db, actor, actor.club.id, 'Sponsoren: Reihenfolge geändert', now);
  return listAdminSponsors(db, actor, now);
}

export async function setLabel(
  db: Db,
  actor: Actor,
  label: string,
  now: Date,
): Promise<AdminSponsors> {
  requireAdmin(actor);
  if (!(SPONSOR_LABELS as readonly string[]).includes(label))
    throw new HttpError(400, 'invalid_label', 'Unbekannte Kennzeichnung.');
  await db.update(s.clubs).set({ sponsorLabel: label }).where(eq(s.clubs.id, actor.club.id));
  await audit(db, actor, actor.club.id, `Sponsoren: Kennzeichnung „${label}“`, now);
  return {
    ...(await listAdminSponsors(
      db,
      { ...actor, club: { ...actor.club, sponsorLabel: label } },
      now,
    )),
  };
}
