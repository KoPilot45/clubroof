# Übergabeprompt: Desktop-Ansicht (Paket DT)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **DT** (`docs/PAKETE.md`, Zeile DT) macht die fünf Hauptseiten und Verwaltung/Vereinskasse ab 1100 px Fensterbreite desktoptauglich: feste Seitenleiste statt schwebender Leiste, mehrspaltige Inhalte, Dialoge statt Fenster von unten.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **DT** vollständig lesen; Entwurf öffnen: `docs/design/anstoss/Desktop.html` (Reiter für alle Seiten; Internet für die Schriften nötig).
3. Vorhandenes lesen: `components/tab-bar`, Screen (`maxWidth: 960`), `Sheet`, `HeroCard`, `squad-table.tsx`, `app/(tabs)/_layout`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Rahmen:** Hook für Breitenstufen (<640, 640–1100, ≥1100); `Sidebar` (248 px, fest) mit Wappen, Name, 5 Punkten, Suche (`/`), Mitteilungen, Verwaltung/Vereinskasse nach Recht, Profilkarte, Waben; Screen-Breite bis 1440; `Sheet` als zentrierter Dialog/Seitenpanel; Hover, Fokus, `Esc`.
2. **Termine und Team:** Liste + Detail; Kader-Hero + Nächster Termin, Kadertabelle, Kacheln rechts, Aufstellungsplaner zweispaltig.
3. **Home und Verein:** zwei Spalten bzw. 3-Spalten-Kacheln, Helfer-Karten.
4. **Mehr, Verwaltung, Kasse:** Einstellungen zweispaltig, Tabellen/Diagramme nebeneinander.

Unter 1100 px darf sich nichts ändern (Browserprüfung vorher/nachher). Nur Layout, keine neuen Daten oder Rechte.

## Abnahme
Bilder 1440 und 1100 px (hell, dunkel) je Hauptseite, zusammengefasst; Kontrast `hell-kontrast.mjs`; Tastaturdurchlauf; kurze Liste erledigt / abweichend / offen.
