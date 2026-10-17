# Übergabeprompt: Kader-Pop-up (Paket KP)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **KP** (`docs/PAKETE.md`, Zeile KP) macht aus der kompakten Zu-/Absage-Übersicht (Balken mit Legende) eine antippbare Fläche, die die **Kaderliste des Termins als Pop-up** öffnet. Es baut auf Paket **TH** auf (Balken im Hero und im Home-Plakat, Freigabe `responsesVisible`). Alle Entscheidungen des Vorstands stehen in der Zeile.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **KP** vollständig lesen (inkl. „Prüfen bei der Umsetzung“); Zeile **TH** für die Freigabe.
3. Vorlagen im Browser öffnen: `docs/design/anstoss/KaderPopup.html` (Internet für die Schriften nötig). Dort: Auslöser (Hero, Home, Team), Pop-up für Spieler, Eltern, Trainer und vergangene Termine, Varianten „Weg zum Spiel“ (**entschieden: Startseite Text-Link „Zum Spiel ›“, Team-Reiter unverändert**).
4. Vorhandenes lesen: `AttendanceBar` (`components/team.tsx`), `components/event-hero.tsx`, `HomePoster` (`components/home.tsx`), `(tabs)/team.tsx`, `Sheet` in `components/ui.tsx`, `events/[id].tsx` (Teilnehmerübersicht, `participants`).

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Auslöser:** `AttendanceBar` bekommt eine Antipp-Eigenschaft (Balken + Legende = eine Fläche ≥ 44 pt, „Kader ›“ in Akzent); ohne Freigabe für Spieler/Eltern fehlt der Auslöser.
2. **Pop-up-Baustein** `SquadSheet` nach der Vorlage: Kopf, Balken mit Legende, Gruppen in der Reihenfolge Zusagen, Unsicher, Offen, Absagen (+ Abwesend, falls geliefert), Zeilen, eigene Zeile hervorgehoben, Fuß „Termin öffnen“. Teilnehmer beim Öffnen über den Termin-Detail-Aufruf nachladen (Ladeplatzhalter, Fehler mit „Erneut versuchen“, Vorab-Laden beim Berühren). Kein neuer Endpunkt, es sei denn für „Abwesend“ nötig.
3. **Home-Plakat:** Text-Link „Zum Spiel ›“ rechts oben (nur Hinweis, die ganze Kachel bleibt antippbar), runder Wischpfeil bleibt, Beschriftung links einzeilig. **Team-Reiter:** nichts ergänzen.
4. **Nur Trainerteam:** Gründe und bei vergangenen Terminen „da/fehlte“; Spieler/Eltern sehen beides nicht. Rechte serverseitig.
5. **Aufräumen:** Hilfe, `docs/FUNKTIONEN.md`, Übersetzungen, Browserprüfung `scripts/e2e/kader-popup.mjs`.

## Abnahme
Pop-up aus Termin-Hero, Home-Plakat und Team-Reiter; Reihenfolge der Gruppen stimmt; keine Filter; eigene Zeile bzw. Kinder hervorgehoben; Trainer sieht Gründe, Spieler nicht; ohne Freigabe kein Auslöser und keine Liste; „Zum Spiel ›“ führt zum Termin. Bilder neben die Vorlagen legen, Abweichungen benennen; am Ende kurze Liste erledigt / bewusst abweichend / offen.
