/**
 * Import-Assistent (Paket IM): ein einheitlicher Ablauf für alle Bereiche. Datei lesen (CSV oder Excel), Spalten den
 * Feldern des Bereichs zuordnen, jede Zeile prüfen (neu, aktualisiert, Dublette, Fehler), nach Wahl des Verhaltens bei
 * Dubletten alles oder nichts übernehmen und den Lauf protokollieren. Rückgängig geht 24 Stunden lang.
 *
 * Vorschau und Übernahme durchlaufen dieselbe Prüfung (`prepare`); übernommen wird nur, was die Vorschau zeigt.
 * Stufe 1: Mitglieder und Kader einer Mannschaft. Weitere Bereiche ergänzen nur eine `AreaSpec` und eine `commit`-Funktion.
 */
import {
  IMPORT_AREAS,
  calendarDayOf,
  toIsoDate,
  type ImportArea,
  type ImportAreaInfo,
  type ImportAreasResponse,
  type ImportDuplicateMode,
  type ImportField,
  type ImportPreview,
  type ImportRequest,
  type ImportRow,
  type ImportRunInfo,
  type TeamFunction,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden } from '../errors';
import { currentTeams, defaultContactVisibility, syncFutureParticipation } from './admin';
import { AREA_HANDLERS, handlerFor, isSimpleArea } from './import-areas';
import {
  EMAIL,
  field,
  germanDate,
  norm,
  parseDate,
  type AreaCtx,
  type CheckedRow,
  type Tx,
} from './import-common';
import { MAX_FILE_BYTES, MAX_IMPORT_LINES, readTableFile } from './table-file';

type TeamRow = typeof s.teams.$inferSelect;

const UNDO_HOURS = 24;

const MEMBER_FIELDS: ImportField[] = [
  field('firstName', 'Vorname', 'Rufname', 'Max', true),
  field('lastName', 'Nachname', 'Familienname', 'Mustermann', true),
  field('birthDate', 'Geburtsdatum', 'TT.MM.JJJJ', '14.05.2011'),
  field('email', 'E-Mail', 'für Einladung und Dublettenprüfung', 'eltern.mustermann@example.org'),
  field('phone', 'Telefon', 'beliebiges Format', '0170 1234567'),
  field('memberNumber', 'Mitgliedsnummer', 'eindeutig im Verein', '1234'),
  field('memberSince', 'Eintrittsdatum', 'TT.MM.JJJJ', '01.08.2026'),
  field('team', 'Mannschaft', 'Kürzel oder Name, z. B. C1', 'C1'),
  field('function', 'Funktion', 'Spieler, Trainer, Co-Trainer oder Betreuer', 'Spieler'),
  field('jerseyNumber', 'Rückennummer', 'Zahl von 1 bis 99', '7'),
  field(
    'parentOf',
    'Elternteil von',
    'Name des Kindes („Vorname Nachname“) oder dessen Mitgliedsnummer',
    'Max Mustermann',
  ),
];

const ROSTER_FIELDS: ImportField[] = [
  field('firstName', 'Vorname', 'Rufname', 'Max', true),
  field('lastName', 'Nachname', 'Familienname', 'Mustermann', true),
  field(
    'birthDate',
    'Geburtsdatum',
    'TT.MM.JJJJ, hilft beim Abgleich mit der Vereinsliste',
    '14.05.2011',
  ),
  field('memberNumber', 'Mitgliedsnummer', 'hilft beim Abgleich mit der Vereinsliste', '1234'),
  field(
    'email',
    'E-Mail',
    'hilft beim Abgleich mit der Vereinsliste',
    'eltern.mustermann@example.org',
  ),
  field(
    'function',
    'Funktion',
    'Spieler (Standard), Co-Trainer oder Betreuer; Trainer nur durch die Vereinsverwaltung',
    'Spieler',
  ),
  field('jerseyNumber', 'Rückennummer', 'Zahl von 1 bis 99', '7'),
  field('position', 'Position', 'frei, z. B. Torwart, Abwehr, Sturm', 'Abwehr'),
];

/** Weitere Überschriften je Bereich (klein, ohne Sonderzeichen → Feld) neben Feldname und Schlüssel */
const ALIASES: Partial<Record<ImportArea, Record<string, string>>> = {
  events: {
    datum: 'date',
    tag: 'date',
    beginn: 'start',
    uhrzeit: 'start',
    anpfiff: 'start',
    startzeit: 'start',
    ende: 'end',
    endzeit: 'end',
    art: 'type',
    typ: 'type',
    titel: 'title',
    gegner: 'opponent',
    heimauswaerts: 'home',
    heim: 'home',
    ort: 'place',
    spielort: 'place',
  },
  sponsors: {
    link: 'linkUrl',
    webseite: 'linkUrl',
    homepage: 'linkUrl',
    von: 'startsOn',
    laufzeitvon: 'startsOn',
    bis: 'endsOn',
    laufzeitbis: 'endsOn',
    werbung: 'advertise',
    werbunginderapp: 'advertise',
  },
  facilities: {
    art: 'kind',
    typ: 'kind',
    kuerzel: 'shortName',
    spielstaette: 'venue',
    anlage: 'venue',
  },
  equipment: {
    art: 'kind',
    typ: 'kind',
    bezeichnung: 'name',
    gegenstand: 'name',
    menge: 'quantity',
    bestand: 'quantity',
    ort: 'location',
    lager: 'location',
    notiz: 'note',
  },
};

