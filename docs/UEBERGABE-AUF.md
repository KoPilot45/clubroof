# Übergabeprompt: Aufstellungsplaner (Paket AUF)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **AUF** (`docs/PAKETE.md`, Zeile AUF) ersetzt die Listen-Aufstellung durch einen **Planer mit Spielfeld** (7er, 9er, 11er, viele Formationen, Drag & Drop, Bank ohne feste Zahl,
Trainingsbeteiligung der letzten 4 Wochen). Alle Entscheidungen des Vorstands stehen in der Zeile; der klickbare Entwurf ist die Vorgabe für Aufbau, Maße und Verhalten.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **AUF** (vollständig lesen, inkl. „Offen“); `docs/FUNKTIONEN.md` (Zeile Kader/Aufstellung); `docs/DESIGN-ANSTOSS.md`.
3. Entwurf im Browser öffnen: `docs/design/anstoss/Aufstellung.html` (Internet für die Schriften nötig). Dort steht das Verhalten im Quelltext (Formationen `F(...)`, Verschieben `move(...)`, Ziehen/Tippen mit Zeiger-Ereignissen).
4. Vorhandenes lesen: `apps/mobile/src/app/match/[id]/lineup.tsx`, `contract.ts` (`MatchSheet`, `SaveLineupInput`), Tabellen `match_lineups`, `events`, `teams`, Service/Route der Aufstellung, Test in `api.test.ts`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Daten:** Migration und Seed (`lineup_size`, `lineup_formation`, `match_lineups.slot`, `teams.lineup_visible` Standard aus; Seed mit Aufstellung 4-4-2 und Entwurf 4-3-3, Anwesenheiten so, dass alle Farbstufen vorkommen). `pnpm db:reset` muss laufen.
2. **`packages/core`:** Formationsliste (7er 8, 9er 9, 11er 14) mit Reihen und Positionskürzeln, Standard-Spielform je Altersklasse (nach Bestätigung der offenen Punkte), Konstanten und Typen; Test, dass die Positionszahl je Spielform stimmt.
3. **Vertrag, Service, Route:** Formation, Slots, Beteiligung (4 Wochen, nur Trainerteam), Sichtbarkeit für Spieler/Eltern (`veröffentlicht` **und** `lineupVisible`), Validierung (jeder Slot und jede Person einmal, Abgesagte nicht aufstellbar, Bank unbegrenzt). Tests in `api.test.ts` wie in der Paketzeile.
4. **Bausteine:** Spielfeld, Spielerscheibe, Wischleiste, Kaderkarte, Formationschips; Farben nur aus dem Theme (Feldgrün und Linien als Tokens in `packages/design-tokens`). Zeiger-Ereignisse, **kein** HTML5-Drag. Seitliches Wischen in den Leisten vs. senkrechtes Ziehen zum Heraushaben (siehe Paketzeile), Tausch, zurück in die Leiste, Antippen-Alternative, Beschriftungen, Haptik (Paket LF), „Bewegung reduzieren“.
5. **Planer-Bildschirm** nach dem Entwurf (Reihenfolge a–h in der Paketzeile; die Spielkarte oben ist ein Hero-Block mit **Waben** über den vorhandenen Baustein `Honeycomb`), Kader im Detail mit Antippen → Sprung zum Feld, Buttons unter der Kaderleiste, Dialog beim Verlassen mit ungespeicherten Änderungen.
6. **Ansicht für Spieler/Eltern** (schreibgeschützt, ohne Beteiligung) und Schalter „Aufstellung für Spieler und Eltern sichtbar“ in „Mannschaft bearbeiten“.
7. **Aufräumen:** Hilfe (`help-content.ts`), `docs/FUNKTIONEN.md`, Übersetzungen, Browserprüfung `scripts/e2e/aufstellung.mjs`.

**Abstände:** Die Abstände, Radien und Überschriften des Entwurfs sind nicht maßgeblich; es gelten die App-Bausteine (`Section`, Hero 28, Seitenrand). Nur die Bühne (Spielkarte bis Buttons) ist bewusst kompakt, damit bei 390 × 844 Spielfeld, Bank und Kaderleiste zusammen sichtbar bleiben. Details in der Paketzeile.

## Abnahme
Planer in 7er, 9er und 11er mit mindestens drei Formationen je Form; Spielfeld, Bank und Kaderleiste gleichzeitig sichtbar bei 390 × 844; Bank wächst und hat immer einen freien Platz; kein Spieler doppelt; Tausch und Zurücknehmen funktionieren; Spieler/Eltern sehen die Aufstellung nur bei veröffentlicht + Schalter an und ohne Beteiligungswerte.
Bilder neben den Entwurf legen, Abweichungen benennen. **Touch am Gerät prüfen** (Wischen der Leisten vs. Ziehen), Ergebnis ehrlich berichten; am Ende kurze Liste erledigt / bewusst abweichend / offen.
