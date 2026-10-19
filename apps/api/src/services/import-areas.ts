/**
 * Einfache Import-Bereiche (Paket IM, Stufe 2): Termine einer Mannschaft, Sponsoren, Plätze und Ausrüstung.
 * Jeder Bereich liefert seine Felder, prüft die Zeilen (neu, aktualisiert, Dublette, Fehler), übernimmt sie und nimmt
 * sie wieder zurück. Die Rechte entsprechen denen der jeweiligen Verwaltung.
 */
import { at, fromIsoDate, type ImportRow } from '@clubroof/core';
import { schema as s } from '@clubroof/db';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { actorCan, moduleEnabled } from '../actor';
import { HttpError } from '../errors';
import { createTeamEvent } from './event-admin';
import { CASH_HANDLERS } from './import-cash';
import { assertFacilityFree } from './facilities';
import {
  field,
  norm,
  parseDate,
  parseTime,
  parseYesNo,
  type AreaCtx,
  type AreaHandler,
  type CheckedRow,
} from './import-common';

/** Status je nach Verhalten bei Dubletten: bekannter Eintrag → überspringen, aktualisieren oder neu anlegen */
function statusFor(mode: AreaCtx['mode'], known: boolean): ImportRow['status'] {
  if (!known) return 'new';
  return mode === 'update' ? 'update' : mode === 'create' ? 'new' : 'duplicate';
}

function httpsLink(value: string, errors: string[]): string | null {
  if (!value) return null;
  try {
    if (new URL(value).protocol === 'https:') return value;
  } catch {
    // unten gemeldet
  }
  errors.push(`Link „${value}“ muss mit https:// beginnen.`);
  return null;
}

// ── Sponsoren ───────────────────────────────────────────────────────────────

type SponsorData = {
  name: string;
  slogan: string | null;
  description: string | null;
  linkUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
  advertise: boolean | null;
  existingId: string | null;
};

