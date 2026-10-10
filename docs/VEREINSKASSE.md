# Vereinskasse – ganzheitliche Finanzverwaltung (Planung)

Stand 10.10.2026 · **K1 umgesetzt** (Konten, Kassenbuch, Kategorien, Kostenstellen, Umbuchung, Storno, Rollen, Einsichtsstufen); K2–K5 geplant. Pakete siehe `PAKETE.md`.

**Umsetzungshinweis K1:** Die Vereinskasse nutzt eigene Tabellen (`club_cash_accounts`, `club_cash_categories`, `club_cost_centers`, `club_cash_entries`) statt `cash_accounts` ohne `teamId`, damit die Mannschaftskassen unberührt bleiben. Einstieg: Kachel „Vereinskasse“ im Verein-Tab (Modul `club_cash`, im Vereins-Assistenten wählbar), Bildschirme unter `/club-cash`. Demo: `kasse` = Kassenwart (Verein), `mitglied` = Kassenprüfer.

## Festlegungen

| Thema                   | Festlegung                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trennung                | Mannschaftskassen bleiben isoliert in ihren Mannschaften. Die Vereinskasse ist ein eigener Bereich (`cash_accounts` ohne `teamId`) mit eigenen Rechten.                                                                                                |
| Rollen                  | Neu: **Kassenwart (Verein)** – erfasst, bucht, verwaltet. Neu: **Kassenprüfer** – lesen, prüfen, Prüfvermerke. Die bisherige Rolle „Kassenwart“ (Mannschaft) heißt künftig **Mannschaftskassenwart** und hat mit der Vereinskasse nichts zu tun. Admin sieht alles. |
| Wer darf einsehen?      | Der **Verein entscheidet selbst**: Einstellung in der Kasse „Wer darf die Kasse einsehen?“ mit Auswahl (z. B. nur Admin, Kassenwart und Prüfer; zusätzlich Vorstand nur Auswertungen; zusätzlich Vorstand alles). Standard: nur Admin, Kassenwart, Prüfer. |
| Buchführung             | Einfache Einnahmen-Ausgaben-Rechnung, getrennt nach den vier steuerlichen Bereichen (ideeller Bereich, Vermögensverwaltung, Zweckbetrieb, wirtschaftlicher Geschäftsbetrieb). Keine doppelte Buchführung.                                              |
| Beiträge                | Manuell erfassen, dazu CSV-Import vom Kontoauszug mit Zuordnung. Keine SEPA-Lastschrift in der ersten Fassung.                                                                                                                                         |
| Steuerberater           | Kein DATEV-Export nötig; CSV und PDF genügen zunächst.                                                                                                                                                                                                 |
| Kassenprüfer            | Nur in der App (kein Link ohne Konto).                                                                                                                                                                                                                 |
| Unveränderlichkeit      | Keine Löschung, nur Storno mit Begründung; abgeschlossene Zeiträume gesperrt; Protokoll.                                                                                                                                                               |
| Keine Zahlungsabwicklung | Die App führt Buch, sie zieht kein Geld ein.                                                                                                                                                                                                          |
| Recht/Steuer            | Spendenquittung, Übungsleiterpauschale, Rücklagen, Aufbewahrungsfristen: vor Umsetzung rechtlich bzw. steuerlich prüfen lassen; die App ersetzt keine Steuerberatung.                                                                                   |

## Funktionsblöcke

1. **Kassenbuch und Konten:** Girokonto, Bargeld, Sparkonto, PayPal mit Anfangsbestand; Buchung mit Datum, Betrag, Konto, Kategorie, Gegenpartei, Zweck, Belegnummer und Beleg (Foto/PDF); Umbuchung; Storno; Suche und Filter.
2. **Kontenrahmen und Zuordnung:** Vorlage mit typischen Kategorien (Beiträge, Spenden, Zuschüsse, Sponsoring, Veranstaltungen, Platzmiete, Aufwandsentschädigungen, Versicherung, Verbandsabgaben, Sportgeräte …), anpassbar; Zuordnung zu den vier Bereichen; Kostenstellen (Abteilung, Mannschaft, Veranstaltung).
3. **Mitgliedsbeiträge:** Beitragsarten (Erwachsene, Jugend, Familie, passiv) mit Betrag und Rhythmus; Sollstellung; Zahlungseingang; Rückstände; Erinnerung (Stufen löst der Kassenwart selbst aus); CSV-Import.
4. **Spenden:** erfassen; Zuwendungsbestätigung als PDF (nach rechtlicher Prüfung).
5. **Haushaltsplan:** Jahresplan je Kategorie/Kostenstelle, Soll-Ist mit Fortschrittsbalken, Warnung bei Überschreitung, Rücklagen-Töpfe.
6. **Auswertung und Abschluss:** Einnahmen-Ausgaben-Rechnung pro Jahr nach den vier Bereichen, Kassenbericht und Jahresabschluss (PDF), CSV-Export, Vorjahresvergleich, Periodensperre.
7. **Kassenprüfung:** Prüfer sehen Buchungen und Belege, ziehen Stichproben, haken ab, vermerken Beanstandungen, geben Prüfbericht ab (Grundlage der Entlastung).
8. **Weitere Funktionen (K5):** Auslagenerstattung/Fahrtkosten (Mitglied reicht ein, Kassenwart prüft), Übungsleiterpauschale/Freibetrag je Person, Zuschüsse mit Frist und Verwendungsnachweis, Verbindung zu Sponsoren (Paket SPO) und Zuschuss an eine Mannschaftskasse (Ausgabe Verein, Einnahme Mannschaft), Inventar.
9. **Sicherheit:** Vier-Augen-Prinzip ab einstellbarem Betrag; Zwei-Faktor für Kassenwart und Prüfer dringend empfohlen; Mandantentrennung; Aufbewahrungsfristen (Belege 10 Jahre) im Löschkonzept.

## Rechte (Entwurf)

Neue Rechte (Gruppe „Vereinsfinanzen“): `clubcash.read` (einsehen), `clubcash.manage` (buchen, verwalten), `clubcash.audit` (prüfen, Vermerke). Sichtbarkeit zusätzlich über die Vereinseinstellung „Wer darf die Kasse einsehen?“ (Rollen/Gruppen wählbar). Rollen: `club_treasurer` (read + manage), `cash_auditor` (read + audit). Rechte nur serverseitig prüfen.
