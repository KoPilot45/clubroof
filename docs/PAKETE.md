# Paketplanung (Stand 07.10.2026)

Je Paket eine frische Sitzung (`CLAUDE.md` und `docs/` tragen den Stand). Größe als grobe Schätzung des Aufwands:
**S** ≈ halbe Sitzung · **M** ≈ eine Sitzung · **L** ≈ ein bis zwei Sitzungen. Ideen und Begründungen: `IDEEN.md`;
Festlegungen: `ENTSCHEIDUNGEN.md`. Jedes Paket endet mit `pnpm check`, Doku (`FUNKTIONEN.md`, Hilfe, Übersetzungen:
`node scripts/i18n.mjs todo|merge`), Commit und Push. Screenshots nur als eine Übersicht.

## Wochenende: Optimierung der Bedienung

**Stand 10.10.2026: W1 bis W7 sowie R, F und I sind umgesetzt** (Kachel-Infos, Neu-Hinweise und Warnungen, Erster Eindruck, Route, Optik, Komfort, Einrichtungs-Demos). Weiter mit den Paketen unter „Danach“.

| Nr. | Paket                                       | Größe | Inhalt                                                                                                                                                            | Abhängigkeit  |
| --- | ------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| W1  | **Kachel-Infos**                            | M     | Hinweis und Zähler in den Kacheln, soweit die Daten schon vorhanden sind (siehe unten)                                                                            | –             |
| W2  | **Neu seit dem letzten Besuch & Warnungen** | M     | Gespeicherter Zeitpunkt je Person und Bereich; Hinweise für Übungen, Dokumente, Forum, Wiki, News; Verwaltungswarnungen (Logo fehlt, kein Kassenwart, IBAN fehlt) | W1            |
| W3  | **Erster Eindruck**                         | M     | Willkommens-Tour je Rolle, leere Zustände mit Handlung, Platzhalter statt Drehkreis, Zusage mit einem Tipp und „Rückgängig“, Offline-Hinweis, Fehlerzustände      | –             |
| W4  | **Route zum Spielort**                      | S     | Ort mit Adresse oder Maps-Link am Termin, Button „Route“ (öffnet die Karten-App), Prüfung der Eingabe                                                             | –             |
| W5  | **Optik-Durchgang**                         | M–L   | Einheitliche Icons und Abstände, Dunkelmodus-Durchgang mit Screenshot-Übersicht, Spielerkarten mit Foto, Spieltag-Anzeigetafel, breites Layout für die Verwaltung | W3 (Zustände) |
| W6  | **Komfort & Barrierefreiheit**              | M–L   | Schriftgröße einstellbar, Bildschirmleser-Texte, Offline-Lesen (Termine, Kader), Face ID / Fingerabdruck                                                          | –             |
| W7  | **Einrichtungs-Demos**                      | M     | Zwei Ablaufvorführungen neben den Demo-Logins: „Vereinseinrichtung“ und „Mannschaftseinrichtung“ als Formularschritte ohne Funktion (siehe unten)                 | –             |

### W1 im Detail (Kachel-Infos, erster Schnitt)

- **Server:** ein Endpunkt je Hauptseite (Team, Verein, Mehr, Verwaltung, Kassenverwaltung), der je Kachel `hint`, `badge`
  und Ton (Aktion, Erfolg, dringend) liefert; Rechte serverseitig; kurz zwischengespeichert; Test in `api.test.ts`.
- **App:** `TileGrid` liest die Infos; Ton mit Beschriftung, nie Farbe allein; Antippen führt zur passenden Ansicht.
- **Umfang:** Kasse (offen / Guthaben / ausgeglichen; Kassenwart: Stand und Meldungen), Termine (nächster, Antwort fehlt,
  Zusagen), Kader, Statistik (eigene Quote), Aufgaben, Umfragen, Helfer, Benachrichtigungen, Gastspieler, Funktionen und
  Module („2 neue Funktionen“), News-Freigaben, Einladen, Verwaltung (offene Aufgaben), Mitglieder mit Fortschrittsbalken
  (Plan-Grenze kommt später, vorerst Anzahl), Rollen, Verein & Design.
