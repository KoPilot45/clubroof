# Einrichtungsassistenten: Entscheidungen und Lücken (Stand 26.10.2026)

Grundlage: Code und Doku gelesen (`setup.tsx`, `admin/team-new.tsx`, `club-cash/setup.tsx`, `teams/[id]/cash-setup.tsx`, `teams/[id]/manage.tsx`, `admin/club.tsx`, `packages/db` Schema, `docs/FUNKTIONEN.md` E2). **Nicht in der laufenden Oberfläche geprüft.** Zeichen: ✅ im Assistenten, 🟡 nur später über Einstellungen oder nur teilweise, ❌ nirgends als Entscheidung vorgesehen.

Die drei Assistenten (vier Abläufe): **Verein** (Admin), **Mannschaft** (Trainer oder Admin), **Vereinskasse** und **Mannschaftskasse** (Kassenwart).

## 1. Verein (Admin)

| Entscheidung | Stand | Anmerkung |
| --- | --- | --- |
| Name, Kurzname, Kürzel, Gründungsjahr, Anschrift, Kontakt, Webseite, Zeitzone | ✅ | |
| Spielstätte, Plätze, Kabinen, Untergrund | ✅ | |
| Logo, Vereinsfarbe, Standard-Darstellung (hell, dunkel, automatisch) | ✅ | Sprache bleibt Geräteeinstellung (bewusst) |
| Aufbau (Abteilungen) | ✅ | |
| Saisonbeginn | ❌ entfällt (27.10.) | Wechsel immer manuell durch den Verein; erste Saison wird still angelegt |
| Vorstand und Aufgaben (Rollen vergeben, Einladung nach der Einrichtung) | ✅ | auch Kassenwart (`club_treasurer`), siehe Doppelabfrage unten |
| Module für den Verein (vorbelegt nach Vereinsgröße) | ✅ | Konfiguration je Modul später |
| Module für Mannschaften im Vereinsassistenten | ❌ entfällt (27.10.) | widerspricht „Mannschaftsregeln bleiben in der Mannschaft“; jede Mannschaft wählt selbst |
| Mitglieder: später, Import oder Einladung | ✅ | |
| Standard-Sichtbarkeit der Kontaktdaten | ✅ | |
| Konto, Passwort, Zwei-Faktor | ✅ | 2FA-Pflicht für die Verwaltung (`requireTwoFactor`) wird gefragt |
| **Weitere Admins** (Zweit-Admin, Vertretung) | ❌ | „Gründer“ wird nur beim Einrichten abgefragt; ein Verein mit nur einem Admin ist ein Betriebsrisiko |
| **Vereinsvorgaben für neue Mannschaften** (Teilnahme-Modell, Fristen, Grund bei Absage Pflicht) | ❌ | jede Mannschaft stellt alles einzeln ein; keine Vorgabe vom Verein |
| **News: wer darf veröffentlichen, braucht es Freigabe** | 🟡 | im Assistenten nur Hinweis; Freigabe-Workflow existiert in der App |
| **Beitrittsanfragen: wer gibt frei** (Trainer, Admin) | ❌ | Einladung per Link/QR gibt es, die Freigaberegel wird nicht gewählt |
| **Elternzugang: ab welchem Alter ein Kind ein eigenes Konto bekommt**; Einwilligungen für Kinder (Fotos, Namen) | ❌ bewusst nicht im Assistenten (26.10.2026), Thema vorgemerkt: eigener Zugang für Kinder | Modul `parent_access` ist nur ein Schalter; Altersgrenze ist laut FAQ Sache der Eltern, Einwilligungstexte sind nirgends vorgesehen |
| **Rechte-Übersicht** (wer sieht Kasse, Mitglieder, Gründe) | 🟡 | Rollenverwaltung existiert (ROLLEN-VERWALTUNG), im Assistenten nur Vorstand |
| Ruhezeiten, Standard-Benachrichtigungen | 🟡 | Hinweise statt Einstellungen (bewusst entfallen) |

## 2. Mannschaft (Trainer)

