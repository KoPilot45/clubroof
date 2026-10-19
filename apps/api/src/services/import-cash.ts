/**
 * Import-Bereiche der Vereinskasse (Paket IMPORT-EXPORT, Stufe 4): Beitragsarten, Beitragszuordnung je Mitglied,
 * offene Posten, Haushaltsplan und Buchungen. Rechte wie die Vereinskasse (`clubcash.manage`); Buchungen und Planzeilen
 * laufen über dieselben Dienste wie die Bildschirme, damit Abschlusssperren und Kassenrechte gelten. Rückgängig
 * macht Buchungen per Storno rückgängig (die Kasse löscht nie).
 */
import { CLUB_FEE_INTERVALS, type ClubFeeInterval, type ImportRow } from '@clubroof/core';
import { schema as s } from '@clubroof/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { actorCan } from '../actor';
import { createEntry } from './club-cash';
import { ensureMainFund } from './club-funds';
import { saveBudgetLine } from './club-planning';
import {
  field,
  norm,
  parseDate,
  type AreaCtx,
  type AreaHandler,
  type CheckedRow,
} from './import-common';

const allowed = (actor: Parameters<AreaHandler['allowed']>[0]) =>
  actorCan(actor, 'clubcash.manage');

/** „12,50“, „1.234,56 €“, „-80“ → Cent; `null` leer, `undefined` ungültig */
export function parseMoney(value: string): number | null | undefined {
  const v = value.trim().replace(/€|eur|\s/gi, '');
  if (!v) return null;
  const clean = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return undefined;
  return Math.round(Number(clean) * 100);
}

const INTERVAL_WORDS: Record<string, ClubFeeInterval> = {
  monthly: 'monthly',
  monatlich: 'monthly',
  monat: 'monthly',
  quarterly: 'quarterly',
  vierteljaehrlich: 'quarterly',
  quartal: 'quarterly',
  yearly: 'yearly',
  jaehrlich: 'yearly',
  jahr: 'yearly',
  once: 'once',
  einmalig: 'once',
};

function statusFor(mode: AreaCtx['mode'], known: boolean): ImportRow['status'] {
  if (!known) return 'new';
  return mode === 'update' ? 'update' : mode === 'create' ? 'new' : 'duplicate';
}

/** Mitglieder (nicht ausgetreten) nach Mitgliedsnummer oder Name; Namensgleiche gelten als nicht eindeutig. */
async function personIndex(ctx: AreaCtx) {
  const rows = await ctx.db
    .select({
      id: s.persons.id,
      first: s.persons.firstName,
      last: s.persons.lastName,
      number: s.persons.memberNumber,
      status: s.persons.membershipStatus,
    })
    .from(s.persons)
    .where(eq(s.persons.clubId, ctx.actor.club.id));
  const live = rows.filter((r) => r.status !== 'left');
  const byKey = new Map<string, string[]>();
  const add = (key: string, id: string) => {
    if (!key) return;
    byKey.set(key, [...(byKey.get(key) ?? []), id]);
  };
  for (const r of live) {
    add(`n:${norm(r.number ?? '')}`, r.id);
    add(`a:${norm(r.first + r.last)}`, r.id);
    add(`a:${norm(r.last + r.first)}`, r.id);
  }
  const names = new Map(live.map((r) => [r.id, `${r.first} ${r.last}`]));
  return {
    names,
    find(value: string): { id?: string; error?: string } {
      const v = value.trim();
      if (!v) return { error: 'Das Mitglied fehlt.' };
      const hits = [
        ...new Set([
          ...(byKey.get(`n:${norm(v)}`) ?? []),
          ...(byKey.get(`a:${norm(v.replace(',', ' '))}`) ?? []),
        ]),
      ];
      if (hits.length === 1) return { id: hits[0] };
      return {
        error: hits.length
          ? `„${v}“ ist nicht eindeutig – bitte die Mitgliedsnummer angeben.`
          : `Mitglied „${v}“ nicht gefunden.`,
      };
    },
  };
}

