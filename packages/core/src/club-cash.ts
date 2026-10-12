/**
 * Vereinskasse (Paket K1, docs/VEREINSKASSE.md): Konten, Kassenbuch, Kategorien nach den vier
 * steuerlichen Bereichen, Kostenstellen. Einfache Einnahmen-Ausgaben-Rechnung, keine doppelte
 * Buchführung; Beträge in Cent, immer positiv.
 */

export const CLUB_CASH_ACCOUNT_KINDS = ['bank', 'cash', 'savings', 'paypal', 'other'] as const;
export type ClubCashAccountKind = (typeof CLUB_CASH_ACCOUNT_KINDS)[number];
export const CLUB_CASH_ACCOUNT_KIND_LABEL: Record<ClubCashAccountKind, string> = {
  bank: 'Girokonto',
  cash: 'Barkasse',
  savings: 'Sparkonto',
  paypal: 'PayPal',
  other: 'Sonstiges Konto',
};

/** Die vier steuerlichen Bereiche eines gemeinnützigen Vereins. */
export const CLUB_CASH_AREAS = ['ideal', 'asset', 'purpose', 'business'] as const;
export type ClubCashArea = (typeof CLUB_CASH_AREAS)[number];
export const CLUB_CASH_AREA_LABEL: Record<ClubCashArea, string> = {
  ideal: 'Ideeller Bereich',
  asset: 'Vermögensverwaltung',
  purpose: 'Zweckbetrieb',
  business: 'Wirtschaftlicher Geschäftsbetrieb',
};

export const CLUB_CASH_DIRECTIONS = ['income', 'expense'] as const;
export type ClubCashDirection = (typeof CLUB_CASH_DIRECTIONS)[number];

export const CLUB_COST_CENTER_KINDS = ['department', 'team', 'event', 'other'] as const;
export type ClubCostCenterKind = (typeof CLUB_COST_CENTER_KINDS)[number];
export const CLUB_COST_CENTER_KIND_LABEL: Record<ClubCostCenterKind, string> = {
  department: 'Abteilung',
  team: 'Mannschaft',
  event: 'Veranstaltung',
  other: 'Sonstiges',
};

/** Wer außer Admin, Kassenwart und Prüfer die Vereinskasse einsehen darf (Einstellung des Vereins). */
export const CLUB_CASH_VISIBILITIES = ['treasury', 'board_reports', 'board_all'] as const;
export type ClubCashVisibility = (typeof CLUB_CASH_VISIBILITIES)[number];
export const CLUB_CASH_VISIBILITY_INFO: Record<
  ClubCashVisibility,
  { name: string; description: string }
> = {
  treasury: {
    name: 'Nur Kassenführung',
    description: 'Administration, Kassenwart und Kassenprüfer – der Standard',
  },
  board_reports: {
    name: 'Zusätzlich Vorstand: nur Auswertungen',
    description: 'Der Vorstand sieht Kontostände und Summen, aber keine einzelnen Buchungen',
  },
  board_all: {
    name: 'Zusätzlich Vorstand: alles',
    description: 'Der Vorstand sieht auch Kassenbuch und Belege (ohne zu buchen)',
  },
};

/** Typische Kategorien eines Sportvereins; der Kassenwart passt sie an. */
export const CLUB_CASH_CATEGORY_TEMPLATE: {
  name: string;
  direction: ClubCashDirection;
  area: ClubCashArea;
}[] = [
  { name: 'Mitgliedsbeiträge', direction: 'income', area: 'ideal' },
  { name: 'Spenden', direction: 'income', area: 'ideal' },
  { name: 'Zuschüsse', direction: 'income', area: 'ideal' },
  { name: 'Sponsoring', direction: 'income', area: 'business' },
  { name: 'Veranstaltungen (sportlich)', direction: 'income', area: 'purpose' },
  { name: 'Vereinsfeste und Verkauf', direction: 'income', area: 'business' },
  { name: 'Zinsen und Kapitalerträge', direction: 'income', area: 'asset' },
  { name: 'Platzmiete und Hallengebühren', direction: 'expense', area: 'ideal' },
  { name: 'Aufwandsentschädigungen', direction: 'expense', area: 'ideal' },
  { name: 'Versicherungen', direction: 'expense', area: 'ideal' },
  { name: 'Verbandsabgaben', direction: 'expense', area: 'ideal' },
  { name: 'Sportgeräte und Material', direction: 'expense', area: 'ideal' },
  { name: 'Fahrtkosten', direction: 'expense', area: 'ideal' },
  { name: 'Schiedsrichter und Spielbetrieb', direction: 'expense', area: 'purpose' },
  { name: 'Einkauf für Feste', direction: 'expense', area: 'business' },
  { name: 'Verwaltung und Bankgebühren', direction: 'expense', area: 'ideal' },
];

