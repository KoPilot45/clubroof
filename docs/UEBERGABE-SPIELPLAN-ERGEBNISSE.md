# Übergabeprompt: Spielplan zum Saisonstart und Ergebnisse nach dem Spieltag (Paket SPIELPLAN-ERGEBNISSE)

**Status: vorgemerkt für später (19.10.2026). Nicht umsetzen, bis anonymisierte echte DFBnet-Exportdateien vorliegen und geprüft sind** (Staffel-Spielplan, Vereinsspielplan, ggf. Ergebnisliste; siehe `docs/VERBANDSANBINDUNG.md` Abschnitt 6). Danach den Prompt in die Umsetzungssitzung einfügen.

---

Paket **SPIELPLAN-ERGEBNISSE** (`docs/PAKETE.md`, gleichnamige Zeile) macht den Spielplan-Import zum Saisonstart vollständig und trägt nach dem Spieltag Ergebnisse ein, soweit DFBnet sie exportiert; sonst Erinnerung und Schnelleingabe.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **SPIELPLAN-ERGEBNISSE** lesen; Recherche: `docs/VERBANDSANBINDUNG.md` (Abschnitte 5 und 6); vorhandenes Verfahren: `docs/SPIELPLAN-IMPORT.md`, Service `schedule-import`, Assistent `schedule-import.tsx`, Spielbericht (`match/[id]/report`).
3. **Klären, bevor Stufe 2 beginnt:** Liegen anonymisierte echte DFBnet-Exporte vor (Staffel-Spielplan, Vereinsspielplan, Ergebnisliste)? Wenn nein: Stufe 1 und Stufe 3 umsetzen, in Stufe 2 nur Erinnerung und Schnelleingabe; Ergebnis-Import erst nach Prüfung des Formats. Der Staffel-Spielplan enthält laut DFBnet-Hilfe **keine Ergebnisse**.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Stufe 1 – Saisonstart:** Import gegen echte Dateien prüfen, Spaltenvorbelegung, ein Import für alle Mannschaften, Alias je Saison, `source_key`, Heim/Auswärts mit Platz und Treffpunkt, Vorschau, Rückgängig, Sammelbenachrichtigung; Schritt „Spielplan übernehmen“ im Saisonwechsel und im Vereinsassistenten; Wiederholungs-Import (Aktualisieren statt Dublette; fehlende Spiele nur mit Rückfrage).
2. **Stufe 2 – Spieltagsabschluss:** Erinnerung am Spieltagabend (Sammelhinweis), Schnelleingabe des Ergebnisses; Spieltagsübersicht für Admin/Leitung (Spiele ohne Ergebnis); **Ergebnis-Import nur bei passendem Exportformat** mit Vorschau und Konfliktauswahl, App-Ergebnisse haben Vorrang.
3. **Stufe 3 – Kopierhilfe für DFBnet:** Ansicht „Für den Spielbericht“ mit Aufstellung, Ergebnis, Tore, Karten, Wechsel zum Kopieren und Teilen.
4. **Stufe 4** (außerhalb der App): Anfrage an DFB-Medien und Landesverband vorbereiten; nicht umsetzen ohne Zulassung.

**Nicht umsetzen:** Scraping von FUSSBALL.DE, Tabellenplatz, Einreichen von Spielberichten beim Verband.

## Abnahme
Tests mit echten Beispieldateien; Bilder (dunkel, hell, Desktop) der Assistenten; kurze Liste erledigt / abweichend / offen.