/** Spaltenüberschrift (klein, ohne Sonderzeichen) → Feld; gilt für Mitglieder und Kader, zählt nur bei vorhandenem Feld */
const HEADERS: Record<string, string> = {
  vorname: 'firstName',
  rufname: 'firstName',
  nachname: 'lastName',
  name: 'lastName',
  familienname: 'lastName',
  geburtsdatum: 'birthDate',
  geboren: 'birthDate',
  geburtstag: 'birthDate',
  email: 'email',
  mail: 'email',
  emailadresse: 'email',
  telefon: 'phone',
  handy: 'phone',
  mobil: 'phone',
  telefonnummer: 'phone',
  mitgliedsnummer: 'memberNumber',
  mitgliedsnr: 'memberNumber',
  mitgliednr: 'memberNumber',
  eintritt: 'memberSince',
  eintrittsdatum: 'memberSince',
  mitgliedseit: 'memberSince',
  mannschaft: 'team',
  team: 'team',
  funktion: 'function',
  rolle: 'function',
  rueckennummer: 'jerseyNumber',
  trikotnummer: 'jerseyNumber',
  nummer: 'jerseyNumber',
  nr: 'jerseyNumber',
  position: 'position',
  elternteilvon: 'parentOf',
  elternvon: 'parentOf',
  erziehungsberechtigtervon: 'parentOf',
};

const FUNCTIONS: Record<string, TeamFunction> = {
  spieler: 'player',
  spielerin: 'player',
  trainer: 'coach',
  trainerin: 'coach',
  cotrainer: 'assistant_coach',
  cotrainerin: 'assistant_coach',
  betreuer: 'team_manager',
  betreuerin: 'team_manager',
  teammanager: 'team_manager',
};

const AREAS: Record<ImportArea, Omit<ImportAreaInfo, 'area'>> = {
  members: {
    label: 'Mitglieder',
    text: 'Stammdaten, Mannschaft, Funktion, Rückennummer und Eltern. Neue Mitglieder werden angelegt.',
    needsTeam: false,
    fields: MEMBER_FIELDS,
  },
  roster: {
    label: 'Kader einer Mannschaft',
    text: 'Spieler und Betreuer einer Mannschaft mit Nummer und Position; vorhandene Mitglieder werden aus der Vereinsliste erkannt.',
    needsTeam: true,
    fields: ROSTER_FIELDS,
  },
  events: AREA_HANDLERS.events.info,
  sponsors: AREA_HANDLERS.sponsors.info,
  facilities: AREA_HANDLERS.facilities.info,
  equipment: AREA_HANDLERS.equipment.info,
  fee_types: AREA_HANDLERS.fee_types.info,
  fee_assignments: AREA_HANDLERS.fee_assignments.info,
  fee_dues: AREA_HANDLERS.fee_dues.info,
  budget: AREA_HANDLERS.budget.info,
  cash_entries: AREA_HANDLERS.cash_entries.info,
};

// ── Rechte ──────────────────────────────────────────────────────────────────

/** Kader darf importieren, wer den Kader der Mannschaft pflegt (Trainerteam) oder Mitglieder verwaltet. */
const canRoster = (actor: Actor, team: TeamRow) =>
  actorCan(actor, 'squad.manage', team) || actorCan(actor, 'members.manage');

/** Darf der Nutzer in diesem Bereich importieren (bei Bereichen mit Mannschaft: für diese Mannschaft)? */
function canArea(actor: Actor, area: ImportArea, teams: TeamRow[], team: TeamRow | null): boolean {
  if (area === 'members') return actorCan(actor, 'members.manage');
  if (area === 'roster')
    return team ? canRoster(actor, team) : teams.some((t) => canRoster(actor, t));
  const handler = handlerFor(area);
  if (handler.info.needsTeam)
    return team
      ? !!handler.allowedForTeam?.(actor, team)
      : teams.some((t) => handler.allowedForTeam?.(actor, t));
  return handler.allowed(actor, teams);
}

const DENIED: Record<ImportArea, string> = {
  members: 'Mitglieder importiert nur die Mitgliederverwaltung.',
  roster: 'Den Kader bearbeitet nur das Trainerteam der Mannschaft.',
  events: 'Termine dürfen nur Verantwortliche der Mannschaft anlegen.',
  sponsors: 'Sponsoren pflegt die Vereinsadministration.',
  facilities: 'Plätze verwalten die Platzverantwortlichen.',
  equipment: 'Material und Schlüssel verwalten die Platzverantwortlichen.',
  fee_types: 'Die Vereinskasse führt nur die Kassenführung.',
  fee_assignments: 'Die Vereinskasse führt nur die Kassenführung.',
  fee_dues: 'Die Vereinskasse führt nur die Kassenführung.',
  budget: 'Die Vereinskasse führt nur die Kassenführung.',
  cash_entries: 'Die Vereinskasse führt nur die Kassenführung.',
};

export async function listImportAreas(db: Db, actor: Actor): Promise<ImportAreasResponse> {
  const all = await currentTeams(db, actor);
  const areas: ImportAreaInfo[] = [];
  const usable = new Set<string>();
  for (const area of IMPORT_AREAS) {
    if (!canArea(actor, area, all, null)) continue;
    const info = AREAS[area];
    if (info.needsTeam) {
      const ids = all.filter((t) => canArea(actor, area, all, t)).map((t) => t.id);
      ids.forEach((id) => usable.add(id));
      areas.push({ area, ...info, teamIds: ids });
    } else areas.push({ area, ...info });
  }
  return {
    areas,
    teams: all
      .filter((t) => usable.has(t.id))
      .map((t) => ({ id: t.id, badge: t.badge, name: t.name })),
    maxRows: MAX_IMPORT_LINES,
    maxBytes: MAX_FILE_BYTES,
  };
}

