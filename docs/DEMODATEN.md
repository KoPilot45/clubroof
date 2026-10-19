# Demodaten: SV Grün-Weiß Musterstadt

Der Demoverein dient für Entwicklung, Tests und Vorführungen. Alle Personen, Vereine und Firmen sind frei
erfunden; E-Mail-Adressen verwenden die reservierte Domain `.example`.

Erzeugt wird er mit `pnpm db:reset` (lokale Datenbank zurücksetzen, Migrationen, Demodaten) oder mit
`pnpm db:seed` (nur Demoverein neu anlegen). Quelle: [`packages/db/src/seed`](../packages/db/src/seed).

## Eigenschaften

- **Immer aktuell:** Alle Termine werden relativ zum heutigen Tag erzeugt (6 Wochen zurück, 7 Wochen voraus),
  vergangene Spiele haben Ergebnisse.
- **Reproduzierbar:** Zufallswerte (Namen, Zusagen, Ergebnisse) stammen aus einem festen Startwert.
- **Wiederholbar:** Ein erneuter Lauf ersetzt den Demoverein vollständig, andere Daten bleiben unberührt.

## Umfang

| Bereich           | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verein            | SV Grün-Weiß Musterstadt 1920 e.V., Vereinsfarbe Grün, Bereiche Senioren, Alte Herren, Frauen & Mädchen, Jugend                                                                                                                                                                                                                                                                                                                                                                                                              |
| Anlagen           | Rasenplatz (Platz 1), Kunstrasen, Sporthalle, Vereinsheim                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Mannschaften      | 1. Mannschaft, 2. Mannschaft, Alte Herren, Frauen, A- bis F-Jugend, Bambini (11 Teams)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Personen          | rund 320: Spielerinnen und Spieler, Trainer, Eltern, Funktionäre, fördernde Mitglieder; dazu 6 passive und 3 ausgetretene Mitglieder                                                                                                                                                                                                                                                                                                                                                                                         |
| Teilnahme-Modelle | automatische Zusage (Senioren), aktive Zu-/Absage (Frauen, Jugend), automatische Zusage auch bei den Alten Herren (früher „nur Abwesenheiten“)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Termine           | Trainings, Spiele, Spielfeste, Vorstandssitzung, Jahreshauptversammlung, Arbeitseinsatz, Hallenturnier, Weihnachtsfeier                                                                                                                                                                                                                                                                                                                                                                                                      |
| Besonderheiten    | Gespielte Partien mit Aufstellung und Spielbericht (Tore, Vorlagen, Karten), Spielerbewegungen zum Saisonstart (Zugänge, Jahrgangswechsel); Vereinsnews der Jugendleitung wartet auf Freigabe, B1-Trainer veröffentlicht Team-News selbst, C1-Entwurf; Kunstrasen am kommenden Donnerstag gesperrt (Sperrung im Platzplan, Trainings abgesagt), Gastspieler aus C-Jugend und 2. Mannschaft, Spielerbörse mit offenem Bedarf (A-Jugend, 2. Mannschaft) und Angeboten (C-Jugend, Alte Herren), Verletzungen, Urlaub, Rotsperre |
| Kommunikation     | 9 News (eine wartet auf Freigabe), 3 Umfragen mit Stimmen, Benachrichtigungen je Demo-Login                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Ehrenamt          | Helferschichten für Hallenturnier, Arbeitseinsatz und Jahreshauptversammlung; Programme und erste Teilnehmer bei den Vereinsveranstaltungen                                                                                                                                                                                                                                                                                                                                                                                  |
| Finanzen          | Mannschaftskassen 1., 2. und B-Jugend mit Strafen, Getränken und Einzahlungen; Vereinskasse mit Girokonto, Barkasse, Tagesgeld, Kategorien, Kostenstellen und Beispielbuchungen                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Dokumente | Satzung (Auszug), Beitragsordnung, Aufnahmeantrag, Hygienekonzept, Protokoll der Jahreshauptversammlung und weitere – kleine PDFs mit eigenem Inhalt (`apps/api/src/storage/demo-documents.ts`); übrige liefern eine Platzhalter-PDF |
| Module            | Forum, Trainingsplanung und Fundbüro sind „verfügbar, aber nicht aktiviert“ (für das Update-Center)                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Ausbau (Paket DEMODATEN-AUSBAU)

Der Ausbau steckt im Seed-Schalter `extended` (Standard: an für `pnpm db:reset`; die API-Tests laden mit `extended: false`, weil sie von einer dünnen Vereinskasse ausgehen). Dateien: `packages/db/src/seed/ausbau-kasse.ts`, `ausbau-inhalte.ts`, eigener Zufallsgenerator, damit die übrigen Demodaten unverändert bleiben.