// ── Beitragsarten ───────────────────────────────────────────────────────────

type FeeTypeData = {
  name: string;
  amountCents: number;
  interval: ClubFeeInterval;
  existingId: string | null;
};

const feeTypes: AreaHandler<FeeTypeData> = {
  info: {
    label: 'Beitragsarten',
    text: 'Beitragsarten der Vereinskasse mit Betrag und Rhythmus (jährlich, vierteljährlich, monatlich, einmalig).',
    needsTeam: false,
    fields: [
      field('name', 'Name', 'Name der Beitragsart', 'Erwachsene', true),
      field('amount', 'Betrag', 'in Euro je Rhythmus', '120,00', true),
      field(
        'interval',
        'Rhythmus',
        'jährlich, vierteljährlich, monatlich oder einmalig',
        'jährlich',
      ),
    ],
  },
  allowed,
  async check(ctx, rows) {
    const existing = await ctx.db
      .select({ id: s.clubFeeTypes.id, name: s.clubFeeTypes.name })
      .from(s.clubFeeTypes)
      .where(and(eq(s.clubFeeTypes.clubId, ctx.actor.club.id), isNull(s.clubFeeTypes.archivedAt)));
    const byName = new Map(existing.map((e) => [norm(e.name), e]));
    const seen = new Set<string>();
    return rows.map(({ get }): CheckedRow<FeeTypeData> => {
      const errors: string[] = [];
      const name = get('name');
      if (name.length < 2 || name.length > 60) errors.push('Der Name braucht 2 bis 60 Zeichen.');
      const amount = parseMoney(get('amount'));
      if (amount === null || amount === undefined || amount <= 0)
        errors.push(`Betrag „${get('amount')}“ ist ungültig.`);
      const interval = get('interval') ? INTERVAL_WORDS[norm(get('interval'))] : 'yearly';
      if (!interval) errors.push(`Rhythmus „${get('interval')}“ ist unbekannt.`);
      const known = byName.get(norm(name)) ?? null;
      const inFile = seen.has(norm(name));
      seen.add(norm(name));
      let status = inFile ? 'duplicate' : statusFor(ctx.mode, !!known);
      if (errors.length) status = 'error';
      return {
        status,
        errors,
        warnings: [],
        match: inFile ? 'weiter oben in der Datei' : (known?.name ?? null),
        data: {
          name,
          amountCents: amount ?? 0,
          interval: interval ?? 'yearly',
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
            .from(s.clubFeeTypes)
            .where(eq(s.clubFeeTypes.id, data.existingId));
          if (!row) continue;
          await tx
            .update(s.clubFeeTypes)
            .set({ amountCents: data.amountCents, interval: data.interval })
            .where(eq(s.clubFeeTypes.id, row.id));
          updated.push({
            id: row.id,
            before: { amountCents: row.amountCents, interval: row.interval },
          });
        } else {
          const [row] = await tx
            .insert(s.clubFeeTypes)
            .values({
              clubId: ctx.actor.club.id,
              name: data.name,
              amountCents: data.amountCents,
              interval: data.interval,
              createdAt: ctx.now,
            })
            .returning({ id: s.clubFeeTypes.id });
          createdIds.push(row!.id);
        }
      }
    });
    return {
      created: createdIds.length,
      updated: updated.length,
      payload: { createdIds, updated },
    };
  },
  async undo(ctx, payload) {
    const p = payload as { createdIds: string[]; updated: { id: string; before: object }[] };
    await ctx.db.transaction(async (tx) => {
      for (const u of p.updated)
        await tx.update(s.clubFeeTypes).set(u.before).where(eq(s.clubFeeTypes.id, u.id));
      // Beitragsarten mit Zuordnungen bleiben bestehen (sie würden sonst ins Leere zeigen)
      for (const id of p.createdIds) {
        const used = await tx
          .select({ id: s.clubFeeAssignments.id })
          .from(s.clubFeeAssignments)
          .where(eq(s.clubFeeAssignments.feeTypeId, id))
          .limit(1);
        if (used.length === 0) await tx.delete(s.clubFeeTypes).where(eq(s.clubFeeTypes.id, id));
        else
          await tx
            .update(s.clubFeeTypes)
            .set({ archivedAt: ctx.now })
            .where(eq(s.clubFeeTypes.id, id));
      }
    });
  },
};

