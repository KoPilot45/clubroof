/**
 * Spielplan-Import aus dem DFBnet (CSV-Export „Vereinsspielplan“ bzw. Mannschaftsspielplan).
 *  1. Spalten erkennen (Kopfzeile, anpassbar) → 2. DFBnet-Mannschaftsnamen eigenen Mannschaften
 *     zuordnen (Schreibweisen werden je Mannschaft gemerkt) → 3. Vorschau neu/geändert/unverändert/
 *     übersprungen → 4. Übernehmen mit Sammelmeldung je Mannschaft, 24 Stunden rückgängig machbar.
 * Ein erneuter Import aktualisiert statt zu verdoppeln (Spielkennung je Mannschaft). Spielen zwei
 * eigene Mannschaften gegeneinander, entsteht das Spiel für beide. Rechte: Terminrecht je Mannschaft.
 */
import {
  type MatchKind,
  type ScheduleField,
  type ScheduleImportInput,
  type SchedulePreview,
  type SchedulePreviewRow,
  SCHEDULE_FIELDS,
  addMinutes,
  at,
  calendarDayOf,
  fromIsoDate,
  toIsoDate,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { currentTeams } from './admin';
import { decodeText, parseCsv } from './csv';
import { createTeamEvent, notify, recipientsFor } from './event-admin';

export const MAX_SCHEDULE_ROWS = 1500;
const UNDO_HOURS = 24;

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');

/** Kopfzeilen des DFBnet (und Varianten) → Feld */
const HEADERS: Record<string, ScheduleField> = {
  spiel: 'matchId',
  spielkennung: 'matchId',
  spielnr: 'matchId',
  spielnummer: 'matchId',
  spielid: 'matchId',
  anstoss: 'kickoff',
  ansto: 'kickoff',
  anstosszeit: 'time',
  beginn: 'kickoff',
  termin: 'kickoff',
  datumuhrzeit: 'kickoff',
  datum: 'date',
  spieldatum: 'date',
  uhrzeit: 'time',
  zeit: 'time',
  heimmannschaft: 'home',
  heim: 'home',
  heimverein: 'home',
  gastmannschaft: 'away',
  gast: 'away',
  gastverein: 'away',
  spielklasse: 'competition',
  wettbewerb: 'competition',
  liga: 'competition',
  staffel: 'competition',
  status: 'status',
  spielstatus: 'status',
};

const CANCELLED = /abgesetzt|abgesagt|ausgefallen|annulliert|nicht ausgetragen/i;

type TeamRow = typeof s.teams.$inferSelect;
type Side =
  | { kind: 'opponent' }
  | { kind: 'ours'; team: TeamRow }
  | { kind: 'unmapped' }
  | { kind: 'forbidden'; name: string };

function detectColumns(
  headers: string[],
  chosen: ScheduleImportInput['columns'],
): Record<ScheduleField, string | null> {
  const result = Object.fromEntries(SCHEDULE_FIELDS.map((f) => [f, null])) as Record<
    ScheduleField,
    string | null
  >;
  for (const h of headers) {
    const field = HEADERS[norm(h)];
    if (field && result[field] === null) result[field] = h;
  }
  for (const f of SCHEDULE_FIELDS) {
    const c = chosen?.[f];
    if (c === null) result[f] = null;
    else if (c !== undefined && headers.includes(c)) result[f] = c;
  }
  return result;
}

/** „02.08.2009 17:00“, „02.08.09“, „2026-08-02T17:00“ → Datum (JJJJ-MM-TT) und Uhrzeit (HH:MM) */
function parseKickoff(dateText: string, timeText: string): { day: string; time: string } | null {
  const joined = `${dateText} ${timeText}`;
  let day: string | null = null;
  const de = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/.exec(joined);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(joined);
  if (de) {
    const y = de[3]!.length === 2 ? 2000 + Number(de[3]) : Number(de[3]);
    day = `${y}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`;
  } else if (iso) day = iso[0];
  if (!day) return null;
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || toIsoDate(d) !== day) return null;
  const time = /(\d{1,2}):(\d{2})/.exec(
    timeText || dateText.replace(day, '').replace(de?.[0] ?? '', ''),
  );
  const hm = time ? `${time[1]!.padStart(2, '0')}:${time[2]}` : '00:00';
  if (Number(hm.slice(0, 2)) > 23 || Number(hm.slice(3)) > 59) return null;
  return { day, time: hm };
}

function kindOf(competition: string | null): MatchKind {
  const c = (competition ?? '').toLowerCase();
  if (/pokal/.test(c)) return 'cup';
  if (/freundschaft|testspiel|test/.test(c)) return 'friendly';
  return 'league';
}

