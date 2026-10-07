# Ideen und Planung (noch nicht umgesetzt)

Sammlung für kommende Sitzungen. Paketplanung: `PAKETE.md`. Verbindliche Entscheidungen stehen in `ENTSCHEIDUNGEN.md`, den Umsetzungsstand in
`FUNKTIONEN.md`. Stand: 07.10.2026.

## 1. Reihenfolge der nächsten Pakete (festgelegt)

Mandantenbetrieb (Vereine manuell anlegen) → Demo-Verein → Pläne & Abo (weiche Mitgliedergrenze) → Store-Reife
(Kontolöschung, Datenschutz, Bildkomprimierung, Web-Push) → Sicherheitsprüfung → Testserver. Zusätzlich möglich:
Paket „Erster Eindruck“ (Abschnitt 3) und „Route + Spieltag“.

## 2. Kachel-Infos: Hinweise direkt in den Kacheln

`TileItem` kennt bereits `hint` (eine Zeile) und `badge` (Zähler). Vorhanden: Umfragen, Helfer gesucht, Abwesenheiten,
Benachrichtigungen, Zahlungsmeldungen, Kassenwart, Beiträge, Kassenprüfung.

**Regeln:** eine Zeile, Zahl zuerst („12,50 € offen“) · nur zeigen, wenn es etwas zu sagen gibt (kein „0“) · Farbe nie
allein, immer mit Text (Aktion / Erfolg / dringend) · Antippen führt direkt zur passenden, gefilterten Ansicht · Daten
nur für Berechtigte (Kasse: eigene Zahlen; Eltern: je Kind) · höchstens ein „dringend“ je Kachel · in der App keine Preise
oder Kauf-Links.

**Technik:** ein Endpunkt je Hauptseite liefert alle Kachel-Infos auf einmal (Rechte serverseitig, kurz zwischengespeichert).
„Neu seit dem letzten Besuch“ braucht einen gespeicherten Zeitpunkt je Person und Bereich.

