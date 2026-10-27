/**
 * Demodaten-Ausbau der Personen und Familien (Paket DEMODATEN-AUSBAU, Schritt 1): Geschwister in mehreren
 * Mannschaften, zweite Elternteile, Doppelrollen (Mutter spielt bei den Frauen, Spielerin und Co-Trainerin),
 * ältere Mitglieder, Neuzugänge und Abgänge der letzten Monate, abwechslungsreiche Profile (die Avatare folgen in `profilbilder.ts`).
 * Läuft nur mit `extended` und verändert die Listen des Seeds, bevor sie eingefügt werden.
 */
import { addDays, toIsoDate } from '@clubroof/core';
import { fakerDE as faker } from '@faker-js/faker';
import type { PgTable } from 'drizzle-orm/pg-core';
import type * as s from '../schema';
import { TEAMS } from './data';

type Insert<T extends PgTable> = T['$inferInsert'];
export type AusbauPerson = Insert<typeof s.persons> & { id: string };
export type AusbauMember = {
  person: AusbauPerson;
  fn: 'player' | 'coach' | 'assistant_coach';
  jersey?: number;
  /** Beginn der Zuordnung (Neuzugänge); sonst Saisonbeginn */
  from?: string;
};
type TeamKey = (typeof TEAMS)[number]['key'];

export type Abgang = { person: AusbauPerson; teamKey: TeamKey; leftOn: string; to: string };

const SENIOR_COUNT = 14;

