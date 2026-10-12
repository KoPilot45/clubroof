/**
 * Kassenprüfung der Vereinskasse (Paket K4): Prüfer ziehen Stichproben, haken Buchungen ab, vermerken
 * Beanstandungen und geben einen Prüfbericht ab (Grundlage der Entlastung). Prüfen darf, wer
 * `clubcash.audit` hat – für den ganzen Verein oder nur für einzelne Kassen. Nach der Abgabe ist
 * die Prüfung unveränderlich.
 */
import {
  CLUB_AUDIT_MAX_SAMPLE,
  calendarDayOf,
  toIsoDate,
  type ClubAuditDetail,
  type ClubAuditEntryRef,
  type ClubAuditFinding,
  type ClubAuditFindingInput,
  type ClubAuditFindingKind,
  type ClubAuditInput,
  type ClubAudits,
  type ClubAuditSummary,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, desc, eq, gte, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm';
import { type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { SimplePdf } from '../storage/pdf';
import { resolveMediaUrl } from '../storage/media-links';
import { audit, clubCashLevel, euro, requireLevel, seesAllFunds } from './club-cash';
import { ensureMainFund, fundScope, listFunds } from './club-funds';

const german = (iso: string) => iso.split('-').reverse().join('.');
const NO_ID = '00000000-0000-0000-0000-000000000000';

/** Kassen, die der Nutzer prüfen darf (`null` = alle). Prüfen ist getrennt vom Buchen. */
async function auditScope(db: Db, actor: Actor): Promise<string[] | null> {
  return fundScope(db, actor, 'clubcash.audit');
}

function requireAuditor(scope: string[] | null) {
  if (scope !== null && scope.length === 0)
    throw forbidden('Die Kassenprüfung machen Kassenprüfer.');
}

const entryRef = (
  actor: Actor,
  now: Date,
  r: {
    entry: typeof s.clubCashEntries.$inferSelect;
    accountName: string;
    fundName: string;
    categoryName: string | null;
  },
): ClubAuditEntryRef => ({
  id: r.entry.id,
  kind: r.entry.kind as ClubAuditEntryRef['kind'],
  bookedOn: r.entry.bookedOn,
  amountCents: r.entry.amountCents,
  purpose: r.entry.purpose,
  counterparty: r.entry.counterparty,
  accountName: r.accountName,
  fundName: r.fundName,
  categoryName: r.categoryName,
  receiptNo: r.entry.receiptNo,
  receiptUrl: resolveMediaUrl(actor.links, r.entry.receiptRef, now),
  cancelled: !!r.entry.cancelledAt,
});

async function nameMap(db: Db, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: s.persons.id, first: s.persons.firstName, last: s.persons.lastName })
    .from(s.persons)
    .where(inArray(s.persons.id, unique));
  return new Map(rows.map((p) => [p.id, `${p.first} ${p.last}`]));
}

type AuditRow = typeof s.clubAudits.$inferSelect;

async function summaries(db: Db, rows: AuditRow[]): Promise<ClubAuditSummary[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      auditId: s.clubAuditFindings.auditId,
      kind: s.clubAuditFindings.kind,
      n: sql<number>`count(*)::int`,
    })
    .from(s.clubAuditFindings)
    .where(
      inArray(
        s.clubAuditFindings.auditId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(s.clubAuditFindings.auditId, s.clubAuditFindings.kind);
  const funds = await db
    .select({ id: s.clubCashFunds.id, name: s.clubCashFunds.name })
    .from(s.clubCashFunds)
    .where(
      inArray(
        s.clubCashFunds.id,
        rows.map((r) => r.fundId ?? NO_ID),
      ),
    );
  const names = await nameMap(
    db,
    rows.map((r) => r.startedByPersonId),
  );
  const n = (id: string, kind: ClubAuditFindingKind) =>
    Number(counts.find((c) => c.auditId === id && c.kind === kind)?.n ?? 0);
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    fundId: r.fundId,
    fundName: r.fundId ? (funds.find((f) => f.id === r.fundId)?.name ?? '') : 'Ganzer Verein',
    startedByName: r.startedByPersonId ? (names.get(r.startedByPersonId) ?? null) : null,
    startedAt: r.startedAt.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    status: r.submittedAt ? 'submitted' : 'open',
    pending: n(r.id, 'pending'),
    checked: n(r.id, 'checked'),
    objections: n(r.id, 'objection'),
    notes: n(r.id, 'note'),
    conclusion: r.conclusion,
  }));
}