| Bereich     | Kachel                | Hinweis (Beispiel)                                                                                            | Für wen                  | Daten vorhanden? |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------- |
| Team        | Termine               | „Nächster: Sa 15:00 Spiel“ · Spieler: „Antwort fehlt“ · Trainer: „9 von 21 zugesagt“                          | alle / Trainer           | ja               |
| Team        | Abwesenheit melden    | „Aktuell abwesend bis 12.10.“                                                                                 | Betroffene               | ja               |
| Team        | Kader                 | „21 Spieler · 2 nicht verfügbar“                                                                              | Trainer (Spieler: Zahl)  | ja               |
| Team        | Statistik             | „Dein Training: 82 %“ · Trainer: „Bilanz 5-2-1“                                                               | alle / Trainer           | ja               |
| Team        | Kasse                 | „Du hast 12,50 € offen“ · „Du hast 5,00 € Guthaben“ · „Ausgeglichen“ · Kassenwart: „Kasse 342 €, 2 Meldungen“ | alle / Kassenwart        | ja               |
| Team        | Strafenkatalog        | „14 Strafen“ · Trainer: „Heute vergeben: 3“                                                                   | alle / Trainer           | ja               |
| Team        | Übungen               | „3 neu seit deinem letzten Besuch“                                                                            | Trainer                  | nein (Zeitpunkt) |
| Team        | Funktionen (Module)   | „2 neue Funktionen verfügbar“                                                                                 | Trainer                  | ja               |
| Team        | Aufgaben              | „Für dich: 1 offen“ · Trainer: „3 offen, 1 überfällig“                                                        | alle / Trainer           | ja               |
| Team        | Umfragen              | „2 offen, endet morgen“                                                                                       | alle                     | ja               |
| Team        | Dokumente             | „1 neues Dokument“                                                                                            | alle                     | nein (Zeitpunkt) |
| Team        | Gastspieler           | „1 Anfrage offen“ · „Gesucht: 2 Spieler für Sonntag“                                                          | Trainer                  | ja               |
| Verein      | News                  | „3 ungelesen“ · „Wichtig: Training entfällt“                                                                  | alle                     | teils            |
| Verein      | News schreiben        | „2 zur Freigabe“ (Freigeber) · „Dein Entwurf wartet“ (Verfasser)                                              | Redaktion                | ja               |
| Verein      | Veranstaltungen       | „Sommerfest in 12 Tagen“ · „Antwort fehlt“                                                                    | alle                     | ja               |
| Verein      | Forum                 | „2 neue Antworten“                                                                                            | alle                     | nein (Zeitpunkt) |
| Verein      | Anlage & Material     | „Du hast: Schlüssel Vereinsheim (seit 3 Tagen)“ · Platzwart: „1 Schaden“                                      | Betroffene / Platzwart   | ja               |
| Verein      | Schiedsrichter        | „Nächster Einsatz Sa 13:00“ · Ansetzer: „3 Spiele ohne Schiedsrichter“                                        | Schiedsrichter / Leitung | ja               |
| Verein      | Vereinswissen         | „2 neue Artikel“                                                                                              | alle                     | nein (Zeitpunkt) |
| Verein      | Helfer gesucht        | „5 Plätze frei“ · „Du bist eingetragen: Sa Kiosk“                                                             | alle                     | ja               |
| Verein      | Platzbelegung         | „Heute: Platz 1 frei bis 17:00“ · „Gesperrt: Kunstrasen“                                                      | alle                     | ja               |
| Mehr        | Profil & Statistik    | „Nr. 7 · Training 82 %“                                                                                       | Spieler                  | ja               |
| Mehr        | Konto & Einstellungen | „2-Faktor nicht eingerichtet“ (Warnung, Pflicht bei Verwaltungsrechten)                                       | betroffene Personen      | ja               |
| Mehr        | Hilfe & Anleitung     | „Neu: Sprache ändern“ (Neuigkeiten der App)                                                                   | alle                     | nein             |
| Mehr        | Kalender-Abo          | „Aktiv“ · „Nicht eingerichtet“                                                                                | alle                     | ja               |
| Mehr        | Einladen              | „2 Anfragen warten auf Freigabe“ · „3 Einladungen offen“                                                      | Einladende               | ja               |
| Mehr        | Verwaltung            | „5 offene Aufgaben“ (Freigaben, Anfragen, News)                                                               | Verwaltung               | ja               |
| Verwaltung  | Mitglieder            | „412 von 500“ mit Fortschrittsbalken (weiche Grenze) · „3 neu diese Woche“ · „5 ohne Mannschaft“              | Verwaltung               | ja (Grenze neu)  |
| Verwaltung  | CSV-Import            | „Letzter Import 12.09.“                                                                                       | Verwaltung               | ja               |
| Verwaltung  | Rollen & Aufgaben     | „Kein Kassenwart in 3 Mannschaften“                                                                           | Verwaltung               | ja               |
| Verwaltung  | Änderungsprotokoll    | „Heute 12 Einträge“                                                                                           | Verwaltung               | ja               |
| Verwaltung  | News-Redaktion        | „2 zur Freigabe“                                                                                              | Redaktion                | ja               |
| Verwaltung  | Verein & Design       | „Logo fehlt“ · „2-Faktor-Pflicht aus“                                                                         | Verwaltung               | ja               |
| Verwaltung  | Veranstaltungen       | „Nächste in 12 Tagen · 4 Helfer fehlen“                                                                       | Verwaltung               | ja               |
| Verwaltung  | Mannschaften & Saison | „Saison 2026/27 vorbereiten“ (ab Frühjahr)                                                                    | Sportliche Leitung       | ja               |
| Verwaltung  | Spielerbewegungen     | „2 Leihen enden bald“                                                                                         | Verwaltung               | ja               |
| Verwaltung  | Einladungen/Anfragen  | „4 Beitrittsanfragen“                                                                                         | Verwaltung               | ja               |
| Verwaltung  | Module                | „Es gibt 2 neue Funktionen“ · „12 von 15 aktiv“                                                               | Verwaltung               | ja               |
| Verwaltung  | Plan / Abo (später)   | „412 von 500 Mitgliedern (82 %)“, nur Status, kein Preis und kein Kauf-Link                                   | Verwaltung               | später           |
| Kasse-Verw. | Einzahlungen          | „3 Zahlungsmeldungen“ · „Offen gesamt 84 €“                                                                   | Kassenwart               | ja               |
| Kasse-Verw. | Strafe vergeben       | „Heute vergeben: 2“                                                                                           | Trainerteam              | ja               |
| Kasse-Verw. | Getränke              | „Preis 1,50 €“                                                                                                | Kassenwart               | ja               |
| Kasse-Verw. | Umlage                | „Zuletzt: Bus, 120 €“                                                                                         | Kassenwart               | ja               |
| Kasse-Verw. | Beiträge              | „5 € monatlich, nächste Buchung 01.11.“                                                                       | Kassenwart               | ja               |
| Kasse-Verw. | Bezahlinfos           | „IBAN fehlt“ (Warnung)                                                                                        | Kassenwart               | ja               |
| Kasse-Verw. | Kassenprüfung         | „Zuletzt 12.09. · fällig“                                                                                     | Kassenwart               | ja               |

