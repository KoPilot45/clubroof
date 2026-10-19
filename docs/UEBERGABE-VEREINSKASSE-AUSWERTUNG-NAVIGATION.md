# Übergabeprompt: Vereinskasse – Reiter „Auswertung“ (Paket VEREINSKASSE-AUSWERTUNG-NAVIGATION)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **VEREINSKASSE-AUSWERTUNG-NAVIGATION** (`docs/PAKETE.md`, gleichnamige Zeile) ordnet die Vereinskasse neu: Alle Statistiken liegen im Reiter „Auswertung“ (bisher „Prüfung“), Spenden liegen unter „Buchung“. Der Befund: Die Statistikseite hat den Reiter „Planung“ aktiv, dort gibt es aber keine Kachel dafür.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile lesen. Dateien: `apps/mobile/src/app/club-cash/_layout.tsx` (`TAB_OF`), `apps/mobile/src/lib/areas.ts` (`cashCategories`: Gruppen und Kacheln), `club-cash/index.tsx` (Übersicht, Button „Auswertungen“), `club-cash/stats.tsx`, Hilfe und Übersetzungen.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Kategorien:** Reiter `pruefung` → `auswertung` (Label „Auswertung“) mit Gruppen Statistik, Prüfung, Steuer; Kacheln für alle Statistik-Themen (`stats?topic=…`); Spenden in `buchung` bei den besonderen Einnahmen.
2. **`TAB_OF`:** `stats`, `audit`, `tax` → `auswertung`; `donations` → `buchung`; Direktlinks (`/club-cash/area/pruefung` o. Ä.) umleiten.
3. **Verweise** „Beitragsstatistik“ (Beiträge) und „Plan gegen Ist“ (Planung) durch Textlink „Auswertung ansehen ›“ ersetzen; Übersicht unverändert.
4. **Abschluss:** Browserprüfung (aktiver Reiter je Seite, Mobil und Desktop, hell und dunkel), Hilfe, Übersetzungen, `FUNKTIONEN.md`, `VEREINSKASSE.md`.

## Abnahme
Bilder der fünf Reiter (zusammengefasst), Liste erledigt / abweichend / offen.
