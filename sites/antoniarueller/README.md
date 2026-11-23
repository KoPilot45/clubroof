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

## Verwaltung im Überblick
- **Übersicht:** Startklar-Check, offene Entwürfe, Platzhalter-Finder, Stand der englischen Übersetzung, Besucherzahlen.
- **Entwürfe & Vorschau:** „Als Entwurf speichern“ ist nur in der Vorschau (`/admin/vorschau.php`, auch `?lang=en`) sichtbar; „Veröffentlichen“ schaltet live. Versionsverlauf (25 Fassungen) mit „Als Entwurf laden“.
- **Englisch:** In jedem Formular der Reiter „English“. Leere Felder zeigen den deutschen Text. Englische Seite: `/en/`, `/en/imprint/`, `/en/privacy/`.
- **Komfort:** Hervorhebungs-Knöpfe, Zeichenzähler, Google-Vorschau, Sortieren per Ziehen, Listensuche, Fokuspunkt im Bild, Mediathek.
- **Sicherheit & Betrieb:** Zusätzliches Passwort (Mein Konto), Geräteliste mit Abmelden, Sicherungen als JSON auf dem Server (`data/backups/`, im Admin aufgelistet: Herunterladen, Wiederherstellen, Löschen; automatisch alle 7 Tage bei Anmeldungen, optional `cron.php`).
- **Besucherzahlen:** `data/stats/*.log`, nur Datum/Stunde, Seite, Gerätetyp, verweisende Domain – ohne Cookies und ohne IP-Adresse.

## SEO & Suche
Im Admin unter **SEO & Suche**: Titel, Beschreibung, Vorschaubild, noindex-Schalter, strukturierte Daten (Schema.org: Person, ProfilePage, Werkliste der Referenzen), Webmaster-Bestätigung, robots.txt (inkl. Sperre für KI-Training-Crawler) und llms.txt. `robots.txt`, `sitemap.xml` und `llms.txt` werden aus den Einstellungen erzeugt. Favicon: `icon.svg`, `favicon.ico`, `apple-touch-icon.png`.

## Weitere Zugänge per Konfiguration
`config.php` → `'extra_users' => [['email' => '…', 'name' => '…']]` legt beim nächsten Aufruf einmalig einen Zugang an.

## Sicherheit
- Anmeldung mit E-Mail-Code (8 Ziffern, 10 Min. gültig, einmalig, nur gehasht gespeichert, max. 5 Versuche, Begrenzung pro Adresse und IP, neutrale Antworten) und optional zusätzlichem Passwort (bcrypt).
- Nur eingetragene Adressen (Admin → Zugänge); Adressen der eigenen Domain werden abgelehnt.
- Sitzung: zufälliges Token (nur als Hash in der Datenbank), `HttpOnly`, `SameSite=Strict`, Abmeldung nach 60 Min. Inaktivität, max. 12 h; CSRF-Token und Herkunftsprüfung bei jeder Änderung; Geräteliste mit Abmelden.
- Strenge Content-Security-Policy, keine externen Skripte/Schriften, Links nur `http(s)`/`mailto`, alle Ausgaben maskiert, Farben nur als #RRGGBB.
- Uploads: nur JPG/PNG/WebP (neu kodiert, Metadaten entfernt) und PDF, Zufallsnamen, keine Programmausführung in `uploads/`.
- Gesperrte Ordner/Dateien (`.htaccess`): `lib/`, `data/` (inkl. Sicherungen), `templates/`, `tools/`, `seed-assets/`, `config*.php`, `error_log`. Im Admin unter „Systemcheck“ prüft ein Selbsttest, dass sie von außen nicht erreichbar sind.
- Verschlüsselung: HTTPS (HSTS), Mail-Versand per SMTP mit TLS und Zertifikatsprüfung, Passwörter/Codes/Sitzungen nur als Hash. Datenbankverbindung zu Ionos ist standardmäßig unverschlüsselt (internes Netz); optional `db.ssl_ca` in `config.php`.
- Konfiguration (`config.php` mit Zugangsdaten) am besten eine Ebene ÜBER dem Webverzeichnis als `antoniarueller-config.php` ablegen; sie wird dann bevorzugt gelesen.
- Protokoll aller Anmeldungen und Änderungen; Mail bei jeder neuen Anmeldung.
- Sicherungen: `data/backups/` (im Admin verwaltet). Zusätzlich gelegentlich eine Sicherung herunterladen und `uploads/` per FTP sichern.