| Bereich       | Inhalt                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vereinskasse  | 24 Monate Buchungen, Beitragsarten (u. a. Familie, Passiv) mit Forderungen und Zahlungen (Quote ca. 70 %), Haushaltsplan mit Soll-Ist (eine Kategorie überzogen, eine unter Plan) |
| Rücklagen     | Töpfe mit Ziel und Zuführungen/Entnahmen, Inventar mit Werten, Steuerdaten, Spenden mit fortlaufenden Bescheinigungen (`JJJJ-NNN`), zwei Kassenprüfungen                           |
| Sponsoren     | 9 Sponsoren mit Stufe im Text und Laufzeiten (einer abgelaufen, einer geplant), je Sponsor ein Logo                                                                               |
| Archiv        | Einträge zum Wiederherstellen: Wiki-Artikel, Übung, Aufgabe, abgelaufener Sponsor, Dokument                                                                                        |
| Bilder        | `node scripts/demo-bilder.mjs` zeichnet Sponsorenlogos und News-Bilder als PNG nach `apps/api/assets/` (Auslieferung unter `/brand/demo-…png`); das Wappen ist eine einzige Variante |
| Rolle         | Eigene Beispielrolle „Platzwart Nord“ (Rollenverwaltung), zugewiesen an den Platzwart                                                                                              |
| Beispieldateien | `docs/demo-dateien/`: `mitglieder.csv` (30 Zeilen mit Dublette und Fehlerzeilen), `kader-c-jugend.csv`, `beitragsarten.csv`, `haushaltsplan.csv`, `spielplan.csv` (nachgebaut, kein echtes DFBnet-Format); ein API-Test liest alle ein |

Noch nicht ausgebaut: Familien/Altersverteilung (Bestand von rund 320 Personen unverändert), Saison mit Hin- und Rückrunde und Pokal, weitere News/Umfragen/Wiki-Artikel, Veranstaltungen im Jahreslauf, Mannschaftsillustrationen und Avatare, Download der Beispieldateien in der Hilfe.

## Demo-Logins

Alle Demo-Logins haben das Passwort `clubroof-demo`. Auf der Anmeldeseite (Entwicklungsmodus) füllen die Buttons Admin, Trainer, Spieler, Eltern, Vorstand und Mitglied die Daten aus.

| E-Mail                            | Person          | Perspektive                                                            |
| --------------------------------- | --------------- | ---------------------------------------------------------------------- |
| `admin@sv-gruen-weiss.example`    | Daniel Schäfer  | Fulladmin                                                              |
| `vorstand@sv-gruen-weiss.example` | Sandra Hoffmann | 1. Vorsitzende                                                         |
| `trainer@sv-gruen-weiss.example`  | Max Mustermann  | Trainer B- und C-Jugend, Spieler 2. Mannschaft                         |
| `spieler@sv-gruen-weiss.example`  | Max Becker      | Spieler B-Jugend (Nr. 14)                                              |
| `eltern@sv-gruen-weiss.example`   | Julia Neumann   | Mutter von Leon (E-Jugend) und Mia (F-Jugend), Co-Trainerin E-Jugend   |
| `kasse@sv-gruen-weiss.example`    | Petra Schulz    | Kassenwartin (Mannschaft) und Kassenwart (Verein)                      |
| `mitglied@sv-gruen-weiss.example` | Heike Brandt    | Vereinsmitglied ohne Amt und Mannschaft, zusätzlich Kassenprüfer        |

## Optionale Module im Demoverein

- **Update-Center:** Das Mini-Forum wartet auf „Einrichten“ (Admin → Verwaltung → Module); danach erscheint ein angeheftetes Thema zur Weihnachtsfeier.
- **Trainingsplanung:** Übungsbibliothek mit 8 Übungen, Plan fürs nächste B1-Training („Gegenpressing nach Ballverlust“).
- **Anlage & Material:** Kabinen 1–4 (heutige Trainings zugeteilt), Schlüssel und Material (Trainer hat den Vereinsheim-Schlüssel), zwei Schadensmeldungen.
- **Schiedsrichter:** drei Vereinsschiedsrichter (Max Mustermann, Uwe Krüger und eine weitere Person) mit Lizenz gültig / läuft ab / abgelaufen, Soll des Verbands 4 aktive Schiedsrichter und 5 Pflichteinsätze, eigene Einsätze (Max Mustermann hat einen kommenden).
- **Fundbüro & Marktplatz, Vereinswissen:** je einige Einträge; Kalender-Abo unter Mehr.

## Ausprobieren ohne Demodaten

- **Einladungen, Passwort vergessen:** Die Mails landen lokal im Test-Postfach <http://localhost:8025>.
- **CSV-Import:** Verwaltung → CSV-Import; die Vorlage lässt sich im Browser herunterladen.
  Eine erneute Übernahme derselben Datei erkennt alle Zeilen als Dublette.
- **Ersteinrichtung:** Nur auf einer leeren Datenbank. Dafür eine zweite Datenbank anlegen, Migrationen
  ausführen und die API mit `DATABASE_URL=…/clubroof_leer SETUP_TOKEN=beliebiger-code` starten – die App
  öffnet dann statt der Anmeldung den Einrichtungsassistenten.

## Automatische Prüfungen

`packages/db/src/seed/seed.test.ts` prüft unter anderem:

- alle Datensätze gehören zum selben Verein (`club_id`)
- jede Mannschaft hat Spieler und Verantwortliche
- Teilnehmer gehören zur Mannschaft oder sind als Gastspieler gekennzeichnet
- Kinder bis einschließlich C-Jugend haben einen Elternzugang
- kein Platz ist doppelt belegt
- abwesende Spieler sind für Termine in ihrem Abwesenheitszeitraum abgesagt
- Kassenstand der B-Jugend: 512,35 € (wie im Mockup der Verkaufsmappe)
