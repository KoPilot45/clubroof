import type { ParticipationMode, TeamTemplate } from '@clubroof/core';

/**
 * Statische Stammdaten des Demovereins. Alle Namen, Vereine und Firmen sind frei erfunden;
 * E-Mail-Adressen verwenden die reservierte Domain `.example`.
 */

export const DEMO_CLUB = {
  name: 'SV Grün-Weiß Musterstadt 1920 e.V.',
  shortName: 'SV Grün-Weiß',
  slug: 'sv-gruen-weiss',
  foundedYear: 1920,
  colorTheme: 'green' as const,
  street: 'Grün-Weiß-Straße 1',
  postalCode: '12345',
  city: 'Musterstadt',
  email: 'info@sv-gruen-weiss.example',
  phone: '01234 567890',
  website: 'https://sv-gruen-weiss.example',
};

export const DEMO_EMAIL_DOMAIN = 'sv-gruen-weiss.example';

export type FacilityKey = 'rasen' | 'kunstrasen' | 'halle' | 'vereinsheim';

export const FACILITIES: {
  key: FacilityKey;
  name: string;
  shortName: string;
  kind: 'grass_pitch' | 'artificial_pitch' | 'hall' | 'clubhouse';
}[] = [
  { key: 'rasen', name: 'Rasenplatz (Platz 1)', shortName: 'Platz 1', kind: 'grass_pitch' },
  {
    key: 'kunstrasen',
    name: 'Kunstrasen (Platz 2)',
    shortName: 'Kunstrasen',
    kind: 'artificial_pitch',
  },
  { key: 'halle', name: 'Sporthalle Musterstadt', shortName: 'Halle', kind: 'hall' },
  { key: 'vereinsheim', name: 'Vereinsheim', shortName: 'Vereinsheim', kind: 'clubhouse' },
];

export type OrgUnitKey = 'seniors' | 'veterans' | 'women' | 'youth';

export const ORG_UNITS: { key: OrgUnitKey; name: string }[] = [
  { key: 'seniors', name: 'Senioren' },
  { key: 'veterans', name: 'Alte Herren' },
  { key: 'women', name: 'Frauen & Mädchen' },
  { key: 'youth', name: 'Jugend' },
];

export type TeamKey = 'h1' | 'h2' | 'ah' | 'f1' | 'a1' | 'b1' | 'c1' | 'd1' | 'e1' | 'fj' | 'bam';

export type Training = { weekday: number; start: string; minutes: number; facility: FacilityKey };

export type TeamDef = {
  key: TeamKey;
  name: string;
  badge: string;
  /** Name in Spielpaarungen, z. B. „SV Grün-Weiß II“ */
  matchName: string;
  ageGroup: string | null;
  league: string;
  unit: OrgUnitKey;
  template: TeamTemplate;
  mode: ParticipationMode;
  gender: 'male' | 'female' | 'mixed';
  playerCount: number;
  /** Geburtsjahrgänge der Spieler (von, bis) */
  birthYears: [number, number];
  trainings: Training[];
  match: {
    weekday: number;
    time: string;
    minutes: number;
    /** Spielrhythmus in Wochen (1 = jede Woche) */
    everyWeeks: number;
    homeFacility: FacilityKey;
    /** Spielfeste/Turniere statt Ligaspiele (F-Jugend, Bambini) */
    asTournament?: boolean;
  };
};

