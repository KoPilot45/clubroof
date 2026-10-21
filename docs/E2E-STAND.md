# Stand der Browserprüfungen (`scripts/e2e`)

Durchlauf am 21.10.2026: jedes Skript einzeln mit `pnpm browser-check scripts/e2e/<name>.mjs --reset --no-build`
(ohne Bilder-, PDF- und Messskripte `hell-kontrast`). Ergebnis vor den Reparaturen: **49 grün, 36 rot**. Die roten
Skripte stammen überwiegend aus Entwurfsphasen (alte Startseite, alter Terminblock, alte Bezeichnungen) und prüfen
Zustände, die bewusst nicht mehr gelten.

## Repariert (Paket „Aufräumen“, 21.10.2026)

| Skript | Ursache | Korrektur |
| --- | --- | --- |
| `offline-rueckmeldung` | Knöpfe heißen „Zusage“ (Radio), Karte zeigt „Wird gesendet“, „Diese Woche“ statt „Deine Woche“ | Auswahl, Texte; Termin aus der Warteschlange gelesen. **Deckte einen echten Fehler auf:** das Home-Plakat ignorierte die gemerkte Offline-Antwort (jetzt „Wird gesendet“). |
| `bereiche` | Reiter „Auswertung“ statt „Prüfung“; Kopfband ist ein SVG-Verlauf | Farbe aus dem Verlauf gelesen |
| `bedienung` | Antwortknöpfe sind Radios auf der Startseite; Punktzeile ist breit | Auswahl, Prüfung der einzelnen Punkte |
| `termine-archiv` | jüngstes Training ist in den Demodaten bewusst nicht erfasst | zweites Training genommen |
| `touchflaechen` | **echte Abweichungen**: Tab-Leiste schrumpfte inaktive Punkte auf 39 pt, „Kalender-Abo“ 36 pt, „Spiel ansehen“ ohne Tippbereich | Leiste 0,96 statt 0,85, Mindesthöhe 44, `hitSlop`; Messskript kennt `hitSlop`-Elemente |
| `pills-mittig` | **echter Fehler**: Chip „Termin abgesagt“ saß oben statt mittig in der Karte | Chip in der Karte zentriert |
| `pdf-bilder` | Termin-Detail ohne Link | Adresse direkt geöffnet |
| `aufraeumen` (neu) | – | Austrittsschutz bei Spielerbewegung, Mannschaftstermin, Börse; Terminkarte „Frist abgelaufen“ |

## Weiter rot, überholt (Vorschlag: überarbeiten oder löschen)

| Skript | Grund |
| --- | --- |
| `neuer-look-bausteine`, `neuer-look-home`, `neuer-look-mehr`, `neuer-look-team`, `neuer-look-termine`, `neuer-look-verein`, `neuer-look-zustaende` | Entwurfsphase „Neuer Look“; prüfen die alte Startseite („1 von n“, „Mein Bereich“, „Neuigkeiten für dich“) |
| `politur2`, `politur3` | Stilprüfung der damaligen Zwischenüberschriften und Auswahlfelder |
| `anstoss-kacheln`, `anstoss-aktionen` | Maße der alten Kacheln; Löschbestätigung hat neuen Text |
| `abstaende` | feste Abstandswerte der alten Karten |
| `anmeldeseite`, `erster-eindruck`, `hilfe-rollen`, `menuestruktur`, `navigation` (ältere Fassung), `ios-feinschliff`, `offline`, `route`, `suche` | suchen Texte und Knöpfe der Navigation vor der Neuordnung („Zusagen“, „Vereinsleben“, „Spiel- & Trainingsbetrieb“, „Rückgängig“); `navigation.mjs` aus der Neuordnung ersetzt sie teilweise |
| `desktop`, `kader-popup`, `bereichsuebersicht`, `termin-hero` | hängen an alten Demodaten (Kader, wenig Trainings) oder der alten Terminkarte |
| `kassen`, `kassen-statistik`, `planung`, `vereinskasse`, `schiedsrichter`, `sponsoren`, `pruefung`, `rechte-import`, `mannschaft-assistent` | Bezeichnungen und Abläufe der Kassen-, Prüf- und Assistentenseiten haben sich geändert, `planung` erwartet einen leeren Haushaltsplan (der Ausbau legt einen an) |

Die grünen Skripte (u. a. `aufstellung`, `beitraege`, `import`, `rollen`, `review-gesamt`, `review-rollen`,
`termin-antwort`, `navigation` im Teilumfang, `demodaten`, `anstoss-sweep`) laufen weiter in jedem Durchlauf.
Neue Skripte nach dem Muster in `beispiel.mjs` schreiben und nach einem Umbau mitziehen.