// ── Vorlagen ────────────────────────────────────────────────────────────────

/** Zeilen für Vorlage: Blatt „Vorlage“ mit Kopf und Beispielzeile, Blatt „Erklärung“ mit Spalten und Hinweisen. */
export function templateRows(area: ImportArea) {
  const fields = AREAS[area].fields;
  return {
    sheet: [fields.map((f) => f.label), fields.map((f) => f.example)],
    explanation: [
      ['Spalte', 'Pflicht', 'Hinweis', 'Beispiel'],
      ...fields.map((f) => [f.label, f.required ? 'ja' : 'nein', f.hint, f.example]),
    ],
  };
}

// ── Prüfung ─────────────────────────────────────────────────────────────────

type Existing = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  memberSince: string | null;
  position: string | null;
  userId: string | null;
};

type Membership = {
  id: string;
  teamId: string;
  personId: string;
  function: TeamFunction;
  jerseyNumber: number | null;
  isPrimaryTeam: boolean;
};

type Parsed = {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  memberSince: string | null;
  position: string | null;
  team: TeamRow | null;
  fn: TeamFunction | null;
  jerseyNumber: number | null;
  parentOf: string;
};

type PreparedRow = {
  row: ImportRow;
  parsed: Parsed;
  /** Bestehende Person bei update */
  existing: Existing | null;
  /** Neue Funktion/Mannschaft muss angelegt werden */
  addMembership: boolean;
  /** Bestehende Mitgliedschaft, deren Nummer aktualisiert wird */
  updateMembership: Membership | null;
};

type Prepared = {
  info: ImportPreview;
  rows: PreparedRow[];
  teams: TeamRow[];
  today: string;
  persons: Existing[];
  memberships: Membership[];
  fixedTeam: TeamRow | null;
  /** Einfache Bereiche (Termine, Sponsoren, Plätze, Ausrüstung): Prüfergebnis und Kontext */
  simple: { ctx: AreaCtx; checked: CheckedRow<unknown>[]; lines: number[] } | null;
};

const keysOf = (p: {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  memberNumber: string | null;
}) =>
  [
    p.memberNumber ? `nr:${norm(p.memberNumber)}` : null,
    p.email ? `mail:${p.email.toLowerCase()}` : null,
    p.birthDate ? `name:${norm(p.firstName)}|${norm(p.lastName)}|${p.birthDate}` : null,
  ].filter((k): k is string => !!k);

/** Zuordnung der Spalten: Angabe des Nutzers oder automatisch aus den Überschriften */
function resolveMapping(
  area: ImportArea,
  header: string[],
  fields: ImportField[],
  given: (string | null)[] | null | undefined,
): (string | null)[] {
  const keys = new Set(fields.map((f) => f.key));
  if (given) {
    const mapping = header.map((_, i) => {
      const k = given[i] ?? null;
      return k && keys.has(k) ? k : null;
    });
    const seen = new Set<string>();
    for (const k of mapping) {
      if (!k) continue;
      if (seen.has(k))
        throw new HttpError(
          400,
          'import_mapping',
          'Jedes Feld kann nur einer Spalte zugeordnet werden.',
        );
      seen.add(k);
    }
    return mapping;
  }
  const seen = new Set<string>();
  const byLabel = new Map(fields.map((f) => [norm(f.label), f.key]));
  return header.map((h) => {
    const n = norm(h);
    const k = byLabel.get(n) ?? ALIASES[area]?.[n] ?? HEADERS[n];
    if (!k || !keys.has(k) || seen.has(k)) return null;
    seen.add(k);
    return k;
  });
}

