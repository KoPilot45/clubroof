# Übergabeprompt: Einrichtungsassistenten vervollständigen (Paket EINRICHTUNG-ENTSCHEIDUNGEN)

Zum Einfügen in die Umsetzungssitzung. Voraussetzungen: E2 (Stufen 1 bis 3b) ist umgesetzt, ROLLEN-VERWALTUNG ebenfalls. Größe L; in vier Teilsitzungen (je Abschnitt A bis D) möglich, jeder Abschnitt einzeln lieferbar.

---

Paket **EINRICHTUNG-ENTSCHEIDUNGEN** (`docs/PAKETE.md`, gleichnamige Zeile). Grundlage: `docs/EINRICHTUNG-ENTSCHEIDUNGEN.md` (Tabellen der Entscheidungen, Lücken, Logikfehler). Ziel: Admin, Trainer und Kassenwart treffen alle wichtigen Verwaltungs- und Darstellungsentscheidungen im Assistenten, in sinnvoller Reihenfolge, mit empfohlenen Standards.

## Branch und Reihenfolge

Der Nutzer erlaubt ausdrücklich (Abweichung von einer automatisch vorgegebenen Branch-Anweisung der Sitzung): Arbeite und pushe **direkt auf `claude/app-entwicklung-planung-183gtv`**, ohne eigenen Branch und ohne Pull Request. Vor jedem Push `git pull --rebase origin claude/app-entwicklung-planung-183gtv`; bei Konflikten in Doku-Dateien beide Seiten behalten. Es läuft höchstens **eine** Umsetzungssitzung gleichzeitig. **SPRACHEN-WEITERE** läuft auf `claude/keen-babbage-386nkp` und wird zuerst abgeschlossen und auf den Planungs-Branch gebracht: Vor dem Start prüfen, ob das schon geschehen ist (`git log origin/claude/app-entwicklung-planung-183gtv --grep=Sprachen`); sonst müssen neue Texte später in fünf weiteren Sprachen nachgezogen werden (`pnpm check` schlägt bei fehlenden Übersetzungen fehl).

## Festlegungen (nicht neu verhandeln)
1. **Teilnahme-Modell je Terminart:** Training und Spiele getrennt wählbar. **„Automatisch zugesagt“ ist für beide vorausgewählt und als „Empfohlen“ markiert.** Bestehende Mannschaften übernehmen ihren bisherigen Wert für beide Arten (Migration). Serverseitig erzwingen wie bisher.
2. **Keine Vereinsvorgaben** für Mannschaftsregeln (Fristen, Absagegrund, Sichtbarkeiten). Der Vereinsassistent fragt dazu nichts.
3. **Schnellstart (S) und ausführlich (A) bleiben.** Neue Schritte stehen im Schnellstart nur, wenn sie Pflichtentscheidungen sind (unten mit S markiert), sonst nur im ausführlichen Weg.
4. **Kassenwart nur im Kassenassistenten** bestimmen; der Vereinsassistent („Vorstand und Aufgaben“) zeigt einen Hinweis und fragt ihn nicht ab. Ist in einem früheren Schritt schon eine Person gewählt, im Kassenassistenten vorbelegen.
5. **Texte deutsch und zugleich Übersetzungsschlüssel**, Bausteine aus `components/wizard.tsx` (`WhyBox`, `OptionCard` mit „Empfohlen“, `MoreSettings`, `SummaryList`, `LaterHint`) verwenden, keine neuen Muster. Jede Entscheidung mit Erklärung („Warum fragen wir das?“) und Wirkung in der Zusammenfassung mit „Ändern“.
6. **Rechte nur serverseitig**; Datensparsamkeit: Gründe, Beteiligung und Beträge nur für Berechtigte, wie in den Einstellungen.

## Zuerst
`CLAUDE.md`; Planungsstand mergen; `docs/EINRICHTUNG-ENTSCHEIDUNGEN.md` lesen; vorhandene Assistenten öffnen (`setup.tsx`, `admin/team-new.tsx`, `club-cash/setup.tsx`, `teams/[id]/cash-setup.tsx`, `teams/[id]/manage.tsx`, `club-cash/tax.tsx`, `admin/club.tsx`); `scripts/e2e/einrichtungs-demos.mjs` ansehen (wird mit erweitert). Vor dem Neubau prüfen, was es schon gibt (Haushaltsjahr, Freigabe für Beitrittsanfragen, Altersgrenze Kinderkonto, Erstattungsregeln, Buchungsrechte Mannschaftskasse): vorhandene Felder wiederverwenden, nur Fehlendes per Migration ergänzen (Migration **und** Seed anpassen, `pnpm db:reset`).