/** Kasse des Vereins (Paket K6): Konten, Beiträge und Auswertung gehören zu einer Kasse. */
export type ClubCashFund = {
  id: string;
  name: string;
  /** genau eine Kasse ist Hauptkasse (Buchungen ohne Abteilungsbezug) */
  isMain: boolean;
  archived: boolean;
  /** zugeordnete Abteilungen (mehrere möglich) */
  units: { id: string; name: string }[];
  accountCount: number;
  /** Summe der Kontostände */
  balanceCents: number;
  /** Es wurde schon gebucht – dann kann die Kasse nur stillgelegt werden */
  hasEntries: boolean;
};

export type ClubCashFundInput = {
  name: string;
  unitIds: string[];
  /** als Hauptkasse festlegen (die bisherige verliert den Status) */
  isMain?: boolean;
};

export type ClubCashAccount = {
  id: string;
  /** Kasse, zu der das Konto gehört */
  fundId: string;
  name: string;
  kind: ClubCashAccountKind;
  openingBalanceCents: number;
  /** Anfangsbestand plus alle nicht stornierten Buchungen */
  balanceCents: number;
  archived: boolean;
};

export type ClubCashCategory = {
  id: string;
  name: string;
  direction: ClubCashDirection;
  area: ClubCashArea;
  archived: boolean;
};

export type ClubCostCenter = {
  id: string;
  name: string;
  kind: ClubCostCenterKind;
  archived: boolean;
};

export type ClubCashEntry = {
  id: string;
  /** income | expense | transfer_in | transfer_out */
  kind: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  accountId: string;
  accountName: string;
  fundId: string;
  fundName: string;
  amountCents: number;
  bookedOn: string;
  categoryId: string | null;
  categoryName: string | null;
  area: ClubCashArea | null;
  costCenterId: string | null;
  costCenterName: string | null;
  counterparty: string | null;
  purpose: string;
  receiptNo: string | null;
  receiptUrl: string | null;
  /** gemeinsame Kennung beider Seiten einer Umbuchung */
  transferId: string | null;
  createdByName: string | null;
  createdAt: string;
  cancelled: { at: string; byName: string | null; reason: string } | null;
};

/** Summen je Bereich und Kategorie (nur nicht stornierte Buchungen, Kalenderjahr). */
export type ClubCashAreaTotal = {
  area: ClubCashArea;
  incomeCents: number;
  expenseCents: number;
};

export type ClubCash = {
  /** full: alles; reports: nur Kontostände und Summen; */
  level: 'full' | 'reports';
  canManage: boolean;
  /** Kassen anlegen und ändern, Hauptkasse wechseln: nur Kassenführung des ganzen Vereins */
  canManageFunds: boolean;
  canAudit: boolean;
  /** Einstellung ändern darf nur die Vereinsadministration */
  canChangeSettings: boolean;
  visibility: ClubCashVisibility;
  year: number;
  /** Kassen, die der Nutzer sehen darf (bei Rechten nur für einzelne Kassen weniger als alle) */
  funds: ClubCashFund[];
  /** Abteilungen des Vereins (zum Zuordnen von Kassen) */
  units: { id: string; name: string }[];
  /** gewählte Kasse; null = alle sichtbaren Kassen zusammen */
  fundId: string | null;
  accounts: ClubCashAccount[];
  categories: ClubCashCategory[];
  costCenters: ClubCostCenter[];
  areaTotals: ClubCashAreaTotal[];
  totalBalanceCents: number;
  /** Letzte Buchungen (nur bei level full) */
  recent: ClubCashEntry[];
};