async function feeTypeIndex(ctx: AreaCtx) {
  const rows = await ctx.db
    .select()
    .from(s.clubFeeTypes)
    .where(and(eq(s.clubFeeTypes.clubId, ctx.actor.club.id), isNull(s.clubFeeTypes.archivedAt)));
  return new Map(rows.map((r) => [norm(r.name), r]));
}

// ── Beitragszuordnung je Mitglied ───────────────────────────────────────────

type AssignmentData = {
  personId: string;
  feeTypeId: string;
  validFrom: string;
  overrideCents: number | null;
};

const feeAssignments: AreaHandler<AssignmentData> = {
  info: {
    label: 'Beitragszuordnung',
    text: 'Welches Mitglied welche Beitragsart zahlt (ab wann, optional mit abweichendem Betrag). Mitglieder werden über Mitgliedsnummer oder Namen erkannt.',
    needsTeam: false,
    fields: [
      field('person', 'Mitglied', 'Mitgliedsnummer oder „Vorname Nachname“', '1001', true),
      field('feeType', 'Beitragsart', 'Name einer vorhandenen Beitragsart', 'Erwachsene', true),
      field('validFrom', 'Gültig ab', 'TT.MM.JJJJ, leer = heute', '01.01.2026'),
      field(
        'amount',
        'Abweichender Betrag',
        'in Euro, nur wenn er von der Beitragsart abweicht',
        '90,00',
      ),
    ],
  },
  allowed,
  async check(ctx, rows) {
    const people = await personIndex(ctx);
    const types = await feeTypeIndex(ctx);
    const running = await ctx.db
      .select({
        personId: s.clubFeeAssignments.personId,
        feeTypeId: s.clubFeeAssignments.feeTypeId,
      })
      .from(s.clubFeeAssignments)
      .where(
        and(
          eq(s.clubFeeAssignments.clubId, ctx.actor.club.id),
          isNull(s.clubFeeAssignments.validTo),
        ),
      );
    const has = new Set(running.map((r) => `${r.personId}:${r.feeTypeId}`));
    const seen = new Set<string>();
    return rows.map(({ get }): CheckedRow<AssignmentData> => {
      const errors: string[] = [];
      const person = people.find(get('person'));
      if (person.error) errors.push(person.error);
      const type = types.get(norm(get('feeType')));
      if (!type)
        errors.push(
          `Beitragsart „${get('feeType')}“ gibt es nicht (zuerst die Beitragsarten importieren).`,
        );
      const from = parseDate(get('validFrom'));
      if (from === undefined) errors.push(`Datum „${get('validFrom')}“ ist ungültig.`);
      const amount = parseMoney(get('amount'));
      if (amount === undefined || (amount !== null && amount <= 0))
        errors.push(`Betrag „${get('amount')}“ ist ungültig.`);
      const key = `${person.id}:${type?.id}`;
      const known = !!person.id && !!type && (has.has(key) || seen.has(key));
      if (person.id && type) seen.add(key);
      const status = errors.length ? 'error' : known ? 'duplicate' : 'new';
      return {
        status,
        errors,
        warnings: [],
        match: known ? 'läuft schon' : null,
        data: {
          personId: person.id ?? '',
          feeTypeId: type?.id ?? '',
          validFrom: from ?? ctx.today,
          overrideCents: amount ?? null,
        },
      };
    });
  },
  async commit(ctx, rows) {
    const ids: string[] = [];
    await ctx.db.transaction(async (tx) => {
      for (const { status, data } of rows) {
        if (status === 'duplicate') continue;
        const [row] = await tx
          .insert(s.clubFeeAssignments)
          .values({
            clubId: ctx.actor.club.id,
            personId: data.personId,
            feeTypeId: data.feeTypeId,
            amountOverrideCents: data.overrideCents,
            validFrom: data.validFrom,
            createdAt: ctx.now,
          })
          .returning({ id: s.clubFeeAssignments.id });
        ids.push(row!.id);
      }
    });
    return { created: ids.length, updated: 0, payload: { ids } };
  },
  async undo(ctx, payload) {
    const ids = (payload as { ids: string[] }).ids;
    for (const id of ids) {
      const dues = await ctx.db
        .select({ id: s.clubFeeDues.id })
        .from(s.clubFeeDues)
        .where(eq(s.clubFeeDues.assignmentId, id))
        .limit(1);
      if (dues.length === 0)
        await ctx.db.delete(s.clubFeeAssignments).where(eq(s.clubFeeAssignments.id, id));
      else
        await ctx.db
          .update(s.clubFeeAssignments)
          .set({ validTo: ctx.now.toISOString().slice(0, 10) })
          .where(eq(s.clubFeeAssignments.id, id));
    }
  },
};

