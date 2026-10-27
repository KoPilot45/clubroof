# Mandantenbetrieb – Konzept (Entwurf zur Bestätigung)

Stand: 27.10.2026 · Paket MANDANTENBETRIEB · **noch nichts gebaut** – erst nach Bestätigung der offenen Fragen (Abschnitt 8).

## 1. Ausgangslage im Code

- `clubs` ist der Mandant; fachliche Tabellen tragen `club_id`. `users` ist vereinsübergreifend, `persons` gehört zu einem Verein
  (`unique(club_id, user_id)` erlaubt schon mehrere Personen je Konto).
- **Engstelle:** `loadActor` (`apps/api/src/actor.ts`) nimmt die *erste* Person des Kontos (`limit(1)`). Mit zwei Vereinen wäre das Zufall –
  hier braucht es den **aktiven Verein**.
- `needsSetup`/`setupClub` gehen von „Server leer = Einrichtung möglich“ aus (ein Verein). `calendar_feeds` hat einen Link je Konto
  (`userId` als Schlüssel), `user_seen` hängt am Konto ohne Verein, `tokenHash` bei Einladungen ist global eindeutig.
- Offline-Speicher der App ist je Konto getrennt, aber nicht je Verein.

## 2. Betreiber

Eigene Tabelle `operators` (Konto-ID, aktiv, Zwei-Faktor Pflicht), **außerhalb jedes Vereins**. Ein Betreiber hat keine Person und keine Rolle im
Verein und damit **keine** Vereinsrechte. Betreiber-Routen unter `/operator/*` mit eigener Prüfung `requireOperator` (nie über `actorCan`).
Betreiber werden nur per Konfiguration/Skript angelegt, nicht über die App. Alle Betreiberaktionen landen in einem eigenen Protokoll
`operator_audit` (wer, was, welcher Verein, wann).

## 3. Verein anlegen (Betreiber-Konsole)

Eigener Bereich in der Web-Verwaltung („Betreiber“), nur sichtbar für Betreiber. Aktionen: Vereine auflisten (Name, Mitgliederzahl, Status),
**Verein anlegen** (Name, Kurzname, Zeitzone, Vereinsfarbe), **ersten Admin einladen** (E-Mail; erzeugt eine Admin-Einladung für den
bestehenden Einrichtungsassistenten, danach läuft alles wie heute), Verein **sperren/entsperren** (gesperrt: Anmeldung zeigt neutralen Hinweis).
Die Betreiber-Konsole zeigt nur Kennzahlen (Anzahl Mitglieder, Mannschaften, letzter Login), **nie** Namen, Kasse, Termine oder Dateien.
Der Einrichtungscode des Servers (`setupToken`) entfällt für weitere Vereine; er bleibt nur für den allerersten Verein auf einem leeren Server.

## 4. Einladungscode

- Bestehende Einladungen (`invitations`: Token-Link, QR) bleiben. Neu: ein **kurzer Code** (8 Zeichen, ohne 0/O/1/I, z. B. `K7M2-QX4P`),
  gespeichert nur als Hash, je Einladung (Verein oder Mannschaft). Er ersetzt den Link, wenn die App noch nicht installiert ist.
- Gültigkeit 14 Tage (Standard, einstellbar), widerrufbar, Verbrauch atomar wie heute (`maxUses`/`useCount`); Verein-Code = Beitrittsanfrage mit
  Freigabe (wie Mannschafts-Link), persönlicher Code = direkte Kontoeinrichtung.
- **Missbrauchsschutz:** Ratenbegrenzung je IP und je Konto (z. B. 10 Fehlversuche/Stunde, dann Sperre); gleiche Fehlermeldung für „unbekannt“,
  „abgelaufen“, „verbraucht“; Code liefert vor dem Beitritt nur Vereinsname und Logo. Tokenhash-Eindeutigkeit global bleibt.
- Ein eingeloggtes Konto kann einen Code einlösen und tritt damit einem **weiteren Verein** bei (neue Person in diesem Verein, nach Freigabe).

## 5. Mehrere Vereine pro Konto

- `sessions` bekommt `active_club_id`. Beim Anmelden: genau ein Verein → direkt; mehrere → zuletzt aktiver Verein. `loadActor` lädt die Person
  **dieses** Vereins und prüft, dass das Konto dort eine Person hat; jede Anfrage ist damit an *einen* Verein gebunden.
- **Wechsler** in „Ich“ (nur sichtbar bei mehr als einem Verein): wechselt `active_club_id` serverseitig, leert danach den Query-Cache der App
  vollständig und lädt Home neu. Das widerspricht nicht der Entscheidung vom 05.10. (kein Umschalter für *einen* Verein); sie wird dazu präzisiert.
- Offline-Speicher: Schlüssel `userId + clubId`; beim Wechsel leeren. Push-Geräte, Benachrichtigungseinstellungen und `user_seen` werden je
  Verein geführt (Spalte `club_id` ergänzen), Kalenderabo je Verein (Schlüssel `userId + clubId`).
- Zwei-Faktor, Passwort und Anzeigename bleiben am Konto (gelten für alle Vereine). „Verein erzwingt 2FA“ gilt beim Wechsel in diesen Verein.

## 6. Was der Betreiber nie sieht – und Support-Zugriff

Nie: Personen, Kontaktdaten, Kasse, Termine, Dokumente, Nachrichten. Braucht ein Verein Hilfe, gibt **dessen Admin** den Support frei:
Schalter „Support-Zugriff erlauben“ (Dauer 1 h / 24 h / 7 Tage, jederzeit widerrufbar). Erst dann kann ein Betreiber mit einer **eigenen
Support-Sitzung** (schreibgeschützt, deutlich gekennzeichnet, läuft mit der Freigabe ab) den Verein ansehen. Jede Anfrage in dieser Sitzung wird in
`operator_audit` **und** im Vereinsprotokoll sichtbar für den Admin festgehalten. Ohne Freigabe: 403, auch mit Betreiberrecht.

