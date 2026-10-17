# Übergabeprompt: Hell-Darstellung vollständig prüfen (Paket LH2)

Zum Einfügen in die Umsetzungssitzung.

---

Der helle Stil (Paket **LH**) ist umgesetzt und in `docs/PAKETE.md` als ✅ geführt. Das offene Paket **LH2** (eigene Zeile direkt unter LH) ist die Nachprüfung: die **gesamte App** wird noch einmal auf **fehlende oder fehlerhafte Hell-Darstellungen** geprüft, und alles Fehlende wird ergänzt.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeilen **LH** (Punkte 1–7, umgesetzt) und **LH2** (offen), `docs/DESIGN-ANSTOSS.md` (Abschnitt „Heller Stil“, „Hero-Auslauf, hell und dunkel gleich“), `docs/FARBKONZEPT.md`.
3. Vorhandene Prüfskripte: `scripts/e2e/review-live.mjs`, `review-anstoss.mjs`, `review-optik.mjs`, `review-rollen.mjs`; hell aufnehmen mit `SCHEME=light pnpm browser-check <skript> --no-build`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Suchen:** feste Farben außerhalb des Themes in `apps/mobile/src` (Hex, `rgba`, `white`/`black`, `#fff`/`#000`, feste Textfarben); Liste anlegen, je Fund entscheiden (Theme-Wert oder bewusst fest, nur auf Hero/Plakat/Kopfband/Spielfeld).
2. **Durchgehen:** alle Routen je Rolle hell und dunkel aufnehmen (ein Skript, das die Routen aus den App-Dateien ableitet statt von Hand zu klicken), Paare vergleichen; Kontrast, Ränder, Trennlinien, Symbole, Statusfarben, nichts weiß auf weiß.
3. **Sonderfälle** nach der Liste in LH2 (c): Zustände, Fenster, Dialoge, Toasts, Menüs, Zeitwalze/Datum, Tastatur, Diagramme, Kopfbänder, Hilfe, Logos, Systemleisten, Login.
4. **Alle Vereinsfarben:** hell je Farbe für Home, Team, eine Liste; Kontrastskript.
5. **Ergänzen:** jede Lücke beheben; wo kein Entwurf existiert, nach den Regeln aus LH Punkt 1 ableiten und im Bericht als „abgeleitet“ kennzeichnen; **Spielfeld, Hero, Plakat und Kopfbänder bleiben in beiden Stilen farbig**.
6. **Dauerhaft:** Prüfung auf neue feste Farben in `pnpm check`, falls machbar; `CLAUDE.md` ergänzen: neue Oberflächen immer hell und dunkel prüfen.

## Bericht
Liste der Lücken (Bildschirm, Problem, behoben ja/nein), je Bereich ein Bildpaar hell/dunkel (wenige, zusammengefasst, nicht jedes Bild einzeln), „bewusst fest gelassen“ mit Begründung, offene Punkte.
