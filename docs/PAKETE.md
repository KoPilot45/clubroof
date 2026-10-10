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
| L   | **Neuer Look** (Schritt 1–3 ✅)       | L     | Designsystem (Tokens, Regeln: `DESIGNSYSTEM.md`) und Schritt 1 (Bausteine, Kopfzeile, schwebende Tab-Leiste, Dunkelmodus) sind umgesetzt, ebenso Schritt 2 (Home mit Wischkarten, Offen, Deine Woche, Schnellzugriff je Person) und Schritt 3 (Team); offen: Termine, Verein, Mehr, Zustände, Dunkelmodus-Durchgang; dazu Suche, Hinweise an Schnellzugriff-Chips, Paket U | Sonnet               |
| U   | **iOS-Feinschliff** (vorgemerkt)   | M     | Aus dem Abgleich mit dem iOS-Leitfaden (10.10.2026): Touch-Flächen mindestens 44 pt (kleine Buttons 36, Stepper 40, Chips ~34) mit Größen-Test im a11y-Check; haptisches Feedback (Zu-/Absage, Abhaken, Schalter, Fehler); Wisch-Aktionen in Listen; iPad-Entscheidung (alle Ausrichtungen oder iPad-Unterstützung aus, vor S1); Splash-Screen in Vereinsfarbe; gezielte Übergänge; Systemtextgröße (Dynamic Type) durchgängig | Sonnet               |
| M   | **Mandantenbetrieb**               | L     | Vereine manuell anlegen (Betreiber-Konsole), Zuordnung per Einladungscode, Personen in mehreren Vereinen                                                                                                       | Sonnet, Review stark |
| D   | **Demo-Verein**                    | M     | Demo-Mandant mit Persona-Wechsel, täglich zurückgesetzt, ohne Push/Mail; Startbildschirm „Demo / Login“                                                                                                        | Sonnet               |
| E   | **Einrichtungsassistenten (echt)** | L     | Echte Formulare für Verein und Mannschaft nach dem Vereinszugang; sie legen Aufbau und Funktionen der App fest (Bereiche, Module, Teilnahmemodelle)                                                            | Sonnet               |
| P   | **Pläne & Abo**                    | L     | Plan-Stufen nach Mitgliederzahl, weiche Grenze mit Fortschrittsbalken, Abo-Status, Zahlungsanbieter, AVV                                                                                                       | Sonnet               |
| S1  | **Store-Reife (Technik)**          | M–L   | Bildkomprimierung, Kontolöschung (App und Web), Datenschutz-/Impressum-Links, Fehlerberichte                                                                                                                   | Sonnet               |
| S2  | **Web-Push**                       | M     | Push für die Web-App                                                                                                                                                                                           | Sonnet               |
| SP  | **Sicherheitsprüfung**             | L     | Mandantentrennung, Rechte, Uploads, Anmeldung, Abhängigkeiten                                                                                                                                                  | stärkstes Modell     |
| T   | **Testserver (IONOS VPS)**         | M     | Server, HTTPS, Backups, Expo-Projekt und Entwicklungs-Build                                                                                                                                                    | Sonnet               |

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
