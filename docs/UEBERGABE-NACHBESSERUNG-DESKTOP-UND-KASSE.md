# Übergabeprompt: Nachbesserung Desktop und Vereinskasse (Paket NACHBESSERUNG-DESKTOP-UND-KASSE)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **NACHBESSERUNG-DESKTOP-UND-KASSE** (`docs/PAKETE.md`, gleichnamige Zeile) bündelt zwei kleine Korrekturen vom 19.10.2026: **Teil A** Desktop (Team zeigt statt der Kaderliste die Unterseiten als Kacheln, „Mehr“ mit getauschten Spalten, flache Zeilenkacheln ohne abgeschnittene Texte, Vereinsname in der Seitenleiste) und **Teil B** Vereinskasse (alle Statistiken im Reiter „Auswertung“, Spenden unter „Buchung“). Mobil bleibt bei Teil A unverändert.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile lesen. Entwürfe: `docs/design/anstoss/Desktop.html` (Reiter Team und Mehr), `DesktopLaptop.html` (Internet für die Schriften nötig). Dateien: `(tabs)/team.tsx`, `(tabs)/mehr.tsx`, Kachelkomponente und Raster, `docs/DESKTOP-VORLAGEN.md`; `club-cash/_layout.tsx` (`TAB_OF`), `lib/areas.ts` (`cashCategories`), `club-cash/index.tsx`, `club-cash/stats.tsx`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
**Teil A – Desktop**
1. Flache Zeilenkachel (Symbol links, Name einzeilig, Kennzahl-Pill rechts innen, Mindestbreite 210 px, `auto-fill`, kein Umbruch im Wort) auf allen Kachelseiten.
2. Team (Desktop): Kaderliste entfernen; Kader-Hero und „Nächster Termin“ nebeneinander; Kachelgruppen „Spiel- und Trainingsbetrieb“ und „Organisation“.
3. Mehr (Desktop): links Hero, „Mein Bereich“, „Meine Mannschaften“; rechts „Einstellungen“, „Über Clubroof“.
4. Seitenleiste: Vereinsname zweizeilig, ohne „…“.

**Teil B – Vereinskasse**
5. Reiter `pruefung` → `auswertung` („Auswertung“) mit Gruppen Statistik, Prüfung, Steuer; Kacheln für alle Statistik-Themen (`stats?topic=…`); Spenden in `buchung` bei den besonderen Einnahmen.
6. `TAB_OF`: `stats`, `audit`, `tax` → `auswertung`; `donations` → `buchung`; alte Direktlinks umleiten. Verweise „Beitragsstatistik“ (Beiträge) und „Plan gegen Ist“ (Planung) durch Textlink „Auswertung ansehen ›“ ersetzen; Übersicht unverändert.

**Abschluss**
7. Bilder 1280/1440/1920 px dunkel und hell vorher/nachher (zusammengefasst), Browserprüfung (aktiver Reiter je Kassenseite, Mobil und Desktop), `DESKTOP-VORLAGEN.md`, Hilfe, Übersetzungen, `FUNKTIONEN.md`, `VEREINSKASSE.md`.

## Abnahme
Bilder neben den Entwürfen; kurze Liste erledigt / abweichend / offen.