const sponsors: AreaHandler<SponsorData> = {
  info: {
    label: 'Sponsoren',
    text: 'Sponsoren mit Name, Slogan, Link und Laufzeit. Logos ergänzt du danach in der Sponsorenverwaltung.',
    needsTeam: false,
    fields: [
      field('name', 'Name', 'Name des Sponsors', 'Autohaus Muster', true),
      field('slogan', 'Slogan', 'eine Zeile für den Werbecontainer', 'Wir fahren mit euch'),
      field('description', 'Beschreibung', 'Text der Detailseite', 'Seit 1990 Partner des Vereins'),
      field('linkUrl', 'Link', 'nur https://', 'https://www.example.org'),
      field('startsOn', 'Laufzeit von', 'TT.MM.JJJJ', '01.08.2026'),
      field('endsOn', 'Laufzeit bis', 'TT.MM.JJJJ', '31.07.2027'),
      field('advertise', 'Werbung in der App', 'Ja oder Nein', 'Ja'),
    ],
  },
  allowed: (actor) => moduleEnabled(actor, 'sponsors') && actorCan(actor, 'club.settings.manage'),
  async check(ctx, rows) {
    const existing = await ctx.db
      .select({ id: s.sponsors.id, name: s.sponsors.name })
      .from(s.sponsors)
      .where(eq(s.sponsors.clubId, ctx.actor.club.id));
    const byName = new Map(existing.map((e) => [norm(e.name), e]));
    const seen = new Set<string>();
    return rows.map(({ get }): CheckedRow<SponsorData> => {
      const errors: string[] = [];
      const name = get('name');
      if (!name) errors.push('Der Name fehlt.');
      if (name.length > 100) errors.push('Name ist zu lang.');
      const startsOn = parseDate(get('startsOn'));
      if (startsOn === undefined) errors.push(`Laufzeit von „${get('startsOn')}“ ist ungültig.`);
      const endsOn = parseDate(get('endsOn'));
      if (endsOn === undefined) errors.push(`Laufzeit bis „${get('endsOn')}“ ist ungültig.`);
      if (startsOn && endsOn && endsOn < startsOn) errors.push('Das Ende liegt vor dem Beginn.');
      const linkUrl = httpsLink(get('linkUrl'), errors);
      const advertise = get('advertise') === '' ? null : parseYesNo(get('advertise'));
      if (advertise === undefined) errors.push(`„${get('advertise')}“ ist weder Ja noch Nein.`);
      const known = byName.get(norm(name)) ?? null;
      const inFile = !!name && seen.has(norm(name));
      let status = inFile ? 'duplicate' : statusFor(ctx.mode, !!known);
      if (errors.length) status = 'error';
      seen.add(norm(name));
      return {
        status,
        errors,
        warnings: [],
        match: inFile ? 'weiter oben in der Datei' : (known?.name ?? null),
        data: {
          name,
          slogan: get('slogan') || null,
          description: get('description') || null,
          linkUrl,
          startsOn: startsOn ?? null,
          endsOn: endsOn ?? null,
          advertise: advertise ?? null,
          existingId: known?.id ?? null,
        },
      };
    });
  },
  async commit(ctx, rows) {
    const createdIds: string[] = [];
    const updated: { id: string; before: Record<string, unknown> }[] = [];
    await ctx.db.transaction(async (tx) => {
      const count = (
        await tx
          .select({ id: s.sponsors.id })
          .from(s.sponsors)
          .where(eq(s.sponsors.clubId, ctx.actor.club.id))
      ).length;
      for (const { status, data } of rows) {
        if (status === 'update' && data.existingId) {
          const [row] = await tx
            .select()
            .from(s.sponsors)
            .where(eq(s.sponsors.id, data.existingId));
          if (!row) continue;
          const patch: Partial<typeof s.sponsors.$inferInsert> = {};
          const before: Record<string, unknown> = {};
          const set = <K extends keyof typeof row & keyof typeof s.sponsors.$inferInsert>(
            key: K,
            value: (typeof row)[K] | null,
          ) => {
            if (value !== null && value !== row[key]) {
              before[key] = row[key];
              (patch as Record<string, unknown>)[key] = value;
            }
          };
          set('slogan', data.slogan);
          set('description', data.description);
          set('linkUrl', data.linkUrl);
          set('startsOn', data.startsOn);
          set('endsOn', data.endsOn);
          set('advertise', data.advertise);
          if (Object.keys(patch).length) {
            await tx.update(s.sponsors).set(patch).where(eq(s.sponsors.id, row.id));
            updated.push({ id: row.id, before });
          }
        } else {
          const [row] = await tx
            .insert(s.sponsors)
            .values({
              clubId: ctx.actor.club.id,
              name: data.name,
              slogan: data.slogan,
              description: data.description,
              linkUrl: data.linkUrl,
              advertise: data.advertise ?? false,
              startsOn: data.startsOn,
              endsOn: data.endsOn,
              sortOrder: count + createdIds.length,
              createdAt: ctx.now,
            })
            .returning({ id: s.sponsors.id });
          createdIds.push(row!.id);
        }
      }
    });
    return {
      created: createdIds.length,
      updated: rows.filter((r) => r.status === 'update').length,
      payload: { createdIds, updated },
    };
  },
  async undo(ctx, payload) {
    const p = payload as { createdIds: string[]; updated: { id: string; before: object }[] };
    await ctx.db.transaction(async (tx) => {
      for (const u of p.updated)
        await tx.update(s.sponsors).set(u.before).where(eq(s.sponsors.id, u.id));
      if (p.createdIds.length)
        await tx.delete(s.sponsors).where(inArray(s.sponsors.id, p.createdIds));
    });
  },
};

// ── Plätze ──────────────────────────────────────────────────────────────────

type FacilityKind = (typeof s.facilities.$inferInsert)['kind'];
const KINDS: Record<string, FacilityKind> = {
  rasenplatz: 'grass_pitch',
  rasen: 'grass_pitch',
  kunstrasen: 'artificial_pitch',
  kunstrasenplatz: 'artificial_pitch',
  hartplatz: 'hard_pitch',
  tennenplatz: 'hard_pitch',
  asche: 'hard_pitch',
  halle: 'hall',
  sporthalle: 'hall',
  vereinsheim: 'clubhouse',
  heim: 'clubhouse',
  kabine: 'changing_room',
  umkleide: 'changing_room',
  sonstiges: 'other',
};