const fmt = (tz: string, d: Date) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(d);

export async function runScheduleImport(
  db: Db,
  actor: Actor,
  input: ScheduleImportInput,
  now: Date,
): Promise<SchedulePreview> {
  const tz = actor.club.timezone;
  const allTeams = await currentTeams(db, actor);
  const allowed = allTeams.filter((t) => actorCan(actor, 'events.manage', t));
  if (allowed.length === 0)
    throw forbidden('Den Spielplan importieren nur Trainerteam und Vereinsverwaltung.');
  const only = input.teamId ? allowed.find((t) => t.id === input.teamId) : null;
  if (input.teamId && !only)
    throw forbidden('Für diese Mannschaft darfst du keinen Spielplan importieren.');

  const table = parseCsv(decodeText(Buffer.from(input.dataBase64, 'base64')));
  const headers = (table[0] ?? []).filter((h) => h !== '');
  const columns = detectColumns(table[0] ?? [], input.columns);
  if ((!columns.kickoff && !columns.date) || !columns.home || !columns.away)
    throw new HttpError(
      400,
      'import_header',
      'Die Datei braucht Spalten für Anstoß (oder Datum), Heim- und Gastmannschaft. Bitte ordne die Spalten zu.',
    );
  const idx = (f: ScheduleField) => (columns[f] ? (table[0] ?? []).indexOf(columns[f]!) : -1);
  const cell = (cells: string[], f: ScheduleField) => (idx(f) >= 0 ? (cells[idx(f)] ?? '') : '');
  const body = table
    .map((cells, i) => ({ cells, line: i + 1 }))
    .slice(1)
    .filter((r) => r.cells.some((c) => c !== ''));
  if (body.length === 0)
    throw new HttpError(400, 'import_empty', 'Die Datei enthält keine Spiele.');
  if (body.length > MAX_SCHEDULE_ROWS)
    throw new HttpError(
      400,
      'import_too_large',
      `Höchstens ${MAX_SCHEDULE_ROWS} Zeilen je Import.`,
    );

  // ── DFBnet-Namen → eigene Mannschaft ─────────────────────────────────────
  const clubNames = [actor.club.name, actor.club.shortName].map(norm).filter(Boolean);
  const auto = new Map<string, TeamRow>();
  for (const t of allowed) {
    const keys = [
      ...t.importAliases,
      ...[actor.club.shortName, actor.club.name].flatMap((c) => [
        `${c} ${t.badge}`,
        `${c} ${t.name}`,
      ]),
    ];
    for (const k of keys) auto.set(norm(k), t);
  }
  const explicit = new Map<string, TeamRow | null | 'forbidden'>();
  for (const [name, teamId] of Object.entries(input.mapping ?? {})) {
    explicit.set(norm(name), teamId ? (allowed.find((t) => t.id === teamId) ?? 'forbidden') : null);
  }
  const unmapped = new Map<string, number>();
  const sideOf = (name: string): Side => {
    const k = norm(name);
    if (explicit.has(k)) {
      const t = explicit.get(k);
      if (t === 'forbidden') return { kind: 'forbidden', name };
      return t ? { kind: 'ours', team: t } : { kind: 'opponent' };
    }
    const t = auto.get(k);
    if (t) return { kind: 'ours', team: t };
    return clubNames.some((c) => k.startsWith(c)) ? { kind: 'unmapped' } : { kind: 'opponent' };
  };

  // ── Zeilen auswerten ─────────────────────────────────────────────────────
  type Candidate = {
    row: SchedulePreviewRow;
    team: TeamRow;
    key: string;
    startsAt: Date;
    opponent: string;
    isHome: boolean;
    kind: MatchKind;
    competition: string | null;
  };
  const rows: SchedulePreviewRow[] = [];
  const candidates: Candidate[] = [];
  const empty = (line: number): SchedulePreviewRow => ({
    line,
    status: 'skipped',
    teamId: null,
    teamLabel: null,
    startsAt: null,
    opponent: null,
    isHome: null,
    kind: null,
    competition: null,
    changes: [],
  });

  for (const { cells, line } of body) {
    const home = cell(cells, 'home').replace(/\s+/g, ' ').trim();
    const away = cell(cells, 'away').replace(/\s+/g, ' ').trim();
    const competition = cell(cells, 'competition').trim() || null;
    const skip = (reason: string) =>
      rows.push({ ...empty(line), reason, opponent: away || home || null });
    const when = parseKickoff(cell(cells, 'kickoff') || cell(cells, 'date'), cell(cells, 'time'));
    if (!home || !away) {
      skip('Heim- oder Gastmannschaft fehlt.');
      continue;
    }
    if (!when) {
      skip('Datum oder Uhrzeit nicht lesbar.');
      continue;
    }
    if (CANCELLED.test(cell(cells, 'status'))) {
      skip('Spiel abgesetzt.');
      continue;
    }
    const startsAt = at(fromIsoDate(when.day), when.time, tz);
    if (startsAt.getTime() < now.getTime()) {
      skip('Das Spiel liegt in der Vergangenheit.');
      continue;
    }
    const sides: [Side, Side] = [sideOf(home), sideOf(away)];
    const unresolved = sides.flatMap((side, i) =>
      side.kind === 'unmapped' ? [i === 0 ? home : away] : [],
    );
    if (unresolved.length) {
      for (const n of unresolved) unmapped.set(n, (unmapped.get(n) ?? 0) + 1);
      skip(`Mannschaft „${unresolved[0]}“ ist noch nicht zugeordnet.`);
      continue;
    }
    if (sides.some((side) => side.kind === 'forbidden')) {
      skip('Für diese Mannschaft fehlt dir die Berechtigung.');
      continue;
    }
    const ours = sides.flatMap((side, i) =>
      side.kind === 'ours'
        ? [{ team: side.team, isHome: i === 0, opponent: i === 0 ? away : home }]
        : [],
    );
    const relevant = only ? ours.filter((o) => o.team.id === only.id) : ours;
    if (relevant.length === 0) {
      skip(
        ours.length
          ? 'Gehört nicht zur gewählten Mannschaft.'
          : 'Kein Spiel einer eigenen Mannschaft.',
      );
      continue;
    }
    const matchId = cell(cells, 'matchId').trim();
    for (const o of relevant) {
      const key = matchId || `d:${when.day}:${norm(o.opponent)}:${o.isHome ? 'h' : 'a'}`;
      const row: SchedulePreviewRow = {
        line,
        status: 'new',
        teamId: o.team.id,
        teamLabel: `${o.team.badge} · ${o.team.name}`,
        startsAt: startsAt.toISOString(),
        opponent: o.opponent,
        isHome: o.isHome,
        kind: kindOf(competition),
        competition,
        changes: [],
      };
      rows.push(row);
      candidates.push({
        row,
        team: o.team,
        key,
        startsAt,
        opponent: o.opponent,
        isHome: o.isHome,
        kind: row.kind!,
        competition,
      });
    }
  }

  // ── Mit bestehenden Spielen vergleichen ──────────────────────────────────
  type Existing = {
    id: string;
    teamId: string;
    sourceKey: string | null;
    startsAt: Date;
    endsAt: Date | null;
    meetingAt: Date | null;
    status: string;
    opponent: string;
    isHome: boolean;
    kind: string;
  };
  const existing: Existing[] = [];
  if (candidates.length) {
    const times = candidates.map((c) => c.startsAt.getTime());
    const from = new Date(Math.min(...times) - 36 * 3_600_000);
    const to = new Date(Math.max(...times) + 36 * 3_600_000);
    const found = await db
      .select({ event: s.events, match: s.matchDetails })
      .from(s.events)
      .innerJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
      .where(
        and(
          eq(s.events.clubId, actor.club.id),
          inArray(s.events.teamId, [...new Set(candidates.map((c) => c.team.id))]),
          gte(s.events.startsAt, from),
          lte(s.events.startsAt, to),
        ),
      );
    for (const { event, match } of found)
      existing.push({
        id: event.id,
        teamId: event.teamId!,
        sourceKey: event.sourceKey,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        meetingAt: event.meetingAt,
        status: event.status,
        opponent: match.opponentName,
        isHome: match.isHome,
        kind: match.kind,
      });
  }
  const targets = new Map<string, { candidate: Candidate; existing: Existing }>();
  const seen = new Set<string>();
  for (const c of candidates) {
    const dup = `${c.team.id}|${c.key}`;
    if (seen.has(dup)) {
      c.row.status = 'skipped';
      c.row.reason = 'Doppelt in der Datei.';
      continue;
    }
    seen.add(dup);
    const day = toIsoDate(calendarDayOf(c.startsAt, tz));
    const match =
      existing.find((e) => e.teamId === c.team.id && e.sourceKey === c.key) ??
      // bereits von Hand angelegtes Spiel am selben Tag gegen denselben Gegner
      existing.find(
        (e) =>
          e.teamId === c.team.id &&
          e.sourceKey === null &&
          toIsoDate(calendarDayOf(e.startsAt, tz)) === day &&
          norm(e.opponent) === norm(c.opponent),
      );
    if (!match) continue;
    if (match.status === 'cancelled') {
      c.row.status = 'skipped';
      c.row.reason = 'Das Spiel wurde in der App abgesagt.';
      continue;
    }
    const changes: string[] = [];
    if (match.startsAt.getTime() !== c.startsAt.getTime())
      changes.push(`Anstoß: ${fmt(tz, match.startsAt)} → ${fmt(tz, c.startsAt)}`);
    if (norm(match.opponent) !== norm(c.opponent))
      changes.push(`Gegner: ${match.opponent} → ${c.opponent}`);
    if (match.isHome !== c.isHome)
      changes.push(
        `${match.isHome ? 'Heimspiel' : 'Auswärtsspiel'} → ${c.isHome ? 'Heimspiel' : 'Auswärtsspiel'}`,
      );
    if (match.kind !== c.kind && match.sourceKey !== null) changes.push('Art des Spiels');
    c.row.changes = changes;
    c.row.status = changes.length ? 'changed' : 'unchanged';
    targets.set(`${c.team.id}|${c.key}`, { candidate: c, existing: match });
  }

  const summary = { new: 0, changed: 0, unchanged: 0, skipped: 0 };
  for (const r of rows) summary[r.status]++;
  const preview: SchedulePreview = {
    headers,
    columns,
    rows,
    unmapped: [...unmapped].map(([name, count]) => ({ name, count })),
    teams: (only ? [only] : allowed).map((t) => ({ id: t.id, label: `${t.badge} · ${t.name}` })),
    summary,
    result: null,
  };
  if (!input.commit) return preview;

  // ── Übernehmen ───────────────────────────────────────────────────────────
  if (preview.unmapped.length)
    throw new HttpError(
      409,
      'unmapped',
      'Bitte ordne zuerst alle Mannschaften zu (oder überspringe sie).',
    );
  if (summary.new + summary.changed === 0)
    throw new HttpError(409, 'nothing_to_import', 'Es gibt nichts zu übernehmen.');
  const [batch] = await db
    .insert(s.scheduleImports)
    .values({ clubId: actor.club.id, createdByPersonId: actor.person.id, createdAt: now })
    .returning({ id: s.scheduleImports.id });
  const batchId = batch!.id;
  const perTeam = new Map<string, { team: TeamRow; created: number; changed: number }>();
  const bump = (team: TeamRow, k: 'created' | 'changed') => {
    const e = perTeam.get(team.id) ?? { team, created: 0, changed: 0 };
    e[k]++;
    perTeam.set(team.id, e);
  };
  let created = 0;
  let updated = 0;
  for (const c of candidates) {
    if (c.row.status === 'new') {
      try {
        await createTeamEvent(
          db,
          actor,
          c.team.id,
          {
            type: 'match',
            startsAt: c.startsAt.toISOString(),
            opponentName: c.opponent,
            isHome: c.isHome,
            matchKind: c.kind,
            allowConflict: true,
          },
          now,
          {
            silent: true,
            sourceKey: c.key,
            importBatchId: batchId,
            competition: c.competition ?? undefined,
          },
        );
        created++;
        bump(c.team, 'created');
      } catch (e) {
        c.row.status = 'skipped';
        c.row.reason =
          e instanceof HttpError ? e.message : 'Das Spiel konnte nicht angelegt werden.';
      }
    } else if (c.row.status === 'changed') {
      const t = targets.get(`${c.team.id}|${c.key}`)!;
      const ev = t.existing;
      const shift = c.startsAt.getTime() - ev.startsAt.getTime();
      await db.transaction(async (tx) => {
        const ourName = `${actor.club.shortName} ${c.team.badge}`;
        await tx
          .update(s.events)
          .set({
            startsAt: c.startsAt,
            endsAt: ev.endsAt ? new Date(ev.endsAt.getTime() + shift) : null,
            meetingAt: ev.meetingAt ? addMinutes(ev.meetingAt, shift / 60_000) : null,
            title: c.isHome ? `${ourName} – ${c.opponent}` : `${c.opponent} – ${ourName}`,
            sourceKey: c.key,
            updatedAt: now,
          })
          .where(eq(s.events.id, ev.id));
        await tx
          .update(s.matchDetails)
          .set({
            opponentName: c.opponent,
            isHome: c.isHome,
            ...(c.competition ? { competition: c.competition } : {}),
          })
          .where(eq(s.matchDetails.eventId, ev.id));
      });
      updated++;
      bump(c.team, 'changed');
    } else if (c.row.status === 'unchanged') {
      // Von Hand angelegtes Spiel übernehmen: Herkunft merken, damit spätere Importe es aktualisieren
      const ev = targets.get(`${c.team.id}|${c.key}`)?.existing;
      if (ev && ev.sourceKey === null)
        await db.update(s.events).set({ sourceKey: c.key }).where(eq(s.events.id, ev.id));
    }
  }
  await db
    .update(s.scheduleImports)
    .set({ createdCount: created, updatedCount: updated })
    .where(eq(s.scheduleImports.id, batchId));

  // Schreibweisen merken
  for (const [name, teamId] of Object.entries(input.mapping ?? {})) {
    const team = teamId ? allowed.find((t) => t.id === teamId) : null;
    if (!team || auto.get(norm(name))?.id === team.id) continue;
    await db
      .update(s.teams)
      .set({ importAliases: [...new Set([...team.importAliases, name.trim()])] })
      .where(eq(s.teams.id, team.id));
  }

  // Sammelmeldung je Mannschaft
  for (const { team, created: n, changed } of perTeam.values()) {
    const people = await db
      .select({ personId: s.teamMemberships.personId })
      .from(s.teamMemberships)
      .where(
        and(
          eq(s.teamMemberships.teamId, team.id),
          or(
            isNull(s.teamMemberships.validTo),
            gte(s.teamMemberships.validTo, toIsoDate(calendarDayOf(now, tz))),
          ),
        ),
      );
    await notify(
      db,
      actor,
      await recipientsFor(db, [...new Set(people.map((p) => p.personId))], actor.user.id),
      {
        level: 'info',
        topic: 'events',
        teamId: team.id,
        title: `Spielplan aktualisiert: ${team.badge}`,
        body: [n ? `${n} neue Spiele` : null, changed ? `${changed} geänderte Spiele` : null]
          .filter(Boolean)
          .join(' · '),
        link: '/calendar',
      },
      now,
    );
  }
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'schedule.imported',
    entityType: 'schedule_import',
    entityId: batchId,
    data: { label: `Spielplan importiert: ${created} neu, ${updated} geändert` },
    createdAt: now,
  });
  const final = { new: 0, changed: 0, unchanged: 0, skipped: 0 };
  for (const r of rows) final[r.status]++;
  return { ...preview, summary: final, result: { batchId, created, updated } };
}