async function prepare(db: Db, actor: Actor, req: ImportRequest, now: Date): Promise<Prepared> {
  const spec = AREAS[req.area];
  if (!spec) throw new HttpError(400, 'import_area', 'Diesen Bereich gibt es nicht.');
  const teams = await currentTeams(db, actor);
  let fixedTeam: TeamRow | null = null;
  if (spec.needsTeam) {
    fixedTeam = teams.find((t) => t.id === req.teamId) ?? null;
    if (!fixedTeam) throw new HttpError(400, 'import_team', 'Bitte eine Mannschaft wählen.');
  }
  if (!canArea(actor, req.area, teams, fixedTeam)) throw forbidden(DENIED[req.area]);
  const file = readTableFile(req.file.dataBase64, req.sheet);
  const header = (file.rows[0] ?? []).map((h) => h.trim());
  if (header.length === 0)
    throw new HttpError(400, 'import_empty', 'Die Datei enthält keine Kopfzeile.');
  const mapping = resolveMapping(req.area, header, spec.fields, req.mapping);
  const missingRequired = spec.fields
    .filter((f) => f.required && !mapping.includes(f.key))
    .map((f) => f.label);

  const body = file.rows
    .map((cells, i) => ({ cells, line: i + 1 }))
    .slice(1)
    .filter((r) => r.cells.some((c) => (c ?? '') !== ''));
  if (body.length > MAX_IMPORT_LINES)
    throw new HttpError(
      400,
      'import_too_large',
      `Bitte höchstens ${MAX_IMPORT_LINES} Zeilen auf einmal importieren.`,
    );
  const mode: ImportDuplicateMode = req.duplicates ?? 'skip';
  const excluded = new Set(req.excluded ?? []);
  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));

  if (isSimpleArea(req.area)) {
    const handler = handlerFor(req.area);
    const ctx: AreaCtx = { db, actor, req, now, today, mode, teams, team: fixedTeam };
    const checked = await handler.check(
      ctx,
      body.map(({ cells, line }) => ({
        line,
        get: (key: string) => {
          const edit = req.edits?.[String(line)]?.[key];
          if (edit !== undefined) return edit.trim();
          const i = mapping.indexOf(key);
          return i >= 0 ? (cells[i] ?? '').trim() : '';
        },
      })),
    );
    const importRows: ImportRow[] = checked.map((c, i) => {
      const { cells, line } = body[i]!;
      const values: Record<string, string> = {};
      for (const f of spec.fields) {
        const k = mapping.indexOf(f.key);
        values[f.key] =
          req.edits?.[String(line)]?.[f.key] ?? (k >= 0 ? (cells[k] ?? '').trim() : '');
      }
      return {
        line,
        status: c.status,
        values,
        errors: c.errors,
        warnings: c.warnings,
        match: c.match,
        selected: !excluded.has(line),
      };
    });
    return {
      info: buildInfo(req.area, file, header, mapping, missingRequired, importRows),
      rows: [],
      teams,
      today,
      persons: [],
      memberships: [],
      fixedTeam,
      simple: { ctx, checked, lines: body.map((b) => b.line) },
    };
  }

  const persons: Existing[] = await db
    .select({
      id: s.persons.id,
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      birthDate: s.persons.birthDate,
      email: s.persons.email,
      phone: s.persons.phone,
      memberNumber: s.persons.memberNumber,
      memberSince: s.persons.memberSince,
      position: s.persons.position,
      userId: s.persons.userId,
    })
    .from(s.persons)
    .where(eq(s.persons.clubId, actor.club.id));
  const memberships: Membership[] = await db
    .select({
      id: s.teamMemberships.id,
      teamId: s.teamMemberships.teamId,
      personId: s.teamMemberships.personId,
      function: s.teamMemberships.function,
      jerseyNumber: s.teamMemberships.jerseyNumber,
      isPrimaryTeam: s.teamMemberships.isPrimaryTeam,
      validTo: s.teamMemberships.validTo,
    })
    .from(s.teamMemberships)
    .where(eq(s.teamMemberships.clubId, actor.club.id))
    .then((rows) =>
      rows
        .filter(
          (m) => !m.validTo || m.validTo >= toIsoDate(calendarDayOf(now, actor.club.timezone)),
        )
        .map(({ validTo: _validTo, ...m }) => m),
    );

  const byKey = new Map<string, Existing>();
  for (const p of persons) for (const k of keysOf(p)) byKey.set(k, p);
  const byName = new Map<string, Existing[]>();
  for (const p of persons) {
    const k = `${norm(p.firstName)}|${norm(p.lastName)}`;
    byName.set(k, [...(byName.get(k) ?? []), p]);
  }
  const teamOf = (v: string) => {
    const n = norm(v);
    return teams.find((t) => norm(t.badge) === n || norm(t.name) === n) ?? null;
  };
  const canCreate = actorCan(actor, 'members.manage');
  // Nummern, die in dieser Datei schon vergeben wurden: Mannschaft → Nummer
  const usedNumbers = new Map<string, Set<number>>();
  const numbersIn = (teamId: string) => {
    let set = usedNumbers.get(teamId);
    if (!set) {
      set = new Set(
        memberships
          .filter((m) => m.teamId === teamId && m.function === 'player' && m.jerseyNumber != null)
          .map((m) => m.jerseyNumber!),
      );
      usedNumbers.set(teamId, set);
    }
    return set;
  };
  const seenInFile = new Set<string>();

  const rows: PreparedRow[] = body.map(({ cells, line }) => {
    const edits = req.edits?.[String(line)] ?? {};
    const get = (key: string) => {
      if (edits[key] !== undefined) return edits[key]!.trim();
      const i = mapping.indexOf(key);
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const errors: string[] = [];
    const warnings: string[] = [];
    const firstName = get('firstName');
    const lastName = get('lastName');
    if (!firstName || !lastName) errors.push('Vor- und Nachname fehlen.');
    if (firstName.length > 60 || lastName.length > 60) errors.push('Name ist zu lang.');
    const birthDate = parseDate(get('birthDate'));
    if (birthDate === undefined) errors.push(`Geburtsdatum „${get('birthDate')}“ ist ungültig.`);
    const memberSince = parseDate(get('memberSince'));
    if (memberSince === undefined)
      errors.push(`Eintrittsdatum „${get('memberSince')}“ ist ungültig.`);
    const email = get('email').toLowerCase() || null;
    if (email && !EMAIL.test(email)) errors.push(`E-Mail-Adresse „${email}“ ist ungültig.`);
    const teamText = get('team');
    let team: TeamRow | null = fixedTeam;
    if (!fixedTeam && teamText) {
      team = teamOf(teamText);
      if (!team) errors.push(`Mannschaft „${teamText}“ gibt es nicht.`);
    }
    const fnText = get('function');
    let fn: TeamFunction | null = fnText ? (FUNCTIONS[norm(fnText)] ?? null) : null;
    if (fnText && !fn) errors.push(`Funktion „${fnText}“ ist unbekannt.`);
    if (team && !fn && !fnText) fn = 'player';
    if (fnText && fn && !team) errors.push('Für die Funktion fehlt die Mannschaft.');
    if (fn === 'coach' && !canCreate)
      errors.push('Den Trainer einer Mannschaft bestimmt die Vereinsverwaltung.');
    const numText = get('jerseyNumber');
    const jerseyNumber = numText ? Number(numText) : null;
    if (numText && (!Number.isInteger(jerseyNumber) || jerseyNumber! < 1 || jerseyNumber! > 99))
      errors.push(`Rückennummer „${numText}“ muss zwischen 1 und 99 liegen.`);
    if (numText && fn && fn !== 'player') warnings.push('Rückennummern gibt es nur für Spieler.');
    const position = get('position') || null;
    if (position && position.length > 40) errors.push('Position ist zu lang.');

    const parsed: Parsed = {
      firstName,
      lastName,
      birthDate: birthDate ?? null,
      email,
      phone: get('phone') || null,
      memberNumber: get('memberNumber') || null,
      memberSince: memberSince ?? null,
      position,
      team,
      fn,
      jerseyNumber: errors.some((m) => m.startsWith('Rückennummer')) ? null : jerseyNumber,
      parentOf: get('parentOf'),
    };

    // Abgleich mit der Vereinsliste: Nummer, E-Mail, Name + Geburtsdatum; ohne Geburtsdatum eindeutiger Name
    let match: Existing | null = null;
    for (const k of keysOf(parsed)) {
      const hit = byKey.get(k);
      if (hit) {
        match = hit;
        break;
      }
    }
    if (!match && !parsed.birthDate && firstName && lastName) {
      const same = byName.get(`${norm(firstName)}|${norm(lastName)}`) ?? [];
      if (same.length === 1) match = same[0]!;
      else if (same.length > 1)
        warnings.push(
          'Mehrere Personen mit diesem Namen – bitte Geburtsdatum oder Nummer ergänzen.',
        );
    }
    const fileKey = keysOf(parsed).join('~');
    const inFile = !match && fileKey !== '' && keysOf(parsed).some((k) => seenInFile.has(k));

    let status: ImportRow['status'] = 'new';
    let matchLabel: string | null = null;
    let addMembership = !!(team && fn);
    let updateMembership: Membership | null = null;

    if (match) {
      matchLabel = `${match.firstName} ${match.lastName}${match.birthDate ? `, ${germanDate(match.birthDate)}` : ''}`;
      const ms = team
        ? memberships.find(
            (m) => m.personId === match!.id && m.teamId === team!.id && m.function === fn,
          )
        : undefined;
      if (req.area === 'roster') {
        // Im Kader ist „bekannte Person, noch nicht in der Mannschaft“ der Normalfall: sie wird aufgenommen
        if (ms) {
          addMembership = false;
          if (mode === 'update' && (parsed.jerseyNumber !== ms.jerseyNumber || parsed.position)) {
            status = 'update';
            updateMembership = ms;
          } else status = 'duplicate';
        } else status = 'update';
      } else if (mode === 'skip') status = 'duplicate';
      else if (mode === 'update') {
        status = 'update';
        if (ms) addMembership = false;
      } else status = 'new';
    } else if (inFile) {
      status = 'duplicate';
      matchLabel = 'weiter oben in der Datei';
    }
    if (req.area === 'roster' && !match && !canCreate && status === 'new') {
      errors.push('Nicht in der Vereinsliste – neue Mitglieder legt die Mitgliederverwaltung an.');
    }
    // Rückennummer im Kader: nicht doppelt vergeben
    if (
      team &&
      fn === 'player' &&
      parsed.jerseyNumber != null &&
      errors.length === 0 &&
      (status === 'new' || status === 'update') &&
      (addMembership || updateMembership)
    ) {
      const numbers = numbersIn(team.id);
      const mine = updateMembership?.jerseyNumber ?? null;
      if (parsed.jerseyNumber !== mine && numbers.has(parsed.jerseyNumber))
        errors.push(`Rückennummer ${parsed.jerseyNumber} ist in ${team.badge} schon vergeben.`);
      else numbers.add(parsed.jerseyNumber);
    }
    if (status === 'new' && birthDate && req.area === 'members') {
      const age = Math.floor((Date.parse(today) - Date.parse(birthDate)) / (365.25 * 86400000));
      if (age < 18 && !parsed.parentOf && !parsed.email)
        warnings.push('Minderjährig ohne Elternteil und ohne E-Mail – später zuordnen.');
    }

    if (errors.length) status = 'error';
    for (const k of keysOf(parsed)) seenInFile.add(k);

    const values: Record<string, string> = {};
    for (const f of spec.fields) values[f.key] = get(f.key);
    return {
      row: {
        line,
        status,
        values,
        errors,
        warnings,
        match: matchLabel,
        selected: !excluded.has(line),
      },
      parsed,
      existing: match,
      addMembership,
      updateMembership,
    };
  });

  return {
    info: buildInfo(
      req.area,
      file,
      header,
      mapping,
      missingRequired,
      rows.map((r) => r.row),
    ),
    rows,
    teams,
    today,
    persons,
    memberships,
    fixedTeam,
    simple: null,
  };
}

