# Farbkonzept

Der Verein wählt bei der Ersteinrichtung **eine von fünf Vereinsfarben** und lädt sein **Logo** hoch.
Jede Vereinsfarbe ist ein vollständiges, vorab geprüftes Farbthema für den **hellen und den dunklen Modus**.
Freie Hex-Werte sind bewusst nicht vorgesehen: So ist die Lesbarkeit in jeder Kombination garantiert, und die
App sieht in jedem Verein professionell aus. Weitere Vereinsfarben lassen sich später ergänzen.

Quelle im Code: [`packages/design-tokens/src/colors.ts`](../packages/design-tokens/src/colors.ts)

## Aufbau

Ein Farbthema besteht aus drei Schichten:

| Schicht | Inhalt | Abhängig von |
| --- | --- | --- |
| **Vereinsfarbe** | `primary`, `onPrimary`, `primaryPressed`, `primaryContainer`, `onPrimaryContainer`, `primaryText` | gewählter Vereinsfarbe + Modus |
| **Neutrale Farben** | Hintergrund, Karten, Text, Rahmen | nur Modus |
| **Statusfarben** | Dringend, Aktion, Info, Erledigt, Archiviert | nur Modus – für alle Vereine gleich |

## Vereinsfarben

| Vereinsfarbe | Hell: `primary` / Text darauf | Hell: `primaryText` | Dunkel: `primary` / Text darauf |
| --- | --- | --- | --- |
| Grün | `#11882E` / weiß | `#0F7A29` | `#4CC46B` / dunkel |
| Rot | `#C8102E` / weiß | `#B30E29` | `#FF6B7D` / dunkel |
| Blau | `#0B4EA2` / weiß | `#0B4EA2` | `#6EA8FF` / dunkel |
| Gelb | `#F5C400` / **dunkel** | `#7A5E00` | `#FFD43B` / dunkel |
| Schwarz | `#1C1C1E` / weiß | `#1C1C1E` | `#F2F2F2` / dunkel |

Besonderheiten:

- **Gelb**: Weiße Schrift auf Gelb ist nicht lesbar. Buttons in Gelb tragen deshalb dunkle Schrift.
  Für Text, Icons und Links auf weißem Grund wird ein dunkles Goldgelb (`primaryText`) verwendet.
- **Schwarz**: Im dunklen Modus wäre Schwarz auf Schwarz unsichtbar. Dort wird die Vereinsfarbe zu einem
  hellen Grau-Weiß, sodass das Design „schwarz-weiß“ bleibt.

## Verwendungsregeln

1. **`primary` nur als Fläche** (Buttons, aktiver Tab, Kopfbereich, aktive Chips), immer mit `onPrimary` darauf.
2. **Auf Hintergrund und Karten** wird für Text, Icons, Links, Fortschrittsbalken und Markierungen
   **`primaryText`** verwendet, nie `primary`. Das hält gelbe und dunkle Themen lesbar.
3. **`primaryContainer`** für dezente Hervorhebungen (z. B. Badge „Heimspiel“, ausgewählte Umfrage-Antwort).
4. **Statusfarben tragen Bedeutung** (Konzept §2) und sind in allen Vereinen gleich:
   rot = dringend, orange = Aktion, blau = organisatorische Info, grün = bestätigt/erledigt, grau = archiviert.
5. Statusfarben werden **immer mit Icon und Beschriftung** gezeigt, nie als reine Farbfläche. Das löst
   Überschneidungen, z. B. rote Vereinsfarbe und roter Hinweis „Dringend“, und hilft Menschen mit
   Farbsehschwäche.
6. Mannschaften werden über **Badges** (B1, 1., AH) erkennbar gemacht, nicht über eigene Farben.

## Automatische Prüfung

Für jede Vereinsfarbe, jeden Modus und jede Statusfarbe prüfen Tests die Kontraste nach **WCAG 2.1 AA**
(`packages/design-tokens/src/colors.test.ts`):

- Text auf Flächen: mindestens 4,5 : 1
- Statusfarben als Fläche gegenüber Karten: mindestens 3 : 1

Eine neue Vereinsfarbe wird erst übernommen, wenn alle diese Tests bestehen.

## Logo

Das Logo lädt der Verein als PNG oder SVG hoch. Es wird in der Kopfzeile und auf dem Startbildschirm gezeigt.
Ist (noch) kein Logo vorhanden, zeigt die App ein Wappen mit dem Kürzel des Vereins in der Vereinsfarbe.
