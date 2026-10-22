# Stand der Browserprüfungen (`scripts/e2e`)

Letzter vollständiger Durchlauf am 22.10.2026: jedes Skript einzeln mit
`pnpm browser-check scripts/e2e/<name>.mjs --reset --no-build` (ohne Bilder-, PDF- und Messskripte wie
`hell-kontrast`, das eigens läuft). **69 Skripte, alle grün** (zwei nach dem Durchlauf nachgebessert und einzeln
bestätigt: `navigation`, `termin-antwort`).

Geschichte: Am 21.10.2026 waren 36 von 85 Skripten rot, weil sie Zustände der alten Oberfläche prüften. Am 22.10.2026
wurden die überholten Entwurfsskripte gelöscht und die übrigen an die neue Oberfläche angepasst.

## Gelöscht (überholt, durch Nachfolger abgedeckt)

| Skript | Grund / Nachfolger |
| --- | --- |
| `neuer-look-bausteine`, `-home`, `-mehr`, `-team`, `-termine`, `-verein`, `-zustaende` | Entwurfsphase „Neuer Look“; abgelöst durch `navigation`, `termin-antwort`, `bedienung`, `review-gesamt`, `hell-kontrast` |
| `politur2`, `politur3`, `abstaende`, `anstoss-kacheln` | Pixelmaße und Stilprüfungen der damaligen Karten und Überschriften |
| `menuestruktur` | Menüaufbau vor der Navigation-Neuordnung → `navigation` |
| `offline` | → `offline-rueckmeldung` |
| `termin-hero`, `kader-popup` | alter Termin-Hero und Kader-Pop-up → `termin-antwort` (Karte, Teilnehmerliste) |
| `hilfe-rollen`, `desktop` | → `review-rollen`, `desktop-alle` |

Die Seite `/bausteine` bleibt als Sichtprüfung für Bausteine erhalten (nur kein eigenes Skript mehr).

## Angepasst oder neu geschrieben

| Skript | Was sich geändert hat |
| --- | --- |
| `navigation`, `bedienung`, `offline-rueckmeldung`, `erster-eindruck`, `ios-feinschliff`, `termin-antwort`, `termine-archiv` | Antwortknöpfe sind Radios („Zusage“, „Vielleicht“, „Absage“); Karten mit Knöpfen stehen auf der Startseite; Karussell-Klone werden übergangen; gesperrte Knöpfe tragen `aria-disabled` |
| `vereinskasse`, `planung`, `pruefung`, `kassen`, `kassen-statistik` | Reiter Buchung → Kachel, Auswertung statt Prüfung, gefüllter Demo-Plan (Planjahr 2027 für Eingaben), laufende Kassenprüfung 2026, freigegebene Spendenvorlage, Statistik im Reiter „Auswertung“ |
| `mannschaft-assistent` | neu geschrieben für den Assistenten mit Schnellstart (9 Schritte) |
| `rechte-import` | Rollenfilter im Blatt „Filter“, Abschnitt „Aus Vereinsliste“ |
| `sponsoren` | Pflichtfelder `advertise`/`hideForYouth`, Banner auf Start/Team/Verein, Dankesliste für alle |
| `schiedsrichter`, `anstoss-aktionen` | „…“-Menü („Weitere Aktionen“) und Bestätigungsdialog (Löschen oder Archivieren) |
| `suche`, `route`, `anmeldeseite`, `bereichsuebersicht` | Bezeichnungen und Rollen (Link „Route“, Clubroof-Zeichen im Kopf, alle Mannschaften mit genug Daten) |
| `touchflaechen`, `pills-mittig` | deckten echte Fehler auf (Tab-Leiste 39 pt, Chip „Termin abgesagt“ oben statt mittig), beides behoben |

Hilfsfunktionen in `scripts/lib/e2e.mjs`: `confirmDialog` (Rückfrage „Wirklich löschen?“ / „Ins Archiv verschieben?“
bestätigen) und `moreAction` („…“-Menü einer Zeile öffnen und Aktion wählen).

## Hinweise für neue Skripte

- Nach Änderungen an Einstellungen eine frische Sitzung starten oder die Seite neu laden: der Offline-Zwischenspeicher
  zeigt sonst den alten Stand.
- Das Plakat-Karussell der Startseite hat Klone außerhalb des Bildes und wechselt von selbst: Knöpfe und Texte im
  Bild wählen (Position prüfen) und nicht `.first()` auf Zusage-Knöpfe verlassen.
- Gesperrte Antwortknöpfe haben `aria-disabled="true"`, nicht das Attribut `disabled`.
- Neue Vorlage: `beispiel.mjs`. Nach einem Umbau die betroffenen Skripte mitziehen; veraltete Skripte lieber löschen als
  anpassen, wenn ein Nachfolger dieselbe Funktion prüft.