## 7. Auswirkungen und Prüfliste Mandantentrennung

| Stelle | Änderung |
| --- | --- |
| Anmeldung (`auth.ts`) | aktiven Verein bestimmen; Antwort `me` enthält Liste der Vereine |
| Einladungen/Beitritt | Code-Einlösung, Konto mit bestehender E-Mail tritt weiterem Verein bei (statt `email_taken`) |
| Caches/Offline | je `userId + clubId`; Wechsel leert alles |
| Kalenderabo, Exporte | je Verein; Export nur Daten des aktiven Vereins |
| Benachrichtigungen/Push | je Verein; Geräte-Token ohne Vereinsbezug dürfen keine fremden Inhalte erhalten |
| Suche, Archiv, Protokoll | immer `club_id` des Actors; Protokoll des Betreibers getrennt |

**Prüfliste (jeweils mit Test „fremder Verein → kein Zugriff“):** jede Abfrage mit `club_id` oder über eine gefilterte Elterntabelle; Zugriff per
ID fremder Datensätze (Termine, Personen, Buchungen, Belege); Dateilinks (signierte Links tragen die Vereins-ID und werden gegen den Actor-Verein
geprüft); Tokens (Einladung, Passwort-Reset, Kalender, Geräte) ohne Vereinsüberschneidung; Hintergrundjobs (`jobs/*`, `notify/*`) arbeiten je Verein;
Suche (`search.ts`); Importe/Exporte; Wiederholung PILOT-SICHERHEIT F01, F02, F06, F07 mit zwei Vereinen.

## 8. Entscheidungen (27.10.2026) und noch offen

1. **Konto ohne Verein** bleibt bestehen. Nach der Anmeldung: Hinweis „Dieses Konto ist keinem Verein zugeordnet“ mit „Code eingeben“ und **eigenem QR-Code** („Mich aufnehmen lassen“). Ein Admin/Trainer scannt ihn in der Verwaltung und nimmt das Konto in Verein bzw. Mannschaft auf (Person wird angelegt). Zwei Wege: Verein lädt ein – oder Mitglied legt Konto an und lässt sich per QR aufnehmen. Der QR-Code enthält nur eine kurze, ablaufende Konto-Kennung, keine Daten.
2. **Verein löschen:** vorerst nur sperren und archivieren.
3. **Datenübernahme:** keine; jeder Verein hat eigene Person und Daten. Sonderfall „Konto in zwei Vereinen“: siehe Abschnitt 5a.
4. **Betreiber-Zugang:** nur Web-Verwaltung (siehe Antwort in der Sitzung); erster Betreiber: der Eigentümer.
5. **Support-Zugriff:** mit Freigabe durch einen Admin **oder** Vorstand; Notfall siehe Abschnitt 6a (offen: Bestätigung).
6. **Code:** 8 Zeichen, 14 Tage – bestätigt.

### 5a. Konto in zwei Vereinen (Sonderfall)
Jeder Verein hat seine **eigene Person** (Name, Mitgliedsnummer, Kinder, Mannschaften, Rollen, Kontaktsichtbarkeit). Nichts wird zwischen Vereinen geteilt oder abgeglichen; ein Verein sieht nie, dass das Konto im anderen Verein ist. Gemeinsam sind nur E-Mail, Passwort, 2-Faktor, Sprache und Darstellung. Es ist immer **ein** Verein aktiv: Home, Termine, Kasse, Suche und Kalender zeigen nur diesen. In „Ich“ steht „Verein wechseln“ mit Punkt-Markierung bei Neuigkeiten im anderen Verein (nur Zahl, kein Inhalt). Push nennt den Vereinsnamen; Antippen wechselt den Verein. Typische Fälle: Elternteil mit Kindern in zwei Vereinen, Trainer in zwei Vereinen, Spieler mit Zweitspielrecht.

### 6a. Admin nicht mehr erreichbar
Zuerst gilt: jeder Verein soll mindestens zwei Admins haben (Hinweis in der Verwaltung). Fällt der einzige Admin aus: Der Betreiber darf **keine Daten sehen**, aber „Admin neu einladen“ auslösen – nur nach Prüfung außerhalb der App (Rückruf/Nachweis über Vereinsregister oder hinterlegte Vereins-E-Mail), mit 48 Stunden Wartefrist, Mail an alle Vorstände und die Vereinsadresse (Widerspruch möglich) und Eintrag in beide Protokolle. Der neue Admin bekommt nur die Einladung, keine Altdaten über den Betreiber.

## 9. Umsetzungsschritte (nach Bestätigung, je eigener Commit)

1. Datenmodell + Migration + Seed (`operators`, `operator_audit`, Codes, `sessions.active_club_id`, `club_id` an Kalenderabo/Geräte/`user_seen`).
2. `loadActor` mit aktivem Verein, `me` mit Vereinsliste, Vereinswechsel.
3. Betreiber-Konsole (API, Test, Web-Bildschirm, Hilfe, Rechteprüfung).
4. Einladungscode und Beitritt (Ratenbegrenzung, Test).
5. Support-Freigabe und Support-Sitzung.
6. Mandantentrenn-Tests je Bereich, Doku (`FUNKTIONEN.md`, Hilfe), Abschluss-Sicherheitsreview mit dem starken Modell.
