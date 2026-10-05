# Funktionsliste

Alle Funktionen aus den beiden Grundlagendokumenten mit aktuellem Umsetzungsstand.
Diese Liste wird bei jedem Entwicklungsschritt aktualisiert.

**Quellen:** M = *Clubroof Verkaufsmappe* (Seitenzahl), K = *VereinsApp Konzept* (Kapitel)

**Stand:** ✅ umgesetzt · 🟡 teilweise (z. B. Daten und Backend vorhanden, Bedienung fehlt) · ⬜ offen

Stand: 05.10.2026

---

## 1. Grundstruktur & Design

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Vier Bereiche: Home, Team, Verein, Mehr | M 1, K 2 | ✅ | |
| Vereinsfarbe (5 Farben) und Wappen in der ganzen App | M 10, K 8 | ✅ | Verwaltung → Verein & Design: Logo, Name, Farbe, Darstellung; ohne Logo erscheint ein Wappen mit Kürzel |
| Hell / dunkel / automatisch | K 8 | ✅ | |
| Farben mit Bedeutung (dringend, Aktion, Info, erledigt, archiviert) | K 2 | ✅ | |
| Mannschafts-Badges (B1, 1., AH) und Tags für Quelle/Typ | K 2 | ✅ | |
| Gekachelte Untermenüs in Team, Verein und Mehr – Kacheln entstehen aus den aktivierten Modulen | K 4 | ✅ | spätere Funktionen als „Bald verfügbar“ |
| Verwaltungsmodus als „App in der App“ mit eigener Navigation | M 8, K 6 | ⬜ | |

## 2. Home – persönliches Dashboard

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Startseite je Rolle verschieden (Spieler, Trainer, Eltern, Vorstand) | M 3–4, K 3 | ✅ | |
| Nächstes Spiel mit Countdown und Zu-/Absage | M 3 | ✅ | |
| Neuigkeiten für dich (nach Priorität und Betroffenheit sortiert) | M 3, K 3 | ✅ | |
| Nächste Termine (eigene, Kinder, Trainerrollen, Gastspiele) | M 3, K 3 | ✅ | |
| Offene Aktionen (Zusagen, Umfragen, Freigaben, Aufgaben) | M 3–4, K 3 | ✅ | Zusagen, Umfragen und News-Freigaben führen direkt zum Inhalt |
| Persönliche Kasse / Teamkasse | M 3, K 3 | ✅ | Karte führt zur Mannschaftskasse |
| Vorstand: Verein im Überblick (Teams, Mitglieder, Freigaben, Event) | M 4 | ✅ | |
| Umfragen mit Schnellantwort | K 3 | 🟡 | über „Offene Aktionen“ direkt zur Umfrage; Antwort auf der Startseite selbst fehlt |
| Persönliche Statistik | K 3 | ✅ | über „Mehr → Meine Statistik“ |

## 3. Mannschaft (Team)

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| „Meine Teams“ für Trainer mehrerer Mannschaften | M 6 | 🟡 | Umschalten zwischen Teams fertig; Kacheln mit Zusagequote und offenen Aufgaben fehlen |
| Team-Cockpit mit Übersicht / Termine / Kader / Statistik | M 7, K 4 | ✅ | als Übersicht mit Kacheln |
| Kaderstatus (Spieler, verfügbar, abgesagt, Urlaub) | M 7 | ✅ | für den nächsten Termin |
| Letzte Ergebnisse | M 7 | ✅ | |
| Trainingswoche mit Zusagen | M 7 | ✅ | |
| Team-Highlights (Tabellenplatz, Tore, Trainingsquote) | M 7 | 🟡 | Bilanz, Tore, Trainingsquote; Tabellenplatz braucht FUSSBALL.DE-Anbindung |
| Teamliste: Spieler, Trainer, Betreuer, Rückennummern, Positionen | K 4 | ✅ | mit heutiger Verfügbarkeit |
| Kader / Aufstellung / Nominierung für ein Spiel | M 4, K 4 | ✅ | Startelf und Bank inkl. Gastspieler, Entwurf nur fürs Trainerteam, Veröffentlichen benachrichtigt die Nominierten; Abgesagte nicht wählbar |
| Spielbericht: Ergebnis, Tore, Assists, Karten | K 4 | ✅ | Tore (auch Elfmeter, Eigentor des Gegners) mit Vorlage und Minute, Gelb/Gelb-Rot/Rot; Tore müssen zum Ergebnis passen |
| Statistik (Aus / Basis / Erweitert / Individuell) | K 4 | 🟡 | Bilanz, Trainingsbeteiligung und sortierbare Kader-Statistik (Einsätze, Startelf, Tore, Vorlagen, Karten; Trainingsquoten nur fürs Trainerteam). Stufen „Erweitert/Individuell“ noch ohne eigene Inhalte |
| Feste Rückennummern (saisonweit, spielbezogen, aus) | M 10, K 4 | ✅ | Trainerteam wählt den Modus und vergibt Nummern (keine Doppelten); je Spiel in der Aufstellung änderbar |
| Mannschaftskasse: Saldo, Buchungen, Strafen, Getränke, Einzahlungen, Bericht-Export | M 16, K 4 | 🟡 | alles außer Bericht-Export; Buchen nur für Kassenverantwortliche |
| Teambezogene Dokumente und Aufgaben | K 4 | 🟡 | Dokumente der Mannschaft, Trainer laden selbst hoch; Aufgaben folgen |
| Trainingsplanung (Übungen, Schwerpunkte, Material) | M 17, K 4 | ⬜ | optionales Modul |

