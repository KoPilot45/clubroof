import { useSegments } from 'expo-router';
import map from './desktop-templates.json';

/**
 * Seitenvorlagen der Desktop-Ansicht (Paket DT2). Jede Route steht in `desktop-templates.json` (und daraus erzeugt in
 * `docs/DESKTOP-VORLAGEN.md`); `scripts/desktop-vorlagen.mjs` prüft, dass keine Route fehlt.
 *
 * A Liste/Detailseite · B Formular · C Tabelle mit Filterleiste · D Kachelraster · E Assistent · F Bericht/Diagramme ·
 * S Sonderfall mit eigenem Entwurf · H Hauptseite (Paket DT) · U bewusst unverändert
 */
export type DesktopTemplate = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'S' | 'H' | 'U';

/** Breite des Inhalts ab 1100 px: Formulare und Assistenten schmal, Listen mittel, Tabellen und Berichte breit. */
export const TEMPLATE_WIDTH: Record<DesktopTemplate, number> = {
  A: 1100,
  B: 720,
  C: 1440,
  D: 1440,
  E: 720,
  F: 1440,
  S: 1440,
  H: 1440,
  U: 960,
};

const routes = map as Record<string, { t: DesktopTemplate }>;

/** Vorlage der aktuellen Seite (aus den Routensegmenten); unbekannte Seiten gelten als Liste/Detail (Auffangregel). */
export function useTemplate(): DesktopTemplate {
  const key = (useSegments() as string[]).join('/');
  return (routes[key] ?? routes[`${key}/index`])?.t ?? 'A';
}