export type ClubCashEntryInput = {
  accountId: string;
  kind: ClubCashDirection;
  amountCents: number;
  bookedOn: string;
  categoryId: string;
  costCenterId?: string | null;
  counterparty?: string | null;
  purpose: string;
  receiptNo?: string | null;
  receiptImageId?: string | null;
};

export type ClubCashTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  bookedOn: string;
  purpose?: string | null;
};

export type ClubCashEntryQuery = {
  fundId?: string;
  accountId?: string;
  categoryId?: string;
  costCenterId?: string;
  q?: string;
  from?: string;
  to?: string;
  includeCancelled?: boolean;
};

// ── Mitgliedsbeiträge (Paket K2) ────────────────────────────────────────────

export const CLUB_FEE_INTERVALS = ['monthly', 'quarterly', 'yearly', 'once'] as const;
export type ClubFeeInterval = (typeof CLUB_FEE_INTERVALS)[number];
export const CLUB_FEE_INTERVAL_LABEL: Record<ClubFeeInterval, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  yearly: 'jährlich',
  once: 'einmalig',
};

/** Höchste Erinnerungsstufe (1 Zahlungserinnerung, 2 erste Mahnung, 3 letzte Mahnung). */
export const CLUB_FEE_MAX_REMINDER = 3;

export type ClubFeeType = {
  id: string;
  name: string;
  amountCents: number;
  interval: ClubFeeInterval;
  categoryId: string | null;
  categoryName: string | null;
  /** Zielkasse der Beiträge; null = Hauptkasse */
  fundId: string | null;
  fundName: string;
  archived: boolean;
  /** Mitglieder mit laufender Zuordnung */
  members: number;
};

export type ClubFeeAssignment = {
  id: string;
  personId: string;
  personName: string;
  memberNumber: string | null;
  feeTypeId: string;
  feeTypeName: string;
  /** wirksamer Betrag (Ausnahme oder Betrag der Beitragsart) */
  amountCents: number;
  overridden: boolean;
  validFrom: string;
  validTo: string | null;
};

export type ClubFeeDueStatus = 'open' | 'overdue' | 'paid' | 'cancelled';

export type ClubFeeDue = {
  id: string;
  personId: string;
  personName: string;
  memberNumber: string | null;
  feeTypeName: string;
  /** Zielkasse der Beitragsart; null = Hauptkasse */
  fundId: string | null;
  periodLabel: string;
  dueOn: string;
  amountCents: number;
  paidCents: number;
  openCents: number;
  status: ClubFeeDueStatus;
  reminderLevel: number;
  remindedAt: string | null;
  cancelReason: string | null;
};

export type ClubFees = {
  level: 'full' | 'reports';
  canManage: boolean;
  today: string;
  types: ClubFeeType[];
  summary: {
    /** offen insgesamt (fällig, noch nicht bezahlt) */
    openCents: number;
    openCount: number;
    /** davon überfällig (Fälligkeit vor heute) */
    overdueCents: number;
    overdueCount: number;
    /** im laufenden Jahr eingegangen */
    paidThisYearCents: number;
    /** Mitglieder mit mindestens einer überfälligen Forderung */
    overduePersons: number;
  };
  /** nur bei level full */
  dues: ClubFeeDue[];
};

export type ClubFeeTypeInput = {
  name: string;
  amountCents: number;
  interval: ClubFeeInterval;
  categoryId?: string | null;
  /** Zielkasse; leer = Hauptkasse */
  fundId?: string | null;
};

export type ClubFeeAssignmentInput = {
  personId: string;
  feeTypeId: string;
  amountOverrideCents?: number | null;
  validFrom: string;
};

export type ClubFeeGenerateResult = { created: number; upTo: string };

export type ClubFeePaymentInput = { accountId: string; amountCents: number; paidOn: string };

/** Zeile aus dem Kontoauszug mit gefundenem Beitrag (Vorschau des CSV-Imports). */
export type ClubFeeImportRow = {
  row: number;
  paidOn: string | null;
  amountCents: number | null;
  name: string;
  purpose: string;
  /** Zuordnung zu einer offenen Forderung, sonst leer */
  match: {
    dueId: string;
    personName: string;
    periodLabel: string;
    openCents: number;
    reason: 'member_number' | 'name';
  } | null;
  /** warum nicht zugeordnet bzw. nicht gebucht */
  note: string | null;
};

