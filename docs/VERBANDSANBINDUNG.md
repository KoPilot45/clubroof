# Verbandsanbindung (FUSSBALL.DE, DFBnet, SpielPLUS): Recherche und Vorschlag

Stand: 19.10.2026. **Belastbarkeit:** Recherche über Websuche; die Seiten der Anbieter selbst waren aus der Arbeitsumgebung nicht abrufbar. Zur technischen Seite der Verbandssysteme (Schnittstellen, Zulassung für Drittanbieter) fanden sich **keine öffentlichen Unterlagen**. Alles dazu ist als offen zu behandeln und beim DFB bzw. Landesverband zu klären. Eigene Vorarbeit: Spielplan-Import per CSV (`SPIELPLAN-IMPORT.md`, umgesetzt), Provider-Layer-Idee in `PLAN.md`.

## 1. Wie andere Apps angebunden sind

| Anbieter | Weg | Belegt |
| -------- | --- | ------ |
| **BFV-Team-App** (Bayern) | Direkte Anbindung an **SpielPLUS/DFBnet**: Termine und Spielerdaten werden übernommen und **dauerhaft synchron** gehalten (Absage in SpielPLUS erscheint in der App); **Aufstellung geht direkt in den elektronischen Spielbericht (ESB)**. Freischaltung: Abgleich mit dem Mannschaftsverantwortlichen aus dem Vereinsmeldebogen, dann Freischaltcode per Mail. Aufstellbar sind nur Spieler der **Spielberechtigungsliste** im DFBnet; Aufstellung bis spätestens 30 Minuten vor Spielbeginn freigeben. | App-Store-Text, BFV-Schulungsunterlagen. Ob über DFBnet-Schnittstelle oder SpielPLUS, ist nicht belegt. |
| **SpielerPlus / TeamPlus** | Kein Zugriff auf DFBnet. **Zwei Wege:** (1) „KI-Datenimport“: Verein und Mannschaft suchen, Spiele einzeln oder alle übernehmen (laut Hilfe für Bayern, Schweiz, Österreich u. a.); (2) **iCal-Abo-Link** (BFV-App: Mannschaft › drei Punkte › „iCal Subscription“) unter „Termine › Kalender-Import“ einfügen. Grenzen beim ICS-Import: höchstens 1.000 Termine, keine vergangenen, höchstens ein Jahr voraus, keine Serientermine; Mannschaftsname muss passen. Ob später automatisch aktualisiert wird, ist nicht belegt. | SpielerPlus-Hilfeseiten (Suchtreffer). |
| **Spond** | Spielplan-Import nur für Handball und Fußball in **Norwegen** (Verbandsseiten), nur über die Web-Version, **einmalig, kein Abgleich**. Für Deutschland kein Import belegt. | Spond-Hilfe. |
| **SportMember, Locaboo** | **CSV-Import** des DFBnet-Exports (Spaltenauswahl: Datum, Zeit, Heim, Gast, Ort). | Hilfeseiten der Anbieter. |
| **Vereinswebsites, Baukästen** | **FUSSBALL.DE-Widgets** (Tabelle, nächstes Spiel, letzte Spiele, Kader) als JavaScript-Einbettung, erzeugt mit FUSSBALL.DE-Konto und Domainangabe; laut Dokumentation für nicht-kommerzielle Vereinsseiten; **kein JSON/REST-Zugang** belegt. | DFBnet-Widget-Anleitung, fussball.de. |
| **DFB selbst** | DFBnet (Spielplanung, Ergebnismeldung, Spielberichte, Vereinsmeldebogen, Spielerpass), FUSSBALL.DE (Anzeige), TEAMPUNKT (DFB-eigene Team-App, 2019). Der DFBnet-Spielplan lässt sich als **CSV exportieren** (ohne Ergebnisse, Zeitraum wählbar); ein iCal-Export wird laut einem Vereinsblog (2024) nicht mehr angeboten (einzelne Quelle). | DFBnet-Onlinehilfe, Vereinsblogs. |

**Schlussfolgerung:** Eine **echte, bidirektionale Anbindung** (Spielplan live, Aufstellung in den Spielbericht) haben nur Verbands-Apps (BFV). Alle Drittanbieter arbeiten mit **Datei- oder Kalender-Import**, meist einmalig. Eine öffentliche, dokumentierte API für Drittanbieter ist **nicht belegt**.

## 2. Wege für Clubroof (Vorschlag in Stufen)