type FacilityData = {
  name: string;
  shortName: string | null;
  kind: FacilityKind | null;
  address: string | null;
  venue: string | null;
  existingId: string | null;
};

const facilities: AreaHandler<FacilityData> = {
  info: {
    label: 'Plätze und Räume',
    text: 'Plätze, Hallen, Vereinsheim und Kabinen, optional einer Spielstätte zugeordnet.',
    needsTeam: false,
    fields: [
      field('name', 'Name', 'Bezeichnung des Platzes', 'Rasenplatz 1', true),
      field('shortName', 'Kürzel', 'kurz, für den Belegungsplan', 'RP1'),
      field(
        'kind',
        'Art',
        'Rasenplatz, Kunstrasen, Hartplatz, Halle, Vereinsheim, Kabine oder Sonstiges',
        'Rasenplatz',
      ),
      field('address', 'Adresse', 'für die Route', 'Sportweg 1, 12345 Musterstadt'),
      field(
        'venue',
        'Spielstätte',
        'wird angelegt, wenn es sie noch nicht gibt',
        'Sportanlage Nord',
      ),
    ],
  },
  allowed: (actor) => actorCan(actor, 'facilities.manage'),
  async check(ctx, rows) {
    const existing = await ctx.db
      .select({ id: s.facilities.id, name: s.facilities.name })
      .from(s.facilities)
      .where(eq(s.facilities.clubId, ctx.actor.club.id));
    const byName = new Map(existing.map((e) => [norm(e.name), e]));
    const venues = await ctx.db
      .select({ name: s.venues.name })
      .from(s.venues)
      .where(eq(s.venues.clubId, ctx.actor.club.id));
    const venueNames = new Set(venues.map((v) => norm(v.name)));
    const seen = new Set<string>();
    return rows.map(({ get }): CheckedRow<FacilityData> => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const name = get('name');
      if (!name) errors.push('Der Name fehlt.');
      if (name.length > 80) errors.push('Name ist zu lang.');
      const kindText = get('kind');
      let kind: FacilityKind | null = kindText ? (KINDS[norm(kindText)] ?? null) : null;
      if (kindText && !kind) errors.push(`Art „${kindText}“ ist unbekannt.`);
      if (!kindText) warnings.push('Art fehlt – wird als „Sonstiges“ angelegt.');
      if (!kindText) kind = 'other';
      const venue = get('venue') || null;
      if (venue && !venueNames.has(norm(venue)))
        warnings.push(`Spielstätte „${venue}“ wird neu angelegt.`);
      const known = byName.get(norm(name)) ?? null;
      const inFile = !!name && seen.has(norm(name));
      let status = inFile ? 'duplicate' : statusFor(ctx.mode, !!known);
      if (errors.length) status = 'error';
      seen.add(norm(name));
      return {
        status,
        errors,
        warnings,
        match: inFile ? 'weiter oben in der Datei' : (known?.name ?? null),
        data: {
          name,
          shortName: get('shortName') || null,
          kind: kindText ? kind : null,
          address: get('address') || null,
          venue,
          existingId: known?.id ?? null,
        },
      };
    });
  },
  async commit(ctx, rows) {
    const createdIds: string[] = [];
    const createdVenueIds: string[] = [];
    const updated: { id: string; before: Record<string, unknown> }[] = [];
    await ctx.db.transaction(async (tx) => {
      const venues = new Map(
        (
          await tx
            .select({ id: s.venues.id, name: s.venues.name })
            .from(s.venues)
            .where(eq(s.venues.clubId, ctx.actor.club.id))
        ).map((v) => [norm(v.name), v.id]),
      );
      const venueFor = async (name: string | null) => {
        if (!name) return null;
        let id = venues.get(norm(name));
        if (!id) {
          const [row] = await tx
            .insert(s.venues)
            .values({ clubId: ctx.actor.club.id, name, sortOrder: venues.size })
            .returning({ id: s.venues.id });
          id = row!.id;
          venues.set(norm(name), id);
          createdVenueIds.push(id);
        }
        return id;
      };
      const count = (
        await tx
          .select({ id: s.facilities.id })
          .from(s.facilities)
          .where(eq(s.facilities.clubId, ctx.actor.club.id))
      ).length;
      for (const { status, data } of rows) {
        if (status === 'update' && data.existingId) {
          const [row] = await tx
            .select()
            .from(s.facilities)
            .where(eq(s.facilities.id, data.existingId));
          if (!row) continue;
          const patch: Partial<typeof s.facilities.$inferInsert> = {};
          const before: Record<string, unknown> = {};
          const venueId = await venueFor(data.venue);
          const set = (key: 'shortName' | 'kind' | 'address' | 'venueId', value: unknown) => {
            if (value !== null && value !== undefined && value !== row[key]) {
              before[key] = row[key];
              (patch as Record<string, unknown>)[key] = value;
            }
          };
          set('shortName', data.shortName);
          set('kind', data.kind);
          set('address', data.address);
          set('venueId', venueId);
          if (Object.keys(patch).length) {
            await tx.update(s.facilities).set(patch).where(eq(s.facilities.id, row.id));
            updated.push({ id: row.id, before });
          }
        } else {
          const [row] = await tx
            .insert(s.facilities)
            .values({
              clubId: ctx.actor.club.id,
              name: data.name,
              shortName: data.shortName,
              kind: data.kind ?? 'other',
              address: data.address,
              venueId: await venueFor(data.venue),
              sortOrder: count + createdIds.length,
            })
            .returning({ id: s.facilities.id });
          createdIds.push(row!.id);
        }
      }
    });
    return {
      created: createdIds.length,
      updated: rows.filter((r) => r.status === 'update').length,
      payload: { createdIds, createdVenueIds, updated },
    };
  },
  async undo(ctx, payload) {
    const p = payload as {
      createdIds: string[];
      createdVenueIds: string[];
      updated: { id: string; before: object }[];
    };
    await ctx.db.transaction(async (tx) => {
      for (const u of p.updated)
        await tx.update(s.facilities).set(u.before).where(eq(s.facilities.id, u.id));
      if (p.createdIds.length)
        await tx.delete(s.facilities).where(inArray(s.facilities.id, p.createdIds));
      if (p.createdVenueIds.length)
        await tx.delete(s.venues).where(inArray(s.venues.id, p.createdVenueIds));
    });
  },
};

