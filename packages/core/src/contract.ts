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
import type { ScopeType } from './scopes';

export type ClubInfo = {
  id: string;
  name: string;
  shortName: string;
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

export type MeResponse = {
  user: { id: string; email: string; displayName: string };
  person: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  club: ClubInfo;
  managedPersons: ManagedPerson[];
  teams: MyTeam[];
  roles: { key: string; name: string; scopeType: ScopeType; scopeId: string | null }[];
  /** Ob der Nutzer den Verwaltungsmodus betreten darf */
  canAdminister: boolean;
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
  /** Auf Vereinsebene aktivierte Module (bestimmen die Kacheln im Vereinsbereich) */
  clubModules: string[];
  /** Schiedsrichter: einteilen bzw. selbst als Schiedsrichter aktiv */
  referees: { manage: boolean; active: boolean };
  /** Kabinen, Material und Schäden bearbeiten (Platzverantwortliche) */
  equipment: { manage: boolean };
};

export type LoginResponse = { token: string; expiresAt: string; me: MeResponse };

/** Zweiter Anmeldeschritt nötig: Code aus der Authenticator-App eingeben */
export type TwoFactorChallenge = { twoFactorRequired: true; challenge: string };

export type TwoFactorStatus = {
  enabled: boolean;
  /** Der Verein verlangt 2-Faktor für Personen mit Verwaltungsrechten */
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
  cancelledReason: string | null;
  team: { id: string; name: string; badge: string } | null;
  match: {
    opponentName: string;
    isHome: boolean;
    competition: string | null;
    goalsFor: number | null;
    goalsAgainst: number | null;
  } | null;
  /** Ende der regulären Zu-/Absagefrist */
  deadline: string | null;
  counts: AttendanceCounts;
  myResponses: MyResponse[];
};

export type Participant = {
  personId: string;
  name: string;
  role: 'player' | 'coach' | 'guest_player' | 'attendee';
  status: AttendanceStatus;
  /** Nur für Berechtigte sichtbar (Datensparsamkeit) */
  reason: string | null;
  guestFromTeam: string | null;
};

export type EventDetail = EventSummary & {
  description: string | null;
  contactPerson: { name: string } | null;
  /** Teilnehmerliste; leer, wenn der Nutzer sie nicht sehen darf */
  participants: Participant[];
  canManage: boolean;
  /** Trainer dürfen Zu-/Absagen anderer korrigieren */
  canOverride: boolean;
  /** Ablaufplan (Vereinsveranstaltungen) */
  program: { time: string; title: string }[];
  /** Freiwillige Teilnahme an Vereinsveranstaltungen; null bei Mannschaftsterminen */
  attendance: { attending: boolean; count: number } | null;
  /** Helferschichten der Veranstaltung */
  shifts: HelperShift[];
  /** Letzte Änderung (alt → neu), solange sie noch relevant ist */
  lastChange: { at: string; items: EventChange[] } | null;
  /** Für das Bearbeiten (nur mit Recht gefüllt) */
  edit: { facilityId: string | null; locationText: string | null; seriesFollowing: number } | null;
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

export type CashTeaser = {
  teamId: string;
  teamName: string;
  badge: string;
  /** Kassenstand der Mannschaft; null, wenn der Nutzer ihn nicht sehen darf */
  balanceCents: number | null;
  incomeCents: number | null;
  expenseCents: number | null;
  /** Persönlicher Saldo (Einzahlungen − Forderungen); null, wenn kein persönliches Konto */
  personalBalanceCents: number | null;
};

export type ClubOverview = {
  teams: number;
  members: number;
  pendingApprovals: number;
  nextClubEvent: { id: string; title: string; startsAt: string } | null;
};

export type HomeResponse = {
  nextMatch: EventSummary | null;
  upcoming: EventSummary[];
  news: NewsItem[];
  actions: ActionItem[];
  cash: CashTeaser[];
  clubOverview: ClubOverview | null;
  unreadNotifications: number;
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
};

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
};

export type TeamPermissions = {
  manageEvents: boolean;
  overrideAttendance: boolean;
  readAttendance: boolean;
  readCash: boolean;
  manageCash: boolean;
  /** Spielerbedarf melden, Spieler anbieten und abstellen (Gastspielerbörse) */
  manageDemand: boolean;
  /** Module der Mannschaft ein- und ausschalten */
  manageModules: boolean;
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

export type TeamOverview = {
  team: { id: string; name: string; badge: string; league: string | null; ageGroup: string | null };
  permissions: TeamPermissions;
  nextEvent: EventSummary | null;
  /** Kaderstatus bezogen auf den nächsten Termin */
  squad: SquadStatus | null;
  lastResults: MatchResult[];
  trainingWeek: EventSummary[];
  highlights: TeamHighlights;
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
  /** Buchungen (nur mit Kassenrechten) */
  entries: CashEntry[] | null;
  /** Persönliche Konten aller Mitglieder (nur mit Kassenrechten) */
  members: { personId: string; name: string; balanceCents: number }[] | null;
  /** Meine Konten bzw. die meiner Kinder */
  personal: PersonalAccount[];
};

export type CashBookingKind = 'income' | 'expense' | 'fine' | 'drinks' | 'payment';

export type CreateCashBookingInput = {
  kind: CashBookingKind;
  amountCents: number;
  description: string;
  personId?: string | null;
  counterparty?: string | null;
  bookedOn?: string | null;
};

export type Facility = { id: string; name: string; shortName: string | null };

export type CreateEventInput = {
  type: 'training' | 'match' | 'team_event';
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  meetingAt?: string | null;
  meetingPoint?: string | null;
  facilityId?: string | null;
  locationText?: string | null;
  description?: string | null;
  opponentName?: string | null;
  isHome?: boolean | null;
  /** Konfliktwarnung bewusst übergehen (Sperrungen nur mit Platzrecht) */
  allowConflict?: boolean;
  /** Serientermin: so viele wöchentliche Termine anlegen (2–26) */
  repeatWeeks?: number;
};

export type UpdateEventInput = {
  title?: string;
  startsAt?: string;
  endsAt?: string | null;
  meetingAt?: string | null;
  meetingPoint?: string | null;
  facilityId?: string | null;
  locationText?: string | null;
  description?: string | null;
  opponentName?: string;
  isHome?: boolean;
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
  /** Ich darf dieses Dokument löschen */
  canDelete: boolean;
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
  purpose: 'news' | 'logo' | 'avatar' | 'board';
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
};

export type PlayerOffer = {
  id: string;
  team: ExchangeTeamRef;
  day: string;
  count: number;
  note: string | null;
  mine: boolean;
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
};

export type FacilityOccupancy = {
  /** Erster und letzter Tag (Vereinszeitzone, YYYY-MM-DD) */
  from: string;
  to: string;
  facilities: { facility: Facility & { kind: string }; bookings: FacilityBooking[] }[];
  conflicts: number;
  canManage: boolean;
};

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

export type AssignRoleInput = { roleKey: string; scopeType: ScopeType; scopeId?: string | null };

export type RoleCatalog = {
  roles: {
    key: string;
    name: string;
    description: string | null;
    defaultScope: ScopeType;
    permissions: string[];
    holders: { personId: string; name: string; scopeLabel: string }[];
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
};

export type LineupCandidate = {
  personId: string;
  name: string;
  status: AttendanceStatus;
  position: string | null;
  jerseyNumber: number | null;
  guestFrom: string | null;
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
  /** null: noch nicht veröffentlicht (für Spieler unsichtbar) */
  lineup: { published: boolean; entries: LineupEntry[] } | null;
  /** Nur für das Trainerteam: alle möglichen Spieler mit Zu-/Absage */
  candidates: LineupCandidate[] | null;
  report: { completed: boolean; incidents: MatchIncident[] } | null;
  can: { editLineup: boolean; editReport: boolean };
};

export type SaveLineupInput = {
  entries: {
    personId: string;
    role: LineupRole;
    position?: string | null;
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

export type ClubColorKey = 'green' | 'red' | 'blue' | 'yellow' | 'black';
export type OrgUnitKind = 'seniors' | 'youth' | 'women' | 'veterans' | 'other';

export type ClubSettings = {
  name: string;
  shortName: string;
  colorTheme: ClubColorKey;
  colorMode: 'light' | 'dark' | 'system';
  requireTwoFactor: boolean;
  /** Vorgabe nur einschaltbar, wenn man selbst 2-Faktor nutzt (Schutz vor Aussperren) */
  canRequireTwoFactor: boolean;
  orgUnits: { id: string; name: string; kind: OrgUnitKind; teams: number }[];
};

export type UpdateClubInput = Partial<{
  name: string;
  shortName: string;
  colorTheme: ClubColorKey;
  colorMode: 'light' | 'dark' | 'system';
  requireTwoFactor: boolean;
}>;

export type SetupInput = {
  setupToken: string;
  club: { name: string; shortName: string; colorTheme: ClubColorKey };
  orgUnits: { name: string; kind: OrgUnitKind }[];
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

/** Spalten der Importvorlage (Trennzeichen Semikolon, wie Excel in Deutschland). */
export const MEMBER_IMPORT_TEMPLATE =
  'Vorname;Nachname;Geburtsdatum;E-Mail;Telefon;Mitgliedsnummer;Eintrittsdatum;Mannschaft;Funktion;Rückennummer\n' +
  'Max;Mustermann;14.05.2011;eltern.mustermann@example.org;0170 1234567;1234;01.08.2026;C1;Spieler;7\n';

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
    counts: AttendanceCounts;
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
  body: string;
  createdAt: string;
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
  facilityId?: string | null;
  locationText?: string | null;
  program?: { time: string; title: string }[];
  shifts?: { title: string; startsAt: string; endsAt: string; capacity: number }[];
  allowConflict?: boolean;
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
};

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
};

export type ForumTopicDetail = ForumTopicSummary & {
  body: string;
  posts: ForumPost[];
  canPost: boolean;
  canModerate: boolean;
};

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
};

export type BoardOverview = {
  /** Nach aktivierten Modulen: Fundbüro (found, lost) und/oder Marktplatz (offer, search) */
  kinds: BoardKind[];
  items: BoardItem[];
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

export type RefereeAssignment = {
  id: string;
  personId: string;
  name: string;
  role: 'referee' | 'assistant';
  status: 'requested' | 'confirmed' | 'declined';
};

export type RefereeMatch = {
  eventId: string;
  title: string;
  badge: string;
  startsAt: string;
  location: string | null;
  assignments: RefereeAssignment[];
};

export type RefereeOverview = {
  referees: {
    personId: string;
    name: string;
    level: string | null;
    active: boolean;
    upcoming: number;
  }[];
  /** Heimspiele der nächsten 6 Wochen */
  matches: RefereeMatch[];
  canManage: boolean;
  /** Meine eigenen Einsätze als Schiedsrichter */
  mine: (RefereeMatch & { assignmentId: string; status: RefereeAssignment['status'] })[];
};
