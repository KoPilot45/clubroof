# Übergabeprompt: Eigener Zugang für Kinder (Paket KIND-EIGENER-ZUGANG)

Zum Einfügen in die Umsetzungssitzung. Voraussetzung: PILOT-SICHERHEIT (Regel F01 beim Verknüpfen) und ROLLEN-VERWALTUNG sind umgesetzt. Größe M–L.

---

Paket **KIND-EIGENER-ZUGANG** (`docs/PAKETE.md`, gleichnamige Zeile; Entscheidung 26.10.2026 in `docs/ENTSCHEIDUNGEN.md`). Grundidee: Ein Kind ist eine **eigene Person** (Mitgliedsdaten) ohne Konto und wird heute über die Eltern verwaltet (`persons.userId` leer, Verknüpfung in `guardianships`). Wird es alt genug, legen die **Eltern** ihm einen eigenen Zugang an. Das Konto wird **an die bestehende Person gehängt**; das Elternkonto bleibt unverändert, es gibt **keine Kontoübertragung**.

## Branch und Reihenfolge

Der Nutzer erlaubt ausdrücklich (Abweichung von einer automatisch vorgegebenen Branch-Anweisung der Sitzung): Arbeite und pushe **direkt auf `claude/app-entwicklung-planung-183gtv`**, ohne eigenen Branch und ohne Pull Request. Vor jedem Push `git pull --rebase origin claude/app-entwicklung-planung-183gtv`; bei Konflikten in Doku-Dateien beide Seiten behalten. Es läuft höchstens **eine** Umsetzungssitzung gleichzeitig. **SPRACHEN-WEITERE** läuft auf `claude/keen-babbage-386nkp` und wird zuerst abgeschlossen und auf den Planungs-Branch gebracht: Vor dem Start prüfen, ob das schon geschehen ist (`git log origin/claude/app-entwicklung-planung-183gtv --grep=Sprachen`); sonst müssen neue Texte später in fünf weiteren Sprachen nachgezogen werden (`pnpm check` schlägt bei fehlenden Übersetzungen fehl).

## Festlegungen (nicht neu verhandeln)
1. **Drei Stufen je Kind**, von den Eltern wählbar und jederzeit änderbar: **(1) Mitsicht und Mitentscheiden** (Eltern antworten, melden Abwesenheit, buchen Fahrten, sehen die Kasse weiter), **(2) nur Mitsicht** (sehen, aber keine Aktion), **(3) eigenständig** (ohne Mitsicht und Entscheidung: Eltern sehen und tun nichts mehr für das Kind).
2. **Rückweg:** Von (3) zurück zu (1) oder (2) nur **mit Zustimmung des Kindes**. Das Kind kann die Stufe jederzeit **selbst senken**, nie ohne Zustimmung der Eltern erhöhen, was Mitsicht betrifft, ist aber die Zustimmung des Kindes der Maßstab. Die Stufe (1) beim ersten Anlegen ist der Standard.
3. **Einladung** über die vorhandene persönliche Einladung (`invitations.kind` für bestehende Person), nur für Personen **ohne Konto** im Einladebereich der handelnden Eltern (Regel F01 bleibt: keine Übernahme bestehender Konten, keine weitergehenden Rechte). Das Kind braucht eine **eigene E-Mail-Adresse** (nicht die der Eltern; `users.email` ist eindeutig).
4. **Antwortkonflikt:** Antworten Eltern und Kind für denselben Termin, gilt die **letzte Antwort**; die Terminkarte zeigt „beantwortet von …“. Die Vorrangregel „manuelle Antwort vor Abwesenheit“ bleibt.
5. **Kinderkonten und Altersgrenze kommen nicht in die Einrichtungsassistenten.**