export function ausbauPersonen(ctx: {
  today: Date;
  persons: AusbauPerson[];
  guardianships: Insert<typeof s.guardianships>[];
  clubId: string;
  teamMembers: Record<TeamKey, AusbauMember[]>;
  addPerson: (input: {
    firstName: string;
    lastName: string;
    birthDate: string;
    position?: string;
    preferredFoot?: 'left' | 'right' | 'both';
  }) => AusbauPerson;
  /** Personen mit festen Rollen (Demo-Logins), die unverändert bleiben */
  fixed: Set<AusbauPerson>;
}) {
  const { today, persons, guardianships, clubId, teamMembers, addPerson, fixed } = ctx;
  const teamDef = (key: TeamKey) => TEAMS.find((t) => t.key === key)!;

  const usedJerseys = (key: TeamKey) =>
    new Set(teamMembers[key].map((m) => m.jersey).filter((n): n is number => n != null));
  const freeJersey = (key: TeamKey) => {
    const used = usedJerseys(key);
    for (let n = 30; n < 100; n++) if (!used.has(n)) return n;
    return undefined;
  };
  const birthIn = (key: TeamKey) => {
    const [from, to] = teamDef(key).birthYears;
    return toIsoDate(
      faker.date.between({
        from: new Date(Date.UTC(from, 0, 1)),
        to: new Date(Date.UTC(to, 11, 31)),
      }),
    );
  };
  const newPlayer = (
    key: TeamKey,
    lastName: string,
    sex: 'male' | 'female',
    extra?: { memberSince?: string; from?: string },
  ) => {
    const person = addPerson({
      firstName: faker.person.firstName(sex),
      lastName,
      birthDate: birthIn(key),
      position: faker.helpers.arrayElement(['Abwehr', 'Mittelfeld', 'Sturm']),
      preferredFoot: faker.helpers.arrayElement(['right', 'right', 'left'] as const),
    });
    if (extra?.memberSince) person.memberSince = extra.memberSince;
    teamMembers[key].push({
      person,
      fn: 'player',
      jersey: freeJersey(key),
      ...(extra?.from ? { from: extra.from } : {}),
    });
    return person;
  };
  const adult = (
    sex: 'male' | 'female',
    lastName: string,
    years: [number, number] = [1970, 1992],
  ) => {
    const person = addPerson({
      firstName: faker.person.firstName(sex),
      lastName,
      birthDate: toIsoDate(
        faker.date.between({
          from: new Date(Date.UTC(years[0], 0, 1)),
          to: new Date(Date.UTC(years[1], 11, 31)),
        }),
      ),
    });
    return person;
  };
  const link = (guardian: { id: string }, child: { id: string }) =>
    guardianships.push({ clubId, guardianPersonId: guardian.id, childPersonId: child.id });
  const guardianOfChild = (child: AusbauPerson) =>
    guardianships.find((g) => g.childPersonId === child.id)?.guardianPersonId;

  // ── Geschwister in anderen Mannschaften ─────────────────────────────────────────────────
  // Je Familie: ein Kind ist schon im Kader, ein bis zwei jüngere Geschwister kommen hinzu
  const families: { from: TeamKey; to: TeamKey[] }[] = [
    { from: 'c1', to: ['e1'] },
    { from: 'c1', to: ['fj'] },
    { from: 'c1', to: ['d1', 'bam'] },
    { from: 'd1', to: ['fj'] },
    { from: 'd1', to: ['bam'] },
    { from: 'd1', to: ['e1'] },
    { from: 'e1', to: ['bam'] },
    { from: 'e1', to: ['bam'] },
    { from: 'e1', to: ['fj', 'bam'] },
    { from: 'fj', to: ['bam'] },
    { from: 'b1', to: ['e1'] },
    { from: 'b1', to: ['d1'] },
  ];
  const taken = new Set<string>();
  for (const family of families) {
    const child = teamMembers[family.from].find(
      (m) =>
        m.fn === 'player' &&
        !fixed.has(m.person) &&
        !taken.has(m.person.id) &&
        guardianOfChild(m.person),
    )?.person;
    if (!child) continue;
    taken.add(child.id);
    const guardianId = guardianOfChild(child)!;
    for (const key of family.to) {
      const sibling = newPlayer(
        key,
        child.lastName,
        faker.helpers.arrayElement(['male', 'female']),
      );
      link({ id: guardianId }, sibling);
    }
  }

  // ── Zweite Elternteile ──────────────────────────────────────────────────────────────────
  let second = 0;
  for (const key of ['e1', 'd1', 'fj', 'bam', 'c1'] as TeamKey[]) {
    for (const m of teamMembers[key]) {
      if (m.fn !== 'player' || fixed.has(m.person) || second >= 24) continue;
      const first = guardianOfChild(m.person);
      if (!first || guardianships.filter((g) => g.childPersonId === m.person.id).length > 1)
        continue;
      if (faker.number.int({ min: 1, max: 100 }) > 35) continue;
      link(adult(faker.helpers.arrayElement(['male', 'female']), m.person.lastName), m.person);
      second++;
    }
  }

  // ── Doppelrollen ────────────────────────────────────────────────────────────────────────
  // Mutter spielt bei den Frauen und hat ein Kind bei den Bambini
  const mother = adult('female', 'Winkler', [1991, 1995]);
  teamMembers.f1.push({ person: mother, fn: 'player', jersey: freeJersey('f1') });
  link(mother, newPlayer('bam', 'Winkler', 'female'));
  // Vater spielt bei den Alten Herren und hat ein Kind in der D-Jugend
  const father = adult('male', 'Sommer', [1976, 1982]);
  teamMembers.ah.push({ person: father, fn: 'player', jersey: freeJersey('ah') });
  link(father, newPlayer('d1', 'Sommer', 'male'));
  // Eine Spielerin der A-Jugend trainiert nebenbei die F-Jugend mit
  const youthCoach = teamMembers.a1.find((m) => m.fn === 'player' && !fixed.has(m.person))?.person;
  if (youthCoach) teamMembers.fj.push({ person: youthCoach, fn: 'assistant_coach' });
  // Vater aus der C-Jugend ist Co-Trainer der D-Jugend (Sohn spielt dort)
  const dad = adult('male', 'Hartmann', [1978, 1985]);
  teamMembers.d1.push({ person: dad, fn: 'assistant_coach' });
  link(dad, newPlayer('d1', 'Hartmann', 'male'));

  // ── Ältere Mitglieder ohne Mannschaft ───────────────────────────────────────────────────
  for (let i = 0; i < SENIOR_COUNT; i++) {
    const senior = adult(i % 2 ? 'female' : 'male', faker.person.lastName(), [1942, 1962]);
    senior.memberSince = toIsoDate(
      faker.date.between({
        from: new Date(Date.UTC(1968, 0, 1)),
        to: new Date(Date.UTC(1998, 11, 31)),
      }),
    );
    if (i % 5 === 4) senior.membershipStatus = 'inactive';
  }

  // ── Neuzugänge der letzten Wochen ───────────────────────────────────────────────────────
  const newcomers: { person: AusbauPerson; teamKey: TeamKey; from: string; club: string }[] = [];
  const arrivals: [TeamKey, number, string][] = [
    ['h1', 50, 'SV Kleefeld'],
    ['h2', 40, 'TSV Blauen'],
    ['f1', 33, 'FC Talheim'],
    ['a1', 28, 'SG Reinstetten'],
    ['c1', 21, 'FC Lindenau'],
    ['e1', 14, 'SV Rotweil'],
    ['fj', 9, 'TuS Ahornfeld'],
  ];
  for (const [key, daysAgo, club] of arrivals) {
    const from = toIsoDate(addDays(today, -daysAgo));
    const sex = key === 'f1' ? 'female' : 'male';
    const person = newPlayer(key, faker.person.lastName(), sex, { memberSince: from, from });
    if (teamDef(key).birthYears[0] >= 2012) link(adult('male', person.lastName), person);
    newcomers.push({ person, teamKey: key, from, club });
  }

  // ── Abgänge der letzten Monate ──────────────────────────────────────────────────────────
  const departures: Abgang[] = [];
  const leavers: [TeamKey, number, string][] = [
    ['h1', 60, 'SC Waldheim'],
    ['b1', 45, 'Jugendspielgemeinschaft Nord'],
    ['ah', 30, ''],
    ['c1', 20, 'TSV Eichstetten'],
  ];
  for (const [key, daysAgo, to] of leavers) {
    const [from, until] = teamDef(key).birthYears;
    const person = addPerson({
      firstName: faker.person.firstName(key === 'f1' ? 'female' : 'male'),
      lastName: faker.person.lastName(),
      birthDate: toIsoDate(
        faker.date.between({
          from: new Date(Date.UTC(from, 0, 1)),
          to: new Date(Date.UTC(until, 11, 31)),
        }),
      ),
    });
    person.membershipStatus = 'left';
    if (from >= 2012) link(adult('female', person.lastName), person);
    departures.push({ person, teamKey: key, leftOn: toIsoDate(addDays(today, -daysAgo)), to });
  }

  // ── Profile: Sichtbarkeit der Kontaktdaten ──────────────────────────────────
  for (const person of persons) {
    if (fixed.has(person)) continue;
    const draw = faker.number.int({ min: 1, max: 100 });
    if (draw <= 12) person.contactVisibility = 'coaches_only';
    else if (draw <= 30) person.contactVisibility = 'club';
  }

  return { newcomers, departures };
}
