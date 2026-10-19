# Übergabeprompt: Antwort und Teilnehmer in allen Terminlisten (Paket TERMIN-ANTWORT-UND-TEILNEHMER)

Zum Einfügen in die Umsetzungssitzung. Voraussetzung: BEDIENUNG-STABILISIEREN und TEILNAHME-UND-KONTEXT sind umgesetzt (gemeinsames Absageformular, Vorrangregel), PILOT-SICHERHEIT für die Outbox.

---

Paket **TERMIN-ANTWORT-UND-TEILNEHMER** (`docs/PAKETE.md`, gleichnamige Zeile): Überall, wo Termine stehen, gibt es eine **gemeinsame Terminkarte** mit drei Antwortknöpfen (✓ Zusage, ? Vielleicht, ✕ Absage) und aufklappbarer Teilnehmerliste; im Home-Hero stehen die Knöpfe mit Symbol und Wort im Plakat. **Der Entwurf ist verbindlich: `docs/design/anstoss/ZusageTeilnehmer.html`** (Reiter Terminkarte, Teilnehmerliste, Home-Hero, Orte in der App; Internet für die Schriften nötig). Setze Maße, Reihenfolge, Texte und Zustände so ähnlich wie möglich um; Abweichungen in der Paketzeile begründen.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile lesen, Entwurf im Browser öffnen und alle Reiter durchklicken (Knöpfe, Pfeil, Zustände sind bedienbar).
3. Vorhandenes lesen: `components/events.tsx` (`EventRow`, `AnswerButtons`, `ResponseControls`, `useRespond`, `ReasonForm`), `components/home.tsx` (`PosterSlide`, `MatchCard`, `WeekCard`), `components/attendance-bar.tsx`, `components/squad-sheet.tsx`, Verwender von `EventRow` (termine, calendar, club-calendar, club-events, events/index, events/archive). Prüfen, was der Server pro Termin schon liefert (eigene Antwort, Frist, Zahlen, `responsesVisible`).

## Aufgaben (jeweils eigener Commit, `pnpm check`, Browserprüfung hell und dunkel)
1. **Gemeinsame Karte:** `EventRow` überarbeiten (kein zweites Bauteil): Datumsblock, Titelzeilen, Statuszeile als Text, drei runde Knöpfe 38 px mit Tippfläche 44 px, Summenzeile mit Balken, Legende und Pfeil; alle Zustände (offen, beantwortet, gesperrt, Trainerteam, automatisch, abwesend, abgesagt, vergangen, ohne Antwortmodell).
2. **Teilnehmerliste:** Aufklappen im Fluss, Gruppen (Zusagen, Vielleicht, Offen, Absagen, darunter Abwesend), je Gruppe höchstens 4 Namen, „Alle anzeigen“ öffnet das Kader-Pop-up, eigene Zeile markiert, Trainerteam mit Gründen und Korrektur, nicht freigegeben mit Hinweis, Laden erst beim Aufklappen mit Zwischenspeicher.
3. **Orte:** Termine, Start-Wochenkarte, Team „Nächster Termin“, Kalender, Vereinskalender und -veranstaltungen, Archiv (nur Anzeige), Eltern mit Kind-Etikett.
4. **Home-Hero:** Antwortblock mit drei Knöpfen (Symbol und Wort), Summenzeile, aufklappbares dunkles Glasfeld mit Gruppenzeilen und Avatar-Stapeln, Textlink „Spiel ansehen ›“, Wischpfeil nach oben gerückt, Eltern „FÜR <KIND>“, Trainer ohne Knöpfe, gesperrter Zustand.
5. **Desktop:** Terminliste als Tabelle mit Spalten Meine Antwort (Chips mit Wort) und Teilnehmer, Aufklappen über die volle Breite mit vier Gruppen, Tastaturkürzel.
6. **Abschluss:** Hilfe, Übersetzungen, Kontrast (`hell-kontrast.mjs`), `FUNKTIONEN.md`.

Rechte nur serverseitig (Gründe nur für Berechtigte, keine Namen bei nicht freigegebenen Listen). Keine zwei unabhängig scrollenden Bereiche. Das Absageformular und die Fehleranzeige kommen aus dem gemeinsamen Formular (U07), nicht neu bauen.

## Abnahme
Bilder 390 und 1440 px, hell und dunkel, je Ort und Zustand neben dem Entwurf (zusammengefasst); API-Tests zur Sichtbarkeit; Browserskript mit allen Zuständen aus dem Entwurf; kurze Liste erledigt / abweichend / offen.
