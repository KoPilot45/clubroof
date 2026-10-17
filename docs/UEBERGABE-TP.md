# Übergabeprompt: Tabellenplatz entfernen (Paket TP)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **TP** (`docs/PAKETE.md`, Zeile TP): Der Tabellenplatz wird vorerst aus der App entfernt. Kleines Paket, ein Durchgang.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **TP** lesen. Fundstellen finden mit `grep -rn "leaguePosition\|league_position\|Tabellenplatz" apps packages docs` (ohne `docs/design`).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **App:** Chip „Platz n“ im Kader-Blickfang und Feld „Tabellenplatz in der Liga (optional)“ in „Mannschaft bearbeiten“ entfernen; Hero-Bedingung ohne Tabellenplatz.
2. **Server und Daten:** Vertrag, Services, Route und Test anpassen; Migration (Spalte `league_position` löschen), Seed; `pnpm db:reset` muss laufen.
3. **Texte:** Übersetzung, Hilfe, `docs/FUNKTIONEN.md` anpassen.

## Abnahme
Nirgends mehr Tabellenplatz in der App; Kader-Blickfang zeigt weiter Bilanz und Trainingsquote; `pnpm check` grün. Kurze Liste erledigt / abweichend / offen.