/** Vorschau aus den geprüften Zeilen: Zahlen und Pflichtspalten (fehlen sie, ist jede Zeile fehlerhaft). */
function buildInfo(
  area: ImportArea,
  file: { sheet: string | null; sheets: string[]; rows: string[][] },
  header: string[],
  mapping: (string | null)[],
  missingRequired: string[],
  rows: ImportRow[],
): ImportPreview {
  if (missingRequired.length)
    for (const r of rows) {
      r.status = 'error';
      r.errors.unshift(`Spalte „${missingRequired.join('“, „')}“ ist nicht zugeordnet.`);
    }
  const active = rows.filter((r) => r.selected);
  const count = (st: ImportRow['status']) => active.filter((r) => r.status === st).length;
  return {
    area,
    sheet: file.sheet,
    sheets: file.sheets,
    header,
    mapping,
    missingRequired,
    sample: file.rows.slice(1, 6),
    rowCount: rows.length,
    rows,
    summary: {
      new: count('new'),
      update: count('update'),
      duplicate: count('duplicate'),
      error: count('error'),
      excluded: rows.length - active.length,
    },
    run: null,
  };
}

export async function previewImport(
  db: Db,
  actor: Actor,
  req: ImportRequest,
  now: Date,
): Promise<ImportPreview> {
  return (await prepare(db, actor, req, now)).info;
}

