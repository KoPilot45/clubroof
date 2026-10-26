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
| Bilder        | `node scripts/demo-bilder.mjs` zeichnet Sponsorenlogos, News- und Mannschaftsbilder als PNG nach `apps/api/assets/` (Auslieferung unter `/brand/demo-…`); die gelieferten WebP-Bilder (20 Profilbilder, Wappen `demo-wappen.webp`, 150 × 150 px, freigestellt) liegen dort ebenfalls und werden vom Skript nie berührt |
| Rolle         | Eigene Beispielrolle „Platzwart Nord“ (Rollenverwaltung), zugewiesen an den Platzwart                                                                                              |
| Beispieldateien | `apps/api/assets/beispiele/` (Download in der Hilfe unter `/beispieldateien/<name>.csv`): `mitglieder.csv` (30 Zeilen mit Dublette und Fehlerzeilen), `kader-c-jugend.csv`, `beitragsarten.csv`, `haushaltsplan.csv`, `spielplan.csv` (nachgebaut, kein echtes DFBnet-Format); ein API-Test liest alle ein |

### Weiterer Ausbau (20.10.2026)

| Bereich | Inhalt |
| --- | --- |
| Personen und Familien (`ausbau-personen.ts`) | rund 390 Personen: Geschwister in mehreren Mannschaften (11 Familien, davon zwei mit drei Kindern), zweite Elternteile bei 20 Kindern, Doppelrollen (Mutter spielt bei den Frauen und hat ein Bambini-Kind, Vater spielt bei den Alten Herren, Vater ist Co-Trainer der D-Jugend, A-Jugend-Spielerin hilft bei der F-Jugend), 14 ältere Mitglieder (60 bis 84 Jahre, teils passiv), 7 Neuzugänge der letzten 50 Tage mit Zugangsvermerk, 4 Abgänge mit Enddatum, Sichtbarkeit der Kontaktdaten gemischt, alle Personen mit Profilbild (siehe „Bilder“ unten) |
| Saison und Spiele | fünf zusätzliche Spielwochen vor dem Fenster (Hinrunde ab August) mit Testspielen (`friendly`), Kreispokal (`cup`) für fünf Mannschaften, Stadtderby gegen den SV Musterstadt-Nord (Hinspiel gespielt, Rückspiel in der 1. Mannschaft und B-Jugend offen), einzelne rote Karten, Spielform je Altersklasse (7er, 9er, 11er), zehn weitere Abwesenheiten mit Anlass |
| Sichtbarkeiten je Mannschaft | 1. Mannschaft: Namen sichtbar, kein „Vielleicht“, Erinnerung 24 h; 2. Mannschaft: nur Trainerteam; Alte Herren und D-Jugend: Namen; Frauen: Grund Pflicht, Gründe für die Mannschaft; A-Jugend: Aufstellung sichtbar, Grund Pflicht; Bambini: kein „Vielleicht“. B-, C-, E- und F-Jugend (Demo-Logins) bleiben im Standard |
| Inhalte (`ausbau-jahreslauf.ts`) | 8 weitere News (mit Mannschaftsbildern), 4 weitere Umfragen (eine abgelaufen) mit rund 190 Stimmen, 8 weitere Wiki-Artikel in vier Kategorien, 4 weitere Aushänge, 9 Vereinsveranstaltungen im Jahreslauf (Sommerfest bis Jugendzeltlager) mit Helferplänen |
| Bilder | 20 gelieferte gezeichnete Profilbilder (`demo-avatar-{maenner,frauen,jungen,maedchen}-01…05.webp`, 100 × 100) und elf Mannschaftsillustrationen (`demo-team-<Schlüssel>.png`, per `node scripts/demo-bilder.mjs`). Zuordnung deterministisch in `packages/db/src/seed/profilbilder.ts` (Geschlecht aus dem Vornamen): feste Bilder für die neun Demo-Personen (admin `maenner-01`, vorstand `frauen-05`, trainer `maenner-02`, spieler `jungen-01`, eltern `frauen-03`, Leon `jungen-02`, Mia `maedchen-03`, kasse `frauen-02`, mitglied `frauen-04`); alle übrigen Personen ebenfalls mit einem Bild ihrer Gruppe (Erwachsene/Kinder × Geschlecht), Wiederholungen innerhalb einer Mannschaft gewollt, nur Eltern und ihre Kinder nie gleich (ohne Bild zeigt die App Initialen, bei Neuanlage im Betrieb) |
| Beispieldateien | in der Hilfe unter „Gibt es Beispieldateien zum Ausprobieren?“ und bei den Import-Fragen herunterladbar |

Bewusst nicht umgesetzt: eigene Mannschaftsfotos als Feld an der Mannschaft (das Produkt kennt kein Mannschaftsbild; die Illustrationen schmücken News), Wechsel als Spielereignis (die Auswechselbank steht in der Aufstellung).

## Trainingsbeteiligung (Paket DEMODATEN-TRAININGSBETEILIGUNG)

Die Anwesenheit vergangener Trainings ist für **alle 11 Mannschaften** erfasst (`packages/db/src/seed/ausbau-anwesenheit.ts`, aufgerufen aus `index.ts`). Je Person gibt es einen festen Anwesenheitstyp (nicht mehr nach Kaderreihenfolge): niedrig, mittel (ab 12 Spielern), Einbruch nach Verletzung (ab 12 Spielern, zuletzt vor drei Wochen), regelmäßig und normal. So kommen bei großen Kadern alle drei Farbstufen des Aufstellungsplaners vor (gut ab 75 %, mittel 50–74 %, niedrig unter 50 %). Max Becker (B1) ist regelmäßig dabei; die Demo-Logins Trainer, Eltern und Kinder sind nie niedrig.

- `attended = true` nur bei Zusage und ohne Abwesenheit; abgesagte, künftige und bewusst offene Trainings haben keinen Wert.
- Offen gelassen: bei zwei Trainings je Woche das jüngste (Kachel „Anwesenheit erfassen“ für B1 und C1) und ein älteres; bei einem Training je Woche eines von vor etwa fünf Wochen. Die letzten vier Wochen sind sonst vollständig erfasst.
- Spiele: keine Anwesenheitserfassung (Einsatz kommt aus dem Spielbericht).

| Mannschaft | Quote 6 Wochen | | Mannschaft | Quote 6 Wochen |
| --- | --- | --- | --- | --- |
| Bambini | ca. 80 % | | A-Jugend | ca. 80 % |
| F-Jugend | ca. 93 % | | Frauen | ca. 74 % |
| E-Jugend | ca. 87 % | | 1. Mannschaft | ca. 78 % |
| D-Jugend | ca. 79 % | | 2. Mannschaft | ca. 64 % |
| C-Jugend | ca. 78 % | | Alte Herren | ca. 57 % |
| B-Jugend | ca. 79 % | | | |

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