export const TEAMS: TeamDef[] = [
  {
    key: 'h1',
    name: '1. Mannschaft',
    badge: '1.',
    matchName: 'SV Grün-Weiß',
    ageGroup: null,
    league: 'Kreisliga A',
    unit: 'seniors',
    template: 'performance',
    mode: 'auto_accept',
    gender: 'male',
    playerCount: 24,
    birthYears: [1992, 2007],
    trainings: [
      { weekday: 2, start: '19:30', minutes: 90, facility: 'rasen' },
      { weekday: 4, start: '19:30', minutes: 90, facility: 'rasen' },
    ],
    match: { weekday: 7, time: '15:00', minutes: 105, everyWeeks: 1, homeFacility: 'rasen' },
  },
  {
    key: 'h2',
    name: '2. Mannschaft',
    badge: '2.',
    matchName: 'SV Grün-Weiß II',
    ageGroup: null,
    league: 'Kreisliga C',
    unit: 'seniors',
    template: 'classic',
    mode: 'auto_accept',
    gender: 'male',
    playerCount: 22,
    birthYears: [1988, 2007],
    trainings: [
      { weekday: 2, start: '19:30', minutes: 90, facility: 'kunstrasen' },
      { weekday: 4, start: '19:30', minutes: 90, facility: 'kunstrasen' },
    ],
    match: { weekday: 7, time: '13:00', minutes: 105, everyWeeks: 1, homeFacility: 'kunstrasen' },
  },
  {
    key: 'ah',
    name: 'Alte Herren',
    badge: 'AH',
    matchName: 'SV Grün-Weiß AH',
    ageGroup: 'Ü32',
    league: 'Freizeitrunde',
    unit: 'veterans',
    template: 'leisure',
    mode: 'absences_only',
    gender: 'male',
    playerCount: 18,
    birthYears: [1968, 1992],
    trainings: [{ weekday: 3, start: '20:00', minutes: 90, facility: 'kunstrasen' }],
    match: { weekday: 5, time: '19:00', minutes: 90, everyWeeks: 2, homeFacility: 'kunstrasen' },
  },
  {
    key: 'f1',
    name: 'Frauen',
    badge: 'FR',
    matchName: 'SV Grün-Weiß',
    ageGroup: null,
    league: 'Kreisliga',
    unit: 'women',
    template: 'classic',
    mode: 'active_response',
    gender: 'female',
    playerCount: 19,
    birthYears: [1993, 2008],
    trainings: [
      { weekday: 1, start: '19:00', minutes: 90, facility: 'rasen' },
      { weekday: 3, start: '19:00', minutes: 90, facility: 'rasen' },
    ],
    match: { weekday: 7, time: '11:00', minutes: 105, everyWeeks: 1, homeFacility: 'rasen' },
  },
  {
    key: 'a1',
    name: 'A-Jugend',
    badge: 'A1',
    matchName: 'SV Grün-Weiß A1',
    ageGroup: 'U19',
    league: 'Kreisliga',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'male',
    playerCount: 18,
    birthYears: [2008, 2009],
    trainings: [
      { weekday: 1, start: '18:00', minutes: 90, facility: 'kunstrasen' },
      { weekday: 3, start: '18:00', minutes: 90, facility: 'kunstrasen' },
    ],
    match: { weekday: 6, time: '16:30', minutes: 105, everyWeeks: 1, homeFacility: 'rasen' },
  },
  {
    key: 'b1',
    name: 'B-Jugend',
    badge: 'B1',
    matchName: 'SV Grün-Weiß B1',
    ageGroup: 'U17',
    league: 'Bezirksliga',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'male',
    playerCount: 20,
    birthYears: [2010, 2011],
    trainings: [
      { weekday: 2, start: '18:00', minutes: 90, facility: 'kunstrasen' },
      { weekday: 4, start: '18:00', minutes: 90, facility: 'kunstrasen' },
    ],
    match: { weekday: 6, time: '15:00', minutes: 95, everyWeeks: 1, homeFacility: 'rasen' },
  },
  {
    key: 'c1',
    name: 'C-Jugend',
    badge: 'C1',
    matchName: 'SV Grün-Weiß C1',
    ageGroup: 'U15',
    league: 'Kreisliga',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'mixed',
    playerCount: 18,
    birthYears: [2012, 2013],
    trainings: [
      { weekday: 1, start: '17:30', minutes: 90, facility: 'rasen' },
      { weekday: 3, start: '17:30', minutes: 90, facility: 'rasen' },
    ],
    match: { weekday: 6, time: '13:00', minutes: 85, everyWeeks: 1, homeFacility: 'rasen' },
  },
  {
    key: 'd1',
    name: 'D-Jugend',
    badge: 'D1',
    matchName: 'SV Grün-Weiß D1',
    ageGroup: 'U13',
    league: 'Kreisklasse',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'mixed',
    playerCount: 15,
    birthYears: [2014, 2015],
    trainings: [
      { weekday: 2, start: '17:00', minutes: 90, facility: 'rasen' },
      { weekday: 4, start: '17:00', minutes: 90, facility: 'rasen' },
    ],
    match: { weekday: 6, time: '11:00', minutes: 75, everyWeeks: 1, homeFacility: 'kunstrasen' },
  },
  {
    key: 'e1',
    name: 'E-Jugend',
    badge: 'E1',
    matchName: 'SV Grün-Weiß E1',
    ageGroup: 'U11',
    league: 'Kreisklasse',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'mixed',
    playerCount: 13,
    birthYears: [2016, 2017],
    trainings: [
      { weekday: 1, start: '16:30', minutes: 75, facility: 'kunstrasen' },
      { weekday: 4, start: '16:30', minutes: 75, facility: 'kunstrasen' },
    ],
    match: { weekday: 6, time: '10:00', minutes: 60, everyWeeks: 1, homeFacility: 'kunstrasen' },
  },
  {
    key: 'fj',
    name: 'F-Jugend',
    badge: 'F1',
    matchName: 'SV Grün-Weiß F1',
    ageGroup: 'U9',
    league: 'Spielfeste',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'mixed',
    playerCount: 11,
    birthYears: [2018, 2019],
    trainings: [{ weekday: 3, start: '16:30', minutes: 60, facility: 'kunstrasen' }],
    match: {
      weekday: 6,
      time: '10:00',
      minutes: 180,
      everyWeeks: 2,
      homeFacility: 'rasen',
      asTournament: true,
    },
  },
  {
    key: 'bam',
    name: 'Bambini',
    badge: 'BAM',
    matchName: 'SV Grün-Weiß Bambini',
    ageGroup: 'U7',
    league: 'Spielfeste',
    unit: 'youth',
    template: 'youth',
    mode: 'active_response',
    gender: 'mixed',
    playerCount: 10,
    birthYears: [2020, 2021],
    trainings: [{ weekday: 5, start: '16:30', minutes: 60, facility: 'rasen' }],
    match: {
      weekday: 6,
      time: '10:00',
      minutes: 150,
      everyWeeks: 3,
      homeFacility: 'rasen',
      asTournament: true,
    },
  },
];

