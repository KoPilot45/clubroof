# Mandantenbetrieb – Konzept (Entwurf zur Bestätigung)

Stand: 27.10.2026 · Paket MANDANTENBETRIEB · **umgesetzt** (Abschnitt 11 nennt Abweichungen vom Entwurf und offene Punkte).

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
Jeder Verein hat seine **eigene Person** (Name, Mitgliedsnummer, Kinder, Mannschaften, Rollen, Kontaktsichtbarkeit). Nichts wird zwischen Vereinen geteilt oder abgeglichen; ein Verein sieht nie, dass das Konto im anderen Verein ist. Gemeinsam sind nur E-Mail, Passwort, 2-Faktor, Sprache und Darstellung. Es ist immer **ein** Verein aktiv: Home, Termine, Kasse, Suche und Kalender zeigen nur diesen. Nur bei Konten mit mehreren Vereinen zeigt die Kopfzeile neben dem Vereinslogo ein **Wechsel-Icon**, das das Vereinslogo unten rechts leicht überlagert; es öffnet ein Fenster mit der Vereinsauswahl (Punkt-Markierung bei Neuigkeiten im anderen Verein, nur Zahl, kein Inhalt). Push nennt den Vereinsnamen; Antippen wechselt den Verein. Typische Fälle: Elternteil mit Kindern in zwei Vereinen, Trainer in zwei Vereinen, Spieler mit Zweitspielrecht.

### 6a. Admin nicht mehr erreichbar
Zuerst gilt: jeder Verein soll mindestens zwei Admins haben (Hinweis in der Verwaltung). Fällt der einzige Admin aus: Der Betreiber darf **keine Daten sehen**, aber „Admin neu einladen“ auslösen – nur nach Prüfung außerhalb der App (Rückruf/Nachweis über Vereinsregister oder hinterlegte Vereins-E-Mail), mit 48 Stunden Wartefrist, Mail an alle Vorstände und die Vereinsadresse (Widerspruch möglich) und Eintrag in beide Protokolle. Der neue Admin bekommt nur die Einladung, keine Altdaten über den Betreiber.

## 9. Umsetzungsschritte (nach Bestätigung, je eigener Commit)

1. Datenmodell + Migration + Seed (`operators`, `operator_audit`, Codes, `sessions.active_club_id`, `club_id` an Kalenderabo/Geräte/`user_seen`).
2. `loadActor` mit aktivem Verein, `me` mit Vereinsliste, Vereinswechsel.
3. Betreiber-Konsole (API, Test, Web-Bildschirm, Hilfe, Rechteprüfung).
4. Einladungscode und Beitritt (Ratenbegrenzung, Test).
5. Support-Freigabe und Support-Sitzung.
6. Mandantentrenn-Tests je Bereich, Doku (`FUNKTIONEN.md`, Hilfe), Abschluss-Sicherheitsreview mit dem starken Modell.

## 10. Ablauf „Verein anlegen“ (Betreiber → Admin) – umgesetzt
Alle Vereine liegen in **einer** Datenbank, getrennt über `club_id` (keine eigene Datenbank je Verein). Abweichung vom ersten Entwurf: Der Betreiber legt den Verein nicht selbst an, sondern einen **Einrichtungscode** (`CR-XXXX-XXXX`, 14 Tage, einmalig, an die E-Mail des Admins gebunden, nur als Hash gespeichert). 1) Betreiber trägt in der Konsole Vereinsname und Admin-E-Mail ein; der Code geht per Mail an den Admin. 2) Der Admin öffnet `/setup`, gibt den Code ein, bestätigt seine E-Mail und durchläuft den **bestehenden Einrichtungsassistenten**, der Verein, Saison, Rollen, Module und sein Administrationskonto anlegt (Passwort wählt er selbst). 3) Der Code ist danach verbraucht; der Betreiber sieht in der Konsole nur „Eingelöst“ und Kennzahlen. Der Server-Einrichtungscode (`SETUP_TOKEN`) gilt weiterhin nur für den allerersten Verein. Widerrufen oder neu ausstellen geht in der Konsole.

