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
- **Englisch:** Menü „Englisch“ → Übersetzungstabelle (alle übersetzbaren Texte, Deutsch links, Englisch rechts; Filter „Noch offen“, Bereich, Suche; Speichern beim Verlassen des Feldes, wirkt direkt auf die englische Seite, ohne andere Entwürfe zu veröffentlichen). In den Formularen gibt es keine Sprachumschalter mehr, nur einen Hinweis mit Link; englische Texte bleiben beim Speichern erhalten. Leere Felder zeigen den deutschen Text. Englische Seite: `/en/`, `/en/imprint/`, `/en/privacy/`.
- **Komfort:** Hervorhebungs-Knöpfe, Zeichenzähler, Google-Vorschau, Sortieren per Ziehen, Listensuche, Fokuspunkt im Bild, Mediathek.
- **Sicherheit & Betrieb:** Zusätzliches Passwort (Mein Konto), Geräteliste mit Abmelden, Sicherungen als JSON auf dem Server (`data/backups/`, im Admin aufgelistet: Herunterladen, Wiederherstellen, Löschen; automatisch alle 7 Tage bei Anmeldungen, optional `cron.php`).
- **Bedienung:** Menü nach Website-Abschnitten (Startseite, Arbeiten, Podcast, Über mich, Lebenslauf, Off the record, Kontakt, Seite & Design, Suche & Recht, Auswertung, System; Gruppen klappbar, Zähler für offene Entwürfe), „Deine Website“-Karte auf der Übersicht, globale Suche mit Strg+K, Hilfe-Seite. Formulare: feste Aktionsleiste, Strg+S (Entwurf) / Strg+Enter (veröffentlichen), automatisches Sichern als Entwurf (bei bestehenden Einträgen), Live-Vorschau neben dem Formular, seltene Einstellungen unter „Erweitert“. Listen: Schalter „Anzeigen“, Statuschips und Filter, Menü „⋯“ (Verschieben, Duplizieren, Papierkorb), Mehrfachauswahl, „Rückgängig“ nach dem Entfernen, Handy-Leiste unten. Die Vorschau darf nur von der eigenen Verwaltung eingebettet werden (`frame-ancestors 'self'`).
- **Trenner unter dem Hero:** schmales Petrol-Band mit Schnittmarken wie ein Lineal (rein dekorativ, kein Laufband mehr, keine Daten im Backend).
- **Kontakt-Überschrift:** „Schreib mir.“ im Stil des Hero (Instrument Serif, einfarbig, zweite Zeile kursiv und eingerückt).
- **AVIF:** Bildfelder und Mediathek nehmen auch AVIF an. Der Browser wandelt es beim Auswählen in WebP um (unabhängig vom Server), danach optimiert der Server wie gewohnt (WebP, Qualität 72, 1600 px). Wo der Server AVIF selbst lesen kann (GD mit AVIF), geht es auch ohne Browser; sonst erscheint eine klare Meldung. Der Systemcheck zeigt den Stand.
- **Bildfelder im Backend:** Ein gewähltes Bild (Computer oder Mediathek) wird sofort hochgeladen (`upload_image`, WebP/Verkleinerung wie gewohnt) und in der Vorschau gezeigt; bei bestehenden Einträgen und Einstellungsseiten wird es zugleich automatisch als Entwurf gesichert und erscheint in der Live-Vorschau. Öffentlich sichtbar wird es erst nach „Veröffentlichen“. Fällt der Direkt-Upload aus, wird die Datei wie früher beim Speichern hochgeladen. Ungenutzte Bilder bleiben in der Mediathek (kein automatisches Löschen; von Hand löschbar).
- **Rechtstexte (Impressum, Datenschutz):** kleiner Text-Editor mit Werkzeugleiste (Überschrift, Fett, Liste, Link, Link entfernen; Strg+B/K). Links gehen auf Webadressen, E-Mail-Adressen und die Seiten Impressum/Datenschutz (je nach Sprache). Gespeichert wird weiter als einfacher Text (`## `, `- `, `**fett**`, `[Text](Ziel)`); der Editor gilt auch in der Übersetzungstabelle. Unsichere Ziele werden nicht verlinkt.
- **Vorschaubilder:** Je Referenz optional „Vorschaubild“ (Fokuspunkt, WebP-Optimierung, Mediathek) und „Bildnachweis". Die Liste „Alle Beiträge" besteht aus quadratischen Kacheln (Bild mit Nummer und Kategorie, Titel und Angaben darunter; ohne Bild eine typografische Kachel in Petrol/Tinte). Beim Hauptbeitrag steht das Bild quadratisch rechts. Der Schnittplatz zeigt keine Bilder.
- **Hero:** Ruhiger Namensschriftzug in Instrument Serif (einfarbig in Tinte: Vorname aufrecht, Nachname kursiv und eingerückt, normales ü), links Text, rechts das Foto im Mint-Kreis. Keine Kontur, keine Überlagerung.
- **Lebenslauf:** Die Jahreszahl einer Gruppe ist farbig, wenn mindestens eine Station dieses Beginn-Jahres „Läuft noch“ hat, sonst als Umriss.
- **Podcast:** Je Folge optionale Kurzbeschreibung (höchstens 200 Zeichen, Zeichenzähler im Backend, übersetzbar) unter dem Titel.
- **Weiche Bewegungen (ohne Bibliothek, nur CSS/wenig JS, aus bei „Bewegung reduzieren“):** Abschnitte blenden unterhalb des sichtbaren Bereichs beim Scrollen ein, Hover-Zustände bei Knöpfen/Listen, gleitender Strich unter dem aktiven Menüpunkt, Clips laden nacheinander in die Spuren des Schnittplatzes, Überblendung beim Wechsel des aktiven Beitrags, sanft pulsierender Aufnahme-Punkt, Parallax des Kreises hinter dem Startfoto (nur Desktop), Aufmacher baut sich ruhig auf. Ohne JavaScript bleibt alles sichtbar.
- **Scroll-Effekte:** Player-Leiste an der Unterkante der Kopfzeile (Fortschritt, Abspielmarke, Kapitelstriche an den Abschnitten) und ein dezenter „Nach oben“-Knopf rechts unten ab 1,5 Bildschirmhöhen.
- **Bilder:** Fester Standard ohne Einstellungen: Uploads werden automatisch als WebP gespeichert (Qualität 72), auf höchstens 1600 px an der längsten Seite verkleinert und von Metadaten/GPS befreit. In der Mediathek (Inhaber) komprimiert „Vorhandene Bilder neu komprimieren“ bestehende Dateien mit demselben Standard (Name und Format bleiben, nur kleinere Ergebnisse ersetzen die Datei).
- **Hauptbeitrag (Featured):** Aufmacher auf Petrol-Fläche wie eine Titelseite (Kopfzeile mit Kategorie/Redaktion/Datum, Format als Vorspann-Marke, Schlagzeile mit Hervorhebungen, Beschreibung als Vorspann, Zeile „Von …“ und Link-Knopf mit Symbol der Kategorie, große Nummer im Hintergrund). Ein hinterlegtes Standbild ersetzt die Nummer als Titelbild. Kein Videobereich, kein Timecode.
- **Schnittplatz (Showreel):** Schlanke Übersicht über alle Beiträge: jede Spur ist eine Kette aus Clips in Listenreihenfolge, ohne Datumsmaßstab (Länge je Referenz: kurz/normal/lang; Jahres-Fähnchen aus dem Datum; dekoratives Timecode-Lineal). Beim Darüberfahren erscheint ein Schild mit Titel und Redaktion, ein Klick springt zur Kachel darunter und hebt sie hervor. Frühere lange Balken werden einmalig zu „Lang“. Darunter stehen die Beiträge als Kacheln (höchstens drei Spalten) mit Beschreibung und Rolle.
- **Statistik** (eigene Seite im Admin): Zeitraum 7/30/90 Tage/12 Monate mit Vorperiode, Diagramm mit Ø-Linie und Veröffentlichungs-Markern, Heatmap Wochentag × Uhrzeit, Verweise nach Kategorie, anonyme Klick-/Abschnittszähler (`stat.php`), Crawler, 404-Adressen, CSV. Daten: `data/stats/` (`JJJJ-MM.log`, `events-*.dat`, `bots-*.dat`, `404-*.dat`); Stundenwerte werden nach 90 Tagen zu Tageswerten (`archive.json`) verdichtet. Ohne Cookies, ohne IP-Adresse; ein Gerät zählt höchstens einmal je Stunde (Kurzwert bis Stundenende, danach gelöscht). Ein-/Ausschalten und Löschen im Admin (Inhaber).

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