- **Abnahme:** Browserprüfung je Rolle (Spieler, Eltern, Trainer, Kassenwart, Admin) mit Textprüfung; Datensparsamkeit
  (Eltern sehen je Kind, andere sehen fremde Salden nie).

### W7 im Detail (Einrichtungs-Demos)

- **Zweck:** nur für die Entwicklungsphase und die spätere App-Demo. Die Demos zeigen einmal, wie die Einrichtung abläuft,
  und speichern **nichts**. Mit dem Vereinszugang durchläuft man später die echten Einrichtungsformulare, die Aufbau und
  Funktionen der App festlegen (eigenes Paket E, siehe unten).
- **Einstieg:** zwei weitere Schaltflächen bei den Demo-Zugängen auf der Anmeldeseite („Demo: Vereinseinrichtung“,
  „Demo: Mannschaftseinrichtung“). Später wandern sie in den Startbildschirm des Demo-Vereins (Paket D).
- **Ablauf Vereinseinrichtung:** dieselben Schritte wie der echte Assistent (Verein und Farbe, Bereiche, Module, erstes
  Admin-Konto, Zusammenfassung) mit Beispieldaten; die Vereinsfarbe zeigt sich live in der Vorschau.
- **Ablauf Mannschaftseinrichtung:** Name und Altersklasse, Teilnahmemodell (Zusage oder Absage), Absagefrist, Funktionen
  der Mannschaft, Trainerteam, Kader einladen, Zusammenfassung.
- **Ende:** Hinweis „Einrichtungs-Demo abgeschlossen“ mit Schaltfläche „Verlassen“ (zurück zur Anmeldung). Kein
  Server-Aufruf, kein Konto, keine Daten; ein Banner „Demo – es wird nichts gespeichert“ auf jeder Seite.
- **Technik:** Formularschritte als wiederverwendbare Bausteine mit `demo`-Modus (keine Speicherung), damit das echte
  Formular später dieselben Bausteine nutzt; Browserprüfung: beide Abläufe bis „Verlassen“ durchklicken.

## Danach (vereinbarte Reihenfolge)

