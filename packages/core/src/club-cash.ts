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

export type ClubCashAccount = {
  id: string;
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
  canAudit: boolean;
  /** Einstellung ändern darf nur die Vereinsadministration */
  canChangeSettings: boolean;
  visibility: ClubCashVisibility;
  year: number;
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
  accountId?: string;
  categoryId?: string;
  costCenterId?: string;
  q?: string;
  from?: string;
  to?: string;
  includeCancelled?: boolean;
};