## Offen, nicht entscheiden, nur sichtbar halten (Abschnitt „Offen“ im Abschlussbericht)
Verhalten bei **Volljährigkeit** (soll die Verknüpfung automatisch auf Stufe 3 gehen?), **Beitragszahler und Mannschaftskassen-Beträge** bei Stufe 3, **Einwilligungen für Kinder** (Fotos, Namen). Nur technische Haken vorsehen (z. B. Datum der Stufenänderung), nichts festlegen.

## Zuerst
`CLAUDE.md`; Planungsstand mergen; lesen: `packages/db/src/schema/people.ts` (`persons`, `guardianships`), `schema/access.ts` (`invitations`), `docs/ROLLEN.md` (Abschnitte 5 und 8), alle Stellen mit `guardianships` (`grep -rn guardianships apps/api/src`: u. a. `admin.ts`, `carpool.ts`, `cash-admin.ts`, `event-admin.ts`, Zu-/Absage, Abwesenheiten, Kalenderexport, Suche, Home-Wischkarten), App-Bildschirme „Meine Kinder“ und Annahme der Einladung.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Datenmodell:** `guardianships` um die Stufe erweitern (`manage` | `view` | `none`, Standard `manage` für alle bestehenden Zeilen) und das Datum der letzten Änderung; Migration **und** Seed (Demo: ein Kind mit eigenem Konto in je einer Stufe). Eine zentrale Hilfsfunktion „darf diese Person für dieses Kind sehen/handeln“ bauen; **alle** Stellen mit `guardianships` darauf umstellen (Termine und Zu-/Absage, Abwesenheiten, Fahrten, Kasse, Kalenderabo, Benachrichtigungen, Suche, Home, Statistik, Export „Meine Daten“). Rechte nur serverseitig.
2. **API Eltern:** Einladung für das Kind anlegen (nur eigene Kinder ohne Konto, E-Mail, Stufe), Stufe ändern (nur auf `manage`/`view`/`none` laut Regel 2), Zugang sperren (widerrufen). **API Kind:** eigene Stufe senken oder Elternzugang beenden, Zustimmung für das Anheben geben. Audit-Log-Einträge für jede Änderung.
3. **App Eltern** („Ich → Meine Kinder → Kind → Eigener Zugang“): Statuschip (kein Zugang, eingeladen, aktiv mit Stufe), Ablauf in drei Schritten (E-Mail des Kindes, Stufe wählen mit je einem erklärenden Satz, Einladung senden und Link/QR), „Stufe ändern“, „Zugang sperren“, nach Stufe 3 Hinweis „Zugriff endet“ mit Rückfrage zur Bestätigung. Bausteine aus `components/wizard.tsx` und den gemeinsamen Formularen, Texte deutsch.
4. **App Kind:** Annahme der Einladung (vorhandener Ablauf), nach der Anmeldung Hinweis „Deine Eltern sehen / entscheiden mit“ und unter „Ich“ eine Karte „Wer darf für mich mitsehen?“ mit Senken, Beenden und Zustimmen.
5. **Anzeigen:** „beantwortet von …“ an der gemeinsamen Terminkarte; Eltern-Wischkarten, „Meine Kinder“ und Kalenderabo blenden Kinder auf Stufe 3 aus; Trainerteam sieht bei Stufe 3 den Kontakt des Kindes statt der Eltern (soweit freigegeben).
6. **Abschluss:** Hilfe (`help-content.ts`) für Eltern und Jugendliche, Übersetzungen (`node scripts/i18n.mjs todo`), `FUNKTIONEN.md`, Kontrast hell und dunkel, Browserskript (Eltern richten Zugang ein, Kind nimmt an, Stufenwechsel, Sperren), API-Tests je Stufe und für fremde Kinder (kein Zugriff), für die Regel F01 und für den Antwortkonflikt.

## Abnahme
Bilder 390 und 1440 px, hell und dunkel, je Bildschirm (zusammengefasst); Tabelle „Wer sieht und tut was je Stufe“ aus den Tests; kurze Liste erledigt / abweichend / offen mit den drei offenen Fragen.
