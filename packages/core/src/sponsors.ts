/**
 * Sponsoren-Modul (Paket SPO): Logo und Banner, Link, Stufe, Laufzeit, Zuordnung. Banner sind
 * gekennzeichnet, ohne Auswertung (kein Zählen von Aufrufen oder Klicks) und erscheinen nie in
 * Anmeldung, Kasse, Chat oder bei Minderjährigen.
 */

export const SPONSOR_TIERS = ['main', 'partner', 'supporter'] as const;
export type SponsorTier = (typeof SPONSOR_TIERS)[number];
export const SPONSOR_TIER_LABEL: Record<SponsorTier, string> = {
  main: 'Hauptsponsor',
  partner: 'Partner',
  supporter: 'Förderer',
};
export const SPONSOR_TIER_PLURAL: Record<SponsorTier, string> = {
  main: 'Hauptsponsoren',
  partner: 'Partner',
  supporter: 'Förderer',
};

/** Zuordnung: ganzer Verein oder nur Jugend bzw. Senioren (Mitglieder dieser Bereiche). */
export const SPONSOR_SCOPES = ['club', 'youth', 'seniors'] as const;
export type SponsorScope = (typeof SPONSOR_SCOPES)[number];
export const SPONSOR_SCOPE_LABEL: Record<SponsorScope, string> = {
  club: 'Ganzer Verein',
  youth: 'Jugend',
  seniors: 'Senioren',
};

/** Wo ein Banner stehen darf (nie in Anmeldung, Kasse oder Chat). */
export const SPONSOR_PLACEMENTS = ['home', 'match', 'events'] as const;
export type SponsorPlacement = (typeof SPONSOR_PLACEMENTS)[number];

/** Auswahl für die Kennzeichnung der Banner (Verein stellt ein). */
export const SPONSOR_LABELS = ['Anzeige', 'Partner des Vereins', 'Gesponsert'] as const;

export type SponsorStatus = 'active' | 'planned' | 'expired';

export type SponsorItem = {
  id: string;
  name: string;
  tier: SponsorTier;
  linkUrl: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  scope: SponsorScope;
  startsOn: string | null;
  endsOn: string | null;
};

/** Seite „Unsere Sponsoren“ (nur aktuell laufende, für diese Person passende Sponsoren). */
export type SponsorPage = { label: string; sponsors: SponsorItem[] };

/** Ein Banner für einen Platz in der App; leer, wenn nichts anzuzeigen ist. */
export type SponsorBanner = { label: string; sponsor: SponsorItem | null };

export type AdminSponsor = SponsorItem & { status: SponsorStatus };
export type AdminSponsors = { label: string; sponsors: AdminSponsor[] };

export type SponsorInput = {
  name: string;
  tier: SponsorTier;
  linkUrl?: string | null;
  scope: SponsorScope;
  startsOn?: string | null;
  endsOn?: string | null;
  logoImageId?: string | null;
  bannerImageId?: string | null;
};
