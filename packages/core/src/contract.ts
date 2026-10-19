import type { Locale } from './i18n';
/**
 * Antworttypen der API. Werden von Backend, App und Web-Verwaltung gemeinsam verwendet,
 * damit beide Seiten immer dieselbe Struktur erwarten. Zeitpunkte sind ISO-8601-Strings (UTC).
 */
import type {
  AbsenceKind,
  ContactVisibility,
  PreferredFoot,
  AnnouncementPriority,
  AttendanceStatus,
  EventType,
  NotificationLevel,
  ParticipationMode,
  JerseyMode,
  LineupRole,
  MatchIncidentKind,
  TeamFunction,
  TeamTemplate,
  TransferKind,
} from './domain';
import type { ClubCashArea, ClubCashDirection } from './club-cash';
import type { LineupSize } from './lineup';
import type { ScopeType } from './scopes';

export type ClubInfo = {
  id: string;
  name: string;
  shortName: string;
  /** Vereinskürzel (2–4 Zeichen) für Plakat und Wappen-Ersatz */
  shortCode: string;
  logoUrl: string | null;
  /** Schlüssel der Vereinsfarbe (siehe @clubroof/design-tokens) */
  colorTheme: string;
  colorMode: 'light' | 'dark' | 'system';
  timezone: string;
};

export type ManagedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  relation: 'self' | 'child';
  avatarUrl: string | null;
};

export type MyTeam = {
  id: string;
  name: string;
  badge: string;
  ageGroup: string | null;
  league: string | null;
  participationMode: ParticipationMode;
  /** Person (ich selbst oder mein Kind), über die ich zu dieser Mannschaft gehöre */
  personId: string;
  functions: TeamFunction[];
  /** Für diese Mannschaft aktivierte Module (bestimmen die Kacheln im Team-Bereich) */
  modules: string[];
};

export type ColorMode = 'light' | 'dark' | 'system';

export type MeResponse = {
  /** colorMode: persönliche Darstellung (Standard hell) */
  user: {
    id: string;
    email: string;
    displayName: string;
    colorMode: ColorMode;
    /** Gewählte Sprache; `null` = Sprache des Geräts */
    language: Locale | null;
    /** Schnellzugriff auf Home (Schlüssel in Reihenfolge); `null` = Standard der Rolle */
    quickLinks: string[] | null;
    /** Vereinsbereich: Reihenfolge und ausgeblendete Kacheln; `null` = alle in Standardreihenfolge */
    clubTiles: { order: string[]; hidden: string[] } | null;
  };
  person: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  club: ClubInfo;
  managedPersons: ManagedPerson[];
  teams: MyTeam[];
  roles: { key: string; name: string; scopeType: ScopeType; scopeId: string | null }[];
  /** Ob der Nutzer den Verwaltungsmodus betreten darf */
  canAdminister: boolean;
  /** Abteilungsübersicht im Team-Tab (Leitung und Vorstand); null ohne Zugriff */
  areaOverview: AreaAccess | null;
  /** Rechte im Verwaltungsbereich (Mitglieder, Rollen, Audit-Log) */
  admin: AdminPermissions;
  /** Bereiche, in denen ich Umfragen erstellen bzw. Dokumente hochladen darf */
  create: { polls: UploadTarget[]; documents: UploadTarget[] };
  /** Vereinslogo und Stammdaten ändern */
  canManageClub: boolean;
  /** Personen einladen und Beitrittsanfragen freigeben (eigene Mannschaften bzw. Verein) */
  canInvite: boolean;
  security: { twoFactorEnabled: boolean; twoFactorRequired: boolean };
  /** News schreiben bzw. ohne Freigabe veröffentlichen (irgendwo im Verein) */
  news: { write: boolean; publish: boolean };
  /** Vereinskasse: Umfang der Einsicht (full = Kassenbuch, reports = nur Auswertungen) oder leer; manage = buchen */
  clubCash: {
    level: 'full' | 'reports';
    manage: boolean;
    /** treasury = Kassenführung/Prüfer (eigener Bereich), board = Vorstand mit Einsicht (nur Kassenübersicht) */
    viewer: 'treasury' | 'board';
  } | null;
  /** Auf Vereinsebene aktivierte Module (bestimmen die Kacheln im Vereinsbereich) */
  clubModules: string[];
  /** Schiedsrichter: einteilen bzw. selbst als Schiedsrichter aktiv */
  referees: { manage: boolean; active: boolean };
  /** Kabinen, Material und Schäden bearbeiten (Platzverantwortliche) */
  equipment: { manage: boolean };
};

export type LoginResponse = { token: string; expiresAt: string; me: MeResponse };

/** Zweiter Anmeldeschritt nötig: Code aus der Authenticator-App eingeben */
export type TwoFactorChallenge = {
  twoFactorRequired: true;
  challenge: string;
  /** Verfügbare Verfahren: Authenticator-App und/oder Code per E-Mail */
  methods: ('app' | 'email')[];
};

export type TwoFactorStatus = {
  enabled: boolean;
  appEnabled: boolean;
  emailEnabled: boolean;
  /** Der Verein verlangt 2-Faktor für das Administrationskonto (Fulladmin) */
  required: boolean;
  recoveryCodesLeft: number;
};

export type TwoFactorSetup = { secret: string; otpauthUrl: string; qrSvg: string };

export type AttendanceCounts = Record<AttendanceStatus, number>;

export type MyResponse = {
  personId: string;
  firstName: string;
  relation: 'self' | 'child';
  role: 'player' | 'coach' | 'guest_player';
  status: AttendanceStatus;
  reason: string | null;
  /** Ob diese Person jetzt noch zu- oder absagen kann */
  canRespond: boolean;
};

/** Sichtbarkeit der erfassten Anwesenheit für Spieler: nur Trainerteam, nur Anzahl („14 von 20 da“) oder namentlich. */
export const ATTENDANCE_VISIBILITIES = ['staff', 'count', 'named'] as const;
export type AttendanceVisibility = (typeof ATTENDANCE_VISIBILITIES)[number];

/** Tage nach Terminbeginn, in denen das Trainerteam die Anwesenheit noch korrigieren darf; danach nur die Verwaltung. */
export const ATTENDANCE_CORRECTION_DAYS = 14;

export const toAttendanceVisibility = (value: string): AttendanceVisibility =>
  (ATTENDANCE_VISIBILITIES as readonly string[]).includes(value)
    ? (value as AttendanceVisibility)
    : 'count';

export type EventSummary = {
  id: string;
  type: EventType;
  status: 'scheduled' | 'cancelled';
  title: string;
  startsAt: string;
  endsAt: string | null;
  meetingAt: string | null;
  meetingPoint: string | null;
  location: string | null;
  /** Link für „Route“ (Karten-App); nur bei Spielorten außerhalb der eigenen Anlage */
  routeUrl: string | null;
  cancelledReason: string | null;
  team: { id: string; name: string; badge: string } | null;
  match: {
    opponentName: string;
    isHome: boolean;
    competition: string | null;
    /** Liga, Pokal oder Testspiel */
    kind: MatchKind;
    goalsFor: number | null;
    goalsAgainst: number | null;
  } | null;
  /** Ende der regulären Zu-/Absagefrist */
  deadline: string | null;
  /** Antwortregeln der Mannschaft (Paket E2); ohne Mannschaft die Standardwerte */
  responseRules: { allowMaybe: boolean; declineReasonRequired: boolean };
  /**
   * Zu- und Absagen der Mannschaft; null, wenn die Mannschaft die Übersicht Spielern und Eltern nicht zeigt
   * (Trainerteam bekommt sie immer) und bei Terminen ohne Mannschaft.
   */
  counts: AttendanceCounts | null;
  myResponses: MyResponse[];
  /**
   * Erfasste Anwesenheit eines vergangenen Termins („14 von 20 da“); null, solange sie nicht erfasst ist
   * oder die Mannschaft sie für die Person nicht freigibt.
   */
  presence: { present: number; total: number } | null;
};

/** Saison des Vereins (Archiv: „Diese Saison“, „Letzte Saison“). */
export type ClubSeason = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
};

/** Rückmeldung zu einer Vereinsveranstaltung: Zusage, Absage oder Unsicher – ohne Begründung. */
export type EventAttendance = {
  /** Meine Rückmeldung; null = noch keine */
  status: 'yes' | 'no' | 'maybe' | null;
  /** Kurzform für status === 'yes' */
  attending: boolean;
  /** Zusagen */
  count: number;
  maybe: number;
  declined: number;
};

/** Termin im Vereinskalender (alle Termine des Vereins) */
export type ClubCalendarEvent = {
  event: EventSummary;
  /** Termin darf geöffnet werden (eigene Mannschaft, Kinder, Verantwortliche, Vereinstermine) */
  canOpen: boolean;
};

export type Participant = {
  personId: string;
  name: string;
  role: 'player' | 'coach' | 'guest_player' | 'attendee';
  status: AttendanceStatus;
  /** Nur für Berechtigte sichtbar (Datensparsamkeit) */
  reason: string | null;
  guestFromTeam: string | null;
  avatarUrl: string | null;
  /** Tatsächlich anwesend laut Trainerteam; null = (noch) nicht erfasst */
  attended: boolean | null;
  /** Fällt über eine eingetragene Abwesenheit aus (zählt in der Kurzübersicht als Absage, im Kader eigene Gruppe) */
  absent: boolean;
  /** Art und Ende der Abwesenheit – nur für das Trainerteam (Datensparsamkeit) */
  absence: { kind: AbsenceKind; endsOn: string } | null;
  /** Rückennummer der Saison (nur bei aktivem Modul „Rückennummern“) */
  jerseyNumber: number | null;
};

export type EventDetail = EventSummary & {
  description: string | null;
  contactPerson: { name: string } | null;
  /** Teilnehmerliste; leer, wenn der Nutzer sie nicht sehen darf */
  participants: Participant[];
  canManage: boolean;
  /** Vereinsveranstaltung: Ich darf sie bearbeiten (Ersteller oder Berechtigte für den Bereich) */
  canEditClubEvent: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung einer Vereinsveranstaltung (ISO), sonst null */
  editedAt: string | null;
  /** Trainer dürfen Zu-/Absagen anderer korrigieren */
  canOverride: boolean;
  /** Ablaufplan (Vereinsveranstaltungen) */
  program: { time: string; title: string }[];
  /**
   * Anwesenheit nach dem Termin: Das Trainerteam hakt ab, wer wirklich da war. Danach zählt
   * die erfasste Anwesenheit statt der Zusage für die Trainingsquote. null bei Vereinsterminen.
   */
  attendanceCheck: {
    recordedAt: string | null;
    canRecord: boolean;
    /** Ende der Korrekturfrist für das Trainerteam; danach nur die Verwaltung */
    correctionUntil: string;
  } | null;
  /** Fahrgemeinschaften bei Auswärtsspielen und Turnieren; sonst null */
  carpool: Carpool | null;
  /** Freiwillige Teilnahme an Vereinsveranstaltungen; null bei Mannschaftsterminen */
  attendance: EventAttendance | null;
  /** Helferschichten der Veranstaltung */
  shifts: HelperShift[];
  /** Letzte Änderung (alt → neu), solange sie noch relevant ist */
  lastChange: { at: string; items: EventChange[] } | null;
  /** Gezielt eingeladen (Vereinsveranstaltung): Mannschaftskürzel und Zahl der Personen; sonst null */
  invited: { teams: string[]; persons: number } | null;
  /** Für das Bearbeiten (nur mit Recht gefüllt) */
  edit: {
    facilityId: string | null;
    locationText: string | null;
    locationUrl: string | null;
    seriesFollowing: number;
  } | null;
};

