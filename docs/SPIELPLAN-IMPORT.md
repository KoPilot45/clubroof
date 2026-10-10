# Planung: Spielplan-Import (DFBnet)

Stand: 10.10.2026. Noch nicht umgesetzt. Ziel: Der Admin importiert zum Saisonwechsel den gesamten Vereinsspielplan als Datei, daraus entstehen
alle Spiele der Mannschaften automatisch. Trainer können dieselbe Funktion für ihre Mannschaft nutzen.

## 1. Ablauf (Vorschau, dann Übernahme)

1. **Datei wählen** (CSV, später auch Excel und iCal). Zeichensatz und Trenner werden erkannt (wie beim Mitglieder-Import).
2. **Spalten zuordnen:** Vorbelegung für das DFBnet-Format, sonst Zuordnung von Hand (Datum, Uhrzeit, Heim, Gast, Spielort, Wettbewerb/Staffel,
   Spielkennung). Die Zuordnung wird je Verein gemerkt.
3. **Mannschaften zuordnen:** Aus dem Heim- und Gastnamen erkennt die App die eigenen Mannschaften („SV Grün-Weiß II“, „B-Junioren“). Unklare Namen
   wählt der Importierende einmal aus; die Zuordnung wird als **Alias der Mannschaft** gespeichert und gilt für künftige Importe.
4. **Vorschau:** Zeilen als _neu_, _geändert_, _unverändert_, _übersprungen_ (mit Grund), dazu Warnungen (Platzkonflikt, Zeit fehlt, Termin liegt vor
   Saisonbeginn). Nichts wird gespeichert.
5. **Übernehmen:** Spiele werden angelegt, Teilnehmer je Teilnahmemodell erzeugt, Protokoll im Änderungsprotokoll. **Eine** Sammelmeldung je Mannschaft
   statt Einzelmeldungen. **Rückgängig** für 24 Stunden (nur Spiele ohne Zusagen und Änderungen).

## 2. Was zu beachten ist

**Daten und Format**

- **Exportformat nicht verifiziert:** Spaltenüberschriften unterscheiden sich je Landesverband und Version. Vor der Umsetzung brauchen wir einen echten
  (anonymen) Export aus eurem DFBnet-Zugang. Deshalb Spaltenzuordnung statt fest verdrahtetem Format.
- Zeichensatz (Windows-1252, Umlaute), Semikolon, deutsche Datumsformate, Zeiten ohne Sekunden, Zeitzone des Vereins; Obergrenze der Zeilen.
- **Stabile Spielkennung** je Spiel speichern (`source_key`), sonst entstehen beim zweiten Import Dubletten.
- Zeilen ohne Uhrzeit („Termin offen“), Absetzungen, Neuansetzungen und Spielverlegungen kommen vor.

**Zuordnung**

- Mannschaften haben je Saison andere Namen; Alias muss pro Saison und Mannschaft gelten.
- Spiele **zweier eigener Mannschaften** (Vereinsderby): ein Termin je Mannschaft, verknüpft; Heim/Auswärts je nach Seite.
- Heimspiele: Spielort mit der **eigenen Anlage** (Platz) verknüpfen, Konfliktprüfung wie beim Anlegen eines Termins (nur Warnung).
  Auswärtsspiele: Spielort als Adresse; „Route“ nutzt sie direkt.
- Fremdspiele, Spiele ohne eigene Mannschaft und Spielverlegungen anderer Vereine überspringen und in der Vorschau nennen.

**Saison und Zeiten**

- Ziel ist die laufende **oder die vorbereitete Folgesaison**: Spiele hängen an den Mannschaften der Zielsaison. Beim Saisonstart dürfen sie nicht
  doppelt übergehen (Zusammenspiel mit „Saison starten“ prüfen).
- Dauer, Treffpunkt und Abfahrt aus Regeln je Altersklasse und Heim/Auswärts (z. B. Treffen 60 Minuten vor Anstoß, Spieldauer 2×45), einstellbar.
- Absagefrist und Zusagemodell kommen aus den Einstellungen der Mannschaft.

**Änderungen später (zweiter Import)**

- Gleiche Spielkennung = **Aktualisieren** (Datum, Uhrzeit, Ort), keine Dublette. Änderungen melden an Teilnehmer, aber **gebündelt** und nur bei echter Änderung.
- Wenn ein Spiel in der neuen Datei fehlt: **nicht automatisch löschen**, sondern in der Vorschau anbieten (Absagen, Behalten).
- Ergebnisse und Spielberichte aus der App haben Vorrang; Ergebnisse aus der Datei nur eintragen, wenn die App noch keines hat (Option).

**Rechte und Datenschutz**

- **Admin/Leitung:** alle Mannschaften, für die er Termine verwalten darf. **Trainer:** nur die eigene(n) Mannschaft(en); Zeilen für andere Mannschaften werden
  übersprungen und genannt. Prüfung immer serverseitig je Mannschaft.
- Die Datei enthält keine Personendaten außer evtl. Schiedsrichternamen: diese werden nicht übernommen. Rohdatei wird nicht gespeichert, nur das Protokoll.

## 3. Technische Bausteine

- Neue Felder: `events`/`match_details.source_key`, `import_batch_id`, Alias je Mannschaft, gespeicherte Spaltenzuordnung je Verein.
- Dienst `schedule-import` (Parsen, Zuordnen, Vorschau, Übernehmen) auf Basis von `parseCsv`/`decodeText`; Anlegen über die vorhandene Termin-Logik,
  aber ohne Einzelbenachrichtigungen; Sammelmeldung je Mannschaft.
- App: Assistent mit Schritten Datei, Spalten, Mannschaften, Vorschau, Ergebnis; erreichbar für Admin (Verwaltung → Mannschaften & Saison) und Trainer (Team → Spielplan importieren).
- Tests: Beispieldateien (Windows-1252, Semikolon), zweiter Import ohne Dubletten, Verlegung, Absetzung, Rechte (Trainer fremde Mannschaft), Platzkonflikt, Sammelmeldung.
- Später: iCal-Abo der Mannschaft von FUSSBALL.DE als laufende Aktualisierung (kein öffentlicher Zugang per Schnittstelle, daher dateibasiert).

## 4. Offene Fragen

1. Echte Beispieldatei aus dem DFBnet (anonymisiert) für das Vereinsformat?
2. Vereinsderby: ein Termin je Mannschaft (Vorschlag) oder ein gemeinsamer Termin?
3. Standardregeln: Spieldauer je Altersklasse, Treffen vor Anstoß, Abfahrt bei Auswärtsspielen?
4. Soll der Import in die vorbereitete Folgesaison möglich sein, bevor sie gestartet ist (Vorschlag: ja)?
5. Sollen Pokalspiele, Freundschaftsspiele und Hallenturniere ebenfalls aus der Datei kommen (soweit enthalten)?
