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
| Vereinsfarbe (5 Farben) und Wappen in der ganzen App | M 10, K 8 | ✅ | Wappen vorerst als Kürzel; Logo-Upload offen |
| Hell / dunkel / automatisch | K 8 | ✅ | |
| Farben mit Bedeutung (dringend, Aktion, Info, erledigt, archiviert) | K 2 | ✅ | |
| Mannschafts-Badges (B1, 1., AH) und Tags für Quelle/Typ | K 2 | ✅ | |
| Verwaltungsmodus als „App in der App“ mit eigener Navigation | M 8, K 6 | ⬜ | |

## 2. Home – persönliches Dashboard

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Startseite je Rolle verschieden (Spieler, Trainer, Eltern, Vorstand) | M 3–4, K 3 | ✅ | |
| Nächstes Spiel mit Countdown und Zu-/Absage | M 3 | ✅ | |
| Neuigkeiten für dich (nach Priorität und Betroffenheit sortiert) | M 3, K 3 | ✅ | |
| Nächste Termine (eigene, Kinder, Trainerrollen, Gastspiele) | M 3, K 3 | ✅ | |
| Offene Aktionen (Zusagen, Umfragen, Freigaben, Aufgaben) | M 3–4, K 3 | 🟡 | Anzeige fertig; Umfragen und Freigaben noch nicht bedienbar |
| Persönliche Kasse / Teamkasse | M 3, K 3 | 🟡 | Saldo sichtbar; Details fehlen |
| Vorstand: Verein im Überblick (Teams, Mitglieder, Freigaben, Event) | M 4 | ✅ | |
| Umfragen mit Schnellantwort | K 3 | ⬜ | |
| Persönliche Statistik | K 3 | ⬜ | |

## 3. Mannschaft (Team)

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| „Meine Teams“ für Trainer mehrerer Mannschaften | M 6 | 🟡 | Umschalten zwischen Teams fertig; Kacheln mit Zusagequote und offenen Aufgaben fehlen |
| Team-Cockpit mit Tabs Übersicht / Termine / Kader / Statistik | M 7, K 4 | 🟡 | nur Termine |
| Kaderstatus (Spieler, verfügbar, abgesagt, Urlaub) | M 7 | ⬜ | |
| Letzte Ergebnisse | M 7 | ⬜ | Ergebnisse in Demodaten vorhanden |
| Trainingswoche mit Zusagen | M 7 | ⬜ | |
| Team-Highlights (Tabellenplatz, Tore, Trainingsquote) | M 7 | ⬜ | |
| Teamliste: Spieler, Trainer, Betreuer, Rückennummern, Positionen | K 4 | ⬜ | Daten vorhanden |
| Kader / Aufstellung / Nominierung für ein Spiel | M 4, K 4 | ⬜ | |
| Spielbericht: Ergebnis, Tore, Assists, Karten | K 4 | ⬜ | |
| Statistik (Aus / Basis / Erweitert / Individuell) | K 4 | ⬜ | |
| Feste Rückennummern (saisonweit, spielbezogen, aus) | M 10, K 4 | 🟡 | in Daten und Modulen hinterlegt |
| Mannschaftskasse: Saldo, Buchungen, Strafen, Getränke, Einzahlungen, Bericht-Export | M 16, K 4 | 🟡 | Daten vorhanden; nur Saldo sichtbar |
| Teambezogene Dokumente und Aufgaben | K 4 | ⬜ | |
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
| Trainer korrigiert Zu-/Absagen nach Fristablauf | K 9 | 🟡 | im Backend fertig; Bedienung in der App fehlt |
| Absagegrund angeben | M 16 | ⬜ | |
| Abwesenheiten melden (Urlaub, Verletzt, Gesperrt, Sonstiges; alle oder einzelne Teams) | M 16, K 9 | 🟡 | Daten und Wirkung vorhanden; Eingabe fehlt |
| Kalenderexport | M 15, 17 | ⬜ | |
| Termine anlegen, ändern, absagen; Serientermine | K 4, 6 | ⬜ | |
| Änderungen zeigen alt und neu (z. B. Treffpunkt) | K 10 | ⬜ | |