// ── Offene Posten ───────────────────────────────────────────────────────────

type DueData = {
  assignmentId: string;
  personId: string;
  feeTypeId: string;
  periodLabel: string;
  dueOn: string;
  amountCents: number;
};

const feeDues: AreaHandler<DueData> = {
  info: {
    label: 'Offene Posten',
    text: 'Beitragsforderungen, die noch offen sind (etwa aus einer alten Liste). Das Mitglied braucht dafür die Beitragszuordnung.',
    needsTeam: false,
    fields: [
      field('person', 'Mitglied', 'Mitgliedsnummer oder „Vorname Nachname“', '1001', true),
      field('feeType', 'Beitragsart', 'Name einer vorhandenen Beitragsart', 'Erwachsene', true),
      field('dueOn', 'Fällig am', 'TT.MM.JJJJ', '31.01.2026', true),
      field('amount', 'Betrag', 'in Euro; leer = Betrag der Beitragsart', '120,00'),
      field('period', 'Zeitraum', 'Text wie „Jahr 2026“; leer = Fälligkeitsdatum', 'Jahr 2026'),
    ],
  },
  allowed,
  async check(ctx, rows) {
    const people = await personIndex(ctx);
    const types = await feeTypeIndex(ctx);
    const assignments = await ctx.db
      .select()
      .from(s.clubFeeAssignments)
      .where(eq(s.clubFeeAssignments.clubId, ctx.actor.club.id));
    const dues = await ctx.db
      .select({ assignmentId: s.clubFeeDues.assignmentId, dueOn: s.clubFeeDues.dueOn })
      .from(s.clubFeeDues)
      .where(eq(s.clubFeeDues.clubId, ctx.actor.club.id));
    const haveDue = new Set(dues.map((d) => `${d.assignmentId}:${d.dueOn}`));
    return rows.map(({ get }): CheckedRow<DueData> => {
      const errors: string[] = [];
      const person = people.find(get('person'));
      if (person.error) errors.push(person.error);
      const type = types.get(norm(get('feeType')));
      if (!type) errors.push(`Beitragsart „${get('feeType')}“ gibt es nicht.`);
      const dueOn = parseDate(get('dueOn'));
      if (!dueOn) errors.push(`Fälligkeit „${get('dueOn')}“ fehlt oder ist ungültig.`);
      const given = parseMoney(get('amount'));
      if (given === undefined || (given !== null && given <= 0))
        errors.push(`Betrag „${get('amount')}“ ist ungültig.`);
      const assignment = assignments
        .filter((a) => a.personId === person.id && a.feeTypeId === type?.id)
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
      if (person.id && type && !assignment)
        errors.push(
          'Dem Mitglied ist diese Beitragsart nicht zugeordnet (zuerst die Zuordnung importieren).',
        );
      const duplicate = !!assignment && !!dueOn && haveDue.has(`${assignment.id}:${dueOn}`);
      return {
        status: errors.length ? 'error' : duplicate ? 'duplicate' : 'new',
        errors,
        warnings: [],
        match: duplicate ? 'Forderung gibt es schon' : null,
        data: {
          assignmentId: assignment?.id ?? '',
          personId: person.id ?? '',
          feeTypeId: type?.id ?? '',
          periodLabel: get('period') || (dueOn ? dueOn.split('-').reverse().join('.') : ''),
          dueOn: dueOn ?? '',
          amountCents: given ?? assignment?.amountOverrideCents ?? type?.amountCents ?? 0,
        },
      };
    });
  },
  async commit(ctx, rows) {
    const ids: string[] = [];
    await ctx.db.transaction(async (tx) => {
      for (const { status, data } of rows) {
        if (status === 'duplicate') continue;
        const [row] = await tx
          .insert(s.clubFeeDues)
          .values({
            clubId: ctx.actor.club.id,
            personId: data.personId,
            feeTypeId: data.feeTypeId,
            assignmentId: data.assignmentId,
            periodLabel: data.periodLabel,
            dueOn: data.dueOn,
            amountCents: data.amountCents,
            createdAt: ctx.now,
          })
          .returning({ id: s.clubFeeDues.id });
        ids.push(row!.id);
      }
    });
    return { created: ids.length, updated: 0, payload: { ids } };
  },
  async undo(ctx, payload) {
    const ids = (payload as { ids: string[] }).ids;
    if (!ids.length) return;
    // Forderungen mit Zahlung bleiben (sie hängen an Buchungen); die übrigen werden storniert statt gelöscht
    const paid = await ctx.db
      .select({ dueId: s.clubFeePayments.dueId })
      .from(s.clubFeePayments)
      .where(inArray(s.clubFeePayments.dueId, ids));
    const withPayment = new Set(paid.map((p) => p.dueId));
    const removable = ids.filter((id) => !withPayment.has(id));
    if (removable.length)
      await ctx.db.delete(s.clubFeeDues).where(inArray(s.clubFeeDues.id, removable));
  },
};

