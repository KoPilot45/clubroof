# Übergabeprompt: Desktop-Nachbesserung (Paket DT3)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **DT3** (`docs/PAKETE.md`, Zeile DT3) behebt die Befunde aus dem Durchgang über 52 Seiten bei 1440 px nach DT und DT2: doppelte Navigation in Verwaltung und Kasse, doppelte Suche, unklare Titel, zu große Kacheln, schmale Formulare, Filter vor Tabellen, schwache Assistenten. Unter 1100 px darf sich nichts ändern.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **DT3**, außerdem DT und DT2 und `docs/DESKTOP-VORLAGEN.md` lesen. Entwürfe: `docs/design/anstoss/Desktop.html`, `DesktopSonder.html`.
3. Vorher-Bilder erzeugen: `SCHEME` dunkel und hell, 1440 und 1100 px, mit einem Skript neben `scripts/e2e/desktop-alle.mjs` (Admin und Trainer, Seiten je Vorlage).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
0. **Zuerst Breiten:** Desktop-Stufen kompakt (1100–1399 px), normal (1400–1799), weit (ab 1800) mit Seitenleiste 208/248 px, Mindestbreiten je Spalte, `auto-fill`-Raster, keine abgeschnittenen Kacheln oder Namen (Befund vom 19.10.: bei ca. 1200–1500 px wirkt alles gequetscht, Neuigkeiten und Wisch-Reihen werden abgeschnitten, Kadernamen gekürzt). Prüfen bei 1280, 1440, 1536, 1920 px und Zoom 125/150 %.
1. **Navigation:** Verwaltung und Vereinskasse ohne Mobil-Kopf und ohne untere Leiste, Unterbereiche als zweite Spalte oder Reiter; Suche und Mitteilungen nur einmal; Seitenname als Titel, Bereich als Brotkrume; Zurück-Pfeil nur ohne Brotkrume.
2. **Raumnutzung:** Kachelseiten 3–4 Spalten, Formulare zweispaltig bis 1040 px, Primäraktionen oben rechts, Leerzustände kompakt.
3. **Home und Team:** Admin ohne Mannschaft kompakt, Wisch-Reihen als Raster oder Reihe mit Pfeilen, Abteilungsübersicht als Raster.
4. **Übersicht:** Filter von Kassenbuch, Beiträgen, Mitgliedern kompakt; Diagramme höher und lesbar; Assistenten mit Schrittliste links und Hinweisspalte rechts; Schrift und Kontrast am Desktop prüfen.
5. **Liste + Detail** für Forum, Wiki, Aushänge, Umfragen, Dokumente, Gastspieler, Termine.

Nur Layout, keine neuen Daten oder Rechte. Hell und dunkel, `hell-kontrast.mjs`, Übersetzungen, Hilfe, `docs/DESKTOP-VORLAGEN.md` anpassen.

## Abnahme
Vorher/nachher-Bilder (zusammengefasst) bei 1440 und 1100 px, hell und dunkel; Prüfung unter 1100 px unverändert; kurze Liste erledigt / abweichend / offen.