export type CarpoolOffer = {
  id: string;
  driverName: string;
  seats: number;
  free: number;
  note: string | null;
  passengers: { personId: string; name: string; mine: boolean }[];
  /** Ich fahre selbst */
  mine: boolean;
  /** Ich darf das Angebot zurückziehen (Fahrer oder Trainerteam) */
  canWithdraw: boolean;
};

export type Carpool = {
  offers: CarpoolOffer[];
  /** „Mitfahrt gesucht“ */
  requests: { personId: string; name: string; note: string | null; mine: boolean }[];
  /** Ich (bzw. mein Kind), die mitfahren könnten – Teilnehmer des Termins */
  riders: { personId: string; firstName: string }[];
  /** Vor Beginn: Fahrten anbieten und buchen */
  open: boolean;
};

export type HelperShift = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  filled: number;
  /** Ich bin eingetragen */
  mine: boolean;
  /** Namen der Helfer – nur für Organisatoren sichtbar */
  helpers: string[] | null;
};

export type HelperEvent = {
  event: { id: string; title: string; startsAt: string; location: string | null };
  shifts: HelperShift[];
  openSpots: number;
};

export type NewsItem = {
  id: string;
  title: string;
  teaser: string | null;
  body: string;
  priority: AnnouncementPriority;
  source: { type: ScopeType; label: string };
  imageUrl: string | null;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  likedByMe: boolean;
};

export type ActionItem = {
  kind: 'attendance' | 'poll' | 'approval' | 'task';
  id: string;
  title: string;
  subtitle: string;
  dueAt: string | null;
  link: string;
  /** Umfragen: Antwortmöglichkeiten für die Schnellantwort auf der Startseite */
  options?: { id: string; label: string }[];
};

export type ClubOverview = {
  teams: number;
  members: number;
  /** Abteilungen des Vereins (oberste Ebene der Bereiche) */
  departments: number;
  /** Spiele aller Mannschaften in den nächsten 7 Tagen */
  matchesThisWeek: number;
  /** Nur für Personen, die News freigeben dürfen; sonst null */
  pendingApprovals: number | null;
  nextClubEvent: { id: string; title: string; startsAt: string } | null;
};

export type HomeResponse = {
  nextMatch: EventSummary | null;
  /** Die nächsten (bis zu drei) Spiele und Spielfeste über alle meine Personen, chronologisch */
  matches: EventSummary[];
  /** Alle meine Termine der nächsten sieben Tage, auch abgesagte */
  week: EventSummary[];
  upcoming: EventSummary[];
  news: NewsItem[];
  actions: ActionItem[];
  clubOverview: ClubOverview | null;
  unreadNotifications: number;
  /** Geburtstage in meinen Mannschaften in den nächsten 7 Tagen */
  birthdays: Birthday[];
};

export type Birthday = {
  personId: string;
  name: string;
  teamBadge: string;
  /** „14.10.“ – ohne Jahr und Alter */
  day: string;
  /** 0 = heute */
  inDays: number;
  /** Ich selbst bzw. mein Kind */
  mine: boolean;
};

export type NotificationItem = {
  id: string;
  level: NotificationLevel;
  category: string;
  topic: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
  doneAt: string | null;
};