/** Macht die neu angelegten Spiele eines Imports rückgängig (24 Stunden, nur ohne Spielbericht). */
export async function undoScheduleImport(
  db: Db,
  actor: Actor,
  batchId: string,
  now: Date,
): Promise<{ removed: number; kept: number }> {
  const [batch] = await db
    .select()
    .from(s.scheduleImports)
    .where(and(eq(s.scheduleImports.id, batchId), eq(s.scheduleImports.clubId, actor.club.id)));
  if (!batch) throw notFound('Der Import');
  if (batch.createdByPersonId !== actor.person.id && !actorCan(actor, 'events.manage'))
    throw forbidden('Den Import macht nur die Person rückgängig, die ihn durchgeführt hat.');
  if (batch.undoneAt)
    throw new HttpError(409, 'undone', 'Der Import wurde schon rückgängig gemacht.');
  if (now.getTime() - batch.createdAt.getTime() > UNDO_HOURS * 3_600_000)
    throw new HttpError(
      409,
      'too_late',
      `Rückgängig geht nur innerhalb von ${UNDO_HOURS} Stunden.`,
    );
  const rows = await db
    .select({
      id: s.events.id,
      report: s.matchDetails.reportCompletedAt,
      lineup: s.matchDetails.lineupPublishedAt,
    })
    .from(s.events)
    .leftJoin(s.matchDetails, eq(s.matchDetails.eventId, s.events.id))
    .where(and(eq(s.events.clubId, actor.club.id), eq(s.events.importBatchId, batchId)));
  const removable = rows.filter((r) => !r.report && !r.lineup).map((r) => r.id);
  if (removable.length) await db.delete(s.events).where(inArray(s.events.id, removable));
  await db
    .update(s.scheduleImports)
    .set({ undoneAt: now })
    .where(eq(s.scheduleImports.id, batchId));
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'schedule.import_undone',
    entityType: 'schedule_import',
    entityId: batchId,
    data: { label: `Spielplan-Import rückgängig: ${removable.length} Spiele entfernt` },
    createdAt: now,
  });
  return { removed: removable.length, kept: rows.length - removable.length };
}