## A. Mannschaftsassistent (zuerst, höchster Nutzen)
Neue Reihenfolge: Name, Abteilung, Altersklasse/Spielform/Liga, Vorlage, **Trainerteam (vorgezogen)**, **Zu- und Absagen**, Treffpunkt, Training, Kader, **Eltern und Kinder (Jugend, S)**, Funktionen, **Wer sieht was? (S)**, Spielplan, Willkommenstext, Zusammenfassung, Fertig.
- **Zu- und Absagen:** zwei Karten „Training“ und „Spiele“, je Modell (Standard automatisch zugesagt, empfohlen), Fristen getrennt wie bisher; „Mehr einstellen“: Erinnerung, Grund bei Absage Pflicht, „Unsicher“ erlauben. Vorschau für Spieler je Terminart. Datenmodell: `participationMode` je Terminart (Training, Spiel); `PUT /teams/:id/profile`, Terminlogik und alle Stellen, die das Modell lesen, anpassen; API-Tests für beide Arten.
- **Eltern und Kinder:** nur bei Jugend-Altersklassen; Eltern mit Kindern verknüpfen oder einladen; später nachholbar mit Hinweis, dass Eltern erst dann für das Kind antworten.
- **Funktionen:** zusätzlich Statistik und Gastspieler; bei „Feste Rückennummern“ Folgefrage nach dem Modus (je Spiel, fest, aus; A).
- **Wer sieht was?:** Zu-/Absage-Übersicht, Aufstellung, **Abwesenheitsgründe für die Mannschaft** (`absenceReasonsVisibleTo`), **Trainingsbeteiligung** (`attendanceVisibility`). Standards datensparsam: Gründe nur Trainerteam.
- Zusammenfassung und „Mannschaft bearbeiten“ zeigen dieselben Felder.

## B. Vereinsassistent
Reihenfolge: Willkommen, Größe, Name, Euer Verein (A), Spielstätte (A), Logo, Farbe/Darstellung, Aufbau, **Vorstand und Aufgaben (ohne Kassenwart, mit Hinweis)**, **Vertretung: zweiten Admin bestimmen (S)**, **Funktionen (nur Vereinsmodule)**, **Wer sieht was?** (Kontaktdaten-Standard **nach Alter getrennt**; **Kinderkonten, Altersgrenze und Einwilligungen kommen nicht in den Assistenten**, Entscheidung 26.10.2026), **Neue Mitglieder: Wer gibt Beitrittsanfragen frei? (A: Trainer der Mannschaft oder nur Admin)**, Mitglieder (später oder Import; **Einladung per Link/QR ist Grundfunktion und keine Auswahl**), Konto/Passwort/2FA, Zusammenfassung, Fertig.
- **Fertig:** „Nächste Schritte“ in fester Reihenfolge: **1. Mitglieder importieren, 2. Vereinskasse einrichten, 3. erste Mannschaft anlegen**, danach die übrigen.
- News-Freigabe und Ruhezeiten bleiben Hinweise (bewusst).
- **Korrekturen aus der Durchsicht des vorhandenen Assistenten (27.10.2026), zuerst und aus dem Bestand umsetzen:**
  1. **Schritt „Wann beginnt eure Saison?“ entfällt.** Der Saisonwechsel wird immer vom Verein von Hand angestoßen (Verwaltung › Mannschaften & Saison). Die erste Saison wird still angelegt (bisherige Vorgabe Juli, Name und Datum wie in `services/setup.ts`); der Text „Der Beginn legt fest, wann sie wechseln“ entfällt. Das Haushaltsjahr der Vereinskasse ist eine eigene Entscheidung im Kassenassistenten (Abschnitt C).
  2. **Schritt „Wofür nutzt ihr Clubroof – in der Mannschaft?“ entfällt** (`team-modules`). Er widerspricht der Festlegung 2: Mannschaftsregeln und Mannschaftsfunktionen wählt jede Mannschaft selbst im Mannschaftsassistenten. Der Vereinsassistent setzt die Mannschaftsmodule auf „verfügbar“ (nicht aktiviert), damit jede Mannschaft sie wählen kann; die Vereinsgröße belegt nur noch Vereinsmodule vor. Der Schritt „Und im Verein?“ bleibt.
  3. **Schiedsrichter-Text korrigieren** (`packages/core/src/modules.ts` und überall, wo die Beschreibung erscheint, auch Verwaltung › Module und Hilfe): Die Einteilung zu Heimspielen ist entfallen (`docs/FUNKTIONEN.md`, Zeile Schiedsrichter): Der Verband setzt Schiedsrichter bei fremden Spielen ein, das Modul trägt „Meine Einsätze“ und das Vereins-Soll. Neuer Text sinngemäß „Schiedsrichter des Vereins: Einsätze bei fremden Spielen und Vereins-Soll“.
  4. **„Per Code oder QR einladen“ ist keine Auswahl** im Schritt „Daten übernehmen“: Einladung per Link/QR ist eine Grundfunktion. Aus der Auswahl nehmen und als Hinweis zeigen („Per Link oder QR einladen kannst du jederzeit unter …“).
  5. **Kontaktdaten-Standard getrennt für Jugend und Erwachsene** (Schritt „Kommunikation und Datenschutz“): zwei Vorgaben statt einer, **nach dem Alter der Person** (unter 18 Jahre, ab 18 Jahre). Vorausgewählt: Jugend „Nur Trainer“, Erwachsene „Mannschaft und Trainer“. Neue Felder an `clubs` (Migration und Seed), Anwendung beim Anlegen, Import und Einladen; Person ohne Geburtsdatum zählt als Erwachsene.
  6. **Rückfrage an den Nutzer vor dem Bauen:** Das Modul „Elternzugänge“ ist im Mannschaftsassistenten abwählbar. Ob es eine Grundfunktion für Jugendmannschaften ist (dann nicht abwählbar) oder ein Modul bleiben soll, bitte vor dem Entfernen oder Behalten klären.