| Entscheidung | Stand | Anmerkung |
| --- | --- | --- |
| Name, Abteilung, Saison, Altersklasse, Spielform, Liga, DFBnet-Schreibweisen | ✅ | |
| Vorlage (leistungsorientiert, klassisch, Jugend, Freizeit) | ✅ | |
| Teilnahme-Modell, Fristen (Training und Spiel getrennt), Erinnerung, Grund Pflicht, Unsicher erlauben | ✅ | |
| Treffpunkt und Treffzeiten | ✅ | |
| Trainingsserie (Wochentag, Zeit, Dauer, Platz, Zeitraum) | ✅ | „Ferien aussetzen“ fehlt (keine Ferientermine im System) |
| Trainerteam, Kader | ✅ | |
| Funktionen (Kasse, Trainingsplanung, Aufgaben, Umfragen) | ✅ | |
| Zu-/Absage-Übersicht und Aufstellung sichtbar | ✅ | |
| Spielplan (DFBnet, Tabelle, von Hand), Willkommenstext | ✅ | |
| **Abwesenheitsgründe für die Mannschaft sichtbar** | 🟡 | je Mannschaft einstellbar (Entscheidung 19.10.), steht in „Mannschaft bearbeiten“, **nicht im Assistenten** |
| **Wer sieht Trainingsbeteiligung und Quoten** (`attendanceVisibility`) | 🟡 | nur in der Bearbeitung; Datenschutzthema, gehört in den Assistenten |
| **Rückennummern** (je Spiel, fest, aus) | 🟡 | „folgt über Mannschaft bearbeiten“; für Senioren und Jugend im Spielbetrieb eine Anfangsentscheidung |
| **Positionen, Eltern mit Kindern verknüpfen** | 🟡 | später; ohne Eltern-Verknüpfung antworten Eltern nicht für das Kind, daher Kernthema bei Jugendmannschaften |
| **Gastspieler und Spielerbedarf** (mitmachen oder nicht) | ❌ | Modul vorhanden, Entscheidung nicht im Assistenten |
| **Statistik** (Tore, Karten erfassen: wer trägt ein) | ❌ | Modul vorhanden, keine Entscheidung |
| Kassenwart der Mannschaft | 🟡 | erst im Kassenassistenten der Mannschaft |

## 3. Vereinskasse (Kassenwart)

| Entscheidung | Stand | Anmerkung |
| --- | --- | --- |
| Gemeinnützigkeit (optional Kategorien vereinfachen) | ✅ | |
| Konten und Kassen mit Anfangsbestand | ✅ | |
| Kategorien-Vorlage, Kostenstellen | ✅ | |
| Beitragsarten, Zuordnungsregeln (unter n Jahre, passiv, übrige) | ✅ | ohne Geburtsdatum übersprungen |
| Zahlungserinnerungen (Tage, Text) | ✅ | |
| Kassenwart, Kassenprüfer, Sichtbarkeit der Kasse | ✅ | |
| **Haushaltsjahr** (Kalenderjahr oder Saison) | ❌ | „bleibt eigene Seite der Kasse“; bestimmt Planung, Abschluss und Statistik, gehört an den Anfang |
| **Steuerliche Bereiche je Kategorie** (ideell, Zweckbetrieb, Vermögensverwaltung, wirtschaftlich) | 🟡 | nur Gemeinnützig ja/nein; Zuordnung später |
| **Spenden:** Daten für Zuwendungsbestätigungen (Finanzamt, Freistellung) | ❌ | „Steuerdaten bleiben eigene Seiten“ |
| **Auslagenerstattung:** Freigabegrenze, Vier-Augen-Prinzip, Belegpflicht | ❌ | Modul K5 vorhanden, Regeln werden nicht gesetzt |
| **Abteilungskassen:** Zuordnung der Abteilungen zu Kassen | 🟡 | Kostenstellen ja, Abteilungskasse (K6) nicht abgefragt |
| Haushaltsplan, Kontoauszug-Import | 🟡 | nur „Nächste Schritte“ |

## 4. Mannschaftskasse (Kassenwart der Mannschaft)

| Entscheidung | Stand | Anmerkung |
| --- | --- | --- |
| Kassenwart, Anfangsbestand, Strafenkatalog (Vorlage), Getränkepreis, Beitrag oder Umlage | ✅ | |
| Sichtbarkeit (Beträge aller Beteiligten nur mit Freigabe, Monatserinnerung) | ✅ | Standard: nur eigene |
| **Wer darf buchen** (Kassenwart, Trainer) | ❌ | Text sagt „Trainer können es ohnehin“; keine Wahl |
| **Einzahlungsweg** (bar, PayPal, Überweisung) | ❌ | |
| **Saisonabschluss und Übertrag** | ❌ | |
| **Abgrenzung zur Vereinskasse** (gehört das Geld dem Verein?) | ❌ | wichtig für Gemeinnützigkeit und Kassenprüfung |

## Logik und Reihenfolge