## 4. Termine & Teilnahme

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Termindetails: Anstoß, Treffpunkt, Spielort, Ansprechperson | M 15 | ✅ | |
| Zu- und Absagen (auch für Kinder) | M 15, K 9 | ✅ | |
| Absagefrist je Mannschaft und Terminart mit Countdown | M 10, 15, K 9 | ✅ | |
| Drei Teilnahme-Modelle (automatische Zusage, aktive Antwort, nur Abwesenheiten) | M 10, K 9 | ✅ | |
| Teilnehmerübersicht (zugesagt, offen, abgesagt) | M 15 | ✅ | |
| Gründe nur für Verantwortliche sichtbar (Datensparsamkeit) | K 7 | ✅ | |
| Trainer korrigiert Zu-/Absagen nach Fristablauf | K 9 | ✅ | |
| Absagegrund angeben | M 16 | ✅ | Auswahl und optionaler Hinweis |
| Abwesenheiten melden (Urlaub, Verletzt, Gesperrt, Sonstiges; alle oder einzelne Teams) | M 16, K 9 | ✅ | auch für Kinder; Löschen nimmt automatische Absagen zurück |
| Kalenderexport | M 15, 17 | ⬜ | |
| Termine anlegen, ändern, absagen; Serientermine | K 4, 6 | ✅ | Wöchentliche Serien (bis 26 Wochen, Ortszeit bleibt bei Zeitumstellung); Ändern einzeln oder „diesen und folgende“; Platzkonflikt-Prüfung |
| Änderungen zeigen alt und neu (z. B. Treffpunkt) | K 10 | ✅ | Karte „Zuletzt geändert“ im Termin (14 Tage) und Benachrichtigung mit alt → neu |

## 5. Gastspieler & Spielerbedarf

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Gastspieler im Termin (bleibt Mitglied seines Stammteams) | K 9 | ✅ | Anzeige; Termin erscheint beim Gastspieler |
| Spielerbedarf melden („2–3 Spieler, Abwehr“) | M 17, K 6 | ✅ | Pro Termin ein offener Bedarf; Trainer der anderen Teams werden mit passendem Angebot benachrichtigt |
| Kapazität anbieten („bis zu 2 Spieler verfügbar“) | M 17, K 6 | ✅ | Angebot je Tag und Mannschaft |
| Abgebender Trainer wählt Spieler aus; Termin erscheint automatisch | K 6, 9 | ✅ | Sperre bei Abwesenheit, Parallelterminen, Doppelnominierung und gedecktem Bedarf; Benachrichtigung an Spieler, Eltern, anfragendes Trainerteam. Aufstellung/Spielbericht folgen (E2) |
| Aggregierte Verfügbarkeit anderer Teams (ohne Gründe) | K 6, 7 | ✅ | Nur Zahlen |

## 6. Verein

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Vereinsnews | M 5, 13, K 5 | ✅ | |
| Vereinstermine (Sitzungen, Veranstaltungen, Arbeitseinsätze) | M 5, K 5 | 🟡 | Liste für gut drei Monate; Kalenderansicht folgt |
| Nächstes Vereinsevent hervorgehoben | M 5 | ✅ | |
| Veranstaltungsseite mit Programm, Ort, Ansprechperson, „Teilnehmen“ | M 14 | ✅ | |
| Helfer gesucht / Helferschichten eintragen | M 5, 14, K 5 | ✅ | mit Kapazität; Namen nur für Organisatoren |
| Heute auf der Anlage | M 5 | ✅ | |
| Mannschaften des Vereins (Senioren, Jugend, Frauen, AH) | K 5 | ✅ | mit Liga, Spielerzahl, Trainern |
| Ansprechpartner (Vorstand, Jugendleitung, Trainer) | K 5 | ✅ | Kontaktdaten nach Sichtbarkeitseinstellung |
| Dokumente: Kategorien, Filter, Suche, Upload | M 9, K 5 | ✅ | Upload (PDF, Word, Excel, JPG, PNG bis 10 MB; Typ wird am Inhalt geprüft) und Löschen je Bereich mit `documents.manage`; Öffnen über signierte Links |
| Austausch / Mini-Forum (wenige, moderierte Themen, Ablaufdatum) | M 5, K 11 | ⬜ | optionales Modul |
| Fundbüro, Marktplatz, Vereinswissen/Wiki | K 5, 12 | ⬜ | optionale Module |