// ── Haushaltsplan ───────────────────────────────────────────────────────────

type BudgetData = {
  fundId: string;
  year: number;
  categoryId: string;
  costCenterId: string | null;
  plannedCents: number;
  note: string | null;
  existing: { id: string; plannedCents: number; note: string | null } | null;
};

const budget: AreaHandler<BudgetData> = {
  info: {
    label: 'Haushaltsplan',
    text: 'Planbeträge je Jahr und Kategorie (optional mit Kostenstelle und Kasse). Vorhandene Zeilen werden je nach Auswahl übersprungen oder aktualisiert.',
    needsTeam: false,
    fields: [
      field('year', 'Jahr', 'vierstellig', '2026', true),
      field(
        'category',
        'Kategorie',
        'Name einer Kategorie der Vereinskasse',
        'Mitgliedsbeiträge',
        true,
      ),
      field('amount', 'Planbetrag', 'in Euro', '36000,00', true),
      field('costCenter', 'Kostenstelle', 'Name einer Kostenstelle', 'Jugend'),
      field('fund', 'Kasse', 'leer = Hauptkasse', 'Hauptkasse'),
      field('note', 'Notiz', 'frei', 'nach Beschluss der Versammlung'),
    ],
  },
  allowed,
  async check(ctx, rows) {
    const clubId = ctx.actor.club.id;
    const mainId = await ensureMainFund(ctx.db, clubId, ctx.now);
    const funds = await ctx.db
      .select()
      .from(s.clubCashFunds)
      .where(eq(s.clubCashFunds.clubId, clubId));
    const cats = await ctx.db
      .select()
      .from(s.clubCashCategories)
      .where(and(eq(s.clubCashCategories.clubId, clubId), isNull(s.clubCashCategories.archivedAt)));
    const centers = await ctx.db
      .select()
      .from(s.clubCostCenters)
      .where(and(eq(s.clubCostCenters.clubId, clubId), isNull(s.clubCostCenters.archivedAt)));
    const lines = await ctx.db
      .select()
      .from(s.clubBudgetLines)
      .where(eq(s.clubBudgetLines.clubId, clubId));
    return rows.map(({ get }): CheckedRow<BudgetData> => {
      const errors: string[] = [];
      const year = Number(get('year'));
      if (!Number.isInteger(year) || year < 2000 || year > 2100)
        errors.push(`Jahr „${get('year')}“ ist ungültig.`);
      const cat = cats.find((c) => norm(c.name) === norm(get('category')));
      if (!cat) errors.push(`Kategorie „${get('category')}“ gibt es nicht.`);
      const center = get('costCenter')
        ? centers.find((c) => norm(c.name) === norm(get('costCenter')))
        : null;
      if (get('costCenter') && !center)
        errors.push(`Kostenstelle „${get('costCenter')}“ gibt es nicht.`);
      const fund = get('fund')
        ? funds.find((f) => norm(f.name) === norm(get('fund')) && !f.archivedAt)
        : funds.find((f) => f.id === mainId);
      if (!fund) errors.push(`Kasse „${get('fund')}“ gibt es nicht.`);
      const amount = parseMoney(get('amount'));
      if (amount === null || amount === undefined || amount < 0)
        errors.push(`Planbetrag „${get('amount')}“ ist ungültig.`);
      const existing =
        fund && cat
          ? (lines.find(
              (l) =>
                l.fundId === fund.id &&
                l.year === year &&
                l.categoryId === cat.id &&
                (l.costCenterId ?? null) === (center?.id ?? null),
            ) ?? null)
          : null;
      const status = errors.length
        ? 'error'
        : statusFor(ctx.mode === 'create' ? 'update' : ctx.mode, !!existing);
      return {
        status,
        errors,
        warnings: [],
        match: existing ? `${euroText(existing.plannedCents)} geplant` : null,
        data: {
          fundId: fund?.id ?? '',
          year,
          categoryId: cat?.id ?? '',
          costCenterId: center?.id ?? null,
          plannedCents: amount ?? 0,
          note: get('note') || null,
          existing: existing
            ? { id: existing.id, plannedCents: existing.plannedCents, note: existing.note }
            : null,
        },
      };
    });
  },
  async commit(ctx, rows) {
    const created: BudgetData[] = [];
    const updated: { id: string; plannedCents: number; note: string | null }[] = [];
    for (const { status, data } of rows) {
      if (status === 'duplicate') continue;
      await saveBudgetLine(
        ctx.db,
        ctx.actor,
        {
          fundId: data.fundId,
          year: data.year,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId,
          plannedCents: data.plannedCents,
          note: data.note,
        },
        ctx.now,
      );
      if (data.existing) updated.push(data.existing);
      else created.push(data);
    }
    // IDs der neuen Zeilen für „Rückgängig“ nachschlagen
    const createdIds: string[] = [];
    for (const c of created) {
      const [row] = await ctx.db
        .select({ id: s.clubBudgetLines.id })
        .from(s.clubBudgetLines)
        .where(
          and(
            eq(s.clubBudgetLines.fundId, c.fundId),
            eq(s.clubBudgetLines.year, c.year),
            eq(s.clubBudgetLines.categoryId, c.categoryId),
            c.costCenterId
              ? eq(s.clubBudgetLines.costCenterId, c.costCenterId)
              : isNull(s.clubBudgetLines.costCenterId),
          ),
        );
      if (row) createdIds.push(row.id);
    }
    return {
      created: createdIds.length,
      updated: updated.length,
      payload: { createdIds, updated },
    };
  },
  async undo(ctx, payload) {
    const p = payload as {
      createdIds: string[];
      updated: { id: string; plannedCents: number; note: string | null }[];
    };
    for (const u of p.updated)
      await ctx.db
        .update(s.clubBudgetLines)
        .set({ plannedCents: u.plannedCents, note: u.note })
        .where(eq(s.clubBudgetLines.id, u.id));
    if (p.createdIds.length)
      await ctx.db.delete(s.clubBudgetLines).where(inArray(s.clubBudgetLines.id, p.createdIds));
  },
};