| Nr. | Paket                              | Größe | Inhalt                                                                                                                                                                                                         | Modell               |
| --- | ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| R   | **Rechte schärfen** ✅              | M     | Vorstand ohne Kassenlesen, 2-Faktor nur Admin + Code per E-Mail, Co-Trainer = Trainer, Bearbeiten-Funktion für Trainer (Kader, Kassenwart, Co-Trainer), Abwesenheitsgründe abstufen, Rollenvorlagen angleichen, individuelle Rechte je Mitglied (Liste zum An-/Abwählen) | Sonnet               |
| F   | **Mitglieder nach Rolle filtern** ✅ | S     | Mitglieder-Übersicht der Verwaltung: Filter nach Rolle, Funktion in der Mannschaft, Mannschaft, App-Zugang; Schnellfilter „Alle Trainer“, „Alle Rollenträger“                                                  | Sonnet               |
| I   | **Spielplan-Import (DFBnet)** ✅    | L     | Vereins- und Mannschaftsspielplan als Datei importieren, Vorschau, Aliasse, Sammelmeldung, Aktualisieren statt Dubletten (siehe `SPIELPLAN-IMPORT.md`)                                                         | Sonnet               |
| L   | **Neuer Look** (Schritt 1–8 ✅)       | L     | Designsystem (Tokens, Regeln: `DESIGNSYSTEM.md`) und alle acht Umbauschritte sind umgesetzt: Bausteine/Navigation, Home (Wischkarten, Offen, Deine Woche, Schnellzugriff je Person), Team, Termine, Verein, Mehr, Zustände, Dunkelmodus-Durchgang mit Verwaltungs-Navigation. Offen: – | Sonnet               |
| U   | **iOS-Feinschliff** ✅              | M     | Umgesetzt (10.10.2026): Tippflächen mindestens 44 pt mit Browser-Messung (`scripts/e2e/touchflaechen.mjs`); haptisches Feedback (`lib/haptics.ts`: Zu-/Absage, Abhaken, Chips/Schalter, Tabs, Fehler); Wisch-Aktionen (`SwipeRow`: Benachrichtigung „Gelesen“, Termin „Zusagen“); iPad bleibt unterstützt, aber ohne Multitasking (`requireFullScreen`, Hochformat); Ladebildschirm in Vereinsfarbe; weiche Übergänge zwischen den Tabs; Systemtextgröße wirkt (Textgröße der App kommt dazu) | Sonnet               |
| UC  | **Über Clubroof** ✅ | S | Bereich unter „Mehr“: AGB, Datenschutz, Privatsphäre-Einstellungen, Impressum, Changelog, Support und „Funktion anfragen“ (Links zur Webseite). Beispieltexte und Platzhalter-Adressen, bis die geprüften Inhalte vorliegen (`lib/about-content.ts`) | Sonnet |
| PB  | **Platzbelegung als Stundenplan** | M | Tag: Zeitraster mit einer Spalte je Platz (Untergrund unter dem Namen), Termine als farbige Blöcke je Mannschaft, Sperrungen schraffiert, Überschneidungen markiert; Woche: Platz wählen, Spalten Mo–So; Block antippen = Details (Termin öffnen, Platz sperren); Wochenwechsel per Wisch. Nutzt vorhandene Daten (`/facilities/occupancy`), Untergrund kommt mit Paket E **Festlegungen (10.10.2026):** nur Ansicht, keine Verschiebung per Ziehen – die Übersicht entsteht ausschließlich aus den vorhandenen Terminen; Zeitfenster richtet sich nach dem frühesten und spätesten Termin der Ansicht, Wochenenden werden leicht abgesetzt mit eigenem Zeitfenster dargestellt. | Sonnet |
| WS  | **Wochen-Spielplan (Verein)** | M | Unter „Verein“: alle Spiele des Vereins pro Woche, nach Tagen gruppiert; Filter Alle/Senioren/Jugend; Wochenwechsel per Wisch mit Pfeilen und Punkte-Anzeige (angedeutete Nachbarwoche); Karten mit Zeit, Mannschaft, Gegner, Heim/Auswärts, Ort/Platz, Treffpunkt, Tag Liga/Pokal/Testspiel, bei Gespieltem das Ergebnis; „Spielfrei: …“. Neue Abfrage `GET /club/schedule?week=` (nur Spiele, nur sichtbare Mannschaften) **Festlegungen (10.10.2026):** nur Spiele (keine Trainings); Einstieg nur unter „Verein“ (Kachel „Spielplan“), nicht auf der Startseite. | Sonnet |
| M   | **Mandantenbetrieb**               | L     | Vereine manuell anlegen (Betreiber-Konsole), Zuordnung per Einladungscode, Personen in mehreren Vereinen                                                                                                       | Sonnet, Review stark |
| D   | **Demo-Verein**                    | M     | Demo-Mandant mit Persona-Wechsel, täglich zurückgesetzt, ohne Push/Mail; Startbildschirm „Demo / Login“                                                                                                        | Sonnet               |
| E   | **Einrichtungsassistenten (echt)** (✅, Rest offen) | L     | Echte Formulare für Verein und Mannschaft nach dem Vereinszugang; sie legen Aufbau und Funktionen der App fest (Bereiche, Module, Teilnahmemodelle)                                                            | Sonnet               |
| K1  | **Vereinskasse: Grundlage** | M | Rollen Kassenwart (Verein) und Kassenprüfer, Umbenennung der Mannschaftsrolle in Mannschaftskassenwart, Einstellung „Wer darf die Kasse einsehen?“, Vereinskonten, Kassenbuch mit Belegen, Kategorien nach vier Bereichen, Kostenstellen, Umbuchung, Storno (siehe `VEREINSKASSE.md`) | Sonnet |
| K2  | **Vereinskasse: Beiträge** | L | Beitragsarten, Sollstellung, Zahlungseingang, Rückstände, Erinnerungen, CSV-Import vom Kontoauszug | Sonnet |
| K3  | **Vereinskasse: Planung und Abschluss** | M | Haushaltsplan, Soll-Ist, Rücklagen, Einnahmen-Ausgaben-Rechnung, Jahresabschluss (PDF/CSV), Periodensperre | Sonnet |
| K4  | **Vereinskasse: Prüfung und Spenden** | M | Kassenprüfung (Stichproben, Vermerke, Prüfbericht), Spendenquittung nach rechtlicher Prüfung | Sonnet |
| K5  | **Vereinskasse: Erweiterungen** | M | Auslagenerstattung, Übungsleiterpauschale, Zuschüsse, Sponsorenanbindung, Zuschuss an Mannschaftskasse, Inventar | Sonnet |
| SPO | **Sponsoren-Modul** | M | Vom Verein aktivierbares Modul: Admins laden Sponsorenlogo und Banner hoch, hinterlegen Link, Stufe (Haupt/Partner/Förderer), Laufzeit und Zuordnung (Verein, Jugend, Senioren). Banner (gekennzeichnet) auf Startseite, Spieltag und Terminlisten, dazu eigene Seite „Unsere Sponsoren“ unter „Mehr“; Reihenfolge und Kennzeichnung einstellbar. Keine Auswertung, kein Splash-Banner, nie in Anmeldung, Kasse, Chat oder bei Kindern | Sonnet |
| P   | **Pläne & Abo**                    | L     | Plan-Stufen nach Mitgliederzahl, weiche Grenze mit Fortschrittsbalken, Abo-Status, Zahlungsanbieter, AVV                                                                                                       | Sonnet               |
| S1  | **Store-Reife (Technik)**          | M–L   | Bildkomprimierung, Kontolöschung (App und Web), Datenschutz-/Impressum-Links, Fehlerberichte                                                                                                                   | Sonnet               |
| S2  | **Web-Push**                       | M     | Push für die Web-App                                                                                                                                                                                           | Sonnet               |
| SP  | **Sicherheitsprüfung**             | L     | Mandantentrennung, Rechte, Uploads, Anmeldung, Abhängigkeiten                                                                                                                                                  | stärkstes Modell     |
| T   | **Testserver (IONOS VPS)**         | M     | Server, HTTPS, Backups, Expo-Projekt und Entwicklungs-Build                                                                                                                                                    | Sonnet               |