/** Darf der Nutzer diese Prüfung ansehen? Prüfer ihre eigenen Kassen, Kassenführung abgegebene Berichte. */
async function canSee(db: Db, actor: Actor, row: AuditRow): Promise<'auditor' | 'reader'> {
  const scope = await auditScope(db, actor);
  const inScope = scope === null || (row.fundId !== null && scope.includes(row.fundId));
  if (inScope && !(scope !== null && scope.length === 0)) return 'auditor';
  if (row.submittedAt && clubCashLevel(actor) !== 'none') {
    const read = await fundScope(db, actor, 'clubcash.read', seesAllFunds(actor));
    if (read === null || (row.fundId !== null && read.includes(row.fundId))) return 'reader';
  }
  throw forbidden('Diese Prüfung siehst du nicht.');
}

export async function listAudits(db: Db, actor: Actor, now: Date): Promise<ClubAudits> {
  requireLevel(actor);
  const clubId = actor.club.id;
  await ensureMainFund(db, clubId, now);
  const scope = await auditScope(db, actor);
  const isAuditor = !(scope !== null && scope.length === 0);
  const rows = await db
    .select()
    .from(s.clubAudits)
    .where(eq(s.clubAudits.clubId, clubId))
    .orderBy(desc(s.clubAudits.year), desc(s.clubAudits.startedAt));
  const visible: AuditRow[] = [];
  for (const r of rows) {
    try {
      await canSee(db, actor, r);
      visible.push(r);
    } catch {
      /* nicht sichtbar */
    }
  }
  const funds = await listFunds(db, clubId, scope);
  return {
    canAudit: isAuditor,
    wholeClub: scope === null,
    funds: isAuditor
      ? funds.filter((f) => !f.archived).map((f) => ({ id: f.id, name: f.name }))
      : [],
    audits: await summaries(db, visible),
  };
}

export async function startAudit(
  db: Db,
  actor: Actor,
  input: ClubAuditInput,
  now: Date,
): Promise<{ id: string }> {
  requireLevel(actor);
  const scope = await auditScope(db, actor);
  requireAuditor(scope);
  const clubId = actor.club.id;
  const thisYear = Number(toIsoDate(calendarDayOf(now, actor.club.timezone)).slice(0, 4));
  if (input.year < 2000 || input.year > thisYear)
    throw new HttpError(400, 'invalid_year', 'Das Prüfjahr ist ungültig.');
  const fundId = input.fundId ?? null;
  if (fundId === null && scope !== null) throw forbidden('Du darfst nur einzelne Kassen prüfen.');
  if (fundId !== null) {
    if (scope !== null && !scope.includes(fundId)) throw forbidden('Diese Kasse prüfst du nicht.');
    const [fund] = await db
      .select()
      .from(s.clubCashFunds)
      .where(and(eq(s.clubCashFunds.id, fundId), eq(s.clubCashFunds.clubId, clubId)));
    if (!fund) throw notFound('Die Kasse');
  }
  const [open] = await db
    .select({ id: s.clubAudits.id })
    .from(s.clubAudits)
    .where(
      and(
        eq(s.clubAudits.clubId, clubId),
        eq(s.clubAudits.year, input.year),
        fundId ? eq(s.clubAudits.fundId, fundId) : isNull(s.clubAudits.fundId),
        isNull(s.clubAudits.submittedAt),
      ),
    );
  if (open) throw new HttpError(409, 'audit_open', 'Für dieses Jahr läuft schon eine Prüfung.');
  const [row] = await db
    .insert(s.clubAudits)
    .values({
      clubId,
      year: input.year,
      fundId,
      startedByPersonId: actor.person.id,
      startedAt: now,
    })
    .returning({ id: s.clubAudits.id });
  await audit(
    db,
    actor,
    'clubcash.audit',
    'club_audit',
    row!.id,
    `Kassenprüfung ${input.year} begonnen`,
    now,
  );
  return { id: row!.id };
}