## 7. Kommunikation

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| News lesen | M 13 | ✅ | |
| News-Detail mit Bild, Aufrufen, „Gefällt mir“ | M 13 | ✅ | Aufrufe einmal je Person |
| Lesebestätigung (optional) | K 11 | 🟡 | Lesen wird je Person erfasst; Anzeige für Verfasser folgt |
| Umfragen beantworten, Frist, Ergebnis (ggf. erst nach Fristende) | M 13, K 11 | ✅ | Stimme änderbar bis Fristende |
| Anfragen / Freigaben mit zielgerichteten Kommentaren | K 11 | ⬜ | |
| News und Umfragen erstellen, Freigabe-Workflow | M 8, K 6 | ✅ | News mit Bild: Schreiben je Bereich, Einreichen, Freigeben oder mit Rückmeldung zurückgeben, Korrigieren, Zurückziehen. Umfragen: Erstellen je Bereich (2–10 Antworten, Frist, Sichtbarkeit), vorzeitig beenden; Beteiligte werden benachrichtigt |
| Kein Gruppenchat (bewusst) | K 1, 11 | ✅ | Grundsatz |

## 8. Benachrichtigungen

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Notification-Center mit Filtern | M 12, K 10 | ✅ | |
| Dringendes oben, Gruppen Heute / Früher | M 12 | 🟡 | Dringendes oben; Gruppierung fehlt |
| Antippen führt direkt zum Inhalt | K 10 | 🟡 | Termine, News, Umfragen, Abwesenheiten; weitere folgen |
| Vier Ebenen (dringend, persönlich wichtig, Aktion, Info) | K 10 | ✅ | |
| Einstellungen je Kategorie und Team, Erinnerungszeitpunkt, Ruhezeiten | M 12, K 10 | ⬜ | |
| Sammelhinweise für Trainer statt Einzelmeldungen | K 10 | ⬜ | |
| Push aufs Handy | M 12, K 10 | ⬜ | |

## 9. Profile

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Mein Profil: Rollen, Teams, Kontakt | M 11 | ✅ | |
| Meine Kinder | K 7 | ✅ | |
| Spielerprofil: Verfügbarkeit, Saisonstatistik, Rückennummer, starker Fuß, Position | M 11 | ✅ | Saisonwerte inkl. Einsätzen, Toren und Vorlagen |
| Sichtbarkeit der Kontaktdaten festlegen | M 11 | ✅ | Verein / Mannschaft und Trainer / nur Trainer |
| Profil bearbeiten | M 11 | 🟡 | Position, Fuß, Telefon, E-Mail, Sichtbarkeit (auch für Kinder); Profilfoto folgt mit dem Datei-Upload |

## 10. Platzbelegung & Betrieb

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Platzbelegung Tag / Woche / Monat je Platz | M 15, K 5–6 | ✅ | Tag und Woche in der App (Verein → Platzbelegung); der Server liefert bis zu 32 Tage |
| Konfliktwarnung bei Überschneidungen | M 15 | ✅ | Beim Anlegen eines Termins: Warnung mit „Trotzdem anlegen“; Belegungsplan markiert Überschneidungen |
| Sperrungen | M 15, K 6 | ✅ | Platzverantwortliche sperren Zeiträume, betroffene Termine werden auf Wunsch abgesagt und Beteiligte informiert; beim Anlegen von Terminen nicht übergehbar |
| Kabinen, Material, Schlüssel, Schäden | K 6, 12 | ⬜ | optionale Module |

