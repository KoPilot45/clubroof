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
  TeamFunction,
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
  person: { id: string; firstName: string; lastName: string };
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
  /** News schreiben bzw. ohne Freigabe veröffentlichen (irgendwo im Verein) */
  news: { write: boolean; publish: boolean };
  /** Auf Vereinsebene aktivierte Module (bestimmen die Kacheln im Vereinsbereich) */
  clubModules: string[];
};

export type LoginResponse = { token: string; expiresAt: string; me: MeResponse };

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
  level: 'basic' | 'extended' | 'custom';
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
  purpose: 'news' | 'logo';
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
};

export type PersonStats = {
  /** Anteil Zusagen an vergangenen Trainings der Saison (0–100) */
  trainingRate: number | null;
  trainings: number;
  trainingsAttended: number;
  matches: number;
  byTeam: PersonStatsByTeam[];
};

export type PersonProfile = {
  personId: string;
  firstName: string;
  lastName: string;
  relation: 'self' | 'child' | 'other';
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
