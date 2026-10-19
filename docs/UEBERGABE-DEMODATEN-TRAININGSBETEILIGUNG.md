# Übergabeprompt: Demodaten – Trainingsbeteiligung für alle Mannschaften (Paket DEMODATEN-TRAININGSBETEILIGUNG)

Zum Einfügen in die Umsetzungssitzung. Gemeinsam mit oder direkt nach DEMODATEN-AUSBAU umsetzen (gleicher Seed).

---

Paket **DEMODATEN-TRAININGSBETEILIGUNG** (`docs/PAKETE.md`, gleichnamige Zeile): Heute wird die Anwesenheit vergangener Trainings nur für die **B-Jugend** erfasst (`recordedTrainings` filtert auf `teamIds.b1`, Trefferquote über `ATTENDANCE_RATE[ordered.indexOf(m) % 4]` in `packages/db/src/seed/index.ts`, ca. Zeilen 1026–1135). Alle anderen Mannschaften haben keine Anwesenheitsdaten, daher sind Trainingsquote, Kader-Beteiligung, Farbstufen im Aufstellungsplaner, Spielerprofile und Statistik dort leer oder unplausibel.

## Aufgaben (jeweils eigener Commit, `pnpm db:reset` und `pnpm check`)
1. **Erfassen für alle Mannschaften:** alle vergangenen, nicht abgesagten Trainings der letzten 6 Wochen mit `attended` und `attendance_recorded_at`; je Mannschaft 1–2 Trainings bewusst nicht erfasst (bei B1 und C1 mindestens eines offen).
2. **Quoten je Mannschaft** plausibel und verschieden (Bambini/E/F ca. 80–90 %, D–A ca. 70–85 %, Frauen ca. 70 %, 1. ca. 75 %, 2. ca. 60 %, Alte Herren ca. 55 %; Hallentraining leicht niedriger).
3. **Spielerebene:** fester Anwesenheitstyp je Person (nicht mehr nach Kaderreihenfolge); bei Mannschaften ab 12 Spielern alle drei Farbstufen (gut ≥ 75 %, mittel 50–74 %, niedrig < 50 %), einzelne Verläufe (Einbruch nach Verletzung, Neuzugang).
4. **Konsistenz:** `attended = true` nur bei Zusage; nichts bei Abwesenheit, Absage, offener Antwort, abgesagten oder zukünftigen Terminen; Gastspieler nur für ihren Einsatz; Trainer nicht in der Spielerquote; Spiele nur mit Spielbericht.
5. **Demo-Logins prüfen:** Spieler Max Becker (B1), Eltern Julia Neumann (E1 und F1), Trainer Max Mustermann (B1 und C1, Spieler 2. Mannschaft) zeigen sinnvolle Anwesenheit in Team-Kopf, Kader-Tab, Aufstellungsplaner, Spielerprofil, persönlicher Statistik, Team-Statistik, Abteilungsübersicht. B-Jugend-Verhalten bleibt erkennbar erhalten.
6. **Tests und Doku:** `seed.test.ts` (vier erfasste Trainings je Mannschaft in vier Wochen, Quotenbereiche, drei Farbstufen, `attended` nur bei Zusage, `attendance_recorded_at` genau bei erfassten, 1–2 offene je Mannschaft); `docs/DEMODATEN.md`; Hilfe; Verkaufs-PDF neu.

Regeln: reproduzierbar (fester Startwert), relativ zum heutigen Tag, `club_id` überall, `db:reset` unter einer Minute.

## Abnahme
Übersichtsbild der Trainingsquote und des Kader-Tabs für mindestens drei Mannschaften, Tabelle Quote je Mannschaft, kurze Liste erledigt / abweichend / offen.