// ── Übernahme ───────────────────────────────────────────────────────────────

type RunPayload = {
  createdPersonIds: string[];
  createdMembershipIds: { id: string; teamId: string; personId: string }[];
  createdGuardianships: { guardianPersonId: string; childPersonId: string }[];
  updatedPersons: { id: string; before: Record<string, string | null> }[];
  updatedMemberships: { id: string; before: { jerseyNumber: number | null } }[];
};

export async function commitImport(
  db: Db,
  actor: Actor,
  req: ImportRequest,
  now: Date,
): Promise<ImportPreview> {
  const prepared = await prepare(db, actor, req, now);
  const { info } = prepared;
  if (info.missingRequired.length)
    throw new HttpError(400, 'import_mapping', 'Es fehlen zugeordnete Pflichtfelder.');
  if (info.summary.error > 0)
    throw new HttpError(
      400,
      'import_errors',
      'Es gibt noch fehlerhafte Zeilen. Bitte korrigieren oder abwählen.',
    );
  if (prepared.simple) {
    const { ctx, checked } = prepared.simple;
    const handler = handlerFor(req.area as Exclude<ImportArea, 'members' | 'roster'>);
    const todoSimple = checked
      .map((c, i) => ({
        line: info.rows[i]!.line,
        status: c.status,
        data: c.data,
        ok: info.rows[i]!.selected,
      }))
      .filter((r) => r.ok && (r.status === 'new' || r.status === 'update'))
      .map(({ line, status, data }) => ({ line, status, data }));
    if (todoSimple.length === 0)
      throw new HttpError(400, 'import_nothing', 'Es gibt nichts zu übernehmen.');
    const runId = randomUUID();
    const result = await handler.commit(ctx, todoSimple, runId);
    await db.transaction(async (tx) => {
      await tx.insert(s.importRuns).values({
        id: runId,
        clubId: actor.club.id,
        area: req.area,
        teamId: prepared.fixedTeam?.id ?? null,
        fileName: req.file.name.slice(0, 200),
        summary: {
          created: result.created,
          updated: result.updated,
          skipped: info.summary.duplicate + info.summary.excluded,
          errors: 0,
        },
        payload: result.payload,
        createdByUserId: actor.user.id,
        createdAt: now,
      });
      await tx.insert(s.auditLog).values({
        clubId: actor.club.id,
        actorUserId: actor.user.id,
        action: 'import.committed',
        entityType: 'import',
        entityId: runId,
        data: {
          label: `${AREAS[req.area].label} importiert: ${result.created} neu, ${result.updated} aktualisiert`,
        },
        createdAt: now,
      });
    });
    return {
      ...info,
      run: {
        id: runId,
        created: result.created,
        updated: result.updated,
        undoUntil: new Date(now.getTime() + UNDO_HOURS * 3600_000).toISOString(),
      },
    };
  }
  const todo = prepared.rows.filter(
    (r) => r.row.selected && (r.row.status === 'new' || r.row.status === 'update'),
  );
  if (todo.length === 0)
    throw new HttpError(400, 'import_nothing', 'Es gibt nichts zu übernehmen.');

  const payload: RunPayload = {
    createdPersonIds: [],
    createdMembershipIds: [],
    createdGuardianships: [],
    updatedPersons: [],
    updatedMemberships: [],
  };
  const created = { n: 0 };
  const updated = { n: 0 };
  const run = await db.transaction(async (tx) => {
    // Personen dieser Datei, für „Elternteil von“ (Name oder Nummer → Person)
    const visibility = await defaultContactVisibility(tx, actor.club.id);
    const newByName = new Map<string, string>();
    const newByNumber = new Map<string, string>();
    const parentLinks: { guardianId: string; childRef: string }[] = [];
    for (const r of todo) {
      const p = r.parsed;
      let personId: string;
      if (r.row.status === 'update' && r.existing) {
        personId = r.existing.id;
        const patch: Partial<typeof s.persons.$inferInsert> = {};
        const before: Record<string, string | null> = {};
        const set = (
          key: keyof Existing & keyof typeof s.persons.$inferInsert,
          value: string | null,
        ) => {
          if (value && value !== r.existing![key]) {
            before[key] = (r.existing![key] as string | null) ?? null;
            (patch as Record<string, unknown>)[key] = value;
          }
        };
        if (req.area === 'members') {
          set('birthDate', p.birthDate);
          set('email', p.email);
          set('phone', p.phone);
          set('memberNumber', p.memberNumber);
          set('memberSince', p.memberSince);
        }
        set('position', p.position);
        if (Object.keys(patch).length) {
          await tx.update(s.persons).set(patch).where(eq(s.persons.id, personId));
          payload.updatedPersons.push({ id: personId, before });
        }
        updated.n++;
      } else {
        const [person] = await tx
          .insert(s.persons)
          .values({
            clubId: actor.club.id,
            contactVisibility: visibility,
            firstName: p.firstName,
            lastName: p.lastName,
            birthDate: p.birthDate,
            email: p.email,
            phone: p.phone,
            memberNumber: p.memberNumber,
            memberSince: p.memberSince ?? prepared.today,
            position: p.position,
          })
          .returning({ id: s.persons.id });
        personId = person!.id;
        payload.createdPersonIds.push(personId);
        newByName.set(`${norm(p.firstName)}|${norm(p.lastName)}`, personId);
        if (p.memberNumber) newByNumber.set(norm(p.memberNumber), personId);
        created.n++;
      }
      if (r.addMembership && p.team && p.fn) {
        const otherPrimary =
          p.fn === 'player' &&
          prepared.memberships.some(
            (m) =>
              m.personId === personId &&
              m.function === 'player' &&
              m.isPrimaryTeam &&
              m.teamId !== p.team!.id,
          );
        const [membership] = await tx
          .insert(s.teamMemberships)
          .values({
            clubId: actor.club.id,
            teamId: p.team.id,
            personId,
            function: p.fn,
            jerseyNumber: p.fn === 'player' ? p.jerseyNumber : null,
            isPrimaryTeam: !otherPrimary,
            validFrom: prepared.today,
          })
          .onConflictDoNothing()
          .returning({ id: s.teamMemberships.id });
        if (membership) {
          payload.createdMembershipIds.push({ id: membership.id, teamId: p.team.id, personId });
          await syncFutureParticipation(tx, actor, p.team, personId, p.fn, now);
        }
      }
      if (r.updateMembership) {
        await tx
          .update(s.teamMemberships)
          .set({ jerseyNumber: p.jerseyNumber })
          .where(eq(s.teamMemberships.id, r.updateMembership.id));
        payload.updatedMemberships.push({
          id: r.updateMembership.id,
          before: { jerseyNumber: r.updateMembership.jerseyNumber },
        });
      }
      if (p.parentOf) parentLinks.push({ guardianId: personId, childRef: p.parentOf });
    }
    // Eltern verknüpfen: Kind aus der Datei oder dem Verein
    const unresolved: string[] = [];
    for (const link of parentLinks) {
      const ref = link.childRef;
      const byNumber =
        newByNumber.get(norm(ref)) ??
        prepared.persons.find((x) => x.memberNumber && norm(x.memberNumber) === norm(ref))?.id;
      const key = norm(ref);
      const candidates = [
        ...prepared.persons.map((x) => ({ id: x.id, key: norm(`${x.firstName}${x.lastName}`) })),
        ...[...newByName.entries()].map(([name, id]) => ({ id, key: name.replace('|', '') })),
      ].filter((c) => c.key === key);
      const childId = byNumber ?? (candidates.length === 1 ? candidates[0]!.id : null);
      if (!childId || childId === link.guardianId) {
        unresolved.push(ref);
        continue;
      }
      const inserted = await tx
        .insert(s.guardianships)
        .values({
          clubId: actor.club.id,
          guardianPersonId: link.guardianId,
          childPersonId: childId,
        })
        .onConflictDoNothing()
        .returning({ g: s.guardianships.guardianPersonId });
      if (inserted.length)
        payload.createdGuardianships.push({
          guardianPersonId: link.guardianId,
          childPersonId: childId,
        });
    }
    if (unresolved.length)
      throw new HttpError(
        400,
        'import_parent',
        `Das Kind zu „Elternteil von“ wurde nicht gefunden: ${[...new Set(unresolved)].slice(0, 3).join(', ')}. Bitte Namen oder Mitgliedsnummer prüfen.`,
      );
    const label = `${AREAS[req.area].label} importiert: ${created.n} neu, ${updated.n} aktualisiert`;
    const [row] = await tx
      .insert(s.importRuns)
      .values({
        clubId: actor.club.id,
        area: req.area,
        teamId: prepared.fixedTeam?.id ?? null,
        fileName: req.file.name.slice(0, 200),
        summary: {
          created: created.n,
          updated: updated.n,
          skipped: info.summary.duplicate + info.summary.excluded,
          errors: 0,
        },
        payload: payload as unknown as Record<string, unknown>,
        createdByUserId: actor.user.id,
        createdAt: now,
      })
      .returning({ id: s.importRuns.id });
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'import.committed',
      entityType: 'import',
      entityId: row!.id,
      data: { label },
      createdAt: now,
    });
    return row!;
  });
  return {
    ...info,
    run: {
      id: run.id,
      created: created.n,
      updated: updated.n,
      undoUntil: new Date(now.getTime() + UNDO_HOURS * 3600_000).toISOString(),
    },
  };
}

