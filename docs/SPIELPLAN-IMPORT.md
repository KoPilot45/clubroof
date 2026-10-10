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

## 4. Entscheidungen (Antworten vom 10.10.2026)

1. **Format:** Vorlage ist der DFBnet-Bildschirm „Meisterschaft → Vereinsspielplan“ (Filter: Datumsbereich, Spielkennung, Heim/Gast, Spielstatus, Sportdisziplin, Mannschaftsart). Spalten: Spielkennung (z. B. 050019077), Anstoß (Datum + Uhrzeit), Heim-/Gastmannschaft, SD, MS-Art (Herren, A-Junioren …), Spielklasse (Liga/Pokal), Tore, Sondereignis, Status. Der genaue Export folgt später; bis dahin Spaltenzuordnung flexibel halten. Die Spielkennung ist der natürliche `source_key`. Ergebnisse (Tore) und Status nicht als Termindaten behandeln, Spielort/Spielstätte nur wenn in der Datei.
2. **Derby:** Spielt die 2. gegen die 1. Mannschaft, entsteht für **beide** Mannschaften ein normaler Spieltermin; Kader, Zusagen usw. werden je Team geplant.
3. **Treffpunkt-Regeln:** Je Mannschaft vom Trainer einstellbar. Standard: Spiele 60 min, Trainings 15 min vor Beginn. Daraus wird der Treffpunkt je Termin automatisch berechnet; in der Terminbearbeitung lässt er sich pro Termin überschreiben.
4. **Folgesaison:** Import erst beim Saisonwechsel (Plan der Folgesaison liegt vorher nicht vor).
5. **Pokal, Freundschaft, Turniere:** Werden nicht importiert, sondern von Trainer, sportlicher Leitung und Admin manuell angelegt.

Offen: nur noch der genaue Beispiel-Export.

## 5. Umsetzung (Stand 10.10.2026)

Umgesetzt (Paket I): `POST /schedule-import` (Vorschau und Übernahme), `POST /schedule-import/:id/undo`, Bildschirm `schedule-import` (Verwaltung → Spielplan-Import und Mannschaft bearbeiten → Spielplan importieren), Tabelle `schedule_imports`, Felder `events.source_key` / `import_batch_id`, `teams.import_aliases`, `match_details.kind`.

- Spalten werden über Kopfzeilen erkannt (Spiel, Anstoß, Heimmannschaft, Gastmannschaft, Spielklasse, Status; auch getrennte Datums-/Uhrzeitspalten) und lassen sich im Bildschirm anpassen. **Noch nicht gegen einen echten Export geprüft** – der Abgleich folgt mit der Beispieldatei.
- Rückgängig entfernt die neu angelegten Spiele (24 Stunden, nicht bei vorhandenem Spielbericht); geänderte Spiele werden nicht zurückgesetzt.
- Anlagen- und Platzkonflikte werden beim Import nicht geprüft (der Spielort steht nicht in der Datei); die Zuordnung zur Anlage erfolgt im Termin.
- Tore und Status der Datei werden nicht als Termindaten übernommen (abgesetzte Spiele werden übersprungen).