async function loadAudit(db: Db, actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(s.clubAudits)
    .where(and(eq(s.clubAudits.id, id), eq(s.clubAudits.clubId, actor.club.id)));
  if (!row) throw notFound('Die Prüfung');
  return row;
}

/** Fondsfilter einer Prüfung als Bedingung auf Konten. */
const fundFilter = (row: AuditRow) =>
  row.fundId ? eq(s.clubCashAccounts.fundId, row.fundId) : undefined;

async function scopeEntryCount(db: Db, row: AuditRow): Promise<number> {
  const e = s.clubCashEntries;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(e)
    .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, e.accountId))
    .where(
      and(
        eq(e.clubId, row.clubId),
        isNull(e.cancelledAt),
        inArray(e.kind, ['income', 'expense']),
        gte(e.bookedOn, `${row.year}-01-01`),
        lte(e.bookedOn, `${row.year}-12-31`),
        fundFilter(row),
      ),
    );
  return Number(r?.n ?? 0);
}

export async function getAudit(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<ClubAuditDetail> {
  requireLevel(actor);
  const row = await loadAudit(db, actor, id);
  await canSee(db, actor, row);
  const [summary] = await summaries(db, [row]);
  const found = await db
    .select({
      finding: s.clubAuditFindings,
      entry: s.clubCashEntries,
      accountName: s.clubCashAccounts.name,
      fundName: s.clubCashFunds.name,
      categoryName: s.clubCashCategories.name,
    })
    .from(s.clubAuditFindings)
    .leftJoin(s.clubCashEntries, eq(s.clubCashEntries.id, s.clubAuditFindings.entryId))
    .leftJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, s.clubCashEntries.accountId))
    .leftJoin(s.clubCashFunds, eq(s.clubCashFunds.id, s.clubCashAccounts.fundId))
    .leftJoin(s.clubCashCategories, eq(s.clubCashCategories.id, s.clubCashEntries.categoryId))
    .where(eq(s.clubAuditFindings.auditId, id))
    .orderBy(asc(s.clubAuditFindings.createdAt));
  const names = await nameMap(
    db,
    found.map((f) => f.finding.createdByPersonId),
  );
  const findings: ClubAuditFinding[] = found.map((f) => ({
    id: f.finding.id,
    kind: f.finding.kind as ClubAuditFindingKind,
    entry: f.entry
      ? entryRef(actor, now, {
          entry: f.entry,
          accountName: f.accountName ?? '',
          fundName: f.fundName ?? '',
          categoryName: f.categoryName,
        })
      : null,
    text: f.finding.text,
    createdByName: f.finding.createdByPersonId
      ? (names.get(f.finding.createdByPersonId) ?? null)
      : null,
    createdAt: f.finding.createdAt.toISOString(),
  }));
  return { ...summary!, findings, entryCount: await scopeEntryCount(db, row) };
}

async function openAuditFor(db: Db, actor: Actor, id: string) {
  requireLevel(actor);
  const scope = await auditScope(db, actor);
  requireAuditor(scope);
  const row = await loadAudit(db, actor, id);
  if (scope !== null && (row.fundId === null || !scope.includes(row.fundId)))
    throw forbidden('Diese Prüfung gehört nicht zu deinen Kassen.');
  if (row.submittedAt)
    throw new HttpError(
      409,
      'audit_submitted',
      'Der Prüfbericht ist abgegeben und nicht mehr änderbar.',
    );
  return row;
}