export type ClubFeeImportPreview = {
  rows: ClubFeeImportRow[];
  matched: number;
  skipped: number;
};

export type ClubFeeImportCommitInput = {
  accountId: string;
  items: { dueId: string; amountCents: number; paidOn: string }[];
};

// ── Planung und Abschluss (Paket K3) ────────────────────────────────────────

/** Ab diesem Anteil der Planung (Ausgaben) warnt die Soll-Ist-Anzeige. */
export const CLUB_BUDGET_WARN_RATIO = 0.9;

export type ClubBudgetStatus = 'ok' | 'warn' | 'over';

export type ClubBudgetLine = {
  id: string;
  fundId: string;
  fundName: string;
  categoryId: string;
  categoryName: string;
  direction: ClubCashDirection;
  area: ClubCashArea;
  costCenterId: string | null;
  costCenterName: string | null;
  plannedCents: number;
  /** bisher gebucht (ohne Stornos) im Planjahr */
  actualCents: number;
  /** Ausgaben: ok / ab 90 % warn / über 100 % over; Einnahmen immer ok */
  status: ClubBudgetStatus;
  note: string | null;
};

export type ClubBudgetInput = {
  fundId: string;
  year: number;
  categoryId: string;
  costCenterId?: string | null;
  plannedCents: number;
  note?: string | null;
};

export type ClubBudget = {
  year: number;
  /** gewählte Kasse; null = alle sichtbaren Kassen zusammen */
  fundId: string | null;
  level: 'full' | 'reports';
  canManage: boolean;
  /** Das Jahr ist abgeschlossen: Plan und Buchungen sind gesperrt */
  locked: boolean;
  lines: ClubBudgetLine[];
  totals: {
    plannedIncomeCents: number;
    actualIncomeCents: number;
    plannedExpenseCents: number;
    actualExpenseCents: number;
    /** Anzahl Ausgabenzeilen über Plan */
    overCount: number;
    warnCount: number;
  };
};

export type ClubReserve = {
  id: string;
  fundId: string;
  fundName: string;
  name: string;
  targetCents: number | null;
  balanceCents: number;
  note: string | null;
  archived: boolean;
};

export type ClubReserveMove = {
  id: string;
  kind: 'allocate' | 'release';
  amountCents: number;
  bookedOn: string;
  note: string | null;
  createdByName: string | null;
};

export type ClubReserves = {
  canManage: boolean;
  reserves: ClubReserve[];
  /** je Kasse: Kassenbestand, davon gebunden, frei verfügbar */
  funds: { fundId: string; fundName: string; balanceCents: number; reservedCents: number }[];
};

export type ClubReserveInput = {
  fundId: string;
  name: string;
  targetCents?: number | null;
  note?: string | null;
};

export type ClubReserveMoveInput = {
  kind: 'allocate' | 'release';
  amountCents: number;
  bookedOn: string;
  note?: string | null;
};

export type ClubPeriodLock = {
  year: number;
  lockedAt: string;
  lockedByName: string | null;
};

/** Zeile der Einnahmen-Ausgaben-Rechnung: Kategorie mit Jahressumme und Vorjahr. */
export type ClubClosingLine = {
  categoryName: string;
  cents: number;
  previousCents: number;
};

export type ClubClosingArea = {
  area: ClubCashArea;
  incomeLines: ClubClosingLine[];
  expenseLines: ClubClosingLine[];
  incomeCents: number;
  expenseCents: number;
  previousIncomeCents: number;
  previousExpenseCents: number;
};

