import type { IconName } from '@/components/ui';

/** Buchungskategorien der Mannschaftskasse */
export const CASH_CATEGORY: Record<string, { label: string; icon: IconName }> = {
  strafe: { label: 'Strafe', icon: 'alert-circle-outline' },
  getraenke: { label: 'Getränke', icon: 'beer-outline' },
  einzahlung: { label: 'Einzahlung', icon: 'cash-outline' },
  sponsoring: { label: 'Sponsoring', icon: 'ribbon-outline' },
  material: { label: 'Material', icon: 'football-outline' },
  uebertrag: { label: 'Übertrag', icon: 'swap-horizontal-outline' },
  veranstaltung: { label: 'Veranstaltung', icon: 'beer-outline' },
  einnahmen_spieltag: { label: 'Spieltag', icon: 'storefront-outline' },
  einnahme: { label: 'Sonstige Einnahme', icon: 'arrow-down-circle-outline' },
  ausgabe: { label: 'Sonstige Ausgabe', icon: 'arrow-up-circle-outline' },
  spende: { label: 'Spende', icon: 'heart-outline' },
  zuschuss: { label: 'Zuschuss', icon: 'business-outline' },
  fahrtkosten: { label: 'Fahrtkosten', icon: 'car-outline' },
  startgeld: { label: 'Startgeld', icon: 'trophy-outline' },
  schiedsrichter: { label: 'Schiedsrichter', icon: 'flag-outline' },
  umlage: { label: 'Umlage', icon: 'people-outline' },
  beitrag: { label: 'Beitrag', icon: 'repeat-outline' },
};

export const cashCategory = (key: string) =>
  CASH_CATEGORY[key] ?? { label: key, icon: 'receipt-outline' as const };