/** Fiktive Gegner. */
export const OPPONENTS = [
  'TSV Blauen',
  'FC Talheim',
  'SG Reinstetten',
  'FC Lindenau',
  'SV Rotweil',
  'TuS Ahornfeld',
  'SpVgg Birkenbach',
  'VfR Sonnenberg',
  'FSV Kleefeld',
  'SC Wiesental',
  'TSG Eschenhain',
  'FC Rosenhügel',
];

export const POSITIONS = [
  'Torwart',
  'Innenverteidigung',
  'Außenverteidigung',
  'Defensives Mittelfeld',
  'Zentrales Mittelfeld',
  'Offensives Mittelfeld',
  'Außenbahn',
  'Sturm',
];

export const ABSENCE_REASONS_NO = [
  'Arbeit',
  'Schule/Klausur',
  'krank',
  'Familienfeier',
  'Urlaub',
  'verletzt',
  'Termin',
];

/** Gemeinsames Passwort aller Demo-Logins. Nur für Entwicklung und Vorführungen. */
export const DEMO_PASSWORD = 'clubroof-demo';

/**
 * Feste Demo-Personen mit Login.
 * `key` wird im Seed zur Verknüpfung verwendet.
 */
export const PERSONAS = {
  admin: {
    firstName: 'Daniel',
    lastName: 'Schäfer',
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    birthDate: '1986-03-14',
    description: 'Fulladmin',
  },
  board: {
    firstName: 'Sandra',
    lastName: 'Hoffmann',
    email: `vorstand@${DEMO_EMAIL_DOMAIN}`,
    birthDate: '1979-09-02',
    description: '1. Vorsitzende',
  },
  coach: {
    firstName: 'Max',
    lastName: 'Mustermann',
    email: `trainer@${DEMO_EMAIL_DOMAIN}`,
    birthDate: '1991-05-21',
    description: 'Trainer B-Jugend und C-Jugend, Spieler 2. Mannschaft',
  },
  player: {
    firstName: 'Max',
    lastName: 'Becker',
    email: `spieler@${DEMO_EMAIL_DOMAIN}`,
    birthDate: '2010-04-17',
    description: 'Spieler B-Jugend',
  },
  parent: {
    firstName: 'Julia',
    lastName: 'Neumann',
    email: `eltern@${DEMO_EMAIL_DOMAIN}`,
    birthDate: '1984-11-08',
    description: 'Mutter von Leon (E-Jugend) und Mia (F-Jugend)',
  },
  treasurer: {
    firstName: 'Petra',
    lastName: 'Schulz',
    email: `kasse@${DEMO_EMAIL_DOMAIN}`,
    birthDate: '1972-01-30',
    description: 'Kassenwartin',
  },
} as const;

