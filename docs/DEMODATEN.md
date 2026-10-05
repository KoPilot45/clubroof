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

| Bereich | Inhalt |
| --- | --- |
| Verein | SV Grün-Weiß Musterstadt 1920 e.V., Vereinsfarbe Grün, Bereiche Senioren, Alte Herren, Frauen & Mädchen, Jugend |
| Anlagen | Rasenplatz (Platz 1), Kunstrasen, Sporthalle, Vereinsheim |
| Mannschaften | 1. Mannschaft, 2. Mannschaft, Alte Herren, Frauen, A- bis F-Jugend, Bambini (11 Teams) |
| Personen | rund 310: Spielerinnen und Spieler, Trainer, Eltern, Funktionäre, fördernde Mitglieder |
| Teilnahme-Modelle | automatische Zusage (Senioren), aktive Zu-/Absage (Frauen, Jugend), nur Abwesenheiten (Alte Herren) |
| Termine | Trainings, Spiele, Spielfeste, Vorstandssitzung, Jahreshauptversammlung, Arbeitseinsatz, Hallenturnier, Weihnachtsfeier |
| Besonderheiten | Kunstrasen am kommenden Donnerstag gesperrt (Trainings abgesagt), Gastspieler aus C-Jugend und 2. Mannschaft, Spielerbörse mit offenem Bedarf (A-Jugend, 2. Mannschaft) und Angeboten (C-Jugend, Alte Herren), Verletzungen, Urlaub, Rotsperre |
| Kommunikation | 9 News (eine wartet auf Freigabe), 3 Umfragen mit Stimmen, Benachrichtigungen je Demo-Login |
| Ehrenamt | Helferschichten für Hallenturnier, Arbeitseinsatz und Jahreshauptversammlung; Programme und erste Teilnehmer bei den Vereinsveranstaltungen |
| Finanzen | Mannschaftskassen 1., 2. und B-Jugend mit Strafen, Getränken und Einzahlungen |
| Dokumente | Satzung, Ordnungen, Formulare, Trainingspläne – beim Öffnen liefert der Server eine Platzhalter-PDF |
| Module | Forum, Trainingsplanung und Fundbüro sind „verfügbar, aber nicht aktiviert“ (für das Update-Center) |

## Demo-Logins

Alle Demo-Logins haben das Passwort `clubroof-demo`.

| E-Mail | Person | Perspektive |
| --- | --- | --- |
| `admin@sv-gruen-weiss.example` | Daniel Schäfer | Fulladmin |
| `vorstand@sv-gruen-weiss.example` | Sandra Hoffmann | 1. Vorsitzende |
| `trainer@sv-gruen-weiss.example` | Max Mustermann | Trainer B- und C-Jugend, Spieler 2. Mannschaft |
| `spieler@sv-gruen-weiss.example` | Max Becker | Spieler B-Jugend (Nr. 14) |
| `eltern@sv-gruen-weiss.example` | Julia Neumann | Mutter von Leon (E-Jugend) und Mia (F-Jugend), Co-Trainerin E-Jugend |
| `kasse@sv-gruen-weiss.example` | Petra Schulz | Kassenwartin |

## Automatische Prüfungen

`packages/db/src/seed/seed.test.ts` prüft unter anderem:

- alle Datensätze gehören zum selben Verein (`club_id`)
- jede Mannschaft hat Spieler und Verantwortliche
- Teilnehmer gehören zur Mannschaft oder sind als Gastspieler gekennzeichnet
- Kinder bis einschließlich C-Jugend haben einen Elternzugang
- kein Platz ist doppelt belegt
- abwesende Spieler sind für Termine in ihrem Abwesenheitszeitraum abgesagt
- Kassenstand der B-Jugend: 512,35 € (wie im Mockup der Verkaufsmappe)
