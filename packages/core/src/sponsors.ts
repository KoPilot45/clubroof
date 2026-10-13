/**
 * Sponsoren-Modul (Paket SPO, umgebaut in SP2): Logo, Slogan, Text, Link, Laufzeit. Werbung wird je Sponsor
 * geschaltet; der Container zeigt bis zu drei zufällige Sponsoren mit Werbung. Ohne Werbung bleibt der Sponsor in
 * der Übersicht „Unsere Sponsoren“. Gekennzeichnet, ohne Auswertung (kein Zählen von Aufrufen oder Klicks) und nie in
 * Anmeldung, Kasse, Chat oder Kinderdaten.
 */

/** Auswahl für die Kennzeichnung der Werbung (Verein stellt ein). */
export const SPONSOR_LABELS = ['Anzeige', 'Partner des Vereins', 'Gesponsert'] as const;

/** Höchstzahl der Sponsoren im Container (Wischelement). */
export const SPONSOR_AD_MAX = 3;

export type SponsorStatus = 'active' | 'planned' | 'expired';

export type SponsorItem = {
  id: string;
  name: string;
  slogan: string | null;
  /** Text der Detailseite */
  description: string | null;
  linkUrl: string | null;
  logoUrl: string | null;
  /** eigenes Logo für den Dunkelmodus (sonst `logoUrl`) */
  logoDarkUrl: string | null;
  startsOn: string | null;
  endsOn: string | null;
};

/** Übersicht „Unsere Sponsoren“: alle laufenden Sponsoren, auch ohne Werbung. */
export type SponsorPage = { label: string; sponsors: SponsorItem[] };

/** Inhalt des Containers: bis zu drei zufällige Sponsoren mit Werbung; leer = kein Container. */
export type SponsorAds = { label: string; sponsors: SponsorItem[] };

export type AdminSponsor = SponsorItem & {
  status: SponsorStatus;
  advertise: boolean;
  hideForYouth: boolean;
};
export type AdminSponsors = {
  label: string;
  /** Sponsoren, die jetzt als Werbung laufen (Werbung an und Laufzeit aktiv) */
  advertising: number;
  sponsors: AdminSponsor[];
};

export type SponsorInput = {
  name: string;
  slogan?: string | null;
  description?: string | null;
  linkUrl?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  advertise: boolean;
  /** nur wirksam mit `advertise` */
  hideForYouth: boolean;
  logoImageId?: string | null;
  logoDarkImageId?: string | null;
};
