# Zuständigkeiten, Sichtbarkeit und Rechte: Analyse und Empfehlungen

Stand: 10.10.2026. Grundlage: `packages/core/src/roles.ts`, `permissions.ts`, `access.ts`, die Rechteprüfungen in
`apps/api/src/services` und die Bildschirmbedingungen der App. Rechte werden immer serverseitig geprüft; die App blendet nur aus.

## 1. Grundprinzip

- **Zugehörigkeit** (Mannschaft + Funktion Spieler, Trainer, Co-Trainer, Betreuer) bestimmt, **was jemand sieht und beantworten kann**
  (eigene Termine, Zu-/Absagen, eigenes Kassenkonto, eigene Kinder).
- **Rollen** sind Rechtepakete mit Geltungsbereich (Verein, Bereich, Mannschaft) und bestimmen, **was jemand ändern darf**.
- Beides ist getrennt. Rechte entstehen **nur** aus ausdrücklich vergebenen Rollen, nie automatisch aus der Funktion.

## 2. Standardrollen im Überblick

| Rolle (Bereich)               | Verein/System        | Mitglieder                  | Mannschaft/Sport                                       | Termine                                                        | Kommunikation                             | Kasse                         | Betrieb                             |
| ----------------------------- | -------------------- | --------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------- | ----------------------------- | ----------------------------------- |
| Fulladmin (Verein)            | alles                | alles                       | alles                                                  | alles                                                          | alles                                     | alles                         | alles                               |
| Vorstand (Verein)             | Überblick, Protokoll | lesen, einladen             | –                                                      | anlegen                                                        | News verfassen+freigeben, Umfragen, Forum | **lesen (alle Mannschaften)** | Dokumente, Helfer                   |
| Sportliche Leitung (Verein)   | Überblick            | lesen, einladen             | Mannschaften, Saison, Spielerbewegungen, Kader, Bedarf | anlegen, Zusagen lesen                                         | –                                         | –                             | –                                   |
| Jugendleitung (Bereich)       | –                    | lesen, einladen             | Mannschaften, Saison, Bewegungen, Bedarf               | anlegen, Zusagen lesen                                         | News verfassen+freigeben, Umfragen        | –                             | –                                   |
| Trainer (Mannschaft)          | –                    | einladen                    | Kader, Bedarf, Funktionen der Mannschaft               | anlegen, Zusagen lesen und korrigieren, **Abwesenheitsgründe** | News veröffentlichen, Umfragen            | lesen, buchen, Strafen        | Dokumente                           |
| Kassenwart (Mannschaft)       | –                    | –                           | –                                                      | –                                                              | –                                         | lesen, buchen, Strafen        | –                                   |
| Platz-/Materialwart (Verein)  | –                    | –                           | –                                                      | –                                                              | News verfassen                            | –                             | Anlage, Material, Schlüssel, Helfer |
| Mitgliederverwaltung (Verein) | –                    | lesen, **ändern**, einladen | –                                                      | –                                                              | –                                         | –                             | –                                   |
| Schiedsrichterobmann (Verein) | –                    | **lesen (alle)**            | –                                                      | –                                                              | –                                         | –                             | Schiedsrichter                      |
| Vereinsmitglied (Verein)      | Überblick            | –                           | –                                                      | –                                                              | News verfassen (Freigabe nötig)           | –                             | –                                   |

Ohne Rolle (Spieler, Eltern) sehen und beantworten Personen ihre eigenen Termine, ihr Kassenkonto (bzw. das ihrer Kinder), News, Umfragen,
Dokumente und Helferdienste, soweit freigegeben.

## 3. Befunde

**Belegt im Code**

1. **Funktion gibt keine Rechte.** Wer als Trainer, Co-Trainer oder Betreuer einer Mannschaft zugeordnet oder per CSV importiert wird, hat
   noch keine Trainerrechte. Die Rolle „Trainer“ muss zusätzlich vergeben werden. Für **Co-Trainer** und **Betreuer** gibt es gar keine Rollenvorlage.
2. **`forum.moderate` ist wirkungslos.** Das Recht steht im Katalog, wird aber nirgends geprüft. Forum und Fundbüro/Marktplatz werden über
   „News freigeben“ (nur vereinsweit) moderiert, also nur durch Vorstand und Fulladmin. Platzwart, Jugendleitung und Trainer können nicht moderieren.
3. **2-Faktor-Pflicht deckt zu wenig ab.** Sie gilt für Rollen mit Rollen-, Einstellungs-, Modul-, Mitgliederverwaltungs- oder Protokollrechten
   (Fulladmin, Vorstand, Mitgliederverwaltung). Kassenwart (Geld), Trainer (Abwesenheitsgründe, Geld) sowie Sportliche und Jugendleitung
   (Mitgliederlisten, Spielerbewegungen) sind ausgenommen.
