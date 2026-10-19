# Übergabeprompt: Demodaten ausbauen (Paket DEMODATEN-AUSBAU)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **DEMODATEN-AUSBAU** (`docs/PAKETE.md`, gleichnamige Zeile) macht den Demoverein detaillierter und vereinsnäher. **Ein** Verein (SV Grün-Weiß Musterstadt 1920 e.V.), Musterstadt und die erfundenen Gegner bleiben, Bilder werden selbst erzeugt (keine Fotos Dritter).

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile lesen; `docs/DEMODATEN.md`; Seed `packages/db/src/seed/{data,index,seed.test}.ts`. Prüfen, wie Bilder und Dateien gespeichert werden (Uploads, Platzhalter-PDF), und welche Tabellen für Haushaltsplan, Rücklagen, Inventar, Spenden, Kassenprüfung, Beiträge, Archiv, Sponsoren (Stufen, Laufzeiten) gelten.
3. Demo-Logins, Personen der Logins und **B-Jugend-Kassenstand 512,35 €** unverändert lassen.

## Aufgaben (jeweils eigener Commit, `pnpm db:reset` und `pnpm check`)
1. **Personen und Familien:** Altersverteilung, Familien mit Geschwistern und Doppelrollen, Neuzugänge und Austritte, Profile.
2. **Saison und Spiele:** Hin- und Rückrunde, Wettbewerbe (Liga, Pokal, Testspiel), Derby, Spielformen, Spielberichte mit Aufstellung, Toren, Karten, Wechseln; Abwesenheitsgründe; Sichtbarkeiten je Mannschaft verschieden.
3. **Vereinskasse:** 24 Monate Buchungen, Beitragsarten und Forderungen mit offenen Posten, Haushaltsplan mit Soll-Ist, Rücklagen, Inventar, Spenden mit Bescheinigungen, Kassenprüfung, Steuerdaten.
4. **Inhalte:** News, Umfragen, Aushänge, Wiki, **Dokumente als echte kleine PDFs**, Veranstaltungen im Jahreslauf mit Helferplänen, Sponsoren (Stufen, Laufzeiten), Archiv-Einträge.
5. **Demo-Bilder:** per Skript im Repo erzeugen (SVG/PNG, reproduzierbar): Sponsorenlogos und -banner, News-Bilder, Wappen hell und dunkel, Mannschaftsillustrationen, Avatare.
6. **Beispieldateien** unter `docs/demo-dateien/` und in der Hilfe: Mitglieder-, Kader-, Spielplan-CSV (nachgebaut, nicht als echtes DFBnet-Format ausgeben), Beitragsarten, Haushaltsplan.
7. **Tests und Doku:** `seed.test.ts` erweitern (Familien, Summen, Quote, Plan, Rücklagen, Inventar, Archiv, Sponsoren, Sichtbarkeiten, keine Doppelbelegung), `DEMODATEN.md`, Hilfe.

Regeln: alles relativ zum heutigen Tag, fester Startwert, `club_id` überall, `db:reset` unter einer Minute, Summen konsistent. Sobald ROLLEN-VERWALTUNG umgesetzt ist: eine eigene Beispielrolle (Platzwart Nord).

## Abnahme
Übersichtsbilder je Bereich (Home, Team, Kasse mit Verlauf, Sponsoren, Archiv), Zahlenliste, kurze Liste erledigt / abweichend / offen. Danach Verkaufs-PDF neu erzeugen (`scripts/pdf-bericht.mjs`).