Betreiber-Konto anlegen: `pnpm --filter @clubroof/db operator <E-Mail>` (Konto muss existieren; 2-Faktor ist Pflicht). Sperren beendet die Sitzungen des Vereins; Archivieren löscht nichts.

## 11. Umsetzungsstand (27.10.2026)

Umgesetzt und getestet (`apps/api/src/mandanten.test.ts`, `scripts/e2e/mandanten.mjs`):

- **Datenmodell** (Migrationen 0067–0071): `operators`, `operator_audit`, `support_grants`, `club_setup_invites`, `admin_recoveries`, `clubs.status`, `sessions.active_club_id`, `users.last_club_id`, `invitations.code_hash/code_encrypted`; Kalenderabo, Benachrichtigungseinstellungen und „zuletzt gesehen“ je Konto **und Verein**.
- **Aktiver Verein** je Sitzung (`loadActor(…, clubId)`), `me.clubs` (nur bei mehr als einem Verein gefüllt), `POST /me/club`; Wechsel-Symbol am Logo überlagert das Logo unten rechts, leert Cache und Offline-Speicher. Nicht gesendete Antworten blockieren den Wechsel.
- **Betreiber-Konsole** (`/operator`, nur Web-Verwaltung vorgesehen): Vereine mit Kennzahlen, Einrichtungscodes (`CR-XXXX-XXXX`), Sperren/Entsperren/Archivieren, Support-Ansicht, Admin-Wiederherstellung. Betreiber nur per `pnpm --filter @clubroof/db operator <E-Mail>`; 2-Faktor Pflicht; Nicht-Betreiber erhalten 404.
- **Kurzcodes** (`XXXX-XXXX`) für Mannschafts-Links und persönliche Einladungen; Beitritt und Annahme **mit bestehendem Konto** (`/join/:token/request-signed-in`, `/accept-signed-in`).
- **Konto ohne Verein**: Anmeldung gelingt (`me: null`, `account`), Hinweisseite „Noch kein Verein“, Aufnahme durch den Verein per Code/QR (`/account/link-code`, `/members/attach-account`, 15 Minuten gültig, einmalig).
- **Support-Zugriff**: Freigabe 1 Stunde/1 Tag/7 Tage durch Administration/Vorstand (`club.settings.manage`), widerrufbar; Betreiber sieht nur eine **schreibgeschützte Support-Ansicht** (Einstellungen, Funktionen, Admins, Änderungsprotokoll), nie Personen-, Kassen- oder Termindaten. Jeder Abruf steht in `operator_audit` und im Änderungsprotokoll des Vereins.
- **Admin-Wiederherstellung**: Ankündigung → 48 Stunden Frist, Mail an alle Admins/Vorstände und Vereinsadresse, Widerspruch im Verein → danach Einladung des neuen Admins (nur Einladung, keine Altdaten).
- **Mandantentests**: Sweep über alle Routen (Pfade, fremde IDs, Abfrageparameter, schreibende Routen) in beide Richtungen mit Inhalts-Fingerabdruck je Tabelle.
- `/public/club` zeigt bei mehr als einem Verein keinen einzelnen Verein (Anmeldeseite neutral).

**Abweichungen vom Entwurf:** (1) Der Betreiber legt keinen Verein direkt an, sondern einen Einrichtungscode; der Admin richtet den Verein im bestehenden Assistenten ein (Abschnitt 10). (2) Der Support-Zugriff ist eine eigene Lese-Ansicht statt einer Support-Sitzung, die als Vereinsmitglied handelt. (3) Kein Vereins-Code ohne Mannschaft: Codes gelten für eine Mannschaft oder eine Person.

**Offen / Hinweise für die Sicherheitsprüfung:** Kurzcodes haben 40 Bit; Schutz durch Ratenbegrenzung je IP (20/Minute) und Befristung – ein Fehlversuchszähler je Code fehlt. Der Betreiber-Sweep sendet bei schreibenden Routen leere Inhalte (greift vor allem die Rechteprüfung, nicht jede Fachlogik). Row-Level-Security in PostgreSQL ist als spätere Härtung vorgesehen. Dateilinks (`/files`) sind signierte Fähigkeits-Links und werden im Review gesondert geprüft. Demo-Verein, Pläne und Abo folgen in eigenen Paketen.