| Stufe | Inhalt | Aufwand | Risiko |
| ----- | ------ | ------- | ------ |
| **0 (vorhanden)** | CSV-Import (DFBnet-Export) mit Spaltenzuordnung, Alias der Mannschaften, stabiler Spielkennung | – | gering |
| **1 – Spielplan-Abo** | Je Mannschaft einen **iCal-Link** hinterlegen (aus BFV-App, FUSSBALL.DE-Kalender oder Verbandsseite). Clubroof ruft ihn regelmäßig ab (z. B. alle 6–24 Stunden), gleicht über die Termin-ID mit `source_key` ab und zeigt **Änderungen** (Verlegung, Absage, neue Spiele) gebündelt zur Übernahme oder übernimmt automatisch (einstellbar). Besser als SpielerPlus: **laufende Synchronisation** statt Einmalimport, mit Vorschau und Sammelbenachrichtigung. Anleitung „So kommt der Link“ je Landesverband in der Hilfe. | M | gering; hängt davon ab, dass die Verbände Links anbieten (Landesverband prüfen) |
| **2 – Ergebnis- und Aufstellungshilfe** | Nach dem Spiel zeigt Clubroof eine **Kopieransicht für DFBnet/ESB**: Aufstellung (Nummer, Name, Position, Kapitän, Auswechslungen), Ergebnis, Tore, Karten in der Reihenfolge des Spielberichts, per Teilen/Kopieren. Hilft dem Trainer sofort, ohne Schnittstelle. | S–M | gering |
| **3 – Tabelle und Ergebnisse anzeigen** | **Verlinken** auf die FUSSBALL.DE-Seite der Mannschaft (Tabelle, Ergebnisse). Einbettung per Widget nur nach Klärung der Nutzungsbedingungen (laut Dokumentation für nicht-kommerzielle Seiten; Clubroof ist ein kommerzielles Produkt). Kein Scraping. | S | Bedingungen unklar |
| **4 – Offizielle Schnittstelle** | **Anfrage bei DFB (DFB-Medien) und Landesverband** zu Partnerprogramm bzw. Schnittstelle für Vereinssoftware: Spielplan, Spielberechtigungsliste, Aufstellung → ESB. Voraussetzungen vermutlich Freischaltung über den Vereinsmeldebogen (wie BFV-Team-App), Vertrag/AVV, Datenschutzprüfung. Pilot mit einem Landesverband (Heimatverband des ersten Vereins). | L, abhängig vom Verband | hoch (Zulassung offen, Zeit) |
| **Nicht empfohlen** | Auslesen von FUSSBALL.DE-Seiten (Scraping): AGB-Verstoß, fragil, Rechtsrisiko. | – | – |

## 3. Zu beachten

- **Datenschutz:** Spielberechtigungsliste und Spielerpass sind Personendaten. Nur über eine offizielle Schnittstelle mit AVV/Vertrag; bis dahin nur Daten, die der Verein selbst in Clubroof pflegt.
- **Eigene Daten führen:** Die interne Datenquelle bleibt führend (`PLAN.md`); Verbandsdaten werden mit Herkunft (`source_key`, Quelle) gespeichert, manuelle Änderungen im Verein gehen vor oder werden bei Konflikt zur Entscheidung angezeigt.
- **Landesverbände unterscheiden sich** (Spaltennamen, Kalenderlinks, Fristen). Pro Verband eine kleine Anleitung; Spaltenzuordnung gemerkt.
- **Andere Sportarten:** handball.net bietet iCal-Links; die Abo-Lösung (Stufe 1) ist sportartneutral.
- **Tabellenplatz** wurde bewusst aus der App entfernt (Paket TP); Tabelle nur als Link (Stufe 3).

## 4. Offene Fragen an die Beteiligten

1. **Welcher Landesverband** ist der erste Zielverband (Pilot)? Davon hängen Kalenderlinks und Schnittstellenanfrage ab.
2. Gibt es einen **echten DFBnet-Export** (CSV) und einen **iCal-Link** einer Mannschaft zur Prüfung?
3. Anfrage an **DFB-Medien/Landesverband** zur Partner-Schnittstelle: Wer im Verein stellt sie (Vereinsmeldebogen-Berechtigte)?
4. Soll Stufe 1 auch **automatisch** Spiele anlegen oder nur Änderungen vorschlagen (Vorschlag: Neue Spiele und Änderungen automatisch, Entfernte Spiele nur nach Rückfrage)?

## Quellen

