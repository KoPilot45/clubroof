/**
 * Demodaten-Ausbau der Vereinskasse (Paket DEMODATEN-AUSBAU, Schritt 3): 24 Monate Buchungen mit typischen Posten,
 * weitere Beitragsarten mit Forderungen, Haushaltsplan mit Soll-Ist (eine Kategorie überzogen, eine unter Plan),
 * Rücklagen, Inventar, Spenden mit fortlaufenden Zuwendungsbestätigungen, Steuerdaten und eine Kassenprüfung.
 * Eigener Zufallsgenerator (fester Startwert), damit die übrigen Demodaten unverändert bleiben.
 */
import { addDays, toIsoDate } from '@clubroof/core';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import * as s from '../schema';
import { DEMO_CLUB } from './data';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Entry = typeof s.clubCashEntries.$inferInsert;

export type KasseAusbauContext = {
  tx: Tx;
  clubId: string;
  today: Date;
  fundId: string;
  accounts: { giro: string; bar: string; tages: string };
  categoryId: (name: string) => string;
  centerId: (name: string) => string;
  treasurerId: string;
  auditorId: string;
  adminId: string;
  boardId: string;
  persons: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    status: string;
  }[];
};

/** kleiner, fester Zufallsgenerator (mulberry32) */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const euro = (amount: number) => Math.round(amount * 100);
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export async function seedKasseAusbau(ctx: KasseAusbauContext) {
  const { tx, clubId, today, fundId } = ctx;
  const rand = rng(1920);
  const vary = (base: number, spread: number) => Math.round(base + (rand() - 0.5) * 2 * spread);
  const todayIso = toIsoDate(today);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  // ── 24 Monate Buchungen ─────────────────────────────────────────────────────────────
  const entries: (Entry & { key?: string })[] = [];
  const add = (
    date: Date,
    kind: 'income' | 'expense',
    account: keyof KasseAusbauContext['accounts'],
    amount: number,
    category: string,
    purpose: string,
    extra: Partial<Entry> & { key?: string } = {},
  ) => {
    const bookedOn = toIsoDate(date);
    if (bookedOn > todayIso) return;
    entries.push({
      clubId,
      accountId: ctx.accounts[account],
      kind,
      amountCents: euro(amount),
      categoryId: ctx.categoryId(category),
      purpose,
      bookedOn,
      createdByPersonId: ctx.treasurerId,
      ...extra,
    });
  };
  let receipt = 100;
  for (let o = -23; o <= 0; o++) {
    const mo = ((((m + o) % 12) + 12) % 12) as number;
    const base = (day: number) => new Date(Date.UTC(y, m + o, day));
    const label = `${MONTHS[mo]} ${base(1).getUTCFullYear()}`;
    const winter = mo >= 9 || mo <= 2;
    add(
      base(3),
      'expense',
      'giro',
      vary(winter ? 780 : 520, 25),
      'Platzmiete und Hallengebühren',
      `Platz- und Hallenmiete ${label}`,
      {
        counterparty: 'Stadt Musterstadt',
        costCenterId: mo % 2 ? ctx.centerId('Jugend') : ctx.centerId('Senioren'),
      },
    );
    add(
      base(5),
      'expense',
      'giro',
      vary(380, 20),
      'Aufwandsentschädigungen',
      `Übungsleiterpauschalen ${label}`,
      {
        counterparty: 'Trainerinnen und Trainer',
      },
    );
    add(base(28), 'expense', 'giro', 9.9, 'Verwaltung und Bankgebühren', `Kontoführung ${label}`, {
      counterparty: 'Sparkasse Musterstadt',
    });
    if (mo % 3 === 0) {
      add(
        base(10),
        'income',
        'giro',
        vary(4200, 350),
        'Mitgliedsbeiträge',
        `Beiträge Quartal (${label})`,
        {
          receiptNo: `B-${base(1).getUTCFullYear()}-${String(receipt++).padStart(3, '0')}`,
        },
      );
      add(
        base(15),
        'expense',
        'giro',
        vary(320, 90),
        'Schiedsrichter und Spielbetrieb',
        `Schiedsrichter und Spielbetrieb Quartal (${label})`,
        {
          counterparty: 'Kreisverband',
        },
      );
    }
    if (mo % 3 === 2) {
      add(
        base(20),
        'income',
        'tages',
        vary(19, 4),
        'Zinsen und Kapitalerträge',
        `Zinsen Tagesgeld ${label}`,
        {
          counterparty: 'Sparkasse Musterstadt',
        },
      );
    }
    if (mo === 1)
      add(
        base(12),
        'expense',
        'giro',
        vary(890, 15),
        'Versicherungen',
        'Sportversicherung und Haftpflicht',
        { counterparty: 'Sportversicherung Nord' },
      );
    if (mo === 7) {
      add(
        base(14),
        'expense',
        'giro',
        vary(640, 20),
        'Verbandsabgaben',
        'Verbandsbeiträge Landesverband',
        { counterparty: 'Landesverband' },
      );
      add(
        base(20),
        'expense',
        'giro',
        vary(2350, 150),
        'Sportgeräte und Material',
        'Trikotsätze und Bälle Saisonstart',
        {
          counterparty: 'Sportshop Musterstadt',
          costCenterId: ctx.centerId('Jugend'),
        },
      );
    }
    if (mo === 2)
      add(
        base(18),
        'expense',
        'giro',
        vary(420, 40),
        'Sportgeräte und Material',
        'Material Frühjahr',
        { counterparty: 'Sportshop Musterstadt', costCenterId: ctx.centerId('Senioren') },
      );
    if (mo === 10)
      add(
        base(9),
        'expense',
        'giro',
        vary(310, 30),
        'Sportgeräte und Material',
        'Trainingsmaterial Herbst',
        { counterparty: 'Sportshop Musterstadt' },
      );
    if (mo === 8) {
      add(base(2), 'income', 'giro', 1200, 'Sponsoring', 'Trikotsponsoring Saison', {
        counterparty: 'Haus & Garten Müller GmbH',
      });
      add(base(3), 'income', 'giro', vary(800, 0), 'Sponsoring', 'Bandenwerbung Platz 1', {
        counterparty: 'Autohaus Meyer',
      });
      add(base(4), 'income', 'giro', 500, 'Sponsoring', 'Partnerschaft Fahrschule Lindner', {
        counterparty: 'Fahrschule Lindner',
      });
    }
    if (mo === 0) {
      add(
        base(20),
        'income',
        'giro',
        vary(860, 60),
        'Veranstaltungen (sportlich)',
        'Einnahmen Jugend-Hallenturnier',
        { costCenterId: ctx.centerId('Jugend') },
      );
      add(base(19), 'expense', 'bar', vary(210, 20), 'Einkauf für Feste', 'Einkauf Hallenturnier', {
        counterparty: 'Getränkemarkt Nord',
        costCenterId: ctx.centerId('Jugend'),
      });
    }
    if (mo === 5) {
      add(
        base(25),
        'income',
        'bar',
        vary(2100, 150),
        'Vereinsfeste und Verkauf',
        'Einnahmen Sommerfest',
        { costCenterId: ctx.centerId('Sommerfest') },
      );
      add(base(24), 'expense', 'bar', vary(760, 60), 'Einkauf für Feste', 'Einkauf Sommerfest', {
        counterparty: 'Getränkemarkt Nord',
        costCenterId: ctx.centerId('Sommerfest'),
      });
    }
    if (mo === 11) {
      add(
        base(14),
        'income',
        'bar',
        vary(640, 50),
        'Vereinsfeste und Verkauf',
        'Einnahmen Weihnachtsfeier',
      );
      add(
        base(13),
        'expense',
        'bar',
        vary(520, 40),
        'Einkauf für Feste',
        'Einkauf Weihnachtsfeier',
        { counterparty: 'Getränkemarkt Nord' },
      );
    }
  }
  // Spenden (mit Verweis für die Zuwendungsbestätigungen)
  const donorDefs: { o: number; amount: number; name: string; street: string }[] = [
    { o: -20, amount: 250, name: 'Familie Wagner', street: 'Lindenweg 4' },
    { o: -14, amount: 100, name: 'Elke Neumann', street: 'Birkenallee 12' },
    { o: -9, amount: 500, name: 'Autohaus Meyer GmbH', street: 'Industriestraße 7' },
    { o: -5, amount: 150, name: 'Dieter Lange', street: 'Gartenstraße 21' },
    { o: -3, amount: 300, name: 'Fahrschule Lindner', street: 'Bahnhofstraße 2' },
    { o: -1, amount: 75, name: 'Katrin Vogel', street: 'Am Sportplatz 9' },
  ];
  const donations = donorDefs.map((d, i) => {
    const date = new Date(Date.UTC(y, m + d.o, 8 + i));
    add(date, 'income', 'giro', d.amount, 'Spenden', `Spende ${d.name}`, { counterparty: d.name });
    return { ...d, date: toIsoDate(date) };
  });
  const inserted: {
    id: string;
    purpose: string;
    categoryId: string | null;
    kind: string;
    amountCents: number;
    bookedOn: string;
  }[] = [];
  for (let i = 0; i < entries.length; i += 400) {
    inserted.push(
      ...(await tx
        .insert(s.clubCashEntries)
        .values(entries.slice(i, i + 400))
        .returning({
          id: s.clubCashEntries.id,
          purpose: s.clubCashEntries.purpose,
          categoryId: s.clubCashEntries.categoryId,
          kind: s.clubCashEntries.kind,
          amountCents: s.clubCashEntries.amountCents,
          bookedOn: s.clubCashEntries.bookedOn,
        })),
    );
  }

  // ── Weitere Beitragsarten: Familie und Passiv ─────────────────────────────────────────
  const feeIncome = ctx.categoryId('Mitgliedsbeiträge');
  const newTypes = await tx
    .insert(s.clubFeeTypes)
    .values([
      {
        clubId,
        name: 'Familie',
        amountCents: euro(75),
        interval: 'quarterly',
        categoryId: feeIncome,
      },
      { clubId, name: 'Passiv', amountCents: euro(24), interval: 'yearly', categoryId: feeIncome },
    ])
    .returning({ id: s.clubFeeTypes.id, name: s.clubFeeTypes.name });
  const familyType = newTypes.find((t) => t.name === 'Familie')!.id;
  const passiveType = newTypes.find((t) => t.name === 'Passiv')!.id;
  const alreadyAssigned = new Set(
    (
      await tx
        .select({ personId: s.clubFeeAssignments.personId })
        .from(s.clubFeeAssignments)
        .where(eq(s.clubFeeAssignments.clubId, clubId))
    ).map((r) => r.personId),
  );
  const adults = ctx.persons.filter(
    (p) =>
      p.status === 'active' &&
      p.birthDate &&
      Number(p.birthDate.slice(0, 4)) <= 1990 &&
      !alreadyAssigned.has(p.id),
  );
  const passives = ctx.persons.filter((p) => p.status === 'inactive').slice(0, 6);
  const [firstFeeEntry] = await tx
    .select({ id: s.clubCashEntries.id })
    .from(s.clubCashEntries)
    .where(
      and(eq(s.clubCashEntries.clubId, clubId), eq(s.clubCashEntries.purpose, 'Beiträge Quartal')),
    )
    .limit(1);
  const feeEntryId = firstFeeEntry!.id;
  const quarterStarts = ['01-01', '04-01', '07-01', '10-01'].map((d) => `${y}-${d}`);
  const labels = ['1. Quartal', '2. Quartal', '3. Quartal', '4. Quartal'].map((l) => `${l} ${y}`);
  const groups: {
    person: (typeof adults)[number];
    type: string;
    cents: number;
    yearly: boolean;
  }[] = [
    ...adults
      .slice(0, 5)
      .map((p) => ({ person: p, type: familyType, cents: euro(75), yearly: false })),
    ...passives.map((p) => ({ person: p, type: passiveType, cents: euro(24), yearly: true })),
  ];
  for (const [index, g] of groups.entries()) {
    const [assignment] = await tx
      .insert(s.clubFeeAssignments)
      .values({ clubId, personId: g.person.id, feeTypeId: g.type, validFrom: quarterStarts[0]! })
      .returning({ id: s.clubFeeAssignments.id });
    const dueDates = g.yearly ? [quarterStarts[0]!] : quarterStarts.filter((d) => d <= todayIso);
    const dues = await tx
      .insert(s.clubFeeDues)
      .values(
        dueDates.map((dueOn, q) => ({
          clubId,
          personId: g.person.id,
          feeTypeId: g.type,
          assignmentId: assignment!.id,
          periodLabel: g.yearly ? `Jahr ${y}` : labels[q]!,
          dueOn,
          amountCents: g.cents,
        })),
      )
      .returning({
        id: s.clubFeeDues.id,
        dueOn: s.clubFeeDues.dueOn,
        amountCents: s.clubFeeDues.amountCents,
      });
    // wie bei den übrigen: Quartale 1 und 2 bezahlt, Quartal 3 zu zwei Dritteln, Quartal 4 offen; Passive zahlen das Jahr
    const paid = g.yearly
      ? dues
      : dues.filter(
          (d) => d.dueOn < quarterStarts[2]! || (d.dueOn === quarterStarts[2] && index % 3 !== 0),
        );
    if (paid.length)
      await tx.insert(s.clubFeePayments).values(
        paid.map((d) => ({
          clubId,
          dueId: d.id,
          entryId: feeEntryId,
          amountCents: d.amountCents,
          paidOn: d.dueOn,
        })),
      );
  }

  // ── Haushaltsplan mit Soll-Ist ───────────────────────────────────────────────────────
  const sums = new Map<string, number>();
  const all = await tx
    .select({
      categoryId: s.clubCashEntries.categoryId,
      kind: s.clubCashEntries.kind,
      amountCents: s.clubCashEntries.amountCents,
      bookedOn: s.clubCashEntries.bookedOn,
      cancelledAt: s.clubCashEntries.cancelledAt,
    })
    .from(s.clubCashEntries)
    .where(eq(s.clubCashEntries.clubId, clubId));
  for (const e of all) {
    if (e.cancelledAt || !e.categoryId || (e.kind !== 'income' && e.kind !== 'expense')) continue;
    const key = `${e.bookedOn.slice(0, 4)}|${e.categoryId}`;
    sums.set(key, (sums.get(key) ?? 0) + e.amountCents);
  }
  const planned = (year: number, category: string) =>
    sums.get(`${year}|${ctx.categoryId(category)}`) ?? 0;
  const round100 = (cents: number) => Math.round(cents / 10000) * 10000;
  const planCategories = [
    'Mitgliedsbeiträge',
    'Sponsoring',
    'Spenden',
    'Vereinsfeste und Verkauf',
    'Platzmiete und Hallengebühren',
    'Aufwandsentschädigungen',
    'Versicherungen',
    'Verbandsabgaben',
    'Sportgeräte und Material',
    'Schiedsrichter und Spielbetrieb',
  ];
  const lines: (typeof s.clubBudgetLines.$inferInsert)[] = [];
  for (const category of planCategories) {
    lines.push({
      clubId,
      fundId,
      year: y - 1,
      categoryId: ctx.categoryId(category),
      plannedCents: Math.max(10000, round100(planned(y - 1, category) * 1.02)),
    });
    let plan = Math.max(10000, round100(planned(y - 1, category) * 1.03 + 5000));
    // eine Kategorie überzogen (Material), eine deutlich unter Plan (Aufwandsentschädigungen)
    if (category === 'Sportgeräte und Material')
      plan = Math.max(10000, round100(planned(y, category) * 0.7));
    if (category === 'Aufwandsentschädigungen') plan = round100(planned(y - 1, category) * 1.35);
    lines.push({
      clubId,
      fundId,
      year: y,
      categoryId: ctx.categoryId(category),
      plannedCents: plan,
    });
  }
  await tx.insert(s.clubBudgetLines).values(lines);

  // ── Rücklagen ────────────────────────────────────────────────────────────────────────
  const reserves = await tx
    .insert(s.clubReserves)
    .values([
      {
        clubId,
        fundId,
        name: 'Kunstrasen-Erneuerung',
        targetCents: euro(60000),
        note: 'Erneuerung in rund acht Jahren',
      },
      {
        clubId,
        fundId,
        name: 'Jugendfahrt Pfingsten',
        targetCents: euro(3500),
        note: 'Zuschuss für das Zeltlager',
      },
    ])
    .returning({ id: s.clubReserves.id, name: s.clubReserves.name });
  const reserve = (name: string) => reserves.find((r) => r.name === name)!.id;
  const day = (o: number, d: number) => toIsoDate(new Date(Date.UTC(y, m + o, d)));
  await tx.insert(s.clubReserveMoves).values([
    {
      clubId,
      reserveId: reserve('Kunstrasen-Erneuerung'),
      kind: 'allocate',
      amountCents: euro(8000),
      bookedOn: day(-22, 30),
      note: 'Überschuss Vorjahr',
    },
    {
      clubId,
      reserveId: reserve('Kunstrasen-Erneuerung'),
      kind: 'allocate',
      amountCents: euro(5000),
      bookedOn: day(-10, 30),
      note: 'Überschuss Sommerfest und Turnier',
    },
    {
      clubId,
      reserveId: reserve('Kunstrasen-Erneuerung'),
      kind: 'allocate',
      amountCents: euro(4000),
      bookedOn: day(-2, 15),
      note: 'Zuführung laut Haushaltsplan',
    },
    {
      clubId,
      reserveId: reserve('Jugendfahrt Pfingsten'),
      kind: 'allocate',
      amountCents: euro(1200),
      bookedOn: day(-8, 20),
    },
    {
      clubId,
      reserveId: reserve('Jugendfahrt Pfingsten'),
      kind: 'allocate',
      amountCents: euro(600),
      bookedOn: day(-3, 20),
    },
    {
      clubId,
      reserveId: reserve('Jugendfahrt Pfingsten'),
      kind: 'release',
      amountCents: euro(500),
      bookedOn: day(-1, 5),
      note: 'Anzahlung Zeltplatz',
    },
  ]);

  // ── Inventar ─────────────────────────────────────────────────────────────────────────
  await tx.insert(s.clubInventory).values([
    {
      clubId,
      name: 'Jugendtore 5 × 2 m',
      category: 'Tore',
      quantity: 6,
      acquiredOn: day(-30, 10),
      costCents: euro(5400),
      location: 'Geräteschuppen Platz 1',
    },
    {
      clubId,
      name: 'Großfeldtore (Alu)',
      category: 'Tore',
      quantity: 2,
      acquiredOn: day(-60, 5),
      costCents: euro(3800),
      location: 'Platz 1',
    },
    {
      clubId,
      name: 'Trikotsätze (15 Stück)',
      category: 'Textilien',
      quantity: 9,
      acquiredOn: day(-4, 20),
      costCents: euro(3150),
      location: 'Kabine 1, Schrank',
    },
    {
      clubId,
      name: 'Spielbälle Größe 5',
      category: 'Bälle',
      quantity: 40,
      acquiredOn: day(-4, 20),
      costCents: euro(1000),
      location: 'Ballkammer',
    },
    {
      clubId,
      name: 'Jugendbälle Größe 4',
      category: 'Bälle',
      quantity: 30,
      acquiredOn: day(-14, 3),
      costCents: euro(690),
      location: 'Ballkammer',
    },
    {
      clubId,
      name: 'Aufsitzrasenmäher',
      category: 'Platzpflege',
      quantity: 1,
      acquiredOn: day(-20, 12),
      costCents: euro(4200),
      location: 'Geräteschuppen Platz 1',
      note: 'Wartung jährlich im März',
    },
    {
      clubId,
      name: 'Hütchen und Stangen-Set',
      category: 'Trainingsmaterial',
      quantity: 25,
      acquiredOn: day(-9, 8),
      costCents: euro(310),
      location: 'Ballkammer',
    },
    {
      clubId,
      name: 'Erste-Hilfe-Koffer',
      category: 'Sicherheit',
      quantity: 4,
      acquiredOn: day(-6, 2),
      costCents: euro(180),
      location: 'Kabinen 1–4',
    },
    {
      clubId,
      name: 'Beamer und Leinwand',
      category: 'Vereinsheim',
      quantity: 1,
      acquiredOn: day(-26, 15),
      costCents: euro(640),
      location: 'Vereinsheim',
    },
    {
      clubId,
      name: 'Grill (Edelstahl, groß)',
      category: 'Vereinsheim',
      quantity: 1,
      acquiredOn: day(-36, 5),
      costCents: euro(780),
      location: 'Vereinsheim, Lager',
    },
    {
      clubId,
      name: 'Alte Trainingsbälle',
      category: 'Bälle',
      quantity: 15,
      acquiredOn: day(-40, 1),
      costCents: euro(300),
      location: 'Ballkammer',
      disposedAt: new Date(Date.UTC(y, m - 2, 12)),
      disposedReason: 'ausgemustert, verschlissen',
    },
  ]);

  // ── Steuerdaten, Spenden und Zuwendungsbestätigungen ─────────────────────────────────
  await tx.insert(s.clubTaxInfo).values({
    clubId,
    taxOffice: 'Finanzamt Musterstadt',
    taxNumber: '123/456/78901',
    exemptionKind: 'freistellung',
    exemptionDate: `${y - 1}-03-18`,
    exemptionPeriod: `${y - 4} bis ${y - 2}`,
    purposes: 'Förderung des Sports',
    reviewedAt: new Date(Date.UTC(y - 1, 3, 2, 9, 0)),
    reviewedByPersonId: ctx.adminId,
    reviewNote: 'Vorlage mit dem Steuerberater des Vereins abgestimmt',
  });
  const donationEntries = new Map(
    inserted.filter((e) => e.purpose.startsWith('Spende ')).map((e) => [e.purpose, e.id]),
  );
  const perYear = new Map<number, number>();
  for (const [i, d] of donations.entries()) {
    const entryId = donationEntries.get(`Spende ${d.name}`)!;
    const year = Number(d.date.slice(0, 4));
    // ältere Spenden haben schon eine Bestätigung, die beiden jüngsten sind noch offen
    const issued = i < donations.length - 2;
    const n = (perYear.get(year) ?? 0) + (issued ? 1 : 0);
    if (issued) perYear.set(year, n);
    await tx.insert(s.clubDonations).values({
      clubId,
      entryId,
      donorName: d.name,
      donorAddress: `${d.street}, ${DEMO_CLUB.postalCode} ${DEMO_CLUB.city}`,
      amountCents: euro(d.amount),
      donatedOn: d.date,
      waiver: i % 3 === 0,
      createdByPersonId: ctx.treasurerId,
      ...(issued
        ? {
            receiptNo: `${year}-${String(n).padStart(3, '0')}`,
            issuedAt: new Date(`${d.date}T10:00:00Z`),
            issuedByPersonId: ctx.treasurerId,
            receiptSnapshot: {
              clubName: DEMO_CLUB.name,
              street: DEMO_CLUB.street,
              postalCode: DEMO_CLUB.postalCode,
              city: DEMO_CLUB.city,
              tax: {
                taxOffice: 'Finanzamt Musterstadt',
                taxNumber: '123/456/78901',
                exemptionKind: 'freistellung',
                exemptionDate: `${y - 1}-03-18`,
                exemptionPeriod: `${y - 4} bis ${y - 2}`,
                purposes: 'Förderung des Sports',
              },
              issuedOn: d.date,
            },
          }
        : {}),
    });
  }

  // ── Kassenprüfung (Heike Brandt): Vorjahr abgegeben, laufendes Jahr begonnen ───────────
  const sample = (year: number, count: number) =>
    inserted
      .filter((e) => e.bookedOn.startsWith(String(year)) && e.kind === 'expense')
      .slice(0, count);
  const lastYear = sample(y - 1, 8);
  const [audit] = await tx
    .insert(s.clubAudits)
    .values({
      clubId,
      year: y - 1,
      fundId: null,
      startedByPersonId: ctx.auditorId,
      startedAt: new Date(Date.UTC(y, 0, 20, 17, 0)),
      submittedAt: new Date(Date.UTC(y, 0, 27, 19, 30)),
      conclusion:
        'Die Kasse wurde ordnungsgemäß geführt. Alle geprüften Buchungen sind belegt; ein fehlender Beleg wurde nachgereicht. Ich empfehle die Entlastung der Kassenführung.',
    })
    .returning({ id: s.clubAudits.id });
  await tx.insert(s.clubAuditFindings).values([
    ...lastYear.map((e, i) => ({
      clubId,
      auditId: audit!.id,
      entryId: e.id,
      kind: i === 3 ? 'objection' : 'checked',
      text: i === 3 ? 'Beleg fehlte bei der Prüfung, wurde am 24.01. nachgereicht.' : null,
      createdByPersonId: ctx.auditorId,
    })),
    {
      clubId,
      auditId: audit!.id,
      kind: 'note',
      text: 'Barkasse am Stichtag gezählt: Kassenstand stimmt mit dem Kassenbuch überein.',
      createdByPersonId: ctx.auditorId,
    },
  ]);
  const [openAudit] = await tx
    .insert(s.clubAudits)
    .values({ clubId, year: y, startedByPersonId: ctx.auditorId, startedAt: addDays(today, -3) })
    .returning({ id: s.clubAudits.id });
  const thisYear = sample(y, 6);
  if (thisYear.length)
    await tx.insert(s.clubAuditFindings).values(
      thisYear.map((e, i) => ({
        clubId,
        auditId: openAudit!.id,
        entryId: e.id,
        kind: i < 2 ? 'checked' : 'pending',
        createdByPersonId: ctx.auditorId,
      })),
    );
  void isNull;
  return { entries: entries.length, donations: donations.length };
}