export type PersonaKey = keyof typeof PERSONAS;

/** Weitere feste Funktionsträger (ohne Login). */
export const OFFICIALS = {
  headCoach: { firstName: 'Thomas', lastName: 'Becker', birthDate: '1983-07-11' },
  youthDirector: { firstName: 'Michael', lastName: 'Weber', birthDate: '1980-02-25' },
  sportsDirector: { firstName: 'Jens', lastName: 'Hartmann', birthDate: '1977-10-03' },
  facilityManager: { firstName: 'Klaus', lastName: 'Richter', birthDate: '1961-06-19' },
  memberAdmin: { firstName: 'Andrea', lastName: 'Wolf', birthDate: '1975-12-12' },
  refereeLead: { firstName: 'Uwe', lastName: 'Krüger', birthDate: '1966-04-07' },
} as const;

export const DOCUMENTS: {
  title: string;
  fileName: string;
  category: 'regulations' | 'forms' | 'training_plans' | 'other';
  mimeType: string;
  sizeBytes: number;
  team?: TeamKey;
}[] = [
  {
    title: 'Vereinssatzung',
    fileName: 'Satzung_SV_Gruen-Weiss.pdf',
    category: 'regulations',
    mimeType: 'application/pdf',
    sizeBytes: 412_000,
  },
  {
    title: 'Beitragsordnung 2026',
    fileName: 'Beitragsordnung_2026.pdf',
    category: 'regulations',
    mimeType: 'application/pdf',
    sizeBytes: 245_000,
  },
  {
    title: 'Jugendordnung',
    fileName: 'Jugendordnung.pdf',
    category: 'regulations',
    mimeType: 'application/pdf',
    sizeBytes: 198_000,
  },
  {
    title: 'Datenschutzhinweise für Mitglieder',
    fileName: 'Datenschutzhinweise.pdf',
    category: 'regulations',
    mimeType: 'application/pdf',
    sizeBytes: 156_000,
  },
  {
    title: 'Aufnahmeantrag',
    fileName: 'Aufnahmeantrag.pdf',
    category: 'forms',
    mimeType: 'application/pdf',
    sizeBytes: 128_000,
  },
  {
    title: 'SEPA-Lastschriftmandat',
    fileName: 'SEPA-Mandat.pdf',
    category: 'forms',
    mimeType: 'application/pdf',
    sizeBytes: 94_000,
  },
  {
    title: 'Einverständniserklärung U18',
    fileName: 'Einverstaendniserklaerung_U18.docx',
    category: 'forms',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 72_000,
  },
  {
    title: 'Fahrtkostenabrechnung',
    fileName: 'Fahrtkostenabrechnung.xlsx',
    category: 'forms',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 41_000,
  },
  {
    title: 'Trainingsplan U15 – Herbst',
    fileName: 'Trainingsplan_U15_Herbst.xlsx',
    category: 'training_plans',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 86_000,
    team: 'c1',
  },
  {
    title: 'Trainingsplan U17 – Herbst',
    fileName: 'Trainingsplan_U17_Herbst.pdf',
    category: 'training_plans',
    mimeType: 'application/pdf',
    sizeBytes: 132_000,
    team: 'b1',
  },
  {
    title: 'Hygienekonzept Sportplatz',
    fileName: 'Hygienekonzept_Sportplatz.pdf',
    category: 'other',
    mimeType: 'application/pdf',
    sizeBytes: 512_000,
  },
  {
    title: 'Platzordnung',
    fileName: 'Platzordnung.pdf',
    category: 'other',
    mimeType: 'application/pdf',
    sizeBytes: 88_000,
  },
];