- [DFBnet: Spielplan und Export](https://portal.dfbnet.org/de/service/online-hilfe/meisterschaft/spielplanbearbeitung/spielplan.html) · [SportMember: Spielplan via DFBnet importieren](https://www.sportmember.de/de/fragen-antworten/trainer/mitglieder/wie-importiere-ich-meinen-spielplan-via-dfbnet) · [Locaboo: Spielplus (DFBnet)](https://help.locaboo.com/en/einstellungen/integrationen/) · [Spielplan aus DFBnet in Google Kalender (2018)](https://www.steffenbischoff.com/2018/08/spielplan-aus-dfbnet-in-google-kalender-importieren/) · [Anleitung ICS-Import und Widgets (Vereinsseite)](https://rsv-mellensee.de/index.php/anleitung-bilder-im-beitrag-2)
- [FUSSBALL.DE-Widget-Dokumentation](https://www.fussball.de/static/egm/5.01.00.1419/pdf/documentation-widget.pdf) · [Kurzanleitung Widget-Generierung (DFBnet)](https://portal.dfbnet.org/fileadmin/content/downloads/Kurzanleitung_fuer_Widget_Generierung.pdf) · [So baue ich Widgets ein](https://www.fussball.de/newsdetail/so-baue-ich-widgets-ein-tipps-fuer-webmaster/-/article-id/130660)
- [BFV-Team-App im App Store](https://apps.apple.com/DE/app/id1403863269) · [BFV-Team-App für Trainer (Handout)](https://78424.coco-online.de/uploads/91871746437773-hIRnETLT/20211015handout-bfv-team-app-fur-trainer.pdf) · [Elektronischer Spielbericht ab 2020](https://kreis4.fvn.de/media/elektronischer_spielbericht-ab2020.pdf) · [TEAMPUNKT-Funktionen (DFB)](https://portal.dfbnet.org/fileadmin/content/downloads/TEAMPUNKT/190320_TEAMPUNKT_Features_final_small.pdf)
- [SpielerPlus: Import BFV](https://support.spielerplus.de/hc/en-us/articles/37358866741137--Import-dates-from-the-Bavarian-Football-Association-into-TeamPlus) · [SpielerPlus: Kalender-URL (.ics)](https://support.spielerplus.de/hc/en-us/articles/37058387865489-Import-events-with-calendar-URL-ics-into-TeamPlus) · [SpielerPlus: Spielplan-Import Deutschland](https://support.spielerplus.de/hc/en-us/articles/27303971916561--Schedule-Import-for-German-Soccer-Teams-Easily-Import-Match-Dates-into-TeamPlus) · [handball.net: automatischer Import in SpielerPlus](https://www.handball.net/news/spielerplus-automatischer-import-spielplaene-direkt-verknuepfen)
- [Spond: Import fotball.no](https://help.spond.com/app/en/articles/129669-import-matches-from-handball-no-and-fotball-no)

## 5. Welche Exporte DFBnet bereitstellt (Recherche 19.10.2026)

**Grenze:** DFBnet liegt hinter Anmeldung. Ich konnte nur öffentliche Hilfeseiten, Handbücher und Verbandsunterlagen über die Suche lesen (die Seiten selbst waren nicht abrufbar) und mich nicht anmelden. Echte Dateien und Spaltenüberschriften lassen sich nur mit einem DFBnet-Zugang prüfen (siehe Abschnitt 6).

| Modul / Stelle | Export | Format | Hinweise | Quelle |
| -------------- | ------ | ------ | -------- | ------ |
| **Spielplan einer Staffel** (Ergebnismeldung, Spielplan) | Schaltfläche „Export“ | **CSV** (Standarddateiname `spielplan.csv`), „Drucken“ erzeugt **PDF** | Dieselben Angaben wie die Bildschirmansicht, **ohne Ergebnisse**; Spaltenüberschriften laut Hilfe „selbsterklärend“, **keine Spaltenbeschreibung veröffentlicht** | DFBnet-Onlinehilfe |
| **Vereinsspielplan** (Sicht des Vereins) | CSV mit Zeitraumauswahl (Hilfe von 2012) | CSV | In der aktuellen Hilfe zur Vereinssicht des Staffelleiters ist CSV **nicht** möglich, nur PDF; welcher Zugang den Vereins-CSV heute noch hat, ist offen | Release-Hinweis 2012, aktuelle Hilfe |
| **DFBnet Verein** (Vereinsverwaltung) | Mein Portal › Administration › Import/Export › Export | **CSV** (Semikolon): Adressdaten (Mitglieder, Firmen, Kontakte, Private Adressen), Mitgliederlisten, Kontenlisten | Import höchstens 1.000 Datensätze je Datei (DFB-Testseite); Feldzuordnung als Profil speicherbar; Dokumente von 2007–2021, Menüs können abweichen | DFBnet-Verein-Handbuch, DFB-Confluence |
| **DFB-Statistik** (Mitgliederzahlen) | Drucken / Export | **PDF** oder **CSV** | Vereinsname, DFBnet-Vereinsnummer, Gesamt-Mitgliederzahl | Anleitung 2021 |
| **Mannschaftsmeldung** | **Upload** (nicht Export) | CSV, Semikolon oder Komma: Vereinsnummer, Mannschaftsnummer, Staffelnummer, optional Schlüsselzahl | Dient dem Zuordnen von Mannschaften zur Staffel | DFBnet-FAQ Spielplanung |
| **Spielbericht Online / elektronischer Spielbericht** | kein Datei-Export belegt | – | Bearbeitung nur durch den angesetzten Schiedsrichter mit eigenem DFBnet-Zugang, **nach** dem Spiel; Vereine melden Ergebnis, Aufstellung über Verbands-Apps | Landesverbands-Anleitungen |
| **Vereinsmeldebogen, Spielberechtigungsliste, Pass-Online** | **kein Export belegt** | – | Vereine pflegen eigene Daten mit Vereinsnummer und Anmeldung; Download der Spielberechtigungsliste nicht gefunden | Landesverbands-Unterlagen |
| **FUSSBALL.DE** (öffentlich) | **Widgets** (JavaScript-Einbettung); iCal für Mannschaften **nicht bestätigt** | JS-Snippet | kein JSON/REST belegt | FUSSBALL.DE-Dokumentation |
| **BFV-Team-App** (Bayern) | iCal-Abo je Mannschaft („iCal Subscription“) | iCalendar | von SpielerPlus-Hilfe beschrieben; nur für Bayern belegt | SpielerPlus-Hilfe |
| **DFBnet-App** | Ergebnis-Ticker, Spielbericht, Ansetzung | – | Ticker-Ergebnis kann in die Ergebnismeldung übernommen werden | App-Store |

**Fazit:** Verlässlich belegt sind **CSV-Exporte** (Spielplan der Staffel, Mitglieder- und Adresslisten im Vereinsverwaltungs-Modul) und **PDF**. Es gibt **keinen belegten Export** für Ergebnisse, Spielberichte, Aufstellungen, Spielberechtigungsliste, Pässe oder Tabellen. **iCal** kommt nur aus Verbands-Apps (Bayern) bzw. ist bei FUSSBALL.DE unbestätigt. Ein **maschinenlesbarer Zugang** (API) ist nicht belegt.

## 6. Was zu prüfen ist (mit DFBnet-Zugang)

1. Aus dem **eigenen DFBnet-Zugang** je einen Export ziehen (anonymisieren, wo Personen drin sind): Staffel-Spielplan (CSV), Vereinsspielplan (falls vorhanden), Mitglieder- und Adressliste (DFBnet Verein), DFB-Statistik. **Spaltenüberschriften, Trennzeichen, Zeichensatz und Datumsformat** festhalten.
2. Auf FUSSBALL.DE bzw. in der Landesverbands-App prüfen, ob für die eigene Mannschaft ein **iCal-/Kalenderlink** angeboten wird (Menü der Mannschaft).
3. Beim Landesverband (Spielbetrieb/DFBnet-Support) nachfragen: gibt es **weitere Exporte** (Ergebnisse, Spielberechtigungsliste) und eine **Schnittstelle für Vereinssoftware**?
4. Mit den echten Dateien den vorhandenen **Spielplan-Import** (Paket I) gegen das Original testen und die Spaltenvorbelegung festschreiben (laut `SPIELPLAN-IMPORT.md` ist das Exportformat bisher nicht verifiziert).

## Weitere Quellen (Abschnitt 5)

- [DFBnet-Onlinehilfe: Spielplan](https://portal.dfbnet.org/de/service/online-hilfe/meisterschaft/spielplanbearbeitung/spielplan) · [Vereinssicht des Staffelleiters](https://portal.dfbnet.org/de/service/online-hilfe/ergebnismeldung/staffelleiter/vereinssicht) · [FAQ Spielplanung](https://portal.dfbnet.org/de/service/faq/spielplanung) · [Release DFBnet Spielplanung 4.20](https://portal.dfbnet.org/fileadmin/content/downloads/freigabe/msb/121022-DFBnet-Spielplanung-4.20.pdf)
- [Anwender-Handbuch DFBnet Verein](https://portal.dfbnet.org/fileadmin/content/downloads/handbuecher/DFBnetVerein_Handbuch-Admin.pdf) · [Import/Export DFBnet Verein (DFB-Testseite)](https://intg-confluence.dfbnet.org/pages/viewpage.action?pageId=40792081) · [CSV-Datenimport 2007](https://www.berliner-fussball.de/fileadmin/files/Dateien/Spielbetrieb/DFBnet_Vereinsverwaltung_CSV_Import_2007.pdf) · [DFB-Statistik-Anleitung 2021](https://portal.dfbnet.org/fileadmin/content/downloads/DFBnet_Verein/DFBnetVerein_Anleitung_DFB-Statistik_NEU.pdf)
- [HFV-Info: Module für Vereine](https://epub.sub.uni-hamburg.de/epub/volltexte/2025/191227/pdf/HFV_Info_Nr.33_12.pdf) · [Spielbericht Online (SFV)](https://www.sfv-online.de/fileadmin/content/PDFs/DFBnet/Spielbericht_Online/Spielbericht_Online_Anleitung_Schiedsrichter.pdf) · [DFBnet-App](https://apps.apple.com/app/id424424865)