4. **Keine Amtszeiten.** Rollenvergaben haben kein Start- oder Enddatum. Rechte bleiben nach einem Wechsel im Vorstand, bis jemand sie entzieht.
5. **Engpass Fulladmin.** Rollen vergeben, Einstellungen, Module und Logo ändert nur der Fulladmin; Mitgliederdaten ändert nur die Mitgliederverwaltung.
   Der Vorstand kann beides nicht. Der letzte Fulladmin ist geschützt, es gibt aber keinen Hinweis auf „nur ein Fulladmin“.
6. **Vorlagen sind nicht einheitlich.** Die Jugendleitung hat keinen Vereinsüberblick (die Sportliche Leitung schon) und keine Dokumente; die Sportliche Leitung
   darf keine News oder Umfragen; Platzwart und Kassenwart haben keinen Überblick.
7. **Zu weite Sicht des Schiedsrichterobmanns:** `members.read` gibt die ganze Mitgliederliste, gebraucht werden nur die Schiedsrichter.
8. **Vorstand liest alle Mannschaftskassen** (vereinsweites `cash.read`). Bei Mannschaftskassen sind das Interna der Mannschaft.
9. **Trainer buchen und lesen selbst** (`cash.manage`, Festlegung 07.10.2026). Eine zweite Person für Stornos oder hohe Beträge fehlt; es gibt die Kassenprüfung, aber keine Prüferrolle.
10. **Gesundheitsnahe Angaben:** Trainer sehen Abwesenheitsgründe (Verletzung, Krankheit) samt Freitext. Es gibt keine Abstufung.

**Nicht geprüft (nur Vermutung, im Betrieb klären)**

- Ob zwei Elternteile je Kind vorgesehen sind und wie ein Jugendlicher ab einem Alter ein eigenes Login bekommt.
- Ob jede Bildschirmbedingung der App exakt zu den Serverrechten passt (Stichproben im Browsercheck: ja).
- Ob die Person bei Vergabe oder Entzug einer Rolle benachrichtigt wird.

## 4. Empfehlungen

**A. Datenschutz und Sicherheit (klein bis mittel)**

1. 2-Faktor-Pflicht einstellbar erweitern: „Verwaltung“ (heute) / „+ Kasse und Trainer“ / „alle mit Rolle“.
2. Abwesenheitsgründe abstufen: Trainer sehen die Kategorie (krank, verletzt, Urlaub), den Freitext nur, wenn die Person ihn freigibt.
3. Schiedsrichterobmann: eingeschränkte Sicht (nur Schiedsrichter) statt `members.read`.
4. `forum.moderate` tatsächlich verwenden oder entfernen.

**B. Konsistenz (mittel)**

5. Beim Zuordnen einer Funktion fragt die App „Rechte passend zur Funktion vergeben?“ (ein Klick); CSV-Import mit Option „Rechte nach Funktion“. Neue Vorlagen **Co-Trainer** (Termine, Anwesenheit, Kader ohne Kasse) und **Betreuer** (Termine, Anwesenheit).
6. Vorlagen angleichen und die Rollenmatrix als Test festhalten, damit Änderungen bewusst geschehen.
7. Eigenes Recht `board.moderate` (Fundbüro/Marktplatz/Forum) für Platzwart und Vorstand.

**C. Betrieb (mittel)**

8. **Amtszeiten:** optional „gültig bis“ je Rollenvergabe, Erinnerung 30 Tage vorher, Kachelhinweis „2 Rollen laufen ab“, jährliche Rollenprüfung.
9. **Ausfallsicherheit:** Hinweis „nur ein Fulladmin“; „Kein Kassenwart in n Mannschaften“; Vorstand darf Stellvertreter vorschlagen.
10. **Rechtevorschau:** „Was darf diese Person?“ und eine Vorschau „Ansicht als Rolle“ (nur lesend) auf der Rollenseite; das spart Supportfragen.
11. Benachrichtigung bei Vergabe und Entzug einer Rolle, Export des Änderungsprotokolls.

**D. Größer (später)**

12. Kassenprüfer-Rolle (nur lesen + Prüfvermerk), Vier-Augen-Prinzip bei Storno oder Beträgen über einer Grenze.
13. Jugendliche mit eigenem Zugang ab einem wählbaren Alter, Eltern behalten Mitsicht; zwei Elternteile je Kind.
14. Eigene Rollen je Verein (laut Konzept vorgesehen) und eine Rolle „Abteilungsleitung“ für Bereiche.
15. **Mandantenbetrieb (Paket M):** Betreiber- und Support-Zugang strikt getrennt von Vereinsrechten: zeitlich begrenzt, nur mit Freigabe des Vereins, vollständig protokolliert.

## 5. Zu entscheiden

1. Darf der Vorstand die Kassen aller Mannschaften sehen (heute ja)?
2. Wie weit soll die 2-Faktor-Pflicht reichen?
3. Welche Rechte erhalten Co-Trainer und Betreuer?
4. Sind Amtszeiten für Rollen gewünscht?
5. Ab welchem Alter dürfen Jugendliche ein eigenes Login haben?