### Paket E im Detail (Stand 10.10.2026, Entwurf freigegeben)

**Umsetzungsstand:** Beide Assistenten laufen (`apps/mobile/src/app/setup.tsx`, `admin/team-new.tsx`, Baukasten
`components/wizard.tsx`). Vereins-Assistent: 12 Schritte, Spielstätten/Plätze/Kabinen als Daten (Migration 0036),
Modulauswahl als Hauptschalter, E-Mail-Code (Pflicht), Zwischenstand auf dem Gerät, Logo-Upload nach dem Anlegen.
Mannschafts-Assistent: 11 Schritte, angelegt wird erst am Ende; Antwortfristen Training/Spiel in freien Stunden
(`PUT /teams/:id/profile`). **Offen:** Bereichsmodell „Jugend/Senioren getrennt“ legt derzeit zwei Bereiche an, die
Rechtefeinheit je Bereich ist noch nicht eigens geprüft; Treffpunkt der Mannschaft ist Freitext (Auswahl aus
Spielstätten/Kabinen folgt); Mannschaft: „Fertig“-Seite mit Vorschlägen (Training anlegen, Spielplan importieren,
Eltern einladen) fehlt; kein Browserdurchlauf des Vereins-Assistenten (braucht leere Datenbank, API-Test deckt ab).