// ── Ausrüstung ──────────────────────────────────────────────────────────────

type EquipmentData = {
  kind: 'material' | 'key';
  name: string;
  quantity: number | null;
  location: string | null;
  note: string | null;
  existingId: string | null;
};

const equipment: AreaHandler<EquipmentData> = {
  info: {
    label: 'Ausrüstung (Material und Schlüssel)',
    text: 'Material und Schlüssel mit Anzahl und Lagerort. Ausgabe an Personen erfolgt später in „Anlage & Material“.',
    needsTeam: false,
    fields: [
      field('kind', 'Art', 'Material oder Schlüssel (Standard: Material)', 'Material'),
      field('name', 'Bezeichnung', 'Name des Gegenstands', 'Ballsack', true),
      field('quantity', 'Anzahl', 'ganze Zahl, Standard 1', '3'),
      field('location', 'Lagerort', 'wo es liegt', 'Geräteraum'),
      field('note', 'Notiz', 'frei', 'Größe 5'),
    ],
  },
  allowed: (actor) => moduleEnabled(actor, 'equipment') && actorCan(actor, 'facilities.manage'),
  async check(ctx, rows) {
    const existing = await ctx.db
      .select({ id: s.equipmentItems.id, name: s.equipmentItems.name, kind: s.equipmentItems.kind })
      .from(s.equipmentItems)
      .where(eq(s.equipmentItems.clubId, ctx.actor.club.id));
    const key = (kind: string, name: string) => `${kind}|${norm(name)}`;
    const byKey = new Map(existing.map((e) => [key(e.kind, e.name), e]));
    const seen = new Set<string>();
    return rows.map(({ get }): CheckedRow<EquipmentData> => {
      const errors: string[] = [];
      const kindText = norm(get('kind'));
      const kind: 'material' | 'key' | null =
        kindText === '' || kindText === 'material'
          ? 'material'
          : kindText === 'schluessel' || kindText === 'key'
            ? 'key'
            : null;
      if (!kind) errors.push(`Art „${get('kind')}“ ist unbekannt (Material oder Schlüssel).`);
      const name = get('name');
      if (!name) errors.push('Die Bezeichnung fehlt.');
      if (name.length > 100) errors.push('Bezeichnung ist zu lang.');
      const qText = get('quantity');
      const quantity = qText ? Number(qText.replace(',', '.')) : null;
      if (qText && (!Number.isInteger(quantity) || quantity! < 0 || quantity! > 99999))
        errors.push(`Anzahl „${qText}“ muss eine ganze Zahl sein.`);
      const k = key(kind ?? 'material', name);
      const known = byKey.get(k) ?? null;
      const inFile = !!name && seen.has(k);
      let status = inFile ? 'duplicate' : statusFor(ctx.mode, !!known);
      if (errors.length) status = 'error';
      seen.add(k);
      return {
        status,
        errors,
        warnings: [],
        match: inFile ? 'weiter oben in der Datei' : (known?.name ?? null),
        data: {
          kind: kind ?? 'material',
          name,
          quantity: errors.some((m) => m.startsWith('Anzahl')) ? null : quantity,
          location: get('location') || null,
          note: get('note') || null,
          existingId: known?.id ?? null,
        },
      };
    });
  },
  async commit(ctx, rows) {
    const createdIds: string[] = [];
    const updated: { id: string; before: Record<string, unknown> }[] = [];
    await ctx.db.transaction(async (tx) => {
      for (const { status, data } of rows) {
        if (status === 'update' && data.existingId) {
          const [row] = await tx
            .select()
            .from(s.equipmentItems)
            .where(eq(s.equipmentItems.id, data.existingId));
          if (!row) continue;
          const patch: Partial<typeof s.equipmentItems.$inferInsert> = {};
          const before: Record<string, unknown> = {};
          const set = (key: 'quantity' | 'location' | 'note', value: unknown) => {
            if (value !== null && value !== row[key]) {
              before[key] = row[key];
              (patch as Record<string, unknown>)[key] = value;
            }
          };
          set('quantity', data.quantity);
          set('location', data.location);
          set('note', data.note);
          if (Object.keys(patch).length) {
            await tx.update(s.equipmentItems).set(patch).where(eq(s.equipmentItems.id, row.id));
            updated.push({ id: row.id, before });
          }
        } else {
          const [row] = await tx
            .insert(s.equipmentItems)
            .values({
              clubId: ctx.actor.club.id,
              kind: data.kind,
              name: data.name,
              quantity: data.quantity ?? 1,
              location: data.location,
              note: data.note,
              createdAt: ctx.now,
            })
            .returning({ id: s.equipmentItems.id });
          createdIds.push(row!.id);
        }
      }
    });
    return {
      created: createdIds.length,
      updated: rows.filter((r) => r.status === 'update').length,
      payload: { createdIds, updated },
    };
  },
  async undo(ctx, payload) {
    const p = payload as { createdIds: string[]; updated: { id: string; before: object }[] };
    await ctx.db.transaction(async (tx) => {
      for (const u of p.updated)
        await tx.update(s.equipmentItems).set(u.before).where(eq(s.equipmentItems.id, u.id));
      if (p.createdIds.length)
        await tx.delete(s.equipmentItems).where(inArray(s.equipmentItems.id, p.createdIds));
    });
  },
};