const euroText = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

// ── Buchungen ───────────────────────────────────────────────────────────────

type EntryData = {
  accountId: string;
  kind: 'income' | 'expense';
  amountCents: number;
  bookedOn: string;
  categoryId: string;
  costCenterId: string | null;
  counterparty: string | null;
  purpose: string;
  receiptNo: string | null;
};

const cashEntries: AreaHandler<EntryData> = {
  info: {
    label: 'Buchungen',
    text: 'Einnahmen und Ausgaben des Kassenbuchs. Der Betrag trägt das Vorzeichen (Ausgaben negativ) oder die Spalte Art sagt „Einnahme“ bzw. „Ausgabe“. Gesperrte Jahre werden abgelehnt.',
    needsTeam: false,
    fields: [
      field('date', 'Datum', 'TT.MM.JJJJ', '15.03.2026', true),
      field('account', 'Konto', 'Name eines Kontos der Vereinskasse', 'Girokonto', true),
      field('amount', 'Betrag', 'in Euro; Ausgaben mit Minus', '-80,00', true),
      field('kind', 'Art', 'Einnahme oder Ausgabe (optional, sonst nach Vorzeichen)', 'Ausgabe'),
      field('category', 'Kategorie', 'Name einer Kategorie', 'Platzpflege', true),
      field('costCenter', 'Kostenstelle', 'Name einer Kostenstelle', 'Jugend'),
      field('counterparty', 'Gegenpartei', 'von wem / an wen', 'Gartenbau Müller'),
      field('purpose', 'Verwendungszweck', 'Text der Buchung', 'Rasendünger', true),
      field('receipt', 'Belegnummer', 'frei', 'R-2026-014'),
    ],
  },
  allowed,
  async check(ctx, rows) {
    const clubId = ctx.actor.club.id;
    const accounts = await ctx.db
      .select()
      .from(s.clubCashAccounts)
      .where(and(eq(s.clubCashAccounts.clubId, clubId), isNull(s.clubCashAccounts.archivedAt)));
    const cats = await ctx.db
      .select()
      .from(s.clubCashCategories)
      .where(and(eq(s.clubCashCategories.clubId, clubId), isNull(s.clubCashCategories.archivedAt)));
    const centers = await ctx.db
      .select()
      .from(s.clubCostCenters)
      .where(and(eq(s.clubCostCenters.clubId, clubId), isNull(s.clubCostCenters.archivedAt)));
    const existing = await ctx.db
      .select({
        accountId: s.clubCashEntries.accountId,
        bookedOn: s.clubCashEntries.bookedOn,
        amountCents: s.clubCashEntries.amountCents,
        purpose: s.clubCashEntries.purpose,
        cancelledAt: s.clubCashEntries.cancelledAt,
      })
      .from(s.clubCashEntries)
      .where(eq(s.clubCashEntries.clubId, clubId));
    const known = new Set(
      existing
        .filter((e) => !e.cancelledAt)
        .map((e) => `${e.accountId}|${e.bookedOn}|${e.amountCents}|${norm(e.purpose)}`),
    );
    const locks = await ctx.db
      .select({ year: s.clubPeriodLocks.year })
      .from(s.clubPeriodLocks)
      .where(and(eq(s.clubPeriodLocks.clubId, clubId), isNull(s.clubPeriodLocks.unlockedAt)));
    const locked = new Set(locks.map((l) => l.year));
    const seen = new Set<string>();
    return rows.map(({ get }): CheckedRow<EntryData> => {
      const errors: string[] = [];
      const date = parseDate(get('date'));
      if (!date) errors.push(`Datum „${get('date')}“ fehlt oder ist ungültig.`);
      if (date && locked.has(Number(date.slice(0, 4))))
        errors.push(`Das Jahr ${date.slice(0, 4)} ist abgeschlossen.`);
      const account = accounts.find((a) => norm(a.name) === norm(get('account')));
      if (!account) errors.push(`Konto „${get('account')}“ gibt es nicht.`);
      const amount = parseMoney(get('amount'));
      if (amount === null || amount === undefined || amount === 0)
        errors.push(`Betrag „${get('amount')}“ ist ungültig.`);
      const kindWord = norm(get('kind'));
      const kind: 'income' | 'expense' | null = kindWord
        ? kindWord === 'einnahme'
          ? 'income'
          : kindWord === 'ausgabe'
            ? 'expense'
            : null
        : amount !== null && amount !== undefined && amount < 0
          ? 'expense'
          : 'income';
      if (!kind) errors.push(`Art „${get('kind')}“ ist weder Einnahme noch Ausgabe.`);
      const cat = cats.find((c) => norm(c.name) === norm(get('category')));
      if (!cat) errors.push(`Kategorie „${get('category')}“ gibt es nicht.`);
      else if (kind && cat.direction !== kind)
        errors.push(
          `Die Kategorie „${cat.name}“ gilt für ${cat.direction === 'income' ? 'Einnahmen' : 'Ausgaben'}.`,
        );
      const center = get('costCenter')
        ? centers.find((c) => norm(c.name) === norm(get('costCenter')))
        : null;
      if (get('costCenter') && !center)
        errors.push(`Kostenstelle „${get('costCenter')}“ gibt es nicht.`);
      if (!get('purpose')) errors.push('Der Verwendungszweck fehlt.');
      const cents = Math.abs(amount ?? 0);
      const key = `${account?.id}|${date}|${cents}|${norm(get('purpose'))}`;
      const dup = !errors.length && (known.has(key) || seen.has(key));
      if (!errors.length) seen.add(key);
      const status = errors.length
        ? 'error'
        : dup
          ? statusFor(ctx.mode === 'update' ? 'skip' : ctx.mode, true)
          : 'new';
      return {
        status,
        errors,
        warnings: [],
        match: dup ? 'gleiche Buchung gibt es schon' : null,
        data: {
          accountId: account?.id ?? '',
          kind: kind ?? 'income',
          amountCents: cents,
          bookedOn: date ?? '',
          categoryId: cat?.id ?? '',
          costCenterId: center?.id ?? null,
          counterparty: get('counterparty') || null,
          purpose: get('purpose'),
          receiptNo: get('receipt') || null,
        },
      };
    });
  },
  async commit(ctx, rows, runId) {
    void runId;
    const ids: string[] = [];
    try {
      for (const { status, data } of rows) {
        if (status === 'duplicate') continue;
        const entry = await createEntry(ctx.db, ctx.actor, data, ctx.now);
        ids.push(entry.id);
      }
    } catch (e) {
      // alles oder nichts: bereits gebuchte Zeilen dieses Laufs wieder stornieren
      await storno(ctx, ids);
      throw e;
    }
    return { created: ids.length, updated: 0, payload: { ids } };
  },
  async undo(ctx, payload) {
    await storno(ctx, (payload as { ids: string[] }).ids);
  },
};

/** Buchungen des Laufs stornieren (die Kasse löscht nie); Umbuchungen und schon stornierte bleiben unberührt. */
async function storno(ctx: Pick<AreaCtx, 'db' | 'actor' | 'now'>, ids: string[]) {
  if (!ids.length) return;
  await ctx.db
    .update(s.clubCashEntries)
    .set({
      cancelledAt: ctx.now,
      cancelledByPersonId: ctx.actor.person.id,
      cancelReason: 'Import rückgängig gemacht',
    })
    .where(and(inArray(s.clubCashEntries.id, ids), isNull(s.clubCashEntries.cancelledAt)));
}

export const CASH_HANDLERS = {
  fee_types: feeTypes,
  fee_assignments: feeAssignments,
  fee_dues: feeDues,
  budget,
  cash_entries: cashEntries,
} as const;
void CLUB_FEE_INTERVALS;
