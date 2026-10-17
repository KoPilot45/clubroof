# Übergabeprompt: Termin-Hero und Helfer-Wischleiste (Paket TH)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **TH** (`docs/PAKETE.md`, Zeile TH) hat zwei kleine Überarbeitungen: **(A)** Das Termin-Detail bekommt **einen** Hero statt zwei, **(B)** die Vereinsseite bekommt eine Wischleiste **„Helfer gesucht“**. Alle Entscheidungen stehen in der Zeile.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **TH**; Entwurf im Browser öffnen: `docs/design/anstoss/TerminHeroHelfer.html` (Internet für die Schriften nötig).
3. Vorhandenes lesen: `app/events/[id].tsx` (heute `Scoreboard` + `HeroCard`), `components/scoreboard.tsx`, `components/honeycomb.tsx`, `app/(tabs)/verein.tsx`, `app/helpers.tsx`, `components/helpers.tsx`, `GET /helpers` (`HelperEvent`).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **EventHero** (neuer Baustein): Spiel, Nicht-Spiel, abgesagt, vergangen, mit Ortszeile und „Route ›“ in derselben Karte; Beschreibung als eigene Karte darunter; „Eingeladen“ als kleine Zeile im Hero; `Scoreboard` entfernen, wenn nicht mehr benutzt. Waben über den vorhandenen Baustein.
2. **Zu- und Absagen im Hero** (Spiel und Training): `AttendanceBar` in dunkler Fläche unter der Ortszeile; neue Mannschaftseinstellung `responsesVisible` (Standard an, Schalter in „Mannschaft bearbeiten“), Server liefert Zahlen/Namensgruppen an Spieler und Eltern nur bei „an“, Trainerteam immer; Test in `api.test.ts`. Der Balken kommt auch ins **Home-Plakat** (je Spiel-Folie, kompakt, ohne eigene Fläche); die **Beschriftung** wird überall zu „Zusagen · Unsicher · Absagen · offen“ (Zahl davor, Singular korrekt) und kommt einmal aus `AttendanceBar`. Entschieden: Bei „aus“ entfällt auch die Teilnehmerliste für Spieler und Eltern (eigene Antwort und die der Kinder bleiben); das Trainerteam sieht alles immer.
3. **Helfer-Wischleiste** auf der Vereinsseite unter den Kacheln „Veranstaltungen": **kompakte** Karten (Datum, Titel, „in n Tagen“, „n Helfer fehlen“), Einrasten, Pager-Punkte, kein Auto-Wechsel, Antippen öffnet die Helfer-Detailseite der Veranstaltung (`/helpers?event=<id>`); Abschnitt nur bei offenen Schichten und aktivem Modul. Daten aus `GET /helpers`, kein neuer Endpunkt.
4. **Eigene Antwort nach Fristablauf sichtbar lassen** (Teil C der Paketzeile): Status-Chip mit Schloss „Frist abgelaufen“, Grund, Datum der Frist, keine Knöpfe; je Kind; Browserprüfung mit abgelaufener Frist.
5. **Aufräumen:** Hilfe, `docs/FUNKTIONEN.md`, Übersetzungen, Browserprüfung `scripts/e2e/termin-hero.mjs`.

## Abnahme
Termin-Detail für Spiel, Training, abgesagten Termin und Vereinstermin mit genau einem Hero; Vereinsseite mit 0, 1 und mehreren offenen Veranstaltungen; Abstände und Maße aus den App-Bausteinen (Hero Radius 28, Innenabstand 18). Bilder neben den Entwurf legen, Abweichungen benennen; am Ende kurze Liste erledigt / bewusst abweichend / offen.