1. **Kassenwart wird zweimal bestimmt:** im Vereinsassistenten („Vorstand und Aufgaben“, `club_treasurer`) und im Vereinskassen-Assistent („Wer führt die Kasse?“). Besser: Vereinsassistent fragt nur Vorstand und Admin, der Kassenassistent bestimmt Kassenwart und Prüfer, oder der Kassenassistent zeigt den im Vereinsassistenten gewählten Namen vorbelegt.
2. **Beitragsregeln brauchen Geburtsdaten:** Der Kassenassistent steht im Vereins-„Fertig“ vor dem Mitgliederimport, die Regeln „unter n Jahre“ greifen aber erst danach. Der Ablauf braucht den Hinweis „Zuerst Mitglieder importieren, dann Beitragsregeln“ oder die Regeln werden nach dem Import erneut angeboten.
3. **Eltern-Verknüpfung nach der Mannschaft:** Antworten für Kinder setzen die Verknüpfung voraus. Der Mannschaftsassistent endet ohne diese Entscheidung.
4. **Teilnahme-Modell einmal je Mannschaft:** Fristen sind für Training und Spiel getrennt, das Modell (automatisch zugesagt oder aktive Antwort) nicht. Im Alltag gelten oft zwei Regeln (Training automatisch, Spiele aktiv). Entscheidung nötig, ob je Terminart wählbar.
5. **Datenschutzentscheidungen sind verstreut:** Kontaktdaten (Verein), Abwesenheitsgründe, Trainingsbeteiligung, Beträge der Mannschaftskasse (je Mannschaft, teils nur in der Bearbeitung). Ein gemeinsamer Schritt „Wer sieht was“ in jedem Assistenten würde es erklärbar machen.
6. **Vereinsvorgaben fehlen:** Alles, was jede Mannschaft gleich beantwortet (Fristen, Absagegrund, Sichtbarkeit), müsste der Verein einmal vorgeben können. Sonst beantworten Trainer 10 Mal dieselben Fragen und der Verein hat keine einheitliche Linie.

## Vorschlag für ein Paket EINRICHTUNG-ENTSCHEIDUNGEN (noch nicht beschlossen)

Reihenfolge nach Nutzen: (1) Doppelabfrage Kassenwart beheben, Hinweis zur Importreihenfolge; (2) Mannschaftsassistent um „Wer sieht was“ (Abwesenheitsgründe, Trainingsbeteiligung), Rückennummern, Eltern-Verknüpfung erweitern; (3) Vereinsassistent um zweiten Admin und Vereinsvorgaben für Mannschaften erweitern; (4) Vereinskasse um Haushaltsjahr, Spenden-Angaben, Erstattungsregeln; (5) Mannschaftskasse um Buchungsrechte und Abgrenzung zur Vereinskasse. Vor Umsetzung klären: Soll das Teilnahme-Modell je Terminart wählbar sein? Gibt es Vereinsvorgaben, die Mannschaften überschreiben dürfen?

## Korrekturen nach Durchsicht des Vereinsassistenten (27.10.2026)

Der Nutzer hat die Bildschirme des bestehenden Vereinsassistenten (20 Schritte) angesehen und fünf Punkte bemängelt, die in der obigen Analyse fälschlich als ✅ standen: **Saisonbeginn** (der Wechsel ist immer manuell, der Schritt ist überflüssig), **Mannschaftsmodule im Vereinsassistenten** (widersprechen der Festlegung, dass jede Mannschaft ihre Regeln selbst bestimmt), **Schiedsrichter-Beschreibung** („Vereinsschiedsrichter für Heimspiele einteilen“ ist veraltet: Der Verband setzt Schiedsrichter bei fremden Spielen ein, die Einteilung zu Heimspielen ist entfallen), **„Per Code oder QR einladen“ als Auswahl** (Grundfunktion), **Kontaktdaten-Standard** (getrennt für Jugend und Erwachsene nötig). Umsetzung als Punkte 1 bis 5 im Abschnitt B des Übergabeprompts; Punkt 6 ist eine Rückfrage zu „Elternzugänge“. Die Analyse hat diese Widersprüche übersehen, weil sie den Bestand nur über Doku und Code gelesen hat; für künftige Durchsichten Bildschirme vergleichen.

### Zweite Durchsicht, Mannschaftsassistent (27.10.2026)

- **Altersklasse:** wirkt nur auf die Anzeige (Mannschaftsübersicht, Listen, Export) und schlägt die Spielform vor, nur bei Eingabe „U<Zahl>“. Bleibt freiwillig, wird erklärt.
- **Vorlagen** („Leistungsorientiert, Klassisch, Jugend, Freizeit“) entfallen, ersetzt durch einen Fragenkatalog je Funktion mit Beispiel und Vorbelegung nach Abteilung.
- **„Funktionen und Sichtbarkeit“** wird auf Sichtbarkeit reduziert („Wer sieht was?“).
- **Treffpunkt-Ort** entfällt im Assistenten (nur Treffzeit), **Willkommenstext-Schritt** entfällt, **Hinweis zum Zeitraum der Trainingsserie** kommt dazu.
- **Schiedsrichter:** im Vereinsassistenten nicht mehr angeboten (Entscheidung 27.10.).
- **Kontaktdaten-Standard** je Abteilung (Jugend, Senioren) statt nach Alter (Korrektur der Korrektur vom selben Tag).