/** Jahresabschluss: Einnahmen-Ausgaben-Rechnung nach den vier Bereichen, Bestände, Rücklagen. */
export type ClubClosing = {
  year: number;
  /** null = ganzer Verein (der Abschluss gilt immer für den ganzen Verein) */
  clubName: string;
  level: 'full' | 'reports';
  canManage: boolean;
  canUnlock: boolean;
  lock: ClubPeriodLock | null;
  /** Jahr ist beendet und kann abgeschlossen werden */
  canClose: boolean;
  openingCents: number;
  closingCents: number;
  incomeCents: number;
  expenseCents: number;
  previousIncomeCents: number;
  previousExpenseCents: number;
  areas: ClubClosingArea[];
  /** Buchungen ohne Kategorie (Umbuchungen sind ausgenommen und bewegen die Summe nicht) */
  accounts: { name: string; fundName: string; openingCents: number; closingCents: number }[];
  reserves: { name: string; fundName: string; balanceCents: number }[];
};

// ── Prüfung und Spenden (Paket K4) ──────────────────────────────────────────

export type ClubAuditFindingKind = 'pending' | 'checked' | 'objection' | 'note';

export type ClubAuditEntryRef = {
  id: string;
  kind: ClubCashEntry['kind'];
  bookedOn: string;
  amountCents: number;
  purpose: string;
  counterparty: string | null;
  accountName: string;
  fundName: string;
  categoryName: string | null;
  receiptNo: string | null;
  receiptUrl: string | null;
  cancelled: boolean;
};

export type ClubAuditFinding = {
  id: string;
  kind: ClubAuditFindingKind;
  entry: ClubAuditEntryRef | null;
  text: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type ClubAuditSummary = {
  id: string;
  year: number;
  /** null = ganzer Verein */
  fundId: string | null;
  fundName: string;
  startedByName: string | null;
  startedAt: string;
  submittedAt: string | null;
  status: 'open' | 'submitted';
  pending: number;
  checked: number;
  objections: number;
  notes: number;
  conclusion: string | null;
};

export type ClubAudits = {
  /** darf prüfen (Stichproben, Vermerke, Bericht) */
  canAudit: boolean;
  /** Kassen, für die der Nutzer prüfen darf; leer bei Prüfung des ganzen Vereins nicht nötig */
  funds: { id: string; name: string }[];
  /** darf den ganzen Verein prüfen */
  wholeClub: boolean;
  audits: ClubAuditSummary[];
};

export type ClubAuditDetail = ClubAuditSummary & {
  findings: ClubAuditFinding[];
  /** Buchungen im Prüfumfang (Einnahmen und Ausgaben des Jahres, ohne Storno) */
  entryCount: number;
};

export type ClubAuditInput = { year: number; fundId?: string | null };

export type ClubAuditFindingInput =
  | { kind: 'note'; text: string }
  | { kind: 'objection' | 'checked'; entryId: string; text?: string | null };

export const CLUB_AUDIT_MAX_SAMPLE = 50;

export type ClubTaxInfo = {
  taxOffice: string | null;
  taxNumber: string | null;
  exemptionKind: 'freistellung' | 'feststellung' | null;
  exemptionDate: string | null;
  exemptionPeriod: string | null;
  purposes: string | null;
  /** alle Pflichtangaben für die Zuwendungsbestätigung sind erfasst */
  complete: boolean;
  /** Die Vorlage wurde rechtlich bzw. steuerlich geprüft und freigegeben */
  reviewed: { at: string; byName: string | null; note: string | null } | null;
};

export type ClubTaxInfoInput = {
  taxOffice: string;
  taxNumber: string;
  exemptionKind: 'freistellung' | 'feststellung';
  exemptionDate: string;
  exemptionPeriod: string;
  purposes: string;
};

export type ClubDonation = {
  id: string;
  entryId: string;
  personId: string | null;
  donorName: string;
  donorAddress: string;
  amountCents: number;
  donatedOn: string;
  waiver: boolean;
  receiptNo: string | null;
  issuedAt: string | null;
  /** die Buchung wurde storniert – dann nur noch ansehen */
  cancelled: boolean;
};

export type ClubDonations = {
  canManage: boolean;
  /** Die Steuerdaten sind vollständig und freigegeben – Bestätigungen können ausgestellt werden */
  canIssue: boolean;
  tax: ClubTaxInfo;
  year: number;
  totalCents: number;
  donations: ClubDonation[];
};

export type ClubDonationInput = {
  accountId: string;
  categoryId: string;
  donorName: string;
  donorAddress: string;
  personId?: string | null;
  amountCents: number;
  donatedOn: string;
  waiver: boolean;
};
