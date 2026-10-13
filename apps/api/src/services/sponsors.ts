/**
 * Sponsoren-Modul (Paket SPO, umgebaut in SP2): Die Vereinsadministration pflegt Sponsoren mit Logo, Slogan,
 * Text, Link und Laufzeit und schaltet je Sponsor Werbung. Der Container in Home, Team und Verein zeigt bis zu
 * drei zufällige Sponsoren mit Werbung; die Übersicht „Unsere Sponsoren“ zeigt alle laufenden. Keine Auswertung
 * (nichts wird gezählt); Anmeldung, Kasse, Chat und Kinderdaten haben gar keinen Platz dafür.
 */
import {
  SPONSOR_AD_MAX,
  SPONSOR_LABELS,
  calendarDayOf,
  toIsoDate,
  type AdminSponsor,
  type AdminSponsors,
  type SponsorAds,
  type SponsorInput,
  type SponsorItem,
  type SponsorPage,
  type SponsorStatus,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { actorCan, moduleEnabled, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { resolveMediaUrl } from '../storage/media-links';
import { mediaReference } from './uploads';

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));

/**
 * Jugendspieler: eigenes Konto mit der Funktion Spieler in einer Mannschaft des Bereichs Jugend. Eltern und
 * Trainer zählen nicht (Eltern sehen die Werbung weiter).
 */
async function isYouthPlayer(db: Db, actor: Actor): Promise<boolean> {
  const own = actor.memberships.filter(
    (m) => m.personId === actor.person.id && m.function === 'player',
  );
  if (own.length === 0) return false;
  const units = await db
    .select({ id: s.orgUnits.id })
    .from(s.orgUnits)
    .where(
      and(
        inArray(s.orgUnits.id, [...new Set(own.map((m) => m.team.orgUnitId))]),
        eq(s.orgUnits.kind, 'youth'),
      ),
    );
  return units.length > 0;
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
  slogan: row.slogan,
  description: row.description,
  linkUrl: row.linkUrl,
  logoUrl: resolveMediaUrl(actor.links, row.logoRef, now),
  logoDarkUrl: resolveMediaUrl(actor.links, row.logoDarkRef, now),
  startsOn: row.startsOn,
  endsOn: row.endsOn,
});

/** Laufende Sponsoren des Vereins in der Reihenfolge der Verwaltung. */
async function running(db: Db, actor: Actor, now: Date) {
  if (!moduleEnabled(actor, 'sponsors')) return [];
  const day = today(actor, now);
  const rows = await db
    .select()
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id))
    .orderBy(asc(s.sponsors.sortOrder), asc(s.sponsors.createdAt));
  return rows.filter((r) => statusOf(r, day) === 'active');
}

/** Übersicht „Unsere Sponsoren“: alle laufenden Sponsoren, auch ohne Werbung. */
export async function getSponsorPage(db: Db, actor: Actor, now: Date): Promise<SponsorPage> {
  const rows = await running(db, actor, now);
  return { label: actor.club.sponsorLabel, sponsors: rows.map((r) => toItem(r, actor, now)) };
}

/** Einfacher, stabiler Mischer: gleicher Startwert → gleiche Reihenfolge (Auswahl je Sitzung). */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Inhalt des Containers: bis zu drei zufällige Sponsoren mit Werbung. Die Reihenfolge folgt dem Startwert
 * (`seed`, je App-Sitzung stabil; ohne Angabe zufällig). Jugendspieler erhalten keinen Sponsor mit gesetztem
 * Schalter „Nicht bei Jugendspielern anzeigen“. Es wird nichts gezählt.
 */
export async function getSponsorAds(
  db: Db,
  actor: Actor,
  seed: string | undefined,
  now: Date,
): Promise<SponsorAds> {
  const youth = await isYouthPlayer(db, actor);
  const rows = (await running(db, actor, now)).filter(
    (r) => r.advertise && !(youth && r.hideForYouth),
  );
  const picked = shuffled(rows, seed ?? Math.random().toString(36)).slice(0, SPONSOR_AD_MAX);
  return { label: actor.club.sponsorLabel, sponsors: picked.map((r) => toItem(r, actor, now)) };
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
  const sponsors = rows.map((r): AdminSponsor => ({
    ...toItem(r, actor, now),
    status: statusOf(r, day),
    advertise: r.advertise,
    hideForYouth: r.advertise && r.hideForYouth,
  }));
  return {
    label: actor.club.sponsorLabel,
    advertising: sponsors.filter((x) => x.advertise && x.status === 'active').length,
    sponsors,
  };
}

function checkInput(input: SponsorInput) {
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
    logoDarkRef: input.logoDarkImageId
      ? await mediaReference(db, actor, input.logoDarkImageId, 'sponsor')
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
  const { logoRef, logoDarkRef } = await refs(db, actor, input);
  const existing = await db
    .select({ id: s.sponsors.id })
    .from(s.sponsors)
    .where(eq(s.sponsors.clubId, actor.club.id));
  const [row] = await db
    .insert(s.sponsors)
    .values({
      clubId: actor.club.id,
      name: input.name.trim(),
      slogan: input.slogan?.trim() || null,
      description: input.description?.trim() || null,
      linkUrl: input.linkUrl ?? null,
      logoRef: logoRef ?? null,
      logoDarkRef: logoDarkRef ?? null,
      advertise: input.advertise,
      hideForYouth: input.advertise && input.hideForYouth,
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
  input: SponsorInput & { removeLogo?: boolean; removeLogoDark?: boolean },
  now: Date,
): Promise<AdminSponsors> {
  requireAdmin(actor);
  checkInput(input);
  const [row] = await db
    .select()
    .from(s.sponsors)
    .where(and(eq(s.sponsors.id, id), eq(s.sponsors.clubId, actor.club.id)));
  if (!row) throw notFound('Der Sponsor');
  const { logoRef, logoDarkRef } = await refs(db, actor, input);
  await db
    .update(s.sponsors)
    .set({
      name: input.name.trim(),
      slogan: input.slogan?.trim() || null,
      description: input.description?.trim() || null,
      linkUrl: input.linkUrl ?? null,
      advertise: input.advertise,
      hideForYouth: input.advertise && input.hideForYouth,
      startsOn: input.startsOn ?? null,
      endsOn: input.endsOn ?? null,
      ...(logoRef !== undefined ? { logoRef } : input.removeLogo ? { logoRef: null } : {}),
      ...(logoDarkRef !== undefined
        ? { logoDarkRef }
        : input.removeLogoDark
          ? { logoDarkRef: null }
          : {}),
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
  return listAdminSponsors(db, { ...actor, club: { ...actor.club, sponsorLabel: label } }, now);
}