Designentwurf: Design-Artefakt „Clubroof Designentwürfe“, Reihen „Verein einrichten“ (V1–V14) und
„Mannschaft anlegen“ (M1–M12). Gemeinsamer Aufbau jedes Schritts: Zurück, Prozentbalken („Schritt X von N · NN %“),
Frage mit kurzer Erklärung, Auswahlkarten/Chips/Schalter, optionaler Hinweis, fester Weiter-Knopf, Überspringen-Link.
Pro Seite nur ein Thema.

**Verein einrichten** – einmaliger Assistent in Clubroof-Farben (#002AFA → #00C3FF, Clubroof-Logo auf der
Willkommensseite); Hinweis, dass jede Entscheidung später in der Verwaltung änderbar ist. 12 Schritte:
Name/Kurzname · Spielstätte (Name, Adresse; weitere Anlage möglich) · Plätze und Kabinen je Anlage ·
Untergrund je Platz (Rasen, Kunstrasen, Hartplatz) · Logo (überspringbar) · Farbe (10 geprüfte) ·
Bereiche (ein gemeinsamer Bereich, oder „Jugend und Senioren getrennt“ – getrennt heißt: keine Daten des anderen
Bereichs; Vorstand/Admin sehen alles; „mehrere Abteilungen“ ist Erweiterung für später) ·
„Wofür nutzt ihr Clubroof?“ in zwei Schritten (Mannschaft, Verein; Module aus `modules.ts`, Kernmodule immer an,
Empfehlung vorausgewählt) · Konto (E-Mail-Bestätigung Pflicht) · Passwort (Stärkeanzeige, Wiederholen) ·
Sicherheit (Zwei-Faktor nur **Empfehlung**, Hinweis: betrifft nur neue Anmeldungen, das eigene Gerät bleibt angemeldet) ·
Fertig mit Vorschlägen (Mannschaft, Mitglieder-/Spielplan-Import, Einladen).

**Mannschaft anlegen** – in der Vereinsfarbe, 11 Schritte: Name/Kürzel · Bereich und Saison · Altersklasse ·
Liga und Name im DFBnet · Art der Zu-/Absagen · Antwortfrist **Training** · Antwortfrist **Spiele**
(je 12/24/48 Std. oder eigene Stundenzahl) · Treffpunkt (Spielstätte und Kabine aus der Vereinseinrichtung) ·
Treffzeit (Spiel/Training) · Trainerteam · Kader · Fertig (Training anlegen, Spielplan importieren, Eltern einladen).

**Folgen für Backend/Daten:** Spielstätten mit Adresse, Plätzen (Untergrund) und Kabinen als Daten (Platzbelegung
nutzt sie); Bereichsmodell „Jugend/Senioren“; getrennte Antwortfristen Training/Spiel pro Mannschaft
(mit freier Stundenzahl); Konto-E-Mail-Bestätigung im Einrichtungsablauf; Fortschritt/Wiederaufnahme des Assistenten
(Abbruch darf nichts halb anlegen). Begriff „Aktive“ wird nicht verwendet – es heißt **Senioren**.

Parallel (ohne Entwicklung): Apple- und Google-Organisationskonten (D-U-N-S) beantragen; Datenschutzerklärung,
Impressum, AGB und Auftragsverarbeitungsvertrag juristisch prüfen lassen.

## Vorschlag für Samstag und Sonntag

1. **Samstag, Sitzung 1:** W1 (Kachel-Infos), weil es dein jüngster Wunsch ist und sofort sichtbar wird.
2. **Samstag, Sitzung 2:** W3 (Erster Eindruck): wirkt besonders im Demo-Verein und bei Prüfern.
3. **Sonntag:** W4 (Route) und, wenn Budget bleibt, W2 oder W7 (Einrichtungs-Demos, klein und gut vorführbar).
4. W5 und W6 danach, sobald das Wochenlimit wieder frei ist; bei knappem Limit lieber W5 in zwei Teile teilen
   (Dunkelmodus-Durchgang zuerst).

Wichtig: W1 bis W6 sind unabhängig vom Mandantenbetrieb. Die Kachel-Infos prüfen die Rechte über den Verein der Person und
bleiben damit auch später richtig.