/** Zieht zufällige Stichproben aus den noch nicht ausgewählten Buchungen des Prüfumfangs. */
export async function drawSample(
  db: Db,
  actor: Actor,
  id: string,
  count: number,
  now: Date,
): Promise<{ drawn: number }> {
  const row = await openAuditFor(db, actor, id);
  if (!Number.isInteger(count) || count < 1 || count > CLUB_AUDIT_MAX_SAMPLE)
    throw new HttpError(
      400,
      'invalid_count',
      `Bitte 1 bis ${CLUB_AUDIT_MAX_SAMPLE} Stichproben wählen.`,
    );
  const e = s.clubCashEntries;
  const already = await db
    .select({ entryId: s.clubAuditFindings.entryId })
    .from(s.clubAuditFindings)
    .where(eq(s.clubAuditFindings.auditId, id));
  const taken = already.map((a) => a.entryId).filter((x): x is string => !!x);
  const picked = await db
    .select({ id: e.id })
    .from(e)
    .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, e.accountId))
    .where(
      and(
        eq(e.clubId, row.clubId),
        isNull(e.cancelledAt),
        inArray(e.kind, ['income', 'expense']),
        gte(e.bookedOn, `${row.year}-01-01`),
        lte(e.bookedOn, `${row.year}-12-31`),
        notInArray(e.id, taken.concat(NO_ID)),
        fundFilter(row),
      ),
    )
    .orderBy(sql`random()`)
    .limit(count);
  if (picked.length)
    await db.insert(s.clubAuditFindings).values(
      picked.map((p) => ({
        clubId: row.clubId,
        auditId: id,
        entryId: p.id,
        kind: 'pending',
        createdByPersonId: actor.person.id,
        createdAt: now,
      })),
    );
  await audit(
    db,
    actor,
    'clubcash.audit',
    'club_audit',
    id,
    `Kassenprüfung ${row.year}: ${picked.length} Stichproben gezogen`,
    now,
  );
  return { drawn: picked.length };
}

/** Vermerk oder Ergebnis zu einer Buchung (abhaken, beanstanden) bzw. freier Vermerk. */
export async function addFinding(
  db: Db,
  actor: Actor,
  id: string,
  input: ClubAuditFindingInput,
  now: Date,
): Promise<void> {
  const row = await openAuditFor(db, actor, id);
  const text = ('text' in input ? input.text : null)?.trim() || null;
  if (input.kind === 'note') {
    if (!text || text.length < 3)
      throw new HttpError(400, 'text_required', 'Bitte einen Vermerk schreiben.');
    await db.insert(s.clubAuditFindings).values({
      clubId: row.clubId,
      auditId: id,
      kind: 'note',
      text,
      createdByPersonId: actor.person.id,
      createdAt: now,
    });
    return;
  }
  if (input.kind === 'objection' && (!text || text.length < 3))
    throw new HttpError(400, 'text_required', 'Bitte die Beanstandung begründen.');
  // Die Buchung muss zum Prüfumfang gehören
  const e = s.clubCashEntries;
  const [entry] = await db
    .select({ id: e.id })
    .from(e)
    .innerJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, e.accountId))
    .where(
      and(
        eq(e.id, input.entryId),
        eq(e.clubId, row.clubId),
        gte(e.bookedOn, `${row.year}-01-01`),
        lte(e.bookedOn, `${row.year}-12-31`),
        fundFilter(row),
      ),
    );
  if (!entry) throw notFound('Die Buchung');
  const f = s.clubAuditFindings;
  const [existing] = await db
    .select()
    .from(f)
    .where(and(eq(f.auditId, id), eq(f.entryId, input.entryId)));
  if (existing)
    await db
      .update(f)
      .set({
        kind: input.kind,
        text,
        createdByPersonId: actor.person.id,
        createdAt: now,
      })
      .where(eq(f.id, existing.id));
  else
    await db.insert(f).values({
      clubId: row.clubId,
      auditId: id,
      entryId: input.entryId,
      kind: input.kind,
      text,
      createdByPersonId: actor.person.id,
      createdAt: now,
    });
  if (input.kind === 'objection')
    await audit(
      db,
      actor,
      'clubcash.audit',
      'club_audit',
      id,
      `Kassenprüfung ${row.year}: Beanstandung vermerkt`,
      now,
    );
}

