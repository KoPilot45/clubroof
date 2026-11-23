# antoniarueller.de – Seite mit Verwaltung

PHP 8.1+, keine Abhängigkeiten, kein Build. Der Ordner wird **unverändert** per FTP/SFTP hochgeladen.

## Aufbau

| Pfad | Zweck |
|---|---|
| `index.php`, `templates/`, `assets/` | öffentliche Seite (wird bei jedem Aufruf aus der Datenbank gerendert) |
| `admin/` | Verwaltung unter `/admin/` |
| `lib/` | Datenmodell (`schema.php`), Datenbank, Anmeldung, Mailversand |
| `data/` | Datenbank-Datei (SQLite), gesperrt per `.htaccess` |
| `uploads/` | hochgeladene Bilder/PDF, Ausführung von Programmen gesperrt |
| `seed-assets/` | Startbilder, nur für die erste Befüllung |
| `tools/` | Selbsttest und lokaler Entwicklungsserver (nicht nötig auf dem Server) |

Neue Felder oder Bereiche: nur `lib/schema.php` ergänzen, die Eingabemasken entstehen daraus.

## Hochladen bei Ionos

1. Alles aus diesem Ordner in das Hauptverzeichnis der Domain hochladen (außer `tools/`, `config.php`, `data/*`, `uploads/*` falls vorhanden).
2. `https://antoniarueller.de/` aufrufen. Beim ersten Aufruf werden `config.php` (mit zufälligem Geheimnis), die Datenbank und die Startinhalte angelegt. Ordner `data/` und `uploads/` brauchen Schreibrechte (meist Standard).
3. `https://antoniarueller.de/admin/` aufrufen, E-Mail-Adresse eingeben, Code aus dem Postfach eingeben.
4. Im Admin unter **Systemcheck** prüfen: PHP, GD, Schreibrechte, Ordnerschutz, Testmail.
5. Unter **Kontakt & Fußzeile** die E-Mail-Adresse, unter **Impressum & Datenschutz** die Pflichttexte eintragen.

### Wenn die Code-Mail nicht ankommt
In `config.php` unter `mail` auf SMTP umstellen:
`'driver' => 'smtp'`, `host` `smtp.ionos.de`, `port` 587, `secure` `tls`, `user`/`pass` eines Ionos-Postfachs, das nur zum Versenden dient. `from` muss eine Adresse der Domain sein. Das Postfach, das den Code **empfängt** (Admin-Login), liegt weiterhin außerhalb der Domain.

### Wenn SQLite fehlt
`config.php` → `db` → `'driver' => 'mysql'` plus Host/Name/Benutzer/Passwort der Ionos-MySQL-Datenbank. (Die MySQL-Variante ist nicht lokal getestet.)

## Sicherheit
- Anmeldung nur mit Code per E-Mail (8 Ziffern, 10 Min. gültig, einmalig, nur gehasht gespeichert, max. 5 Versuche, Begrenzung pro Adresse und IP, neutrale Antworten).
- Nur eingetragene Adressen (Admin → Zugänge); Adressen der eigenen Domain werden abgelehnt.
- Sitzung: zufälliges Token (gehasht in der Datenbank), `HttpOnly`, `SameSite=Strict`, Abmeldung nach 60 Min. Inaktivität, max. 12 h; CSRF-Token und Herkunftsprüfung bei jeder Änderung.
- Strenge Content-Security-Policy, keine externen Skripte/Schriften (Schriften selbst gehostet), Links nur `http(s)`/`mailto`.
- Uploads: nur JPG/PNG/WebP (neu kodiert, Metadaten entfernt) und PDF, Zufallsnamen.
- Protokoll aller Anmeldungen und Änderungen; Mail bei jeder neuen Anmeldung.
- Backup: `data/` (Datenbank) und `uploads/` regelmäßig sichern (Ionos-Backup oder FTP-Download).

## Papierkorb
„In den Papierkorb“ blendet Einträge sofort aus. Unter **Papierkorb**: wiederherstellen (ans Listenende) oder endgültig löschen. Ungenutzte Bilddateien werden danach entfernt.

## Lokal testen
```
cp config.sample.php config.php   # dann driver auf 'log' stellen, site_url leer/Produktion
php -S 127.0.0.1:8080 -t . tools/router.php
php tools/selftest.php
```
Im Modus `log` landet der Anmeldecode in `data/mail.log`.