## 5. Gastspieler & Spielerbedarf

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Gastspieler im Termin (bleibt Mitglied seines Stammteams) | K 9 | ✅ | Anzeige; Termin erscheint beim Gastspieler |
| Spielerbedarf melden („2–3 Spieler, Abwehr“) | M 17, K 6 | ⬜ | |
| Kapazität anbieten („bis zu 2 Spieler verfügbar“) | M 17, K 6 | ⬜ | |
| Abgebender Trainer wählt Spieler aus; Termin erscheint automatisch | K 6, 9 | ⬜ | |
| Aggregierte Verfügbarkeit anderer Teams (ohne Gründe) | K 6, 7 | ⬜ | |

## 6. Verein

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Vereinsnews | M 5, 13, K 5 | ✅ | |
| Vereinstermine (Sitzungen, Veranstaltungen, Arbeitseinsätze) | M 5, K 5 | 🟡 | als Liste; kein Kalender |
| Nächstes Vereinsevent hervorgehoben | M 5 | ⬜ | |
| Veranstaltungsseite mit Programm, Ort, Ansprechperson, „Teilnehmen“ | M 14 | ⬜ | |
| Helfer gesucht / Helferschichten eintragen | M 5, 14, K 5 | ⬜ | Schichten in Demodaten vorhanden |
| Heute auf der Anlage | M 5 | ⬜ | |
| Mannschaften des Vereins (Senioren, Jugend, Frauen, AH) | K 5 | ⬜ | |
| Ansprechpartner (Vorstand, Jugendleitung, Trainer) | K 5 | ⬜ | |
| Dokumente: Kategorien, Filter, Suche, Upload | M 9, K 5 | ⬜ | Metadaten in Demodaten vorhanden |
| Austausch / Mini-Forum (wenige, moderierte Themen, Ablaufdatum) | M 5, K 11 | ⬜ | optionales Modul |
| Fundbüro, Marktplatz, Vereinswissen/Wiki | K 5, 12 | ⬜ | optionale Module |

## 7. Kommunikation

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| News lesen | M 13 | ✅ | |
| News-Detail mit Bild, Aufrufen, „Gefällt mir“ | M 13 | 🟡 | Text aufklappbar; Bild und „Gefällt mir“ fehlen |
| Lesebestätigung (optional) | K 11 | ⬜ | |
| Umfragen beantworten, Frist, Ergebnis (ggf. erst nach Fristende) | M 13, K 11 | ⬜ | Umfragen in Demodaten vorhanden |
| Anfragen / Freigaben mit zielgerichteten Kommentaren | K 11 | ⬜ | |
| News und Umfragen erstellen, Freigabe-Workflow | M 8, K 6 | ⬜ | |
| Kein Gruppenchat (bewusst) | K 1, 11 | ✅ | Grundsatz |

## 8. Benachrichtigungen

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Notification-Center mit Filtern | M 12, K 10 | ✅ | |
| Dringendes oben, Gruppen Heute / Früher | M 12 | 🟡 | Dringendes oben; Gruppierung fehlt |
| Antippen führt direkt zum Inhalt | K 10 | 🟡 | für Termine; andere Ziele folgen mit den Funktionen |
| Vier Ebenen (dringend, persönlich wichtig, Aktion, Info) | K 10 | ✅ | |
| Einstellungen je Kategorie und Team, Erinnerungszeitpunkt, Ruhezeiten | M 12, K 10 | ⬜ | |
| Sammelhinweise für Trainer statt Einzelmeldungen | K 10 | ⬜ | |
| Push aufs Handy | M 12, K 10 | ⬜ | |

## 9. Profile

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Mein Profil: Rollen, Teams, Kontakt | M 11 | ✅ | |
| Meine Kinder | K 7 | ✅ | |
| Spielerprofil: Verfügbarkeit, Saisonstatistik, Rückennummer, starker Fuß, Position | M 11 | ⬜ | Daten vorhanden |
| Sichtbarkeit der Kontaktdaten festlegen | M 11 | ⬜ | Daten vorhanden |
| Profil bearbeiten | M 11 | ⬜ | |