## 11. Verwaltung

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Verwaltungsübersicht (Teams, Mitglieder, offene Anfragen) | M 8 | ✅ | Kennzahlen, Mitglieder ohne Mannschaft, offene Beitrittsanfragen, letzte Änderungen (Mehr → Verwaltung) |
| Mitglieder: Stammdaten, Ein-/Austritte, Mannschaftszuordnung | K 6–7 | ✅ | Suche/Filter, Anlegen, Bearbeiten, Aktiv/Passiv/Austritt; Zuordnung trägt Person sofort in künftige Termine ein bzw. aus. Jugendleitung sieht nur ihren Bereich |
| Mannschaften verwalten, Saisonplanung, Saisonwechsel | K 6–7 | ✅ | Anlegen/Bearbeiten/Löschen; nächste Saison vorbereiten (Teams, Module, Fristen, Trainerteams, Zusatzaufgaben, optional Spieler), Kader der neuen Saison planen, Saison starten (Kasse, Dokumente, künftige Termine, Spielerbedarf gehen mit) |
| Spielerbewegungen (Zu-/Abgänge, Leihe) | M 8, K 6 | ✅ | Wechsel im Verein, befristete Leihe (Stammteam bleibt), Zugang, Abgang; Termine werden angepasst, Historie bleibt |
| Rollen & Rechte vergeben | M 8, K 7 | ✅ | Beim Mitglied mit Geltungsbereich (z. B. Kassenwart B1); Schutz vor Rechteausweitung und Aussperren |
| Veranstaltungen planen | M 8 | ⬜ | |
| Audit-Log | K 6, 16 | ✅ | „Änderungsprotokoll“ für Vorstand und Fulladmin |
| Import / Sync-Status | K 6, 14 | 🟡 | CSV-Import der Mitglieder mit Vorschau und Dublettenprüfung; Sync-Status kommt mit FUSSBALL.DE/DFBnet |
| Schiedsrichterverwaltung | K 7, 12 | ⬜ | optionales Modul |

## 12. Einrichtung & Module

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Vereins-Ersteinrichtung als Assistent (Name, Logo, Farbe, Bereiche, Admins) | M 10, K 8 | ✅ | Auf leerem Server mit Einrichtungscode (`SETUP_TOKEN`): Verein, Farbe, Bereiche, erstes Admin-Konto; Bereiche später unter Verein & Design |
| Mannschafts-Einrichtung mit Vorlagen (leistungsorientiert, klassisch, Jugend, Freizeit) | M 10, K 8 | ✅ | Vorlage setzt die Mannschaftsmodule; danach je Modul änderbar |
| Module je Verein / Bereich / Mannschaft mit Vererbung | K 4, 8 | 🟡 | Verein und Mannschaft in der App einstellbar; Bereichsebene nur im Backend |
| Update-Center: „Einrichten / Später / Nicht verwenden“ | M 17, K 13 | ✅ | „Später“ blendet 14 Tage aus; neue Module erscheinen automatisch |
| Einladungen per Link / QR-Code mit Freigabe | M 10, K 8 | ✅ | Persönliche Einladung per E-Mail oder Mannschafts-Link/QR-Code; Selbstregistrierung (auch Eltern mit Kind) mit Freigabe durch Trainer bzw. Verwaltung |

## 13. Sicherheit, Betrieb, Integrationen

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Anmeldung, sichere Passwörter, widerrufbare Sitzungen | K 16 | ✅ | |
| Rechteprüfung immer serverseitig | K 16 | ✅ | |
| Mandantenfähigkeit (`club_id`) | K 14 | ✅ | |
| Passwort vergessen / ändern | K 16 | ✅ | Link per E-Mail (30 Minuten gültig); beim Ändern werden andere Sitzungen abgemeldet |
| 2-Faktor-Anmeldung für privilegierte Rollen | K 16 | ✅ | Authenticator-App (TOTP) mit Wiederherstellungscodes; Verein kann sie für alle mit Verwaltungsrechten verpflichtend machen |
| Server, HTTPS, getrennte Backups | K 15–16 | ⬜ | mit dem IONOS-VPS |
| Import (CSV) | K 14 | ✅ | Mitglieder samt Mannschaft; UTF-8 und Excel (Windows-1252), Semikolon oder Komma |
| Anbindung FUSSBALL.DE / DFBnet | K 14 | ⬜ | braucht Zugangsdaten des Verbands, nach dem Testserver |

---

## Zusammenfassung

| Bereich | ✅ | 🟡 | ⬜ |
| --- | ---: | ---: | ---: |
| Grundstruktur & Design | 6 | 0 | 1 |
| Home | 8 | 1 | 0 |
| Mannschaft | 8 | 5 | 1 |
| Termine & Teilnahme | 11 | 0 | 1 |
| Gastspieler & Spielerbedarf | 5 | 0 | 0 |
| Verein | 8 | 1 | 2 |
| Kommunikation | 5 | 1 | 1 |
| Benachrichtigungen | 2 | 2 | 3 |
| Profile | 4 | 1 | 0 |
| Platzbelegung & Betrieb | 3 | 0 | 1 |
| Verwaltung | 6 | 1 | 2 |
| Einrichtung & Module | 4 | 1 | 0 |
| Sicherheit, Betrieb, Integrationen | 6 | 0 | 2 |
| **Gesamt** | **76** | **13** | **14** |