export async function removeFinding(
  db: Db,
  actor: Actor,
  id: string,
  findingId: string,
): Promise<void> {
  await openAuditFor(db, actor, id);
  const f = s.clubAuditFindings;
  const [finding] = await db
    .select()
    .from(f)
    .where(and(eq(f.id, findingId), eq(f.auditId, id)));
  if (!finding) throw notFound('Der Vermerk');
  await db.delete(f).where(eq(f.id, findingId));
}

export async function submitAudit(
  db: Db,
  actor: Actor,
  id: string,
  conclusion: string,
  now: Date,
): Promise<void> {
  const row = await openAuditFor(db, actor, id);
  const text = conclusion.trim();
  if (text.length < 10)
    throw new HttpError(400, 'conclusion_required', 'Bitte das Ergebnis der Prüfung beschreiben.');
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.clubAuditFindings)
    .where(and(eq(s.clubAuditFindings.auditId, id), eq(s.clubAuditFindings.kind, 'pending')))) as [
    { n: number },
  ];
  if (n > 0)
    throw new HttpError(
      409,
      'pending_samples',
      `Es sind noch ${n} Stichproben offen. Bitte alle abhaken oder beanstanden.`,
    );
  await db
    .update(s.clubAudits)
    .set({ submittedAt: now, conclusion: text })
    .where(eq(s.clubAudits.id, id));
  await audit(
    db,
    actor,
    'clubcash.audit',
    'club_audit',
    id,
    `Kassenprüfung ${row.year}: Prüfbericht abgegeben`,
    now,
  );
}

// ── Prüfbericht (CSV und PDF über kurzlebigen Link) ─────────────────────────

const LINK_MS = 10 * 60 * 1000;

export async function auditReportLink(
  db: Db,
  actor: Actor,
  id: string,
  format: 'csv' | 'pdf',
  now: Date,
): Promise<{ token: string; expiresAt: string }> {
  requireLevel(actor);
  const row = await loadAudit(db, actor, id);
  await canSee(db, actor, row);
  const expiresAt = new Date(now.getTime() + LINK_MS);
  const key = `${format === 'pdf' ? 'ap' : 'a'}:${actor.club.id}|${id}`;
  return { token: actor.links.create(key, expiresAt), expiresAt: expiresAt.toISOString() };
}

const cell = (value: string | null | undefined): string => {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
const KIND_LABEL: Record<ClubAuditFindingKind, string> = {
  pending: 'Offen',
  checked: 'In Ordnung',
  objection: 'Beanstandet',
  note: 'Vermerk',
};

async function reportData(db: Db, payload: string, now: Date) {
  const [clubId, auditId] = payload.split('|');
  if (!clubId || !auditId) return null;
  const [row] = await db
    .select()
    .from(s.clubAudits)
    .where(and(eq(s.clubAudits.id, auditId), eq(s.clubAudits.clubId, clubId)));
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.id, clubId));
  if (!row || !club) return null;
  const [summary] = await summaries(db, [row]);
  const found = await db
    .select({
      finding: s.clubAuditFindings,
      entry: s.clubCashEntries,
      accountName: s.clubCashAccounts.name,
      categoryName: s.clubCashCategories.name,
    })
    .from(s.clubAuditFindings)
    .leftJoin(s.clubCashEntries, eq(s.clubCashEntries.id, s.clubAuditFindings.entryId))
    .leftJoin(s.clubCashAccounts, eq(s.clubCashAccounts.id, s.clubCashEntries.accountId))
    .leftJoin(s.clubCashCategories, eq(s.clubCashCategories.id, s.clubCashEntries.categoryId))
    .where(eq(s.clubAuditFindings.auditId, auditId))
    .orderBy(asc(s.clubAuditFindings.createdAt));
  const names = await nameMap(
    db,
    found.map((f) => f.finding.createdByPersonId),
  );
  const created = german(toIsoDate(calendarDayOf(now, club.timezone)));
  return { club, row, summary: summary!, found, names, created };
}