// ── Termine einer Mannschaft ────────────────────────────────────────────────

type EventData = {
  type: 'training' | 'match' | 'team_event';
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  opponent: string | null;
  isHome: boolean | null;
  facilityId: string | null;
  locationText: string | null;
};

const EVENT_TYPES: Record<string, EventData['type']> = {
  training: 'training',
  trainingseinheit: 'training',
  spiel: 'match',
  match: 'match',
  punktspiel: 'match',
  testspiel: 'match',
  pokalspiel: 'match',
  teamevent: 'team_event',
  mannschaftstermin: 'team_event',
  termin: 'team_event',
  veranstaltung: 'team_event',
};

const events: AreaHandler<EventData> = {
  info: {
    label: 'Termine einer Mannschaft',
    text: 'Trainingsplan, Spielplan oder Termine der Mannschaft mit Datum, Uhrzeit und Platz. Die DFBnet-Datei importierst du weiter unter „Spielplan-Import“.',
    needsTeam: true,
    fields: [
      field('date', 'Datum', 'TT.MM.JJJJ', '24.10.2026', true),
      field('start', 'Beginn', 'HH:MM', '18:00', true),
      field('end', 'Ende', 'HH:MM, sonst Standarddauer', '19:30'),
      field('type', 'Art', 'Training (Standard), Spiel oder Termin', 'Training'),
      field('title', 'Titel', 'bei Terminen Pflicht, sonst automatisch', ''),
      field('opponent', 'Gegner', 'bei Spielen Pflicht', 'FSV Kleefeld'),
      field('home', 'Heim/Auswärts', 'Heim (Standard) oder Auswärts', 'Heim'),
      field('place', 'Platz', 'Name oder Kürzel eines Platzes, sonst Ortsangabe', 'Rasenplatz 1'),
    ],
  },
  allowed: (actor, teams) => teams.some((t) => actorCan(actor, 'events.manage', t)),
  allowedForTeam: (actor, team) => actorCan(actor, 'events.manage', team),
  async check(ctx, rows) {
    const team = ctx.team!;
    const tz = ctx.actor.club.timezone;
    const places = await ctx.db
      .select({ id: s.facilities.id, name: s.facilities.name, shortName: s.facilities.shortName })
      .from(s.facilities)
      .where(eq(s.facilities.clubId, ctx.actor.club.id));
    const placeOf = (v: string) => {
      const n = norm(v);
      return places.find((p) => norm(p.name) === n || (p.shortName && norm(p.shortName) === n));
    };
    // Vorhandene Termine der Mannschaft im Zeitraum der Datei (zur Dublettenprüfung)
    const days = rows
      .map((r) => parseDate(r.get('date')))
      .filter((d): d is string => !!d)
      .sort();
    const existing = days.length
      ? await ctx.db
          .select({ startsAt: s.events.startsAt, type: s.events.type })
          .from(s.events)
          .where(
            and(
              eq(s.events.teamId, team.id),
              eq(s.events.status, 'scheduled'),
              gte(s.events.startsAt, new Date(fromIsoDate(days[0]!).getTime() - 2 * 86400000)),
              lte(
                s.events.startsAt,
                new Date(fromIsoDate(days[days.length - 1]!).getTime() + 3 * 86400000),
              ),
            ),
          )
      : [];
    const keyOf = (ms: number, type: string) => `${ms}|${type}`;
    const known = new Set(existing.map((e) => keyOf(e.startsAt.getTime(), e.type)));
    const seen = new Set<string>();
    const out: CheckedRow<EventData>[] = [];
    for (const { get } of rows) {
      const errors: string[] = [];
      const warnings: string[] = [];
      const date = parseDate(get('date'));
      if (date === null) errors.push('Das Datum fehlt.');
      if (date === undefined) errors.push(`Datum „${get('date')}“ ist ungültig.`);
      const start = parseTime(get('start'));
      if (start === null) errors.push('Der Beginn fehlt.');
      if (start === undefined) errors.push(`Beginn „${get('start')}“ ist ungültig.`);
      const end = parseTime(get('end'));
      if (end === undefined) errors.push(`Ende „${get('end')}“ ist ungültig.`);
      const typeText = get('type');
      const type = typeText ? (EVENT_TYPES[norm(typeText)] ?? null) : 'training';
      if (!type) errors.push(`Art „${typeText}“ ist unbekannt (Training, Spiel oder Termin).`);
      const title = get('title') || null;
      const opponent = get('opponent') || null;
      if (type === 'match' && !opponent) errors.push('Bei Spielen fehlt der Gegner.');
      if (type === 'team_event' && !title) errors.push('Bei Terminen fehlt der Titel.');
      const homeText = norm(get('home'));
      const isHome =
        homeText === '' || ['heim', 'h', 'ja'].includes(homeText)
          ? true
          : ['auswaerts', 'a', 'gast', 'nein'].includes(homeText)
            ? false
            : null;
      if (isHome === null) errors.push(`„${get('home')}“ ist weder Heim noch Auswärts.`);
      const placeText = get('place');
      const place = placeText ? placeOf(placeText) : undefined;
      if (placeText && !place)
        warnings.push(`Platz „${placeText}“ ist unbekannt – als Ortsangabe übernommen.`);

      let startsAt = '';
      let endsAt: string | null = null;
      if (date && start && !errors.length) {
        const day = fromIsoDate(date);
        const s0 = at(day, start, tz);
        startsAt = s0.toISOString();
        if (end) {
          const e0 = at(day, end, tz);
          if (e0 <= s0) errors.push('Das Ende muss nach dem Beginn liegen.');
          else endsAt = e0.toISOString();
        }
        if (s0.getTime() < ctx.now.getTime() - 24 * 3600_000)
          errors.push('Der Termin liegt in der Vergangenheit.');
        if (!errors.length && place) {
          try {
            await assertFacilityFree(
              ctx.db,
              ctx.actor,
              place.id,
              s0,
              endsAt ? new Date(endsAt) : new Date(s0.getTime() + 90 * 60_000),
              false,
            );
          } catch (e) {
            errors.push(e instanceof HttpError ? e.message : 'Der Platz ist belegt.');
          }
        }
      }
      let status: ImportRow['status'] = 'new';
      let match: string | null = null;
      if (startsAt && type) {
        const k = keyOf(new Date(startsAt).getTime(), type);
        if (known.has(k)) {
          status = 'duplicate';
          match = 'Termin gibt es schon';
        } else if (seen.has(k)) {
          status = 'duplicate';
          match = 'weiter oben in der Datei';
        }
        seen.add(k);
      }
      if (errors.length) status = 'error';
      out.push({
        status,
        errors,
        warnings,
        match,
        data: {
          type: type ?? 'training',
          title,
          startsAt,
          endsAt,
          opponent,
          isHome,
          facilityId: place?.id ?? null,
          locationText: !place && placeText ? placeText : null,
        },
      });
    }
    return out;
  },
  async commit(ctx, rows, runId) {
    const team = ctx.team!;
    let created = 0;
    try {
      for (const { status, data } of rows) {
        if (status !== 'new') continue;
        await createTeamEvent(
          ctx.db,
          ctx.actor,
          team.id,
          {
            type: data.type,
            title: data.title,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            facilityId: data.facilityId,
            locationText: data.locationText,
            opponentName: data.opponent,
            isHome: data.isHome,
          },
          ctx.now,
          { silent: true, importBatchId: runId },
        );
        created++;
      }
    } catch (e) {
      // alles oder nichts: bereits angelegte Termine dieses Laufs wieder entfernen
      await ctx.db
        .delete(s.events)
        .where(and(eq(s.events.clubId, ctx.actor.club.id), eq(s.events.importBatchId, runId)));
      throw e;
    }
    return { created, updated: 0, payload: { batchId: runId } };
  },
  async undo(ctx, payload) {
    const batchId = (payload as { batchId: string }).batchId;
    const rows = await ctx.db
      .select({
        id: s.events.id,
        report: s.matchDetails.reportCompletedAt,
        lineup: s.matchDetails.lineupPublishedAt,
      })
      .from(s.events)
      .leftJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
      .where(and(eq(s.events.clubId, ctx.actor.club.id), eq(s.events.importBatchId, batchId)));
    // Spiele mit Bericht oder veröffentlichter Aufstellung bleiben erhalten
    const removable = rows.filter((r) => !r.report && !r.lineup).map((r) => r.id);
    if (removable.length) await ctx.db.delete(s.events).where(inArray(s.events.id, removable));
  },
};

export const AREA_HANDLERS = { events, sponsors, facilities, equipment, ...CASH_HANDLERS } as const;
export type SimpleArea = keyof typeof AREA_HANDLERS;
export const isSimpleArea = (area: string): area is SimpleArea => area in AREA_HANDLERS;
export const handlerFor = (area: SimpleArea): AreaHandler<unknown> =>
  AREA_HANDLERS[area] as AreaHandler<unknown>;
