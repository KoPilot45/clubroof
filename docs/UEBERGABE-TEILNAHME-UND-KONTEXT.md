# Übergabeprompt: Paket TEILNAHME-UND-KONTEXT

Zum Einfügen in die Umsetzungssitzung.

---

Paket **TEILNAHME-UND-KONTEXT** (`docs/PAKETE.md`, gleichnamige Zeile) setzt Befunde der externen Prüfberichte vom 19.10.2026 um (`docs/pruefberichte/`). Die Zeile enthält Befund, Ursache mit Dateiverweisen, Korrektur und Abnahme je Punkt.

## Vorgehen
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile und den passenden Abschnitt im Bericht lesen. **Jeden Befund zuerst mit einem fehlschlagenden Test nachstellen** (API-Test gegen echte Datenbank oder Modultest), dann beheben, dann den Test als Regression behalten.
3. Je Befund ein eigener Commit, `pnpm check` vor jedem Commit; keine Tests auslassen oder abschwächen.
4. Abweichungen vom Bericht (Befund nicht nachstellbar, andere Ursache) in der Paketzeile festhalten.

## Abnahme
Alle Abnahmeszenarien der Zeile als Tests oder Browserprüfung; kurze Liste erledigt / abweichend / offen.