## Referenzen: Kategorien, Featured, eigener Beitrag

- **Kategorien** (früher „Spuren“, Menü „Arbeiten → Kategorien“): jede Kategorie ist eine Spur im Schnittplatz (Kürzel, Bezeichnung, Symbol, Farben). Die Referenz wählt nur die Kategorie; Format, Länge, „Schnittplatz“, „Hauptclip“, „Große Überschrift“ und „Auf der Seite anzeigen“ entfallen im Formular. Die Breite der Clips variiert automatisch (fester Wert je Beitrag, `tl_weight()`), die längste Spur füllt mindestens 80 % der Breite (CSS `--u`, Container-Einheiten).
- **Featured:** Stern in der Referenzen-Liste (immer nur eine Referenz, wirkt sofort wie der Schalter zum Ein-/Ausblenden). Ist die hervorgehobene Referenz ausgeblendet, zeigt die Liste einen Hinweis und der Bereich fällt auf der Seite weg; ohne Featured entfällt der Bereich ebenfalls. Der Block heißt „Featured“, die Überschrift ist immer der Titel.
- **Link zum Beitrag:** Umschalter „Externer Link“ / „Beitrag selbst hosten“. Selbst gehostet: Linktext (Standard „Beitrag ansehen“) und Galerie aus Bildern und PDFs (Reihenfolge per Ziehen oder Pfeile, Bildunterschrift optional, englisch in der Übersetzungstabelle). Auf der Seite öffnet der Knopf (Featured und Kachel) eine Lightbox mit Pfeilen, Wischen, Tastatur und Zähler. Jede Kachel hat unten einen Knopf (externer Link oder Galerie).
- **Bild entfernen:** rotes X am Vorschaubild mit Rückfrage; wirkt im Entwurf, live erst nach „Veröffentlichen“.
- **Speicher-Leiste:** eine Zeile – Veröffentlichen, Entwurf, Status, Live/Vorschau/English als kompakte Knöpfe, Abbrechen, Hilfe („?“) mit Erklärung und Tastenkürzeln.
- „Alle Clips“ heißt jetzt „Alle Beiträge“.