## 10. Platzbelegung & Betrieb

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Platzbelegung Tag / Woche / Monat je Platz | M 15, K 5–6 | ⬜ | Plätze und Termine vorhanden |
| Konfliktwarnung bei Überschneidungen | M 15 | ⬜ | wird in Demodaten bereits geprüft |
| Sperrungen | M 15, K 6 | 🟡 | als abgesagte Termine abgebildet |
| Kabinen, Material, Schlüssel, Schäden | K 6, 12 | ⬜ | optionale Module |

## 11. Verwaltung

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Verwaltungsübersicht (Teams, Mitglieder, offene Anfragen) | M 8 | ⬜ | |
| Mitglieder: Stammdaten, Ein-/Austritte, Mannschaftszuordnung | K 6–7 | ⬜ | |
| Mannschaften verwalten, Saisonplanung, Saisonwechsel | K 6–7 | ⬜ | |
| Spielerbewegungen (Zu-/Abgänge, Leihe) | M 8, K 6 | ⬜ | |
| Rollen & Rechte vergeben | M 8, K 7 | 🟡 | 9 Rollen und Prüfung im Backend fertig; Bedienung fehlt |
| Veranstaltungen planen | M 8 | ⬜ | |
| Audit-Log | K 6, 16 | 🟡 | wird geschrieben; Anzeige fehlt |
| Import / Sync-Status | K 6, 14 | ⬜ | |
| Schiedsrichterverwaltung | K 7, 12 | ⬜ | optionales Modul |

## 12. Einrichtung & Module

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Vereins-Ersteinrichtung als Assistent (Name, Logo, Farbe, Bereiche, Admins) | M 10, K 8 | ⬜ | |
| Mannschafts-Einrichtung mit Vorlagen (leistungsorientiert, klassisch, Jugend, Freizeit) | M 10, K 8 | ⬜ | |
| Module je Verein / Bereich / Mannschaft mit Vererbung | K 4, 8 | 🟡 | im Backend fertig; Bedienung fehlt |
| Update-Center: „Einrichten / Später / Nicht verwenden“ | M 17, K 13 | ⬜ | Module dafür in Demodaten vorbereitet |
| Einladungen per Link / QR-Code mit Freigabe | M 10, K 8 | ⬜ | Schritt 3 der Roadmap |

## 13. Sicherheit, Betrieb, Integrationen

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Anmeldung, sichere Passwörter, widerrufbare Sitzungen | K 16 | ✅ | |
| Rechteprüfung immer serverseitig | K 16 | ✅ | |
| Mandantenfähigkeit (`club_id`) | K 14 | ✅ | |
| 2-Faktor-Anmeldung für privilegierte Rollen | K 16 | ⬜ | |
| Server, HTTPS, getrennte Backups | K 15–16 | ⬜ | mit dem IONOS-VPS |
| Import (CSV) und Anbindung FUSSBALL.DE / DFBnet | K 14 | ⬜ | Phase 4 |

---

## Zusammenfassung

| Bereich | ✅ | 🟡 | ⬜ |
| --- | ---: | ---: | ---: |
| Grundstruktur & Design | 5 | 0 | 1 |
| Home | 5 | 2 | 2 |
| Mannschaft | 0 | 4 | 10 |
| Termine & Teilnahme | 6 | 2 | 4 |
| Gastspieler & Spielerbedarf | 1 | 0 | 4 |
| Verein | 1 | 1 | 9 |
| Kommunikation | 2 | 1 | 4 |
| Benachrichtigungen | 2 | 2 | 3 |
| Profile | 2 | 0 | 3 |
| Platzbelegung & Betrieb | 0 | 1 | 3 |
| Verwaltung | 0 | 2 | 7 |
| Einrichtung & Module | 0 | 1 | 4 |
| Sicherheit, Betrieb, Integrationen | 3 | 0 | 3 |
| **Gesamt** | **27** | **16** | **57** |