// ── Protokoll und Rückgängig ────────────────────────────────────────────────

async function canUseRun(db: Db, actor: Actor, run: typeof s.importRuns.$inferSelect) {
  const area = run.area as ImportArea;
  const teams = await currentTeams(db, actor);
  const team = run.teamId ? (teams.find((t) => t.id === run.teamId) ?? null) : null;
  if (AREAS[area]?.needsTeam) {
    // Wer Mitglieder verwaltet, darf Kader-Importe immer zurücknehmen; sonst das zuständige Trainerteam
    if (area === 'roster' && actorCan(actor, 'members.manage')) return true;
    return !!team && canArea(actor, area, teams, team);
  }
  return canArea(actor, area, teams, null);
}

export async function listImportRuns(db: Db, actor: Actor, now: Date): Promise<ImportRunInfo[]> {
  const rows = await db
    .select({ run: s.importRuns, by: s.users.displayName })
    .from(s.importRuns)
    .leftJoin(s.users, eq(s.users.id, s.importRuns.createdByUserId))
    .where(eq(s.importRuns.clubId, actor.club.id))
    .orderBy(desc(s.importRuns.createdAt))
    .limit(30);
  const out: ImportRunInfo[] = [];
  for (const { run, by } of rows) {
    if (!(await canUseRun(db, actor, run))) continue;
    const until = new Date(run.createdAt.getTime() + UNDO_HOURS * 3600_000);
    out.push({
      id: run.id,
      area: run.area as ImportArea,
      areaLabel: AREAS[run.area as ImportArea]?.label ?? run.area,
      fileName: run.fileName,
      createdAt: run.createdAt.toISOString(),
      createdByName: by,
      summary: {
        created: run.summary.created ?? 0,
        updated: run.summary.updated ?? 0,
        skipped: run.summary.skipped ?? 0,
        errors: run.summary.errors ?? 0,
      },
      undone: !!run.undoneAt,
      undoUntil: until.toISOString(),
      canUndo: !run.undoneAt && until > now,
    });
  }
  return out;
}