## Abschnitte

- „Seite → Abschnitte“ (früher „Überschriften der Abschnitte“): je Abschnitt eine Karte mit Schieberegler (Leitfragen, Showreel, Podcast, Über mich, Stationen, Lebenslauf, Off the record, Kontakt) und allen Texten des Abschnitts. Start (Intro) ist immer sichtbar; die Fußzeile mit Impressum und Datenschutz bleibt auch bei ausgeschaltetem Kontakt.
- Ausgeschaltete Abschnitte entfallen samt Menüpunkt (Kopfzeile, Handy-Menü, „Schreib mir“-Knopf); das Featured hängt nur am Stern der Referenzen.
- Neu bearbeitbar (vorher fest im Code): Abschnittsnamen der REC-Zeilen, Intro-Name und Timecode, Hinweis/Spaltenkopf im Schnittplatz, Featured-Beschriftungen, „Rolle:“, Wort für „Clips“, Podcast „Anhören bei“/„Folge“, „heute“/„seit“, Mail-Hinweis, „Kopieren“/„Kopiert“, Fußzeilen-Links, Titel im Handy-Menü. Das Feld „Podcast: Zeile rechts“ war bisher ohne Wirkung und wird jetzt angezeigt. Leere Pflichtbeschriftungen fallen auf den Standardtext zurück; Standardtexte stehen ohne Eingabe auch englisch zur Verfügung (nur eigene Texte erscheinen in der Übersetzungstabelle).
- Fest gestaltet bleibt die Überschrift „Off the record“ (durchgestrichenes „the“).
