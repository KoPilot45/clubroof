# Übergabeprompt: Umsetzung der Pakete aus den Prüfberichten vom 19.10.2026

Zum Einfügen in die Umsetzungssitzung.

---

Setze die folgenden Pakete aus `docs/PAKETE.md` **in dieser Reihenfolge** um. Grundlage sind die externen Prüfberichte vom 19.10.2026 (`docs/pruefberichte/`: technische Erstprüfung, Optik und UX, Inhaltsstruktur und Navigation) und die Festlegungen in `docs/ENTSCHEIDUNGEN.md` (Eintrag 19.10.2026). Je Paket gibt es eine Zeile mit Befund, Ursache, Korrektur und Abnahme sowie einen kurzen Übergabeprompt `docs/UEBERGABE-<PAKETNAME>.md`.

## Reihenfolge
1. **PILOT-SICHERHEIT** (P1: F01 Verknüpfen ohne Rechteprüfung, F02 Cache und Outbox beim Kontowechsel, F06 Warteschlange bei Serverfehlern, F07 2FA-Pflicht pro Aktion)
2. **KASSE-BEITRAEGE-KONSISTENZ** (P1: F03 Storno, F04 parallele Zahlungen, U09 sichtbarer Beitragsfilter)
3. **BEDIENUNG-STABILISIEREN** (U07 und U10 sind P1: sichtbare Pflichtgrund-Fehler bei Absagen, Home nicht leeren; danach U01, U04, U08 Seitenpanel am Desktop, Teilpunkte von U03)
4. **TEILNAHME-UND-KONTEXT** (F05 zentrale Neuberechnung bei Abwesenheit und Terminverschiebung, manuelle Antwort hat Vorrang; U05 Personenkarten folgen dem Plakat; U06 Kind vorwählen)
5. **NACHBESSERUNG-DESKTOP-UND-KASSE** (Team-Unterseiten als Kacheln, „Mehr“ mit getauschten Spalten, flache Zeilenkacheln, Vereinskasse-Reiter „Auswertung“, Spenden unter Buchung)
6. **NAVIGATION-NEUORDNUNG** (Start · Termine · Team · Verein · Ich nach Konzept; Home mit Plakat zuerst; mobile Leiste unverändert; Auslage bleibt; erst nach Paket 5)

Nicht umsetzen, solange nicht ausdrücklich beauftragt: SPIELPLAN-ERGEBNISSE (vorgemerkt), neue Standardrollen, Forum-Moderation, ROLLEN-VERWALTUNG, DEMODATEN-AUSBAU (eigene Pakete).

## Arbeitsweise (verbindlich)
- Zuerst `CLAUDE.md` lesen und den Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
- **Fehlerbefunde (Pakete 1 bis 4) immer zuerst mit einem fehlschlagenden Test nachstellen**: API-Test gegen echte Datenbank (`api.test.ts`), Modultest oder Browserskript; dann beheben; Test als Regression behalten. Konkrete Szenarien stehen im jeweiligen Bericht. Wenn ein Befund nicht nachstellbar ist oder die Ursache anders liegt: in der Paketzeile festhalten.
- Je Befund oder Teilaufgabe ein eigener, thematisch getrennter Commit; **`pnpm check` einmal vor jedem Commit**, keine Tests auslassen, abschwächen oder überspringen. Danach pushen.
- Neue Oberflächen in beiden Darstellungen prüfen (`SCHEME=light`), Kontrast mit `hell-kontrast.mjs`; neue Texte deutsch, danach `node scripts/i18n.mjs todo` und `merge`; Hilfe und `docs/FUNKTIONEN.md` aktualisieren; neue Routen in `desktop-templates.json` eintragen.
- Rechte nur serverseitig prüfen. Keine Daten eines Kontos dürfen bei einem anderen Konto sichtbar werden.
- Screenshots sparsam, zu einer Übersicht zusammengefasst; Browserprüfung als Skript statt von Hand.
- Nach jedem Paket die Paketzeile in `docs/PAKETE.md` mit „✔ umgesetzt“ und Abweichungen kennzeichnen und eine kurze Liste **erledigt / abweichend / offen** ausgeben.

## Abnahme je Paket
Die Abnahmeszenarien der Paketzeile als Tests bzw. Browserprüfung grün; Gesamtprüfung `pnpm check` grün; bei Paket 6 zusätzlich die Zuordnungsliste alt → neu vollständig (nichts unerreichbar).

## Rückfragen
Bei Kleinigkeiten nach Vorgabe entscheiden und die Entscheidung benennen. Rückfragen nur bei Widersprüchen zu `docs/ENTSCHEIDUNGEN.md` oder wenn ein Befund nicht nachstellbar ist.
