# Übergabeprompt: Import-Assistent und Exporte (Paket IM)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **IM** (`docs/PAKETE.md`, Zeile IM) macht aus dem vorhandenen CSV-Import einen einheitlichen Assistenten für Excel und CSV und ergänzt Exporte, darunter „Meine Daten“ für jede Person. IM3 (Kontoauszug) ist nur vermerkt, nicht umsetzen.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **IM** vollständig lesen. Vorhandenes lesen: Mitglieder-Import (CSV, Vorschau, Dublettenprüfung), Spielplan-Import (Paket I), Kassenbericht-Export, Kalenderexport, `components/wizard.tsx`, Archiv (`ARCHIV.md`).
3. Excel lesen: eine geeignete Bibliothek wählen und kurz begründen (Größe, Lizenz, Betrieb im Server).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Gerüst:** Dateien (xlsx, csv; Kodierung, Trennzeichen, Blattwahl), Vorlagen, Spaltenzuordnung (je Quelle gemerkt), Vorschau mit Zeilenstatus, Dublettenverhalten, Import alles-oder-nichts, Protokoll, Rückgängig (24 h), Abschlussbericht mit Fehlerdatei. Zuerst Mitglieder (mit Eltern-Zuordnung, Einladungen) und Kader.
2. **Weitere Bereiche:** Termine (Trainings, Spiele, Platzbelegung), Sponsoren, Plätze, Ausrüstung.
3. **Exporte:** Mitglieder, Kader, Termine, Anwesenheit, Kasse, Archiv; Gesamtexport (Admin); „Meine Daten“ für jede Person (Eltern für Kinder); jeder Export im Protokoll.
4. **Kasse:** Beitragsarten, Zuordnung, offene Posten, Haushaltsplan, Buchungen (CSV/Excel).
5. **Einrichtung:** Schritt „Daten übernehmen“ im Vereinsassistenten (nach E2).

Grenzen: 5 MB, 5000 Zeilen. Rechte nur serverseitig; Tests mit echten Beispieldateien (Windows-1252, Excel mit mehreren Blättern, Dubletten, Fehlerzeilen); Rückgängig läuft über das Archiv. Hell/dunkel, Übersetzungen, Hilfe.

## Abnahme
Bilder der sechs Schritte, kurze Liste erledigt / abweichend / offen.
