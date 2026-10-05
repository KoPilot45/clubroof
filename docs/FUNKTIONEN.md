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
| Gekachelte Untermenüs in Team, Verein und Mehr – Kacheln entstehen aus den aktivierten Modulen | K 4 | ✅ | spätere Funktionen als „Bald verfügbar“ |
| Verwaltungsmodus als „App in der App“ mit eigener Navigation | M 8, K 6 | ⬜ | |

## 2. Home – persönliches Dashboard

| Funktion | Quelle | Stand | Anmerkung |
| --- | --- | --- | --- |
| Startseite je Rolle verschieden (Spieler, Trainer, Eltern, Vorstand) | M 3–4, K 3 | ✅ | |
| Nächstes Spiel mit Countdown und Zu-/Absage | M 3 | ✅ | |
| Neuigkeiten für dich (nach Priorität und Betroffenheit sortiert) | M 3, K 3 | ✅ | |
| Nächste Termine (eigene, Kinder, Trainerrollen, Gastspiele) | M 3, K 3 | ✅ | |
| Offene Aktionen (Zusagen, Umfragen, Freigaben, Aufgaben) | M 3–4, K 3 | 🟡 | Zusagen und Umfragen bedienbar; Freigaben folgen mit der Verwaltung |
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
| Kader / Aufstellung / Nominierung für ein Spiel | M 4, K 4 | ⬜ | |
| Spielbericht: Ergebnis, Tore, Assists, Karten | K 4 | ⬜ | |
| Statistik (Aus / Basis / Erweitert / Individuell) | K 4 | 🟡 | Basis: Bilanz, Tore, Trainingsbeteiligung; Spielerstatistik (Tore, Assists) folgt mit dem Spielbericht |
| Feste Rückennummern (saisonweit, spielbezogen, aus) | M 10, K 4 | 🟡 | im Kader sichtbar; Einstellung folgt mit der Mannschafts-Einrichtung |
| Mannschaftskasse: Saldo, Buchungen, Strafen, Getränke, Einzahlungen, Bericht-Export | M 16, K 4 | 🟡 | alles außer Bericht-Export; Buchen nur für Kassenverantwortliche |
| Teambezogene Dokumente und Aufgaben | K 4 | 🟡 | Dokumente der Mannschaft; Aufgaben folgen |
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
| Termine anlegen, ändern, absagen; Serientermine | K 4, 6 | 🟡 | Anlegen und Absagen (mit Benachrichtigung); Ändern und Serien folgen |
| Änderungen zeigen alt und neu (z. B. Treffpunkt) | K 10 | ⬜ | |

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
| Dokumente: Kategorien, Filter, Suche, Upload | M 9, K 5 | 🟡 | Öffnen über signierte Links; Upload folgt mit der Verwaltung |
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
| News und Umfragen erstellen, Freigabe-Workflow | M 8, K 6 | ⬜ | |
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
| Spielerprofil: Verfügbarkeit, Saisonstatistik, Rückennummer, starker Fuß, Position | M 11 | 🟡 | Saisonwerte aus Trainings und Spielen; Tore/Assists folgen mit dem Spielbericht |
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
| Grundstruktur & Design | 6 | 0 | 1 |
| Home | 7 | 2 | 0 |
| Mannschaft | 5 | 6 | 3 |
| Termine & Teilnahme | 9 | 1 | 2 |
| Gastspieler & Spielerbedarf | 5 | 0 | 0 |
| Verein | 7 | 2 | 2 |
| Kommunikation | 4 | 1 | 2 |
| Benachrichtigungen | 2 | 2 | 3 |
| Profile | 3 | 2 | 0 |
| Platzbelegung & Betrieb | 3 | 0 | 1 |
| Verwaltung | 0 | 2 | 7 |
| Einrichtung & Module | 0 | 1 | 4 |
| Sicherheit, Betrieb, Integrationen | 3 | 0 | 3 |
| **Gesamt** | **54** | **19** | **28** |