export async function undoImport(db: Db, actor: Actor, runId: string, now: Date): Promise<void> {
  const [run] = await db
    .select()
    .from(s.importRuns)
    .where(and(eq(s.importRuns.id, runId), eq(s.importRuns.clubId, actor.club.id)));
  if (!run || !(await canUseRun(db, actor, run)))
    throw new HttpError(404, 'not_found', 'Diesen Import gibt es nicht.');
  if (run.undoneAt) throw new HttpError(409, 'undone', 'Der Import ist schon rückgängig gemacht.');
  if (now.getTime() - run.createdAt.getTime() > UNDO_HOURS * 3600_000)
    throw new HttpError(
      409,
      'undo_expired',
      `Rückgängig geht nur ${UNDO_HOURS} Stunden nach dem Import.`,
    );
  if (isSimpleArea(run.area)) {
    const handler = handlerFor(run.area);
    try {
      await handler.undo({ db, actor, now }, run.payload);
      await db.transaction(async (tx) => {
        await tx.update(s.importRuns).set({ undoneAt: now }).where(eq(s.importRuns.id, run.id));
        await tx.insert(s.auditLog).values({
          clubId: actor.club.id,
          actorUserId: actor.user.id,
          action: 'import.undone',
          entityType: 'import',
          entityId: run.id,
          data: {
            label: `Import rückgängig gemacht: ${run.fileName ?? AREAS[run.area as ImportArea].label}`,
          },
          createdAt: now,
        });
      });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(
        409,
        'undo_used',
        'Importierte Einträge werden schon verwendet. Der Import lässt sich nicht mehr rückgängig machen.',
      );
    }
    return;
  }
  const payload = run.payload as unknown as RunPayload;
  const people = payload.createdPersonIds.length
    ? await db
        .select({ id: s.persons.id, userId: s.persons.userId })
        .from(s.persons)
        .where(inArray(s.persons.id, payload.createdPersonIds))
    : [];
  // Wer sich inzwischen mit einem Konto verbunden hat, bleibt: Der Import lässt sich dann nicht mehr zurücknehmen.
  if (people.some((p) => p.userId))
    throw new HttpError(
      409,
      'undo_used',
      'Mindestens eine importierte Person hat schon ein Konto. Der Import lässt sich nicht mehr rückgängig machen.',
    );
  const teams = await currentTeams(db, actor);
  try {
    await db.transaction(async (tx: Tx) => {
      for (const m of payload.createdMembershipIds) {
        const team = teams.find((t) => t.id === m.teamId);
        if (team) await syncFutureParticipation(tx, actor, team, m.personId, null, now);
        await tx.delete(s.teamMemberships).where(eq(s.teamMemberships.id, m.id));
      }
      for (const g of payload.createdGuardianships)
        await tx
          .delete(s.guardianships)
          .where(
            and(
              eq(s.guardianships.guardianPersonId, g.guardianPersonId),
              eq(s.guardianships.childPersonId, g.childPersonId),
            ),
          );
      for (const u of payload.updatedPersons)
        await tx
          .update(s.persons)
          .set(u.before as Partial<typeof s.persons.$inferInsert>)
          .where(eq(s.persons.id, u.id));
      for (const u of payload.updatedMemberships)
        await tx
          .update(s.teamMemberships)
          .set({ jerseyNumber: u.before.jerseyNumber })
          .where(eq(s.teamMemberships.id, u.id));
      if (payload.createdPersonIds.length)
        await tx.delete(s.persons).where(inArray(s.persons.id, payload.createdPersonIds));
      await tx.update(s.importRuns).set({ undoneAt: now }).where(eq(s.importRuns.id, run.id));
      await tx.insert(s.auditLog).values({
        clubId: actor.club.id,
        actorUserId: actor.user.id,
        action: 'import.undone',
        entityType: 'import',
        entityId: run.id,
        data: {
          label: `Import rückgängig gemacht: ${run.fileName ?? AREAS[run.area as ImportArea]?.label}`,
        },
        createdAt: now,
      });
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // Fremdschlüssel: importierte Personen werden inzwischen anderswo verwendet (z. B. Rückmeldungen)
    throw new HttpError(
      409,
      'undo_used',
      'Importierte Einträge werden schon verwendet. Der Import lässt sich nicht mehr rückgängig machen.',
    );
  }
}
