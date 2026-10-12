/**
 * Spenden und Zuwendungsbestätigungen (Paket K4): Spende erfassen (mit Buchung im Kassenbuch),
 * Steuerdaten des Vereins pflegen, Bestätigung ausstellen. Die Vorlage ist an eine rechtliche bzw.
 * steuerliche Prüfung gebunden: Erst wenn die Administration bestätigt, dass die Vorlage geprüft
 * wurde, können Bestätigungen ausgestellt werden. Die App ersetzt keine Steuerberatung.
 */
import {
  calendarDayOf,
  toIsoDate,
  type ClubDonation,
  type ClubDonationInput,
  type ClubDonations,
  type ClubTaxInfo,
  type ClubTaxInfoInput,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { SimplePdf } from '../storage/pdf';
import { audit, createEntry, euro, requireClubFull, requireClubManage } from './club-cash';

const german = (iso: string) => iso.split('-').reverse().join('.');

// ── Betrag in Buchstaben (Pflichtangabe der Bestätigung) ────────────────────

const ONES = [
  'null',
  'ein',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
  'zwölf',
  'dreizehn',
  'vierzehn',
  'fünfzehn',
  'sechzehn',
  'siebzehn',
  'achtzehn',
  'neunzehn',
];
const TENS = [
  '',
  '',
  'zwanzig',
  'dreißig',
  'vierzig',
  'fünfzig',
  'sechzig',
  'siebzig',
  'achtzig',
  'neunzig',
];

function below100(n: number): string {
  if (n < 20) return ONES[n]!;
  const unit = n % 10;
  const ten = TENS[Math.floor(n / 10)]!;
  return unit === 0 ? ten : `${ONES[unit]}und${ten}`;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? `${ONES[h]}hundert` : ''}${rest ? below100(rest) : ''}`;
}

/** „1.234,50 €“ → „eintausendzweihundertvierunddreißig Euro fünfzig Cent“ */
export function euroInWords(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  const thousands = Math.floor(euros / 1000);
  const low = euros % 1000;
  let words = '';
  if (thousands) words += `${thousands === 1 ? 'eintausend' : `${below1000(thousands)}tausend`}`;
  if (low) words += below1000(low);
  if (!words) words = 'null';
  // „eins“ am Ende („einhunderteins Euro“): hier steht „ein Euro“, weil „Euro“ folgt
  const euroPart = `${words} Euro`;
  return rest ? `${euroPart} ${below100(rest)} Cent` : euroPart;
}

// ── Steuerdaten des Vereins ─────────────────────────────────────────────────

export async function getTaxInfo(db: Db, clubId: string): Promise<ClubTaxInfo> {
  const [row] = await db.select().from(s.clubTaxInfo).where(eq(s.clubTaxInfo.clubId, clubId));
  let reviewer: string | null = null;
  if (row?.reviewedByPersonId) {
    const [p] = await db
      .select({ first: s.persons.firstName, last: s.persons.lastName })
      .from(s.persons)
      .where(eq(s.persons.id, row.reviewedByPersonId));
    reviewer = p ? `${p.first} ${p.last}` : null;
  }
  const info = {
    taxOffice: row?.taxOffice ?? null,
    taxNumber: row?.taxNumber ?? null,
    exemptionKind: (row?.exemptionKind as ClubTaxInfo['exemptionKind']) ?? null,
    exemptionDate: row?.exemptionDate ?? null,
    exemptionPeriod: row?.exemptionPeriod ?? null,
    purposes: row?.purposes ?? null,
  };
  return {
    ...info,
    complete: Object.values(info).every((v) => !!v),
    reviewed: row?.reviewedAt
      ? { at: row.reviewedAt.toISOString(), byName: reviewer, note: row.reviewNote }
      : null,
  };
}

function requireTaxAdmin(actor: Actor) {
  if (!actorCan(actor, 'club.settings.manage'))
    throw forbidden('Die Steuerdaten pflegt die Vereinsadministration.');
}

export async function saveTaxInfo(
  db: Db,
  actor: Actor,
  input: ClubTaxInfoInput,
  now: Date,
): Promise<void> {
  requireTaxAdmin(actor);
  const values = {
    taxOffice: input.taxOffice.trim(),
    taxNumber: input.taxNumber.trim(),
    exemptionKind: input.exemptionKind,
    exemptionDate: input.exemptionDate,
    exemptionPeriod: input.exemptionPeriod.trim(),
    purposes: input.purposes.trim(),
    // Jede Änderung der Angaben verlangt eine neue Freigabe
    reviewedAt: null,
    reviewedByPersonId: null,
    reviewNote: null,
    updatedAt: now,
  };
  await db
    .insert(s.clubTaxInfo)
    .values({ clubId: actor.club.id, ...values })
    .onConflictDoUpdate({ target: s.clubTaxInfo.clubId, set: values });
  await audit(
    db,
    actor,
    'clubcash.tax',
    'club',
    actor.club.id,
    'Spenden: Steuerdaten des Vereins gespeichert (Freigabe zurückgesetzt)',
    now,
  );
}

/** Die Vorlage der Bestätigung wurde rechtlich bzw. steuerlich geprüft – Freigabe durch die Administration. */
export async function approveTemplate(
  db: Db,
  actor: Actor,
  note: string,
  now: Date,
): Promise<void> {
  requireTaxAdmin(actor);
  const why = note.trim();
  if (why.length < 3)
    throw new HttpError(
      400,
      'note_required',
      'Bitte angeben, wer die Vorlage geprüft hat (z. B. Steuerberatung, Verband).',
    );
  const tax = await getTaxInfo(db, actor.club.id);
  if (!tax.complete)
    throw new HttpError(409, 'tax_incomplete', 'Bitte zuerst alle Steuerdaten ausfüllen.');
  await db
    .update(s.clubTaxInfo)
    .set({ reviewedAt: now, reviewedByPersonId: actor.person.id, reviewNote: why })
    .where(eq(s.clubTaxInfo.clubId, actor.club.id));
  await audit(
    db,
    actor,
    'clubcash.tax',
    'club',
    actor.club.id,
    `Spenden: Vorlage der Zuwendungsbestätigung freigegeben (${why})`,
    now,
  );
}

// ── Spenden ─────────────────────────────────────────────────────────────────

const today = (actor: Actor, now: Date) => toIsoDate(calendarDayOf(now, actor.club.timezone));

export async function listDonations(
  db: Db,
  actor: Actor,
  year: number,
  now: Date,
): Promise<ClubDonations> {
  requireClubFull(actor);
  const d = s.clubDonations;
  const rows = await db
    .select({ donation: d, cancelledAt: s.clubCashEntries.cancelledAt })
    .from(d)
    .innerJoin(s.clubCashEntries, eq(s.clubCashEntries.id, d.entryId))
    .where(
      and(
        eq(d.clubId, actor.club.id),
        gte(d.donatedOn, `${year}-01-01`),
        lte(d.donatedOn, `${year}-12-31`),
      ),
    )
    .orderBy(desc(d.donatedOn), desc(d.createdAt));
  const tax = await getTaxInfo(db, actor.club.id);
  const donations: ClubDonation[] = rows.map((r) => ({
    id: r.donation.id,
    entryId: r.donation.entryId,
    personId: r.donation.personId,
    donorName: r.donation.donorName,
    donorAddress: r.donation.donorAddress,
    amountCents: r.donation.amountCents,
    donatedOn: r.donation.donatedOn,
    waiver: r.donation.waiver,
    receiptNo: r.donation.receiptNo,
    issuedAt: r.donation.issuedAt?.toISOString() ?? null,
    cancelled: !!r.cancelledAt,
  }));
  return {
    canManage: actorCan(actor, 'clubcash.manage'),
    canIssue: tax.complete && !!tax.reviewed,
    tax,
    year: year || Number(today(actor, now).slice(0, 4)),
    totalCents: donations.filter((x) => !x.cancelled).reduce((sum, x) => sum + x.amountCents, 0),
    donations,
  };
}

export async function createDonation(
  db: Db,
  actor: Actor,
  input: ClubDonationInput,
  now: Date,
): Promise<{ id: string }> {
  requireClubManage(actor);
  const name = input.donorName.trim();
  const address = input.donorAddress.trim();
  if (name.length < 2)
    throw new HttpError(
      400,
      'donor_required',
      'Bitte den Namen der Spenderin oder des Spenders angeben.',
    );
  if (address.length < 5)
    throw new HttpError(
      400,
      'address_required',
      'Für die Zuwendungsbestätigung wird die Anschrift gebraucht.',
    );
  if (input.personId) {
    const [p] = await db
      .select({ id: s.persons.id })
      .from(s.persons)
      .where(and(eq(s.persons.id, input.personId), eq(s.persons.clubId, actor.club.id)));
    if (!p) throw notFound('Die Person');
  }
  // Die Spende steht als Einnahme im Kassenbuch (Kategorie, Konto, Sperre des Jahres gelten wie sonst)
  const entry = await createEntry(
    db,
    actor,
    {
      accountId: input.accountId,
      kind: 'income',
      amountCents: input.amountCents,
      bookedOn: input.donatedOn,
      categoryId: input.categoryId,
      counterparty: name,
      purpose: `Spende ${name}`,
    },
    now,
  );
  const [row] = await db
    .insert(s.clubDonations)
    .values({
      clubId: actor.club.id,
      entryId: entry.id,
      personId: input.personId ?? null,
      donorName: name,
      donorAddress: address,
      amountCents: input.amountCents,
      donatedOn: input.donatedOn,
      waiver: input.waiver,
      createdByPersonId: actor.person.id,
      createdAt: now,
    })
    .returning({ id: s.clubDonations.id });
  await audit(
    db,
    actor,
    'clubcash.donation',
    'club_donation',
    row!.id,
    `Spenden: Spende ${euro(input.amountCents)} von ${name} erfasst`,
    now,
  );
  return { id: row!.id };
}

/** Bestätigung ausstellen: laufende Nummer, eingefrorene Steuerdaten. Nur mit freigegebener Vorlage. */
export async function issueReceipt(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  requireClubManage(actor);
  const d = s.clubDonations;
  const [row] = await db
    .select({ donation: d, cancelledAt: s.clubCashEntries.cancelledAt })
    .from(d)
    .innerJoin(s.clubCashEntries, eq(s.clubCashEntries.id, d.entryId))
    .where(and(eq(d.id, id), eq(d.clubId, actor.club.id)));
  if (!row) throw notFound('Die Spende');
  if (row.cancelledAt)
    throw new HttpError(409, 'cancelled', 'Die Buchung der Spende ist storniert.');
  if (row.donation.receiptNo)
    throw new HttpError(409, 'already_issued', 'Die Bestätigung ist schon ausgestellt.');
  const tax = await getTaxInfo(db, actor.club.id);
  if (!tax.complete)
    throw new HttpError(
      409,
      'tax_incomplete',
      'Bitte zuerst alle Steuerdaten des Vereins ausfüllen.',
    );
  if (!tax.reviewed)
    throw new HttpError(
      409,
      'template_not_reviewed',
      'Die Vorlage ist noch nicht freigegeben. Sie muss zuerst rechtlich bzw. steuerlich geprüft werden.',
    );
  const year = Number(row.donation.donatedOn.slice(0, 4));
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(d)
    .where(
      and(
        eq(d.clubId, actor.club.id),
        isNotNull(d.receiptNo),
        gte(d.donatedOn, `${year}-01-01`),
        lte(d.donatedOn, `${year}-12-31`),
      ),
    )) as [{ n: number }];
  const receiptNo = `${year}-${String(n + 1).padStart(3, '0')}`;
  await db
    .update(d)
    .set({
      receiptNo,
      issuedAt: now,
      issuedByPersonId: actor.person.id,
      receiptSnapshot: {
        clubName: actor.club.name,
        street: actor.club.street ?? null,
        postalCode: actor.club.postalCode ?? null,
        city: actor.club.city ?? null,
        tax: {
          taxOffice: tax.taxOffice,
          taxNumber: tax.taxNumber,
          exemptionKind: tax.exemptionKind,
          exemptionDate: tax.exemptionDate,
          exemptionPeriod: tax.exemptionPeriod,
          purposes: tax.purposes,
        },
        issuedOn: today(actor, now),
      },
    })
    .where(eq(d.id, id));
  await audit(
    db,
    actor,
    'clubcash.donation',
    'club_donation',
    id,
    `Spenden: Zuwendungsbestätigung ${receiptNo} ausgestellt (${row.donation.donorName})`,
    now,
  );
}

// ── Bestätigung als PDF (kurzlebiger Link) ──────────────────────────────────

const LINK_MS = 10 * 60 * 1000;

export async function receiptLink(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<{ token: string; expiresAt: string }> {
  requireClubFull(actor);
  const [row] = await db
    .select({ receiptNo: s.clubDonations.receiptNo })
    .from(s.clubDonations)
    .where(and(eq(s.clubDonations.id, id), eq(s.clubDonations.clubId, actor.club.id)));
  if (!row) throw notFound('Die Spende');
  if (!row.receiptNo)
    throw new HttpError(409, 'not_issued', 'Die Bestätigung ist noch nicht ausgestellt.');
  const expiresAt = new Date(now.getTime() + LINK_MS);
  return {
    token: actor.links.create(`dp:${actor.club.id}|${id}`, expiresAt),
    expiresAt: expiresAt.toISOString(),
  };
}

type Snapshot = {
  clubName: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  tax: {
    taxOffice: string;
    taxNumber: string;
    exemptionKind: 'freistellung' | 'feststellung';
    exemptionDate: string;
    exemptionPeriod: string;
    purposes: string;
  };
  issuedOn: string;
};

export async function receiptPdf(
  db: Db,
  payload: string,
): Promise<{ fileName: string; pdf: Buffer } | null> {
  const [clubId, id] = payload.split('|');
  if (!clubId || !id) return null;
  const [row] = await db
    .select()
    .from(s.clubDonations)
    .where(and(eq(s.clubDonations.id, id), eq(s.clubDonations.clubId, clubId)));
  if (!row || !row.receiptNo || !row.receiptSnapshot) return null;
  const snap = row.receiptSnapshot as Snapshot;
  const doc = new SimplePdf();
  doc.text(snap.clubName, { size: 12, bold: true });
  doc.text(
    [snap.street, [snap.postalCode, snap.city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
    {
      size: 9,
    },
  );
  doc.gap(10);
  doc.text('Bestätigung über Geldzuwendungen', { size: 16, bold: true });
  doc.paragraph(
    'im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten Körperschaften, Personenvereinigungen oder Vermögensmassen',
    { size: 9 },
  );
  doc.text(`Laufende Nummer: ${row.receiptNo}`, { size: 9 });
  doc.gap(10);
  doc.text('Name und Anschrift des Zuwendenden:', { size: 10, bold: true });
  doc.paragraph(`${row.donorName}, ${row.donorAddress}`);
  doc.gap(6);
  doc.text('Betrag der Zuwendung', { size: 10, bold: true });
  doc.text(`${euro(row.amountCents)} €  –  in Buchstaben: ${euroInWords(row.amountCents)}`, {
    size: 10,
  });
  doc.gap(6);
  doc.text(`Tag der Zuwendung: ${german(row.donatedOn)}`, { size: 10 });
  doc.text(
    row.waiver
      ? 'Es handelt sich um den Verzicht auf die Erstattung von Aufwendungen: Ja'
      : 'Es handelt sich um den Verzicht auf die Erstattung von Aufwendungen: Nein',
    { size: 10 },
  );
  doc.gap(8);
  const kind =
    snap.tax.exemptionKind === 'freistellung'
      ? 'Freistellungsbescheid bzw. nach der Anlage zum Körperschaftsteuerbescheid'
      : 'vorläufiger Bescheinigung bzw. nach der Feststellung nach § 60a AO';
  doc.paragraph(
    `Wir sind wegen Förderung des Zwecks „${snap.tax.purposes}“ nach dem ${kind} des Finanzamts ${snap.tax.taxOffice}, StNr. ${snap.tax.taxNumber}, vom ${german(snap.tax.exemptionDate)} für den Zeitraum ${snap.tax.exemptionPeriod} nach § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes von der Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.`,
    { size: 10 },
  );
  doc.gap(6);
  doc.paragraph(
    `Die Zuwendung wird entsprechend den Angaben des Zuwendenden für den Zweck „${snap.tax.purposes}“ verwendet.`,
    { size: 10 },
  );
  doc.gap(12);
  doc.text(`${snap.city ?? ''}${snap.city ? ', ' : ''}${german(snap.issuedOn)}`, { size: 10 });
  doc.text('(Ort, Datum und Unterschrift des Zuwendungsempfängers)', { size: 8 });
  doc.gap(14);
  doc.paragraph(
    'Hinweis: Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG).',
    { size: 8 },
  );
  return {
    fileName: `Zuwendungsbestätigung ${row.receiptNo}.pdf`,
    pdf: doc.build(),
  };
}