export type Absence = {
  id: string;
  personId: string;
  personName: string;
  kind: AbsenceKind;
  startsOn: string;
  endsOn: string;
  /** Leer = gilt für alle Mannschaften der Person */
  teams: { id: string; badge: string }[];
  note: string | null;
  /** Anzahl der Termine, für die dadurch automatisch abgesagt wurde */
  affectedEvents: number;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

/** Abwesenheit nachträglich ändern (Paket BE); die Person selbst bleibt gleich. */
export type UpdateAbsenceInput = Partial<Omit<CreateAbsenceInput, 'personId'>>;

export type CreateAbsenceInput = {
  personId: string;
  kind: AbsenceKind;
  startsOn: string;
  endsOn: string;
  teamIds?: string[] | null;
  note?: string | null;
};

export type PollSummary = {
  id: string;
  question: string;
  source: { type: ScopeType; label: string };
  closesAt: string | null;
  isOpen: boolean;
  votes: number;
  /** Gewählte Option, falls bereits abgestimmt */
  myOptionId: string | null;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

export type PollDetail = PollSummary & {
  description: string | null;
  createdBy: string | null;
  resultVisibility: 'always' | 'after_vote' | 'after_close';
  /** Ob Ergebnisse für den Nutzer sichtbar sind */
  resultsVisible: boolean;
  options: { id: string; label: string; votes: number | null }[];
  /** Ich darf die Umfrage vorzeitig beenden */
  canClose: boolean;
  /** Ich darf die Umfrage ändern (Ersteller oder Berechtigte, nur solange sie offen ist) */
  canEdit: boolean;
  /** Antworten lassen sich nicht mehr ändern, weil schon abgestimmt wurde */
  optionsLocked: boolean;
};

/** Umfrage nachträglich ändern (Paket BE): Optionen nur, solange keine Stimme abgegeben ist. */
export type UpdatePollInput = Partial<
  Pick<CreatePollInput, 'question' | 'description' | 'closesAt' | 'resultVisibility' | 'options'>
>;

export type TeamPermissions = {
  manageEvents: boolean;
  overrideAttendance: boolean;
  readAttendance: boolean;
  readCash: boolean;
  manageCash: boolean;
  /** Strafenkatalog pflegen und Strafen vergeben (Trainerteam, Kassenwart) */
  manageFines: boolean;
  /** Spielerbedarf melden, Spieler anbieten und abstellen (Gastspielerbörse) */
  manageDemand: boolean;
  /** Module der Mannschaft ein- und ausschalten */
  manageModules: boolean;
  /** Archiv der Mannschaft einsehen (Paket AR) */
  readArchive: boolean;
};

export type MatchResult = {
  eventId: string;
  startsAt: string;
  opponentName: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  outcome: 'win' | 'draw' | 'loss';
};

export type TeamHighlights = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Anteil Zusagen an vergangenen Trainings der letzten 4 Wochen (0–100), null ohne Trainings */
  trainingRate: number | null;
};

export type SquadStatus = {
  players: number;
  available: number;
  declined: number;
  absent: number;
  pending: number;
};

/** Spieler je Mannschaftsteil (nur Spieler mit eingetragener Position) */
export type SquadComposition = Record<'goalkeeper' | 'defense' | 'midfield' | 'attack', number>;

export type TeamOverview = {
  team: {
    id: string;
    name: string;
    badge: string;
    league: string | null;
    ageGroup: string | null;
    /** Willkommenstext für Eltern und Spieler (Paket E2) */
    welcomeText?: string | null;
  };
  permissions: TeamPermissions;
  /** Mannschaftskasse mit Strafenkatalog aktiv */
  fines: boolean;
  nextEvent: EventSummary | null;
  /** Kaderstatus bezogen auf den nächsten Termin */
  squad: SquadStatus | null;
  /** Kaderzusammensetzung nach Mannschaftsteilen (Tor, Abwehr, Mittelfeld, Sturm) */
  composition: SquadComposition;
  /** Nur für das Trainerteam: die nächsten drei Spiele mit Kaderstatus (Kaderplanung auf einen Blick) */
  upcomingMatches: { event: EventSummary; squad: SquadStatus }[];
  lastResults: MatchResult[];
  trainingWeek: EventSummary[];
  highlights: TeamHighlights;
  /** Erfolgreichster Torschütze der Saison (aus abgeschlossenen Spielberichten), nur mit Statistik-Modul */
  topScorer: { name: string; goals: number } | null;
};

export type RosterEntry = {
  personId: string;
  name: string;
  function: TeamFunction;
  jerseyNumber: number | null;
  position: string | null;
  preferredFoot: 'left' | 'right' | 'both' | null;
  /** Heute nicht verfügbar (Abwesenheit) */
  unavailable: boolean;
  /** Grund nur für Verantwortliche oder die Person selbst */
  unavailableReason: string | null;
  unavailableUntil: string | null;
  avatarUrl: string | null;
};

export type PlayerStat = {
  personId: string;
  name: string;
  trainings: number;
  trainingsAttended: number;
  /** 0–100 */
  trainingRate: number | null;
  matchesAttended: number;
};

export type TeamStats = {
  highlights: TeamHighlights;
  results: MatchResult[];
  /** Alle Spieler (für Verantwortliche) oder nur die eigenen Werte */
  players: PlayerStat[];
  /** Kader-Statistik: alle Spieler der Mannschaft mit Einsätzen, Toren, Vorlagen und Karten */
  squad: SquadStatRow[];
  /** Trainingsquoten in der Kader-Statistik sichtbar (Trainerteam); sonst nur die eigene */
  showsTrainingRates: boolean;
  level: 'basic' | 'extended' | 'custom';
  /** Ausgewerteter Zeitraum (Kalendertage, inklusive) */
  period: StatsPeriod;
};

export type StatsPeriodKind = 'season' | 'month' | 'custom';

export type StatsPeriod = {
  kind: StatsPeriodKind;
  from: string;
  to: string;
  /** Saisonbeginn – frühestes sinnvolles Datum für die Auswahl */
  seasonStart: string;
};

export type SquadStatRow = {
  personId: string;
  name: string;
  jerseyNumber: number | null;
  position: string | null;
  /** Einsätze (Startelf + eingewechselt bzw. Bank) in vergangenen Spielen */
  appearances: number;
  starts: number;
  goals: number;
  assists: number;
  yellow: number;
  yellowRed: number;
  red: number;
  /** 0–100; null, wenn nicht sichtbar oder keine Trainings */
  trainingRate: number | null;
};

export type PaymentMethod = 'bar' | 'ueberweisung' | 'paypal';

export type CashEntry = {
  id: string;
  bookedOn: string;
  direction: 'income' | 'expense';
  isCharge: boolean;
  amountCents: number;
  category: string;
  description: string;
  counterparty: string | null;
  person: { id: string; name: string } | null;
  paymentMethod: PaymentMethod | null;
  /** Beleg (signierter Bildlink) */
  receiptUrl: string | null;
  /** Storniert – zählt nicht mehr */
  cancelled: { at: string; by: string | null; reason: string | null } | null;
};

export type PersonalAccount = {
  personId: string;
  name: string;
  /** Einzahlungen − Forderungen; negativ = offener Betrag */
  balanceCents: number;
  entries: CashEntry[];
};

export type TeamCash = {
  team: { id: string; name: string; badge: string };
  permissions: TeamPermissions;
  config: { fines: boolean; drinks: boolean };
  balanceCents: number | null;
  incomeCents: number | null;
  expenseCents: number | null;
  /** Buchungen (ganze Mannschaft und Kassenverantwortliche) */
  entries: CashEntry[] | null;
  /** Persönliche Konten aller Mitglieder (ganze Mannschaft und Kassenverantwortliche) */
  members: { personId: string; name: string; balanceCents: number }[] | null;
  /** Meine Konten bzw. die meiner Kinder */
  personal: PersonalAccount[];
  /** Strafenkatalog der Mannschaft (wenn Strafen aktiviert sind) */
  fineCatalog: FineType[];
  /** Bezahlinfos (für alle), übrige Einstellungen für die Kassenverwaltung */
  settings: CashSettings;
  /** Kassenwarte der Mannschaft */
  treasurers: { personId: string; name: string }[];
  /** Meldungen „Ich habe überwiesen“: Kassenverwaltung alle offenen, sonst die eigenen */
  paymentNotices: PaymentNotice[];
  fees: CashFee[];
  closings: CashClosing[];
};

export type CashSettings = {
  iban: string | null;
  accountHolder: string | null;
  paypalLink: string | null;
  drinkPriceCents: number | null;
  /** Mannschaft sieht offene Beträge der anderen (sonst nur die eigenen) */
  showMemberBalances: boolean;
  /** Am Monatsanfang automatisch an offene Beträge erinnern */
  autoReminder: boolean;
  /** Sparziel der Mannschaft (Name und Betrag), z. B. „Mannschaftsfahrt“ */
  savingsGoalName: string | null;
  savingsGoalCents: number | null;
};

export type PaymentNotice = {
  id: string;
  personId: string;
  name: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  note: string | null;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'rejected';
};

export type CashFee = {
  id: string;
  name: string;
  amountCents: number;
  interval: 'monthly' | 'season' | 'once';
  nextDueOn: string | null;
};

export type CashClosing = {
  id: string;
  closedOn: string;
  balanceCents: number;
  openCents: number;
  auditor: string | null;
  note: string | null;
  createdBy: string | null;
};

export type TreasurerCandidates = {
  treasurers: { personId: string; name: string }[];
  /** Erwachsene mit Login aus der Mannschaft und Eltern der Spieler */
  candidates: { personId: string; name: string; relation: string }[];
};

export type FineType = {
  id: string;
  name: string;
  amountCents: number;
  /** So oft in dieser Saison vergeben */
  timesGiven: number;
};

export type SaveFineTypeInput = { name: string; amountCents: number };

export type AssignFineInput = {
  /** Aus dem Katalog; leer = freie Strafe (nur mit vollen Kassenrechten) */
  fineTypeId?: string | null;
  amountCents?: number;
  description?: string;
  personIds: string[];
  bookedOn?: string | null;
};

export type CashStats = {
  /** Monatsweise ab Saisonbeginn: echte Geldbewegungen und Kassenstand am Monatsende */
  months: { month: string; incomeCents: number; expenseCents: number; balanceCents: number }[];
  /** Einnahmen und Ausgaben nach Kategorie (ohne Forderungen) */
  categories: { category: string; incomeCents: number; expenseCents: number }[];
  /** Vergebene Strafen nach Art */
  fines: { name: string; count: number; amountCents: number }[];
  /** Strafen je Person (Summe vergeben, noch offen) */
  finesByPerson: {
    personId: string;
    name: string;
    count: number;
    amountCents: number;
    openCents: number;
  }[];
  /** Woher das Geld kommt: Forderungen (Strafen, Getränke, Umlagen, Beiträge) und Einnahmen nach Art, Saison */
  sources: { category: string; cents: number }[];
  /** Getränke je Person in der Saison – nur für Berechtigte */
  drinksByPerson: { personId: string; name: string; count: number; amountCents: number }[];
  /** Sparziel mit aktuellem Kassenstand; null ohne Ziel */
  goal: { name: string; targetCents: number; balanceCents: number } | null;
  /** Zahlungsmoral je Person (vergebene Forderungen insgesamt, davon noch offen) – nur für Berechtigte */
  moral: { personId: string; name: string; chargedCents: number; openCents: number }[];
  /** Summe aller offenen Beträge der persönlichen Konten */
  openCents: number;
  /** Anteil der vergebenen Forderungen, der schon bezahlt ist (0–100) */
  paidRate: number | null;
};

/** Zeitraum-Auflösung der Kassen-Statistik: Monate oder Quartale. */
export const CLUB_STATS_INTERVALS = ['month', 'quarter'] as const;
export type ClubStatsInterval = (typeof CLUB_STATS_INTERVALS)[number];

/**
 * Auswertungen der Vereinskasse (Paket ST), serverseitig berechnet und nur aggregiert geliefert. Beträge in Cent.
 * Periodenschlüssel sind `JJJJ-MM` (Monat) bzw. `JJJJ-Qn` (Quartal); `previous…` ist dieselbe Periode ein Jahr früher.
 */
export type ClubCashStats = {
  from: string;
  to: string;
  interval: ClubStatsInterval;
  fundId: string | null;
  /** Kassenstand am Ende jeder Periode (alle sichtbaren Konten, ohne Stornierte) */
  balance: { key: string; cents: number; previousCents: number }[];
  /** Einnahmen und Ausgaben je Periode (ohne Umbuchungen) */
  flows: {
    key: string;
    incomeCents: number;
    expenseCents: number;
    previousIncomeCents: number;
    previousExpenseCents: number;
  }[];
  /** Einnahmen und Ausgaben je steuerlichem Bereich im Zeitraum */
  areas: { area: ClubCashArea; incomeCents: number; expenseCents: number }[];
  /** Haushaltsplan gegen Ist je Kategorie für das Jahr des Zeitraumendes; null ohne Plan */
  plan: {
    year: number;
    lines: {
      categoryId: string;
      name: string;
      direction: ClubCashDirection;
      area: ClubCashArea;
      plannedCents: number;
      actualCents: number;
    }[];
  } | null;
  /** Beiträge mit Fälligkeit im Zeitraum; null, wenn die Kasse nur für Abteilungen sichtbar ist */
  fees: {
    dueCents: number;
    paidCents: number;
    openCents: number;
    overdueCents: number;
    overdueCount: number;
    /** Zahlungseingang je Periode (nach Zahldatum) */
    received: { key: string; cents: number }[];
  } | null;
  /** Ausgaben je Abteilung (Kostenstellen der Art „Abteilung“) im Zeitraum */
  departments: { id: string; name: string; expenseCents: number }[];
  /** Rücklagen mit Ziel */
  reserves: { id: string; name: string; balanceCents: number; targetCents: number | null }[];
  totals: {
    balanceCents: number;
    previousBalanceCents: number;
    incomeCents: number;
    expenseCents: number;
    previousExpenseCents: number;
  };
};

export type CashBookingKind = 'income' | 'expense' | 'fine' | 'drinks' | 'payment';

export type CreateCashBookingInput = {
  kind: CashBookingKind;
  amountCents: number;
  description: string;
  personId?: string | null;
  counterparty?: string | null;
  bookedOn?: string | null;
  /** Einnahmen/Ausgaben: Kategorie aus CASH_INCOME_CATEGORIES bzw. CASH_EXPENSE_CATEGORIES */
  category?: string | null;
  paymentMethod?: PaymentMethod | null;
  /** Hochgeladenes Belegbild (Zweck „receipt“) */
  receiptImageId?: string | null;
};

export const CASH_INCOME_CATEGORIES = [
  'sponsoring',
  'einnahmen_spieltag',
  'veranstaltung',
  'spende',
  'zuschuss',
  'einnahme',
] as const;
export const CASH_EXPENSE_CATEGORIES = [
  'material',
  'getraenke',
  'veranstaltung',
  'fahrtkosten',
  'startgeld',
  'schiedsrichter',
  'ausgabe',
] as const;

export type Facility = { id: string; name: string; shortName: string | null };

export const MATCH_KINDS = ['league', 'cup', 'friendly'] as const;
export type MatchKind = (typeof MATCH_KINDS)[number];

export type CreateEventInput = {
  type: 'training' | 'match' | 'team_event';
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  meetingAt?: string | null;
  meetingPoint?: string | null;
  facilityId?: string | null;
  locationText?: string | null;
  /** Maps-Link oder Koordinaten („50.1234, 8.5678“) */
  locationUrl?: string | null;
  description?: string | null;
  opponentName?: string | null;
  isHome?: boolean | null;
  /** Konfliktwarnung bewusst übergehen (Sperrungen nur mit Platzrecht) */
  allowConflict?: boolean;
  /** Serientermin: so viele wöchentliche Termine anlegen (2–26) */
  repeatWeeks?: number;
  /** Serientermin: wöchentlich wiederholen bis einschließlich diesem Tag (Vereinszeitzone, JJJJ-MM-TT) */
  repeatUntil?: string | null;
  /** Spiele: Liga (Standard), Pokal oder Testspiel */
  matchKind?: MatchKind | null;
};

export type UpdateEventInput = {
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
  meetingAt?: string | null;
  meetingPoint?: string | null;
  facilityId?: string | null;
  locationText?: string | null;
  locationUrl?: string | null;
  description?: string | null;
  opponentName?: string;
  isHome?: boolean;
  matchKind?: MatchKind;
  /** Bei Serienterminen: nur diesen oder auch alle folgenden Termine ändern */
  scope?: 'single' | 'following';
  allowConflict?: boolean;
};

export type EventChange = { label: string; from: string | null; to: string | null };

export type DocumentCategory = 'regulations' | 'forms' | 'training_plans' | 'other';

export type DocumentItem = {
  id: string;
  title: string;
  fileName: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  source: { type: ScopeType; label: string };
  /** Bereich, für den das Dokument sichtbar ist (Mannschaft, Abteilung; null = ganzer Verein) */
  scopeId: string | null;
  /** Ich darf dieses Dokument löschen */
  canDelete: boolean;
  /** Ich darf Titel, Kategorie und Sichtbarkeit ändern */
  canEdit: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

/** Dokument nachträglich ändern (Paket BE); die Datei selbst bleibt – austauschen heißt löschen und neu hochladen. */
export type UpdateDocumentInput = {
  title?: string;
  category?: DocumentCategory;
  scopeType?: ScopeType;
  scopeId?: string | null;
};

export type UploadTarget = { type: ScopeType; id: string | null; label: string };

export type UploadDocumentInput = {
  title: string;
  category: DocumentCategory;
  scopeType: ScopeType;
  scopeId?: string | null;
  fileName: string;
  /** Dateiinhalt als Base64 */
  dataBase64: string;
};

export type UploadImageInput = {
  purpose: 'news' | 'logo' | 'avatar' | 'board' | 'receipt' | 'sponsor' | 'claim';
  fileName: string;
  dataBase64: string;
};

export type UploadedImage = { id: string; url: string };

export type CreatePollInput = {
  question: string;
  description?: string | null;
  options: string[];
  closesAt?: string | null;
  resultVisibility: 'always' | 'after_vote' | 'after_close';
  scopeType: ScopeType;
  scopeId?: string | null;
};

export type ClubTeamGroup = {
  orgUnit: { id: string; name: string };
  teams: {
    id: string;
    name: string;
    badge: string;
    ageGroup: string | null;
    league: string | null;
    players: number;
    coaches: string[];
    isMine: boolean;
  }[];
};

/** Mannschaftsseite für alle im Verein (ohne Kontaktdaten). */
export type ClubTeamPage = {
  team: {
    id: string;
    name: string;
    badge: string;
    ageGroup: string | null;
    league: string | null;
    orgUnitName: string;
  };
  coaches: { personId: string; name: string; function: TeamFunction; avatarUrl: string | null }[];
  playerCount: number;
  /** Kader mit Namen – bei Jugendmannschaften nur für die Mannschaft selbst und Verantwortliche */
  players:
    | { personId: string; name: string; jerseyNumber: number | null; position: string | null }[]
    | null;
  nextMatch: {
    id: string;
    title: string;
    startsAt: string;
    isHome: boolean | null;
    location: string | null;
  } | null;
  lastResults: MatchResult[];
  highlights: TeamHighlights;
  isMine: boolean;
};

export type Contact = {
  personId: string;
  name: string;
  /** z. B. „1. Vorsitzende“, „Jugendleitung“, „Trainer B1“ */
  functions: string[];
  email: string | null;
  phone: string | null;
};

export type ContactGroup = { title: string; contacts: Contact[] };

export type PersonStatsByTeam = {
  teamId: string;
  badge: string;
  trainings: number;
  trainingsAttended: number;
  matches: number;
  /** Einsätze laut Aufstellung, Tore und Vorlagen aus abgeschlossenen Spielberichten */
  appearances: number;
  goals: number;
  assists: number;
};

export type PersonStats = {
  /** Anteil Zusagen an vergangenen Trainings der Saison (0–100) */
  trainingRate: number | null;
  trainings: number;
  trainingsAttended: number;
  matches: number;
  appearances: number;
  goals: number;
  assists: number;
  byTeam: PersonStatsByTeam[];
};

export type PersonProfile = {
  personId: string;
  firstName: string;
  lastName: string;
  relation: 'self' | 'child' | 'other';
  avatarUrl: string | null;
  position: string | null;
  preferredFoot: PreferredFoot | null;
  teams: {
    id: string;
    name: string;
    badge: string;
    function: TeamFunction;
    jerseyNumber: number | null;
    isPrimary: boolean;
  }[];
  /** Heute verfügbar? Grund nur für die Person selbst, Eltern und das Trainerteam */
  availability: { available: boolean; reason: string | null; until: string | null };
  /** Saisonwerte – nur für die Person selbst, Eltern und das Trainerteam */
  stats: PersonStats | null;
  /** Kontaktdaten gemäß Sichtbarkeitseinstellung */
  contact: { email: string | null; phone: string | null } | null;
  /** Nur für die Person selbst bzw. Eltern */
  contactVisibility: ContactVisibility | null;
  canEdit: boolean;
};

export type UpdateProfileInput = {
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  preferredFoot?: PreferredFoot | null;
  contactVisibility?: ContactVisibility;
  /** Hochgeladenes Profilfoto (Zweck „avatar“); null entfernt das Foto */
  avatarImageId?: string | null;
};

export type ExchangeTeamRef = { id: string; name: string; badge: string };

export type PlayerDemand = {
  id: string;
  team: ExchangeTeamRef;
  event: { id: string; title: string; type: EventType; startsAt: string; location: string | null };
  count: number;
  /** Nominierte Gastspieler, die nicht abgesagt haben */
  filled: number;
  positions: string[];
  note: string | null;
  status: 'open' | 'fulfilled';
  createdAt: string;
  /** Der Bedarf gehört zu einer Mannschaft, für die ich Bedarf verwalten darf */
  mine: boolean;
  /** Ich kann aus einer meiner Mannschaften Spieler abstellen */
  canNominate: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

export type PlayerOffer = {
  id: string;
  team: ExchangeTeamRef;
  day: string;
  count: number;
  note: string | null;
  mine: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

export type ExchangeOverview = {
  /** Mannschaften, für die ich Bedarf melden bzw. aus denen ich Spieler abstellen darf */
  myTeams: ExchangeTeamRef[];
  demands: PlayerDemand[];
  offers: PlayerOffer[];
  summary: { openDemands: number; offeringTeams: number; forYou: number };
};

export type DemandCandidate = {
  personId: string;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  state: 'available' | 'absent' | 'busy' | 'nominated';
  /** Hinweis für den abgebenden Trainer, z. B. „Spielt selbst: B1 Training“ */
  hint: string | null;
};

export type DemandDetail = PlayerDemand & {
  guests: {
    personId: string;
    name: string;
    fromTeam: string;
    status: AttendanceStatus;
    canWithdraw: boolean;
  }[];
  /** Verfügbarkeit anderer Mannschaften – nur Zahlen, keine Gründe */
  availability: { team: ExchangeTeamRef; players: number; available: number }[];
  /** Spieler meiner Mannschaften, die ich nominieren kann */
  candidates: { team: ExchangeTeamRef; players: DemandCandidate[] }[];
};

export type CreateDemandInput = {
  teamId: string;
  eventId: string;
  count: number;
  positions?: string[];
  note?: string | null;
};

/** Spielerbedarf nachträglich ändern (Paket BE): Anzahl (nicht unter den schon Nominierten), Positionen, Hinweis. */
export type UpdateDemandInput = { count?: number; positions?: string[]; note?: string | null };

/** Angebot nachträglich ändern (Paket BE): Anzahl, Tag und Hinweis. */
export type UpdateOfferInput = { count?: number; day?: string; note?: string | null };

export type CreateOfferInput = { teamId: string; day: string; count: number; note?: string | null };

export type ApiError = { error: string; message: string };

// ── Platzbelegung ─────────────────────────────────────────────────────────

export type FacilityBooking = {
  id: string;
  kind: 'event' | 'block';
  title: string;
  /** Mannschaft des Termins, z. B. „B1“ */
  teamBadge: string | null;
  eventType: EventType | null;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  /** Überschneidet sich mit einer anderen Belegung oder Sperrung */
  conflict: boolean;
  /** Sperrung nachträglich geändert (ISO), sonst null */
  editedAt: string | null;
};

export type FacilityOccupancy = {
  /** Erster und letzter Tag (Vereinszeitzone, YYYY-MM-DD) */
  from: string;
  to: string;
  facilities: { facility: Facility & { kind: string }; bookings: FacilityBooking[] }[];
  conflicts: number;
  canManage: boolean;
};

/** Sperrung nachträglich ändern (Paket BE): Platz, Zeitraum und Grund; betroffene Termine auf Wunsch absagen. */
export type UpdateFacilityBlockInput = Partial<CreateFacilityBlockInput>;

export type CreateFacilityBlockInput = {
  facilityId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  /** Betroffene Termine absagen und Beteiligte benachrichtigen */
  cancelEvents?: boolean;
};

// ── Verwaltung ────────────────────────────────────────────────────────────

export type MembershipStatus = 'active' | 'inactive' | 'left';

/** Was der angemeldete Nutzer in der Verwaltung darf (Anzeige; geprüft wird serverseitig). */
export type AdminPermissions = {
  readMembers: boolean;
  /** Stammdaten, Ein-/Austritte, Mannschaftszuordnung (nur Vereinsebene) */
  manageMembers: boolean;
  manageRoles: boolean;
  readAudit: boolean;
  /** Archiv gelöschter Einträge einsehen (Paket AR) */
  readArchive: boolean;
  /** Module für den Verein ein- und ausschalten, Update-Center */
  manageModules: boolean;
  /** Spielerbewegungen erfassen (Wechsel, Leihe, Zu-/Abgang) */
  manageTransfers: boolean;
  /** Mannschaften anlegen und bearbeiten (Verein oder eigener Bereich) */
  manageTeams: boolean;
  /** Neue Saison vorbereiten und starten (nur Vereinsebene) */
  planSeason: boolean;
  /** Vereins- bzw. Bereichsveranstaltungen planen */
  planEvents: boolean;
};

export type AuditEntry = {
  id: string;
  at: string;
  actor: string | null;
  /** Verständliche Beschreibung, z. B. „Rolle vergeben: Kassenwart (B1)“ */
  label: string;
};

export type AdminOverview = {
  can: AdminPermissions;
  members: { active: number; inactive: number; left: number; withoutTeam: number };
  teams: number;
  accounts: number;
  recentActivity: AuditEntry[];
};

export type MemberListItem = {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  status: MembershipStatus;
  teams: { badge: string; function: TeamFunction }[];
  roles: string[];
  hasAccount: boolean;
  avatarUrl: string | null;
};

export type MemberRoleAssignment = {
  id: string;
  roleKey: string;
  roleName: string;
  scopeType: ScopeType;
  scopeId: string | null;
  /** „Verein“, „Jugend“ oder „B1 · B-Jugend“ */
  scopeLabel: string;
};

export type MemberDetail = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  memberSince: string | null;
  status: MembershipStatus;
  hasAccount: boolean;
  avatarUrl: string | null;
  guardians: { id: string; name: string }[];
  children: { id: string; name: string }[];
  memberships: {
    id: string;
    /** Gilt erst in der vorbereiteten nächsten Saison */
    upcoming: boolean;
    team: { id: string; name: string; badge: string };
    function: TeamFunction;
    jerseyNumber: number | null;
    isPrimary: boolean;
    validFrom: string;
  }[];
  roles: MemberRoleAssignment[];
  /** Einzeln vergebene Rechte (zusätzlich zu den Rollen, vereinsweit) */
  individualPermissions: string[];
  can: AdminPermissions;
};

export type CreateMemberInput = {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  email?: string | null;
  phone?: string | null;
  memberNumber?: string | null;
  memberSince?: string | null;
};

export type UpdateMemberInput = Partial<CreateMemberInput> & { status?: MembershipStatus };

export type AddMembershipInput = {
  teamId: string;
  function: TeamFunction;
  jerseyNumber?: number | null;
  isPrimary?: boolean;
};

/** Mannschaftsprofil, das Trainer selbst pflegen (Treffpunkt-Regeln, DFBnet-Schreibweisen) */
export type TeamProfile = {
  /** Minuten vor Spielbeginn (leer = kein automatisches Treffen) */
  matchMeetingMinutes: number | null;
  /** Minuten vor Trainingsbeginn */
  trainingMeetingMinutes: number | null;
  defaultMeetingPoint: string | null;
  /** Weitere Schreibweisen der Mannschaft im DFBnet (für den Spielplan-Import) */
  importAliases: string[];
  /** Wer die erfasste Anwesenheit vergangener Termine sieht (Standard: nur Anzahl) */
  attendanceVisibility: AttendanceVisibility;
  /** Antwortfrist für Zu-/Absagen zum Training in Stunden vor Beginn (leer = keine feste Frist oder Wochentagsregel) */
  trainingDeadlineHours: number | null;
  /** Antwortfrist für Spiele in Stunden vor Beginn */
  matchDeadlineHours: number | null;
  /** Aufstellung für Spieler und Eltern sichtbar (Paket AUF, Standard aus) */
  lineupVisible: boolean;
  /** Zu- und Absage-Übersicht für Spieler und Eltern sichtbar (Paket TH, Standard an) */
  responsesVisible: boolean;
  /** Erinnerung an fehlende Rückmeldungen: Stunden vor der Frist (leer = Standard 24, 0 = keine) */
  reminderHours: number | null;
  /** Bei einer Absage ist ein Grund Pflicht (Paket E2) */
  declineReasonRequired: boolean;
  /** „Unsicher“ als Antwort erlaubt (Paket E2, Standard an) */
  allowMaybe: boolean;
  /** Willkommenstext für Eltern und Spieler */
  welcomeText: string | null;
  /** Standard-Spielform im Aufstellungsplaner; leer = nach Altersklasse */
  matchFormat: 7 | 9 | 11 | null;
};

export type TeamManageMember = {
  membershipId: string;
  personId: string;
  name: string;
  function: TeamFunction;
  jerseyNumber: number | null;
  isTreasurer: boolean;
  isMe: boolean;
};

export type TeamManage = {
  team: { id: string; name: string; badge: string };
  profile: TeamProfile;
  members: TeamManageMember[];
  canManageSquad: boolean;
  canEditProfile: boolean;
};

export type TeamCandidate = { personId: string; name: string; memberNumber: string | null };

export type AddTeamMemberInput = {
  personId: string;
  function: Exclude<TeamFunction, 'coach'>;
  jerseyNumber?: number | null;
};

export type UpdateTeamMemberInput = {
  function?: Exclude<TeamFunction, 'coach'>;
  jerseyNumber?: number | null;
};

export type SetIndividualPermissionsInput = { permissions: string[] };

export type AssignRoleInput = { roleKey: string; scopeType: ScopeType; scopeId?: string | null };

export type RoleCatalog = {
  roles: {
    key: string;
    name: string;
    description: string | null;
    defaultScope: ScopeType;
    permissions: string[];
    holders: {
      /** Zuweisung (zum Entziehen) */
      assignmentId: string;
      personId: string;
      name: string;
      scopeLabel: string;
    }[];
  }[];
  scopes: { type: ScopeType; id: string | null; label: string }[];
  teams: { id: string; name: string; badge: string }[];
};

// ── News-Redaktion ───────────────────────────────────────────────────────

export type NewsStatus = 'draft' | 'pending_approval' | 'published' | 'archived';

/** draft = speichern, submit = zur Freigabe einreichen, publish = sofort veröffentlichen */
export type NewsAction = 'draft' | 'submit' | 'publish';

export type EditorialScope = {
  type: ScopeType;
  id: string | null;
  label: string;
  /** Hier darf ich ohne Freigabe veröffentlichen */
  canPublish: boolean;
};

export type EditorialNews = {
  id: string;
  title: string;
  teaser: string | null;
  body: string;
  priority: AnnouncementPriority;
  status: NewsStatus;
  scope: { type: ScopeType; id: string | null; label: string };
  author: string | null;
  mine: boolean;
  /** Rückmeldung bei Ablehnung */
  reviewNote: string | null;
  imageId: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  can: { edit: boolean; publish: boolean; remove: boolean };
};

/** Lesebestätigung für Verfasser und Freigebende */
export type NewsReadReceipt = {
  read: number;
  audience: number;
  /** Nur bei Mannschafts-News: wer noch nicht gelesen hat (Konto-Namen) */
  unread: string[] | null;
};

export type EditorialOverview = {
  scopes: EditorialScope[];
  mine: EditorialNews[];
  toApprove: EditorialNews[];
  published: EditorialNews[];
};

export type SaveNewsInput = {
  title: string;
  teaser?: string | null;
  body: string;
  priority: AnnouncementPriority;
  scopeType: ScopeType;
  scopeId?: string | null;
  action: NewsAction;
  /** Hochgeladenes Bild (`UploadedImage.id`); `null` entfernt das Bild */
  imageId?: string | null;
};

// ── Module & Update-Center ───────────────────────────────────────────────

export type ModuleEntry = {
  key: string;
  name: string;
  description: string;
  core: boolean;
  /** Ebenen, auf denen das Modul eingestellt werden kann */
  scopes: ScopeType[];
  /** Zustand auf Vereinsebene; `new` = noch nie eingerichtet */
  state: 'enabled' | 'available' | 'locked' | 'new';
  declined: boolean;
  snoozedUntil: string | null;
  /** Bei Mannschaftsmodulen: in wie vielen Mannschaften aktiv */
  enabledTeams: number | null;
};

export type ModuleOverview = {
  /** Neue oder noch nicht eingerichtete Module („Einrichten / Später / Nicht verwenden“) */
  updates: ModuleEntry[];
  modules: ModuleEntry[];
};

export type ModuleDecision = 'enable' | 'disable' | 'later' | 'decline';

export type TeamModule = {
  key: string;
  name: string;
  description: string;
  /** Auf Vereinsebene eingeschaltet – sonst in der Mannschaft nicht nutzbar */
  clubEnabled: boolean;
  /** Im Verein bzw. Bereich ausgeschaltet – dann in der Mannschaft nicht einschaltbar */
  lockedBy: 'club' | 'unit' | null;
  enabled: boolean;
  /** Keine eigene Einstellung der Mannschaft, Wert kommt von Verein/Bereich */
  inherited: boolean;
};

// ── Mannschaften & Saison ────────────────────────────────────────────────

export type SeasonInfo = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
};

export type AdminTeam = {
  id: string;
  name: string;
  badge: string;
  ageGroup: string | null;
  league: string | null;
  template: TeamTemplate;
  participationMode: ParticipationMode;
  orgUnit: { id: string; name: string };
  seasonId: string;
  players: number;
  staff: number;
  canManage: boolean;
};

export type TeamAdminOverview = {
  current: SeasonInfo;
  /** Vorbereitete Folgesaison, falls vorhanden */
  next: SeasonInfo | null;
  teams: AdminTeam[];
  nextTeams: AdminTeam[];
  orgUnits: { id: string; name: string; canManage: boolean }[];
};

export type TeamInput = {
  name: string;
  badge: string;
  ageGroup?: string | null;
  league?: string | null;
  orgUnitId: string;
  template: TeamTemplate;
  participationMode: ParticipationMode;
  /** Ohne Angabe: laufende Saison */
  seasonId?: string | null;
};

export type TeamDetailAdmin = AdminTeam & { modules: TeamModule[] };

export type PrepareSeasonInput = {
  /** Spielerinnen und Spieler in die neuen Mannschaften übernehmen (Trainerteams immer) */
  copyPlayers: boolean;
};

// ── Spielbetrieb: Aufstellung und Spielbericht ───────────────────────────

export type PersonRef = { id: string; name: string };

export type LineupEntry = {
  personId: string;
  name: string;
  role: LineupRole;
  position: string | null;
  jerseyNumber: number | null;
  /** Gastspieler aus einer anderen Mannschaft (Badge) */
  guestFrom: string | null;
  /** Startelf: Platz in der Formation (hinten nach vorn, 0 = Torwart); Bank: null (Paket AUF) */
  slot: number | null;
};

/** Trainingsbeteiligung der letzten vier Wochen (älteste Woche zuerst); nur für das Trainerteam. */
export type LineupAttendance = {
  weeks: { attended: number; total: number }[];
  /** null: im Fenster gab es kein Training */
  percent: number | null;
};

export type LineupCandidate = {
  personId: string;
  name: string;
  status: AttendanceStatus;
  position: string | null;
  jerseyNumber: number | null;
  guestFrom: string | null;
  /** Grund einer Absage (z. B. Abwesenheit, Verletzt), nur für das Trainerteam */
  reason: string | null;
  attendance: LineupAttendance;
};

export type MatchIncident = {
  id: string;
  kind: MatchIncidentKind;
  minute: number | null;
  person: PersonRef | null;
  assist: PersonRef | null;
};

export type MatchSheet = {
  eventId: string;
  title: string;
  startsAt: string;
  opponentName: string;
  isHome: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  jerseyMode: JerseyMode | null;
  team: { id: string; name: string; badge: string };
  /** Spielform, die der Planer vorschlägt (nach Altersklasse der Mannschaft) */
  suggestedSize: LineupSize;
  /** Aufstellung für Spieler und Eltern sichtbar (Teameinstellung, nur für das Trainerteam mitgeliefert) */
  lineupVisible: boolean | null;
  /**
   * null: nicht sichtbar – noch nicht veröffentlicht oder die Mannschaft zeigt sie Spielern und Eltern nicht.
   * `size`/`formation` fehlen bei älteren Aufstellungen ohne Planer.
   */
  lineup: {
    published: boolean;
    size: LineupSize | null;
    formation: string | null;
    entries: LineupEntry[];
  } | null;
  /** Nur für das Trainerteam: alle möglichen Spieler mit Zu-/Absage */
  candidates: LineupCandidate[] | null;
  report: { completed: boolean; incidents: MatchIncident[] } | null;
  can: { editLineup: boolean; editReport: boolean };
};

export type SaveLineupInput = {
  /** Spielform und Formation (Schlüssel); beide zusammen oder beide weglassen (ältere Aufstellung) */
  size?: LineupSize;
  formation?: string;
  entries: {
    personId: string;
    role: LineupRole;
    position?: string | null;
    /** Startelf: Slot der Formation; Bank: weglassen */
    slot?: number | null;
    jerseyNumber?: number | null;
  }[];
  publish: boolean;
};

export type SaveReportInput = {
  goalsFor: number;
  goalsAgainst: number;
  incidents: {
    kind: MatchIncidentKind;
    personId?: string | null;
    assistPersonId?: string | null;
    minute?: number | null;
  }[];
  complete: boolean;
};

export type JerseySettings = {
  mode: JerseyMode | null;
  numbers: { personId: string; name: string; jerseyNumber: number | null }[];
  canEdit: boolean;
};

// ── Spielerbewegungen ────────────────────────────────────────────────────

export type TransferItem = {
  id: string;
  kind: TransferKind;
  person: PersonRef;
  fromTeam: { id: string; badge: string; name: string } | null;
  toTeam: { id: string; badge: string; name: string } | null;
  startsOn: string;
  endsOn: string | null;
  externalClub: string | null;
  note: string | null;
};

export type TransferOverview = {
  items: TransferItem[];
  /** Mannschaften, für die ich Bewegungen erfassen darf */
  teams: { id: string; badge: string; name: string }[];
};

export type CreateTransferInput = {
  personId: string;
  kind: TransferKind;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  /** Ende einer Leihe (Bewegungen gelten ab heute) */
  endsOn?: string | null;
  externalClub?: string | null;
  note?: string | null;
  jerseyNumber?: number | null;
};

// ── Einladungen und Beitrittsanfragen ────────────────────────────────────

export type InviteLink = {
  url: string;
  /** QR-Code als SVG-Text */
  qrSvg: string;
  expiresAt: string;
};

export type InviteTeam = {
  id: string;
  badge: string;
  name: string;
  /** Aktiver Mannschafts-Link (für Aushang/QR-Code) */
  link: (InviteLink & { uses: number }) | null;
};

export type InvitePerson = {
  personId: string;
  name: string;
  /** z. B. „Spieler B1“ oder „Elternteil von Leon (E1)“ */
  context: string;
  email: string | null;
  invitedAt: string | null;
};

export type JoinRequestItem = {
  id: string;
  team: { id: string; badge: string; name: string };
  relation: 'player' | 'parent';
  name: string;
  email: string;
  birthDate: string | null;
  child: { name: string; birthDate: string | null } | null;
  message: string | null;
  createdAt: string;
  /** Mögliche bereits angelegte Personen (gleicher Name) ohne App-Zugang */
  matches: { personId: string; name: string; birthDate: string | null }[];
  childMatches: { personId: string; name: string; birthDate: string | null }[];
};

export type InviteOverview = {
  teams: InviteTeam[];
  people: InvitePerson[];
  requests: JoinRequestItem[];
};

/** Öffentliche Ansicht eines Einladungslinks (ohne Anmeldung) */
export type JoinInfo = {
  kind: 'person' | 'team';
  club: {
    name: string;
    shortName: string;
    shortCode: string;
    colorTheme: ClubInfo['colorTheme'];
    logoUrl: string | null;
  };
  team: { badge: string; name: string } | null;
  person: { firstName: string; email: string | null } | null;
};

export type AcceptInviteInput = { email: string; password: string };

export type JoinRequestInput = {
  email: string;
  password: string;
  relation: 'player' | 'parent';
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  childFirstName?: string | null;
  childLastName?: string | null;
  childBirthDate?: string | null;
  message?: string | null;
};

export type ApproveJoinInput = {
  /** Bestehende Person verknüpfen statt neu anzulegen */
  personId?: string | null;
  childPersonId?: string | null;
};

// ── Vereinseinstellungen und Ersteinrichtung ─────────────────────────────

/** Vereinsfarben; Liste und Prüfwerte in `@clubroof/design-tokens` (hier und dort müssen dieselben Schlüssel stehen). */
export type ClubColorKey =
  | 'green'
  | 'red'
  | 'blue'
  | 'yellow'
  | 'black'
  | 'orange'
  | 'purple'
  | 'burgundy'
  | 'skyblue'
  | 'teal';
export type OrgUnitKind = 'seniors' | 'youth' | 'women' | 'veterans' | 'other';

export type ClubSettings = {
  name: string;
  shortName: string;
  /** Vereinskürzel (gespeichert oder Vorgabe aus den Initialen des Kurznamens) */
  shortCode: string;
  colorTheme: ClubColorKey;
  colorMode: 'light' | 'dark' | 'system';
  requireTwoFactor: boolean;
  /** Angaben zum Verein (Anschrift für Spendenbescheinigungen, Kontakt, Webseite) */
  foundedYear: number | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  /** Wer die Kontaktdaten neuer Personen standardmäßig sieht */
  defaultContactVisibility: 'club' | 'team_and_coaches' | 'coaches_only';
  /** Vorgabe nur einschaltbar, wenn man selbst 2-Faktor nutzt (Schutz vor Aussperren) */
  canRequireTwoFactor: boolean;
  orgUnits: { id: string; name: string; kind: OrgUnitKind; teams: number }[];
};

export type UpdateClubInput = Partial<{
  name: string;
  shortName: string;
  shortCode: string;
  colorTheme: ClubColorKey;
  colorMode: 'light' | 'dark' | 'system';
  requireTwoFactor: boolean;
  foundedYear: number | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  defaultContactVisibility: 'club' | 'team_and_coaches' | 'coaches_only';
}>;

/** Untergrund eines Platzes (Einrichtungsassistent) */
export const PITCH_SURFACES = ['grass', 'artificial', 'hard'] as const;
export type PitchSurface = (typeof PITCH_SURFACES)[number];

/** Spielstätte mit Plätzen und Kabinen (Einrichtungsassistent, Schritte „Spielstätte“ bis „Untergrund“) */
export type SetupVenue = {
  name: string;
  address: string | null;
  pitches: { name: string; surface: PitchSurface }[];
  changingRooms: string[];
};

export type SetupInput = {
  setupToken: string;
  /** Nachweis der bestätigten E-Mail-Adresse des ersten Kontos (`POST /setup/email-code/verify`) */
  emailProof: string;
  club: {
    name: string;
    shortName: string;
    shortCode?: string;
    colorTheme: ClubColorKey;
    /** Angaben zum Verein (Paket E2, Stufe 2); alle freiwillig */
    foundedYear?: number | null;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    timezone?: string;
    colorMode?: 'light' | 'dark' | 'system';
    /** Monat, in dem die Saison beginnt (1–12, Standard 7 = Juli) */
    seasonStartMonth?: number;
    defaultContactVisibility?: 'club' | 'team_and_coaches' | 'coaches_only';
  };
  orgUnits: { name: string; kind: OrgUnitKind }[];
  venues?: SetupVenue[];
  /** Gewählte optionale Module (Schlüssel aus `MODULES`); ohne Angabe die bisherige Voreinstellung */
  modules?: string[];
  admin: { firstName: string; lastName: string; email: string; password: string };
};

// ── Mitglieder-Import (CSV) ──────────────────────────────────────────────

export type MemberImportRow = {
  /** Zeilennummer in der Datei (Kopfzeile = 1) */
  line: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  memberSince: string | null;
  team: { id: string; badge: string } | null;
  function: 'player' | 'coach' | 'assistant_coach' | 'team_manager' | null;
  jerseyNumber: number | null;
  /** new = wird angelegt, duplicate = gibt es schon, error = fehlerhaft */
  status: 'new' | 'duplicate' | 'error';
  messages: string[];
};

export type MemberImportResult = {
  rows: MemberImportRow[];
  /** Erkannte Spalten (Kopfzeile) und nicht zugeordnete Spalten */
  columns: string[];
  ignoredColumns: string[];
  summary: { new: number; duplicate: number; error: number };
  /** Nur nach der Übernahme gesetzt */
  imported: number | null;
};

// ── Import-Assistent (Paket IM) ───────────────────────────────────────────

export const IMPORT_AREAS = [
  'members',
  'roster',
  'events',
  'sponsors',
  'facilities',
  'equipment',
] as const;
export type ImportArea = (typeof IMPORT_AREAS)[number];

export const IMPORT_DUPLICATE_MODES = ['skip', 'update', 'create'] as const;
/** Verhalten bei Dubletten: überspringen, bestehenden Eintrag aktualisieren oder trotzdem neu anlegen */
export type ImportDuplicateMode = (typeof IMPORT_DUPLICATE_MODES)[number];

export type ImportField = {
  key: string;
  label: string;
  required: boolean;
  /** Erklärung für die Vorlage („TT.MM.JJJJ“) */
  hint: string;
  example: string;
};

export type ImportAreaInfo = {
  area: ImportArea;
  label: string;
  text: string;
  fields: ImportField[];
  /** Bereich gilt für genau eine Mannschaft (Auswahl im Assistenten) */
  needsTeam: boolean;
  /** Nur mit `needsTeam`: Mannschaften, für die der Nutzer importieren darf */
  teamIds?: string[];
};

export type ImportAreasResponse = {
  areas: ImportAreaInfo[];
  /** Mannschaften, für die der Nutzer einen Kader importieren darf */
  teams: { id: string; badge: string; name: string }[];
  maxRows: number;
  maxBytes: number;
};

/**
 * Angaben eines Schritts im Assistenten. Vorschau und Übernahme nehmen dieselben Angaben, damit nur übernommen wird,
 * was der Nutzer zuletzt gesehen hat.
 */
export type ImportRequest = {
  area: ImportArea;
  teamId?: string | null;
  file: { name: string; dataBase64: string };
  /** Blatt einer Excel-Datei; ohne Angabe das erste */
  sheet?: string | null;
  /** je Spalte der Datei das Feld (Schlüssel aus `ImportField`) oder `null`; ohne Angabe automatisch erkannt */
  mapping?: (string | null)[] | null;
  duplicates?: ImportDuplicateMode;
  /** Zeilennummern der Datei, die nicht übernommen werden sollen */
  excluded?: number[];
  /** Korrigierte Werte einzelner Zeilen (Zeilennummer → Feld → Wert), vor der Prüfung angewendet */
  edits?: Record<string, Record<string, string>>;
};

export type ImportRow = {
  /** Zeilennummer in der Datei (Kopfzeile = 1) */
  line: number;
  /** new = wird angelegt, update = aktualisiert einen Eintrag, duplicate = gibt es schon (wird übersprungen), error = fehlerhaft */
  status: 'new' | 'update' | 'duplicate' | 'error';
  values: Record<string, string>;
  errors: string[];
  warnings: string[];
  /** Bei update/duplicate: der gefundene Eintrag */
  match: string | null;
  /** false, wenn der Nutzer die Zeile abgewählt hat */
  selected: boolean;
};

export type ImportPreview = {
  area: ImportArea;
  sheet: string | null;
  sheets: string[];
  /** Kopfzeile der Datei */
  header: string[];
  /** Zuordnung je Spalte, wie verwendet (erkannt oder vom Nutzer gesetzt) */
  mapping: (string | null)[];
  /** Pflichtfelder, die keiner Spalte zugeordnet sind */
  missingRequired: string[];
  /** erste Zeilen der Datei zur Orientierung bei der Zuordnung */
  sample: string[][];
  rowCount: number;
  rows: ImportRow[];
  summary: { new: number; update: number; duplicate: number; error: number; excluded: number };
  /** Nur nach der Übernahme: Nummer des Importlaufs und Zahlen */
  run: { id: string; created: number; updated: number; undoUntil: string } | null;
};

export type ImportRunInfo = {
  id: string;
  area: ImportArea;
  areaLabel: string;
  fileName: string | null;
  createdAt: string;
  createdByName: string | null;
  summary: { created: number; updated: number; skipped: number; errors: number };
  undone: boolean;
  /** Rückgängig geht 24 Stunden lang und nur mit dem Recht für den Bereich */
  undoUntil: string;
  canUndo: boolean;
};

export type ImportTemplateFile = {
  name: string;
  contentType: string;
  dataBase64: string;
};

/** Spalten der Importvorlage (Trennzeichen Semikolon, wie Excel in Deutschland). */
export const MEMBER_IMPORT_TEMPLATE =
  'Vorname;Nachname;Geburtsdatum;E-Mail;Telefon;Mitgliedsnummer;Eintrittsdatum;Mannschaft;Funktion;Rückennummer\n' +
  'Max;Mustermann;14.05.2011;eltern.mustermann@example.org;0170 1234567;1234;01.08.2026;C1;Spieler;7\n';

// ── Spielplan-Import (DFBnet) ────────────────────────────────────────────

export const SCHEDULE_FIELDS = [
  'matchId',
  'kickoff',
  'date',
  'time',
  'home',
  'away',
  'competition',
  'status',
] as const;
export type ScheduleField = (typeof SCHEDULE_FIELDS)[number];

export type ScheduleImportInput = {
  /** Datei wie hochgeladen (UTF-8 oder Windows-1252) */
  dataBase64: string;
  /** Trainer: nur diese Mannschaft; Verwaltung: leer = alle Mannschaften des Vereins */
  teamId?: string | null;
  /** Spalte je Feld (Text der Kopfzeile); fehlende Felder werden automatisch erkannt */
  columns?: Partial<Record<ScheduleField, string | null>>;
  /** DFBnet-Mannschaftsname → Mannschaft (leere Zeichenkette = überspringen) */
  mapping?: Record<string, string>;
  commit?: boolean;
};

export type SchedulePreviewRow = {
  line: number;
  /** new = wird angelegt, changed = bestehendes Spiel wird angepasst, unchanged, skipped */
  status: 'new' | 'changed' | 'unchanged' | 'skipped';
  reason?: string;
  teamId: string | null;
  teamLabel: string | null;
  startsAt: string | null;
  opponent: string | null;
  isHome: boolean | null;
  kind: MatchKind | null;
  competition: string | null;
  /** Bei „changed“: was sich ändert */
  changes: string[];
};

export type SchedulePreview = {
  headers: string[];
  /** Erkannte bzw. gewählte Spalte je Feld */
  columns: Record<ScheduleField, string | null>;
  rows: SchedulePreviewRow[];
  /** Eigene Mannschaften der Datei, die noch keiner Mannschaft zugeordnet sind */
  unmapped: { name: string; count: number }[];
  /** Mannschaften, in die der Nutzer importieren darf */
  teams: { id: string; label: string }[];
  summary: { new: number; changed: number; unchanged: number; skipped: number };
  /** Nur nach dem Übernehmen gesetzt */
  result: { batchId: string; created: number; updated: number } | null;
};

// ── Benachrichtigungseinstellungen ───────────────────────────────────────

export type NotificationSettings = {
  topics: {
    key: string;
    label: string;
    description: string;
    mode: 'push' | 'app' | 'off';
    defaultMode: 'push' | 'app' | 'off';
  }[];
  /** Mannschaften des Nutzers und seiner Kinder – einzeln stummschaltbar */
  teams: { id: string; badge: string; name: string; muted: boolean }[];
  reminderHours: number;
  quietHours: { enabled: boolean; start: string; end: string };
  /** Registrierte Geräte für Push */
  devices: number;
};

export type UpdateNotificationSettingsInput = Partial<{
  topics: Record<string, 'push' | 'app' | 'off'>;
  mutedTeamIds: string[];
  reminderHours: number;
  quietHours: { enabled: boolean; start: string; end: string };
}>;

// ── Mannschaftsaufgaben ──────────────────────────────────────────────────

export type TeamTask = {
  id: string;
  title: string;
  note: string | null;
  dueOn: string | null;
  event: { id: string; title: string; startsAt: string } | null;
  assignee: { personId: string; name: string } | null;
  doneAt: string | null;
  createdBy: string | null;
  can: {
    /** Für sich selbst oder ein eigenes Kind übernehmen (nur offene Aufgaben ohne Zuständige) */
    take: boolean;
    complete: boolean;
    manage: boolean;
  };
};

export type TeamTaskList = {
  open: TeamTask[];
  /** Zuletzt erledigte (höchstens 20) */
  done: TeamTask[];
  canManage: boolean;
  /** Für die Zuteilung (nur Verantwortliche) */
  members: { personId: string; name: string }[];
  /** Termine der nächsten Wochen zum Verknüpfen (nur Verantwortliche) */
  events: { id: string; title: string; startsAt: string }[];
};

export type CreateTeamTaskInput = {
  title: string;
  note?: string | null;
  dueOn?: string | null;
  eventId?: string | null;
  assigneePersonId?: string | null;
};

// ── Meine Teams (Trainer mehrerer Mannschaften) ──────────────────────────

export type MyTeamCard = {
  team: { id: string; badge: string; name: string };
  nextEvent: {
    id: string;
    title: string;
    type: string;
    startsAt: string;
    counts: AttendanceCounts | null;
  } | null;
  /** Abwesend heute (Urlaub, Verletzung …) */
  absentToday: number;
  openTasks: number;
};

// ── Kommentare zu Freigaben und Anfragen ─────────────────────────────────

export type CommentEntity = 'news' | 'demand' | 'board';

export type CommentItem = {
  id: string;
  author: string;
  mine: boolean;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
  /** Ich darf diesen Kommentar ändern (eigener) */
  canEdit: boolean;
  /** Ich darf ihn löschen (eigener oder als Moderation) */
  canDelete: boolean;
};

// ── Veranstaltungen planen ───────────────────────────────────────────────

export type ClubEventType = 'club_event' | 'meeting' | 'work_assignment';

export type PlannedEvent = {
  id: string;
  type: ClubEventType;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: 'scheduled' | 'cancelled';
  location: string | null;
  scopeLabel: string;
  shifts: { title: string; filled: number; capacity: number }[];
};

export type EventPlanning = {
  /** Wo ich planen darf: Verein (id null) und/oder eigene Bereiche */
  scopes: { orgUnitId: string | null; label: string }[];
  facilities: { id: string; name: string }[];
  upcoming: PlannedEvent[];
};

export type CreateClubEventInput = {
  type: ClubEventType;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  orgUnitId?: string | null;
  /** Gezielt einladen: Mannschaften (mit Trainerrecht) und Personen (nur mit Mitgliederrecht) */
  teamIds?: string[];
  personIds?: string[];
  facilityId?: string | null;
  locationText?: string | null;
  locationUrl?: string | null;
  program?: { time: string; title: string }[];
  shifts?: { title: string; startsAt: string; endsAt: string; capacity: number }[];
  allowConflict?: boolean;
};

/** Schicht beim Bearbeiten einer Vereinsveranstaltung: mit `id` ändern, ohne `id` neu anlegen; fehlende werden entfernt. */
export type ClubEventShiftInput = {
  id?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
};

/** Vereinsveranstaltung nachträglich ändern (Paket BE): Art und Bereich bleiben, alles andere ist änderbar. */
export type UpdateClubEventInput = Partial<
  Omit<CreateClubEventInput, 'type' | 'orgUnitId' | 'shifts'>
> & { shifts?: ClubEventShiftInput[] };

/** Vereinsveranstaltung zum Bearbeiten (vorausgefülltes Formular). */
export type ClubEventForm = {
  id: string;
  type: ClubEventType;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  orgUnitId: string | null;
  teamIds: string[];
  personIds: string[];
  facilityId: string | null;
  locationText: string | null;
  locationUrl: string | null;
  program: { time: string; title: string }[];
  /** Schichten mit Zahl der Angemeldeten (Kapazität darf nicht darunter sinken) */
  shifts: (ClubEventShiftInput & { id: string; signedUp: number })[];
  editedAt: string | null;
};

// ── Kalenderexport ───────────────────────────────────────────────────────

export type CalendarFeed = {
  /** https-Adresse des Abos; null = kein Abo eingerichtet */
  url: string | null;
  /** Zuletzt von einem Kalender abgerufen */
  lastAccessAt: string | null;
};

// ── Trainingsplanung ─────────────────────────────────────────────────────

export const EXERCISE_CATEGORIES = [
  'warmup',
  'technique',
  'tactics',
  'fitness',
  'finishing',
  'game',
  'cooldown',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export type Exercise = {
  id: string;
  title: string;
  category: ExerciseCategory;
  durationMinutes: number;
  players: string | null;
  material: string | null;
  description: string | null;
  createdBy: string | null;
  canDelete: boolean;
  /** Ich darf die Übung ändern (wer sie angelegt hat, oder die Administration) */
  canEdit: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

/** Übung nachträglich ändern (Paket BE): Name, Beschreibung, Material und die übrigen Angaben. */
export type UpdateExerciseInput = Partial<CreateExerciseInput>;

export type CreateExerciseInput = {
  title: string;
  category: ExerciseCategory;
  durationMinutes: number;
  players?: string | null;
  material?: string | null;
  description?: string | null;
};

export type TrainingPlanItem = {
  exerciseId: string | null;
  title: string;
  minutes: number;
  note: string | null;
  /** Aus der Übung (nur für das Trainerteam) */
  category: ExerciseCategory | null;
  material: string | null;
  description: string | null;
};

export type TrainingPlan = {
  eventId: string;
  focus: string | null;
  /** Material aus allen Übungen – auch für Spieler („bitte mitbringen“ bleibt Sache des Trainers) */
  material: string[];
  /** Ablauf und Notizen nur für das Trainerteam */
  items: TrainingPlanItem[] | null;
  notes: string | null;
  totalMinutes: number;
  eventMinutes: number;
  canEdit: boolean;
  updatedAt: string | null;
  /** Letzter Plan der Mannschaft als Vorlage (nur für das Trainerteam) */
  previous: { eventId: string; startsAt: string; focus: string | null } | null;
};

export type SaveTrainingPlanInput = {
  focus?: string | null;
  notes?: string | null;
  items: { exerciseId?: string | null; title: string; minutes: number; note?: string | null }[];
};

// ── Mini-Forum ───────────────────────────────────────────────────────────

export type ForumTopicSummary = {
  id: string;
  title: string;
  author: string | null;
  createdAt: string;
  closesAt: string;
  open: boolean;
  pinned: boolean;
  postCount: number;
  lastPostAt: string | null;
};

export type ForumOverview = {
  topics: ForumTopicSummary[];
  canCreate: boolean;
  canModerate: boolean;
};

export type ForumPost = {
  id: string;
  author: string;
  mine: boolean;
  /** null, wenn ausgeblendet (für Mitglieder) */
  body: string | null;
  hidden: boolean;
  /** Gemeldet – nur für das Moderationsteam */
  reported: boolean;
  createdAt: string;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
  /** Ich darf diesen Beitrag ändern (eigener, solange Thema offen und nicht ausgeblendet) */
  canEdit: boolean;
};

export type ForumTopicDetail = ForumTopicSummary & {
  body: string;
  posts: ForumPost[];
  canPost: boolean;
  canModerate: boolean;
  /** Ich darf Titel und Text ändern (Ersteller, solange das Thema offen ist) */
  canEdit: boolean;
  editedAt: string | null;
};

/** Thema nachträglich ändern (Paket BE): Titel und Text durch den Ersteller; Schließen und Anheften bleiben Moderation. */
export type UpdateForumTopicInput = { title?: string; body?: string };

export type CreateForumTopicInput = { title: string; body: string; days: number };

// ── Fundbüro & Marktplatz ────────────────────────────────────────────────

export const BOARD_KINDS = ['found', 'lost', 'offer', 'search'] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];

export type BoardItem = {
  id: string;
  kind: BoardKind;
  title: string;
  description: string | null;
  detail: string | null;
  imageUrl: string | null;
  author: string | null;
  mine: boolean;
  createdAt: string;
  expiresAt: string;
  done: boolean;
  canClose: boolean;
  /** Ich darf den Aushang ändern (wer ihn erstellt hat oder die Moderation, solange er nicht erledigt ist) */
  canEdit: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

export type BoardOverview = {
  /** Nach aktivierten Modulen: Fundbüro (found, lost) und/oder Marktplatz (offer, search) */
  kinds: BoardKind[];
  items: BoardItem[];
};

/** Aushang nachträglich ändern (Paket BE): Text, Foto (null = entfernen) und Ablauf (neue Dauer ab heute in Tagen). */
export type UpdateBoardItemInput = {
  title?: string;
  description?: string | null;
  detail?: string | null;
  imageId?: string | null;
  days?: number;
};

export type CreateBoardItemInput = {
  kind: BoardKind;
  title: string;
  description?: string | null;
  detail?: string | null;
  imageId?: string | null;
};

// ── Vereinswissen ────────────────────────────────────────────────────────

export type WikiPageSummary = {
  id: string;
  title: string;
  category: string;
  updatedAt: string;
  /** Erste Zeilen für die Suche/Liste */
  excerpt: string;
};

export type WikiPage = WikiPageSummary & { body: string; updatedBy: string | null };

export type WikiOverview = { pages: WikiPageSummary[]; categories: string[]; canEdit: boolean };

export type SaveWikiPageInput = { title: string; category: string; body: string };

// ── Anlage & Material ────────────────────────────────────────────────────

export type ChangingRoomPlan = {
  date: string;
  rooms: { id: string; name: string }[];
  events: {
    id: string;
    title: string;
    badge: string | null;
    startsAt: string;
    endsAt: string;
    location: string | null;
    changingRoomId: string | null;
    /** Gleiche Kabine zeitgleich mit einem anderen Termin */
    conflict: boolean;
  }[];
  canAssign: boolean;
};

export type EquipmentItem = {
  id: string;
  kind: 'material' | 'key';
  name: string;
  quantity: number;
  location: string | null;
  note: string | null;
  holder: { personId: string; name: string } | null;
  handedOutAt: string | null;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

/** Ausrüstung nachträglich ändern (Paket BE): Bezeichnung, Anzahl, Lagerort, Hinweis (z. B. Zustand). */
export type UpdateEquipmentInput = {
  name?: string;
  quantity?: number;
  location?: string | null;
  note?: string | null;
};

export type EquipmentOverview = {
  items: EquipmentItem[];
  /** Was ich (oder mein Kind) gerade ausgeliehen habe */
  mine: EquipmentItem[];
  canManage: boolean;
};

export type DamageStatus = 'open' | 'in_progress' | 'done';

export type DamageReport = {
  id: string;
  title: string;
  description: string | null;
  facility: string | null;
  imageUrl: string | null;
  status: DamageStatus;
  resolution: string | null;
  reportedBy: string | null;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DamageOverview = {
  reports: DamageReport[];
  facilities: { id: string; name: string }[];
  canManage: boolean;
};

// ── Schiedsrichter ───────────────────────────────────────────────────────

/** Lizenzstatus: keine Angabe, gültig, läuft in den nächsten 60 Tagen ab, abgelaufen */
export type RefereeLicenseStatus = 'none' | 'ok' | 'expiring' | 'expired';

/** Einsatz bei einem Verbandsspiel, vom Schiedsrichter selbst eingetragen. */
export type RefereeDuty = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  /** Abwesenheit wurde automatisch eingetragen */
  absence: boolean;
  /** Zeitpunkt der letzten nachträglichen Änderung (ISO), sonst null */
  editedAt: string | null;
};

/** Überschneidung eines Einsatzes mit einem eigenen Termin (Spiel, Training …). */
export type RefereeCollision = { eventId: string; title: string; startsAt: string };

export type RefereeProfile = {
  level: string | null;
  licenseValidUntil: string | null;
  licenseStatus: RefereeLicenseStatus;
  active: boolean;
};

export type RefereeRow = RefereeProfile & {
  personId: string;
  name: string;
  /** Einsätze in der laufenden Saison */
  duties: number;
  /** Pflichteinsätze erfüllt (oder keine verlangt) */
  dutiesOk: boolean;
};

export type RefereeSettings = { requiredReferees: number; requiredMatches: number };

export type RefereeOverview = {
  canManage: boolean;
  /** Ich bin aktiver Schiedsrichter des Vereins */
  isReferee: boolean;
  /** Mein Profil als Schiedsrichter (Stufe, Lizenz) */
  profile: RefereeProfile | null;
  /** Meine Einsätze: kommende zuerst, dazu die letzten 90 Tage */
  mine: RefereeDuty[];
  /** Vereinsübersicht „Schiedsrichter-Soll“ – nur mit Recht zum Verwalten */
  club: {
    settings: RefereeSettings;
    active: number;
    /** fehlende aktive Schiedsrichter gegenüber dem Soll (0 = erfüllt) */
    shortfall: number;
    seasonName: string;
    referees: RefereeRow[];
  } | null;
};

export type RefereeDutyInput = {
  title: string;
  startsAt: string;
  durationMinutes?: number;
  location?: string | null;
  /** Abwesenheit für diesen Tag automatisch eintragen */
  createAbsence?: boolean;
};

/** Einsatz nachträglich ändern (Paket BE): Titel, Beginn, Dauer, Ort; die automatische Abwesenheit folgt dem Tag. */
export type UpdateRefereeDutyInput = Partial<Omit<RefereeDutyInput, 'createAbsence'>>;

export type RefereeDutyResult = { overview: RefereeOverview; collisions: RefereeCollision[] };

// ── Kachel-Infos ─────────────────────────────────────────────────────────────

/** Ton eines Kachelhinweises; wird immer mit Text angezeigt, nie Farbe allein */
export type TileTone = 'neutral' | 'action' | 'success' | 'urgent' | 'info';

/**
 * Zu einer Kachel: `figure` ist die kleine Kennzahl oben rechts (Datum, Zahl, Bilanz, Kassenstand), `hint` ein
 * längerer Hinweis (nur für Screenreader), `badge` ein Zähler. Texte sind bereits in der Sprache der Person.
 */
export type TileInfoEntry = { figure?: string; hint?: string; badge?: number; tone?: TileTone };

/** Kachel-Infos eines Menüs, Schlüssel = Kachelname */
export type TileInfo = Record<string, TileInfoEntry>;

export const TILE_HUBS = ['team', 'club', 'more', 'admin', 'cash'] as const;
export type TileHub = (typeof TILE_HUBS)[number];

// ── Globale Suche ─────────────────────────────────────────────────────────

/** Ergebnis der globalen Suche – je Bereich nur, was die Person auch sonst sehen darf. */
export type SearchResponse = {
  events: {
    id: string;
    title: string;
    startsAt: string;
    status: 'scheduled' | 'cancelled';
    type: string;
    teamBadge: string | null;
  }[];
  members: { personId: string; name: string; teamBadges: string[]; avatarUrl: string | null }[];
  news: { id: string; title: string; publishedAt: string; source: string }[];
  teams: { id: string; name: string; badge: string; league: string | null }[];
};

// ── Wochen-Spielplan des Vereins (Paket WS) ─────────────────────────────────

export type ClubScheduleMatch = {
  event: EventSummary;
  /** Bereich der Mannschaft (für den Filter Senioren/Jugend) */
  unitKind: OrgUnitKind | null;
  /** Spiel darf geöffnet werden (eigene Mannschaft, Kinder, Verantwortliche) */
  canOpen: boolean;
};

export type ClubSchedule = {
  /** Montag und Sonntag der Woche (Vereinszeit), ISO-Datum */
  weekStart: string;
  weekEnd: string;
  today: string;
  /** Spiele nach Tagen gruppiert, nur Tage mit Spielen */
  days: { date: string; matches: ClubScheduleMatch[] }[];
  /** Mannschaften der laufenden Saison ohne Spiel in dieser Woche („Spielfrei“) */
  free: { id: string; name: string; badge: string; unitKind: OrgUnitKind | null }[];
  /** Bereiche, die im Verein vorkommen (für die Filterchips) */
  kinds: OrgUnitKind[];
};

// ── Anmeldeseite (Paket LG) ─────────────────────────────────────────────────

/** Öffentliche Angaben zum Verein dieses Servers für die Anmeldeseite (ohne Anmeldung). */
export type PublicClub = {
  needsSetup: boolean;
  club: {
    name: string;
    shortName: string;
    shortCode: string;
    colorTheme: ClubColorKey;
    /** Ort, falls hinterlegt */
    city: string | null;
    foundedYear: number | null;
    logoUrl: string | null;
  } | null;
};

// ── Abteilungsübersicht (Leitung und Vorstand) ───────────────────────────────

/** Bereiche des Vereins: Senioren (inkl. Alte Herren), Frauen, Jugend. */
export const AREA_KEYS = ['seniors', 'women', 'youth'] as const;
export type AreaKey = (typeof AREA_KEYS)[number];
export const AREA_LABELS: Record<AreaKey, string> = {
  seniors: 'Senioren',
  women: 'Frauen',
  youth: 'Jugend',
};

/** Ampel der Trainingsbeteiligung: grün ab 65 %, gelb 50–64 %, rot darunter; unter 3 erfassten Einheiten zu wenig Daten. */
export const PARTICIPATION_GOOD_FROM = 65;
export const PARTICIPATION_MEDIUM_FROM = 50;
export const PARTICIPATION_MIN_SESSIONS = 3;
export type ParticipationLevel = 'good' | 'medium' | 'low' | 'none';

export function participationLevel(percent: number | null, sessions: number): ParticipationLevel {
  if (percent === null || sessions < PARTICIPATION_MIN_SESSIONS) return 'none';
  if (percent >= PARTICIPATION_GOOD_FROM) return 'good';
  if (percent >= PARTICIPATION_MEDIUM_FROM) return 'medium';
  return 'low';
}

export type AreaAccess = {
  /** Bereiche, die die Person sehen darf (Filter erscheint ab zwei) */
  areas: AreaKey[];
  /** Abgespeckte Variante für Mitglieder ohne Mannschaft: ohne Trainingsbeteiligung, Zusagen und Kaderverfügbarkeit */
  lite?: boolean;
};

export type AreaTeamCard = {
  id: string;
  badge: string;
  name: string;
  area: AreaKey;
  /** Spieler im Kader und davon heute nicht abwesend */
  squad: { total: number; available: number };
  /** Namen des Trainerteams; leer = kein Trainer */
  coaches: string[];
  /** Trainingsbeteiligung der letzten 4 Wochen (nur Einheiten mit erfasster Anwesenheit, Abwesenheiten herausgerechnet) */
  participation: { percent: number | null; sessions: number; level: ParticipationLevel };
  nextMatch: {
    startsAt: string;
    isHome: boolean;
    opponent: string;
    yes: number;
    no: number;
    open: number;
  } | null;
};

export type AreaOverview = {
  /** Gewählter Bereich; „all“ = alle Bereiche, auf die die Person Zugriff hat */
  area: AreaKey | 'all';
  areas: AreaKey[];
  /** Abgespeckte Variante (siehe `AreaAccess.lite`) */
  lite: boolean;
  summary: {
    teams: number;
    players: number;
    coaches: number;
    matchesThisWeek: number;
    /** Mittel der Trainingsbeteiligung aller Mannschaften mit genug Daten (nur bei „all“) */
    trainingAverage: number | null;
  };
  /** Bilanz der Saison (nur bei „all“) */
  record: { won: number; drawn: number; lost: number } | null;
  /** Mannschaften nach Altersklasse sortiert: Jugend A → G, Senioren 1. → Alte Herren */
  teams: AreaTeamCard[];
};

// ── Exporte (Paket IMPORT-EXPORT, Stufe 3) ───────────────────────────────────

export const EXPORT_AREAS = [
  'members',
  'roster',
  'events',
  'attendance',
  'cash',
  'fees',
  'club',
  'me',
] as const;
export type ExportArea = (typeof EXPORT_AREAS)[number];
export const EXPORT_FORMATS = ['xlsx', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportAreaInfo = {
  area: ExportArea;
  label: string;
  description: string;
  /** Mannschaften, für die der Export möglich ist (nur Bereiche je Mannschaft) */
  teams?: { id: string; badge: string; name: string }[];
  /** Gesamtexport kommt als ZIP mit CSV-Dateien (ein Format) */
  zip?: boolean;
};

export type ExportAreasResponse = { areas: ExportAreaInfo[] };

/** Exportdatei wie die Importvorlagen: Name, Medientyp, Inhalt in Base64. */
export type ExportFile = ImportTemplateFile;
