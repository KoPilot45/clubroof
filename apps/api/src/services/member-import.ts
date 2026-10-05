/**
 * Mitglieder-Import aus einer CSV-Datei (Mappe S. 10): erst Vorschau mit Prüfung auf Fehler und
 * Dubletten, dann Übernahme der neuen Zeilen. Recht: `members.manage`.
 * Dublette = gleiche Mitgliedsnummer, gleiche E-Mail-Adresse oder gleicher Name mit gleichem
 * Geburtsdatum – im Verein oder weiter oben in derselben Datei.
 */
import {
  TEAM_FUNCTIONS,
  calendarDayOf,
  toIsoDate,
  type MemberImportResult,
  type MemberImportRow,
  type TeamFunction,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import type { Actor } from '../actor';
import { HttpError } from '../errors';
import { currentTeams, requireManageMembers, syncFutureParticipation } from './admin';
import { parseCsv } from './csv';

export const MAX_IMPORT_ROWS = 2000;

type Field =
  | 'firstName'
  | 'lastName'
  | 'birthDate'
  | 'email'
  | 'phone'
  | 'memberNumber'
  | 'memberSince'
  | 'team'
  | 'function'
  | 'jerseyNumber';

/** Spaltenüberschriften (klein, ohne Sonderzeichen) → Feld */
const HEADERS: Record<string, Field> = {
  vorname: 'firstName',
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

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

/** TT.MM.JJJJ, TT.MM.JJ oder JJJJ-MM-TT → JJJJ-MM-TT; `undefined` bei ungültigem Datum */
export function parseDate(value: string): string | null | undefined {
  const v = value.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (de) {
    [d, m, y] = [Number(de[1]), Number(de[2]), Number(de[3])];
    // Zweistellige Jahre: bis 30 → 20xx, sonst 19xx
    if (de[3]!.length === 2) y += y <= 30 ? 2000 : 1900;
  } else if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else return undefined;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function importMembers(
  db: Db,
  actor: Actor,
  csv: string,
  commit: boolean,
  now: Date,
): Promise<MemberImportResult> {
  requireManageMembers(actor);
  const table = parseCsv(csv);
  const header = table[0] ?? [];
  const map = header.map((h) => HEADERS[norm(h)] ?? null);
  if (!map.includes('firstName') || !map.includes('lastName'))
    throw new HttpError(
      400,
      'import_header',
      'Die erste Zeile braucht mindestens die Spalten „Vorname“ und „Nachname“.',
    );
  const body = table
    .map((cells, i) => ({ cells, line: i + 1 }))
    .slice(1)
    .filter((r) => r.cells.some((c) => c !== ''));
  if (body.length === 0)
    throw new HttpError(400, 'import_empty', 'Die Datei enthält keine Mitglieder.');
  if (body.length > MAX_IMPORT_ROWS)
    throw new HttpError(
      400,
      'import_too_large',
      `Bitte höchstens ${MAX_IMPORT_ROWS} Mitglieder auf einmal importieren.`,
    );

  const teams = await currentTeams(db, actor);
  const teamOf = (v: string) => {
    const n = norm(v);
    return teams.find((t) => norm(t.badge) === n || norm(t.name) === n) ?? null;
  };
  const existing = await db
    .select({
      firstName: s.persons.firstName,
      lastName: s.persons.lastName,
      birthDate: s.persons.birthDate,
      email: s.persons.email,
      memberNumber: s.persons.memberNumber,
    })
    .from(s.persons)
    .where(eq(s.persons.clubId, actor.club.id));
  const keys = new Set<string>();
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
  for (const p of existing) for (const k of keysOf(p)) keys.add(k);

  const rows: MemberImportRow[] = body.map(({ cells, line }) => {
    const get = (f: Field) => {
      const i = map.indexOf(f);
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const messages: string[] = [];
    const firstName = get('firstName');
    const lastName = get('lastName');
    if (!firstName || !lastName) messages.push('Vor- und Nachname fehlen.');
    if (firstName.length > 60 || lastName.length > 60) messages.push('Name ist zu lang.');
    const birthDate = parseDate(get('birthDate'));
    if (birthDate === undefined) messages.push(`Geburtsdatum „${get('birthDate')}“ ist ungültig.`);
    const memberSince = parseDate(get('memberSince'));
    if (memberSince === undefined)
      messages.push(`Eintrittsdatum „${get('memberSince')}“ ist ungültig.`);
    const email = get('email').toLowerCase() || null;
    if (email && !EMAIL.test(email)) messages.push(`E-Mail-Adresse „${email}“ ist ungültig.`);
    const teamText = get('team');
    const team = teamText ? teamOf(teamText) : null;
    if (teamText && !team) messages.push(`Mannschaft „${teamText}“ gibt es nicht.`);
    const fnText = get('function');
    let fn: TeamFunction | null = fnText ? (FUNCTIONS[norm(fnText)] ?? null) : null;
    if (fnText && !fn) messages.push(`Funktion „${fnText}“ ist unbekannt.`);
    if (team && !fn && !fnText) fn = 'player';
    if (fnText && fn && !team) messages.push('Für die Funktion fehlt die Mannschaft.');
    const numText = get('jerseyNumber');
    const jerseyNumber = numText ? Number(numText) : null;
    if (numText && (!Number.isInteger(jerseyNumber) || jerseyNumber! < 1 || jerseyNumber! > 99))
      messages.push(`Rückennummer „${numText}“ muss zwischen 1 und 99 liegen.`);

    const row: MemberImportRow = {
      line,
      firstName,
      lastName,
      birthDate: birthDate ?? null,
      email,
      phone: get('phone') || null,
      memberNumber: get('memberNumber') || null,
      memberSince: memberSince ?? null,
      team: team ? { id: team.id, badge: team.badge } : null,
      function: TEAM_FUNCTIONS.includes(fn as TeamFunction) ? fn : null,
      jerseyNumber: messages.some((m) => m.startsWith('Rückennummer')) ? null : jerseyNumber,
      status: messages.length ? 'error' : 'new',
      messages,
    };
    if (row.status === 'new') {
      const own = keysOf(row);
      if (own.some((k) => keys.has(k))) {
        row.status = 'duplicate';
        row.messages.push('Ist schon im Verein oder weiter oben in der Datei – wird übersprungen.');
      }
      for (const k of own) keys.add(k);
    }
    return row;
  });

  const summary = {
    new: rows.filter((r) => r.status === 'new').length,
    duplicate: rows.filter((r) => r.status === 'duplicate').length,
    error: rows.filter((r) => r.status === 'error').length,
  };
  const result: MemberImportResult = {
    rows,
    columns: header.filter((_, i) => map[i] !== null),
    ignoredColumns: header.filter((h, i) => map[i] === null && h !== ''),
    summary,
    imported: null,
  };
  if (!commit) return result;
  if (summary.new === 0)
    throw new HttpError(400, 'import_nothing', 'Es gibt keine neuen Mitglieder zu übernehmen.');

  const today = toIsoDate(calendarDayOf(now, actor.club.timezone));
  await db.transaction(async (tx) => {
    for (const row of rows.filter((r) => r.status === 'new')) {
      const [person] = await tx
        .insert(s.persons)
        .values({
          clubId: actor.club.id,
          firstName: row.firstName,
          lastName: row.lastName,
          birthDate: row.birthDate,
          email: row.email,
          phone: row.phone,
          memberNumber: row.memberNumber,
          memberSince: row.memberSince ?? today,
        })
        .returning({ id: s.persons.id });
      const team = row.team ? teams.find((t) => t.id === row.team!.id)! : null;
      if (team && row.function) {
        await tx.insert(s.teamMemberships).values({
          clubId: actor.club.id,
          teamId: team.id,
          personId: person!.id,
          function: row.function,
          jerseyNumber: row.function === 'player' ? row.jerseyNumber : null,
          isPrimaryTeam: true,
          validFrom: today,
        });
        await syncFutureParticipation(tx, actor, team, person!.id, row.function, now);
      }
    }
    await tx.insert(s.auditLog).values({
      clubId: actor.club.id,
      actorUserId: actor.user.id,
      action: 'member.imported',
      entityType: 'club',
      entityId: actor.club.id,
      data: {
        label: `Mitglieder importiert: ${summary.new} neu${summary.duplicate ? `, ${summary.duplicate} Dubletten übersprungen` : ''}`,
      },
      createdAt: now,
    });
  });
  return { ...result, imported: summary.new };
}