**Vorschlag für die Reihenfolge:** zuerst alles mit vorhandenen Daten und hohem Nutzen (Kasse-Saldo, nächster Termin und
offene Zusage, Benachrichtigungen, Module-Neuigkeiten, Mitglieder-Balken, Freigaben, Aufgaben, Umfragen, Helfer);
danach „neu seit dem letzten Besuch“ (braucht den gespeicherten Zeitpunkt); zuletzt Wetter und Platzstatus.

## 3. Bedienung, Optik, Komfort

- **Einrichtungs-Demos (W7):** bei den Demo-Zugängen zwei Vorführungen „Vereinseinrichtung“ und „Mannschaftseinrichtung“ ohne
  Funktion, am Ende „Einrichtungs-Demo abgeschlossen“ → „Verlassen“. Echte Einrichtungsformulare folgen mit Paket E.

- **Erster Eindruck:** Willkommens-Tour je Rolle, leere Zustände mit Handlung, Platzhalter statt Drehkreis, Zusage mit
  einem Tipp (mit „Rückgängig“), Aktualisieren durch Ziehen, Offline-Hinweis, globale Suche, Favoriten/Schnellzugriff.
- **Optik:** einheitliche Icon-Familie, Tablet-/Desktop-Layout für die Verwaltung, Dunkelmodus-Durchgang mit
  Screenshot-Check, Spielerkarten mit Foto und Position, Spieltag-Anzeigetafel, dezente Animationen.
- **Komfort:** einstellbare Schriftgröße, Bildschirmleser-Texte prüfen, Offline-Lesen (Termine, Kader), Face ID /
  Fingerabdruck.

## 4. Weitere Funktionen

- **Mitglieder:** Anfahrt-Button „Route“ (Adresse oder Maps-Link am Termin), Wetter- und Platzhinweis am Spieltag, Spielplan
  und Tabelle (später FUSSBALL.DE), Foto-Galerie mit Einwilligungsprüfung, Dienstplan für Helfer, Mitgliedsantrag online,
  Widget mit dem nächsten Termin.
- **Trainer und Vorstand:** Anwesenheits-Auswertung, Trainingsplan-Vorlagen mit Bild/Video, Vorstands-Dashboard,
  Versammlungen mit Abstimmung, Kinderschutz (Führungszeugnis-Ablauf, Notfallkontakte).
- **Betrieb:** Bildkomprimierung, Web-Push, Fehlerberichte und anonyme Statistik, Mehrsprachigkeit (weitere Sprachen).
