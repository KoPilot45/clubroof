/**
 * Antworttypen der API. Werden von Backend, App und Web-Verwaltung gemeinsam verwendet,
 * damit beide Seiten immer dieselbe Struktur erwarten. Zeitpunkte sind ISO-8601-Strings (UTC).
 */
import type {
  AbsenceKind,
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
  role: 'player' | 'coach' | 'guest_player';
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
};

export type ApiError = { error: string; message: string };