export async function auditReportCsv(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; csv: string } | null> {
  const r = await reportData(db, payload, now);
  if (!r) return null;
  const { club, row, summary, found, names } = r;
  const lines = [
    `Prüfbericht Vereinskasse ${row.year};${cell(club.name)}`,
    `Prüfumfang;${cell(summary.fundName)}`,
    `Status;${row.submittedAt ? `Abgegeben am ${german(row.submittedAt.toISOString().slice(0, 10))}` : 'Entwurf'}`,
    `Erstellt;${r.created}`,
    '',
    `Stichproben abgehakt;${summary.checked}`,
    `Beanstandungen;${summary.objections}`,
    `Offene Stichproben;${summary.pending}`,
    '',
    'Ergebnis;Datum;Betrag;Zweck;Konto;Kategorie;Vermerk;Geprüft von',
    ...found.map((f) =>
      [
        KIND_LABEL[f.finding.kind as ClubAuditFindingKind],
        f.entry ? german(f.entry.bookedOn) : '',
        f.entry ? euro(f.entry.amountCents) : '',
        cell(f.entry?.purpose),
        cell(f.accountName),
        cell(f.categoryName),
        cell(f.finding.text),
        cell(f.finding.createdByPersonId ? names.get(f.finding.createdByPersonId) : null),
      ].join(';'),
    ),
    '',
    `Gesamtergebnis;${cell(row.conclusion ?? '(noch nicht abgegeben)')}`,
  ];
  return {
    fileName: `Prüfbericht ${row.year} ${club.shortName}.csv`,
    csv: '﻿' + lines.join('\r\n') + '\r\n',
  };
}

export async function auditReportPdf(
  db: Db,
  payload: string,
  now: Date,
): Promise<{ fileName: string; pdf: Buffer } | null> {
  const r = await reportData(db, payload, now);
  if (!r) return null;
  const { club, row, summary, found, names } = r;
  const doc = new SimplePdf();
  doc.text(`Prüfbericht Vereinskasse ${row.year}`, { size: 18, bold: true });
  doc.text(`${club.name} · Prüfumfang: ${summary.fundName}`, { size: 10 });
  doc.text(
    row.submittedAt
      ? `Abgegeben am ${german(row.submittedAt.toISOString().slice(0, 10))}${summary.startedByName ? ` · Prüfung begonnen von ${summary.startedByName}` : ''}`
      : 'Entwurf – noch nicht abgegeben',
    { size: 9 },
  );
  doc.text(`Erstellt am ${r.created}`, { size: 9 });
  doc.gap(10);
  doc.text(
    `${summary.checked} Stichproben in Ordnung · ${summary.objections} Beanstandungen · ${summary.pending} offen`,
    { size: 11, bold: true },
  );
  doc.gap(6);
  const cols = [56, 112, 170, 250, 400, 539];
  doc.row(['Ergebnis', 'Datum', 'Betrag', 'Zweck', 'Vermerk'], cols, {
    bold: true,
    alignRight: [2],
  });
  for (const f of found.filter((x) => x.finding.kind !== 'note'))
    doc.row(
      [
        KIND_LABEL[f.finding.kind as ClubAuditFindingKind],
        f.entry ? german(f.entry.bookedOn) : '',
        f.entry ? `${euro(f.entry.amountCents)} €` : '',
        f.entry?.purpose ?? '',
        f.finding.text ?? '',
      ],
      cols,
      { alignRight: [2] },
    );
  const notes = found.filter((x) => x.finding.kind === 'note');
  if (notes.length) {
    doc.gap(10);
    doc.text('Vermerke', { size: 12, bold: true });
    for (const n of notes)
      doc.paragraph(
        `${n.finding.text}${n.finding.createdByPersonId ? ` (${names.get(n.finding.createdByPersonId) ?? ''})` : ''}`,
      );
  }
  doc.gap(12);
  doc.text('Ergebnis der Prüfung (Grundlage der Entlastung)', { size: 12, bold: true });
  doc.paragraph(row.conclusion ?? '(noch nicht abgegeben)');
  return { fileName: `Prüfbericht ${row.year} ${club.shortName}.pdf`, pdf: doc.build() };
}
