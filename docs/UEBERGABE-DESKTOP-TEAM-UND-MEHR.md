# Übergabeprompt: Desktop – Team, Mehr und Kacheln (Paket DESKTOP-TEAM-UND-MEHR)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **DESKTOP-TEAM-UND-MEHR** (`docs/PAKETE.md`, gleichnamige Zeile) räumt drei Dinge der Desktop-Ansicht auf: Team zeigt statt der Kaderliste die Unterseiten als Kacheln, „Mehr“ bekommt getauschte Spalten, die Kacheln werden flache Zeilenkacheln ohne abgeschnittene Texte und Kennzahlen. Mobil bleibt unverändert.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile lesen; Entwürfe öffnen: `docs/design/anstoss/Desktop.html` (Reiter Team und Mehr), `DesktopLaptop.html` (Internet für die Schriften nötig). Vorhandenes: `(tabs)/team.tsx`, `(tabs)/mehr.tsx`, Kachelkomponente und Raster, `docs/DESKTOP-VORLAGEN.md`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Kachel Desktop:** flache Zeilenkachel (Symbol links, Name einzeilig, Kennzahl-Pill rechts innen, Mindestbreite 210 px, `auto-fill`), kein Umbruch im Wort; auf allen Kachelseiten (Team, Verein, Verwaltung, Vereinskasse, Auswertungen).
2. **Team (Desktop):** Kaderliste entfernen; Kader-Hero und „Nächster Termin“ nebeneinander; Kachelgruppen Spiel- und Trainingsbetrieb sowie Organisation wie im Entwurf.
3. **Mehr (Desktop):** Spalten tauschen (links Hero, Mein Bereich, Meine Mannschaften; rechts Einstellungen, Über Clubroof).
4. **Seitenleiste:** Vereinsname ohne „…“ (zweizeilig).
5. **Abschluss:** Bilder 1280/1440/1920 px dunkel und hell vorher/nachher (zusammengefasst), `DESKTOP-VORLAGEN.md`, Hilfe, Übersetzungen.

## Abnahme
Bilder neben dem Entwurf; kurze Liste erledigt / abweichend / offen.