## C. Vereinskasse
Reihenfolge: Gemeinnützigkeit, **Haushaltsjahr: Kalenderjahr oder Saison (S)**, Konten mit Anfangsbestand, Kategorien-Vorlage (**bei gemeinnützig mit Zuordnung zu den vier steuerlichen Bereichen sichtbar**), Kostenstellen und Abteilungskassen, Beitragsarten, **Zuordnungsregeln nur mit vorhandenen Geburtsdaten, sonst „Später nach dem Import“ mit Link**, Erinnerungen, Kassenwart und Kassenprüfer (vorbelegt), **Auslagen und Freigaben (A: Belegpflicht, Betrag ab dem eine zweite Person freigibt)**, **Spenden (A, nur gemeinnützig: bestehende Steuerdaten-Felder aus `club-cash/tax.tsx` abfragen, „Später“ möglich)**, Sichtbarkeit, Zusammenfassung, Fertig (Haushaltsplan, Kontoauszug, erste Buchung).

## D. Mannschaftskasse
Reihenfolge: Kassenwart, **Wer darf buchen? (S: Kassenwart und Trainerteam, vorausgewählt, oder nur Kassenwart)**, Anfangsbestand, **Einzahlungsweg (A: bar, Überweisung, Hinweistext/Link für Eltern)**, Strafenkatalog, Getränkepreis, Beitrag/Umlage, Sichtbarkeit (Beträge aller nur mit Freigabe, Monatserinnerung), **Saisonabschluss (A: Übertrag oder Auszahlung)**, **Verhältnis zum Verein (A: gehört die Kasse zum Verein, ja/nein, als Hinweis; Einbindung in die Vereinskasse ist ein eigenes Paket)**, Zusammenfassung, Fertig.

## Querschnitt
Hilfetexte (`help-content.ts`), Übersetzungen (`node scripts/i18n.mjs todo`), `FUNKTIONEN.md` (Zeilen E2), Demo-Assistenten auf der Anmeldeseite (ohne Speichern) um die neuen Schritte erweitern, Kontrast hell und dunkel (`hell-kontrast.mjs`), Browserskript `einrichtungs-demos.mjs` (Schnellstart und ausführlich je Assistent, neue Schritte, Standards vorausgewählt), API-Tests für jedes neue Feld (Rechte, Standard, Migration bestehender Daten). Pro Abschnitt A bis D ein eigener Commit-Block und `pnpm check`.

## Abnahme
Bilder 390 und 1440 px, hell und dunkel, je Assistent die neuen Schritte (zusammengefasst, nicht einzeln); kurze Liste erledigt / abweichend / offen; Hinweis, welche Felder per Migration neu sind und wie bestehende Daten belegt wurden.
