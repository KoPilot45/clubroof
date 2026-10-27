# Übergabeprompt: Demo-Profilbilder und Vereinswappen (Paket DEMO-PROFILBILDER-LOGO)

Zum Einfügen in die Umsetzungssitzung. Kleines Paket (S–M), eine Sitzung. Voraussetzung: DEMODATEN-AUSBAU ist umgesetzt.

---

Paket **DEMO-PROFILBILDER-LOGO** (`docs/PAKETE.md`, gleichnamige Zeile). Der Auftraggeber hat gezeichnete Beispielbilder geliefert: **20 Profilbilder** und ein **Vereinswappen** für den Demoverein „SV Grün-Weiß Musterstadt“. Sie liegen in `docs/demo-assets/` (siehe dortige `README.md`), die Dateinamen sind bereits die Zielnamen unter `apps/api/assets/`. Ziel: Demo-Accounts und Personen im Demoverein zeigen diese Bilder, das Wappen ersetzt das bisherige.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Die Bilder in `docs/demo-assets/` ansehen (Vorschau im Browser oder Bildbetrachter): Avatare 100 × 100, Wappen 150 × 150, **Wappen mit weißem Hintergrund**, Avatare mit grünem Trikot auf hellgrünem Grund.
3. Lesen: `scripts/demo-bilder.mjs` (zeichnet bisher zwölf PNG-Avatare), `apps/api/src/routes/club.ts` (`/brand/:name`, `BRAND_FILE`, Inhaltstyp fest `image/png`), `packages/db/src/seed/data.ts` (`logoUrl: '/brand/demo-wappen.png'`), `seed/index.ts` (Liste `AVATARS` für Demo-Personen), `seed/ausbau-personen.ts` (Zufallsavatare, `AVATAR_COUNT`), `docs/DEMODATEN.md`, den Test auf `/brand/demo-wappen.png` in `apps/api/src/api.test.ts`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Dateien übernehmen:** `git mv docs/demo-assets/*.webp apps/api/assets/` (README bleibt in `docs/demo-assets/` mit angepasstem Hinweis „liegen unter apps/api/assets“). Das alte `demo-wappen.png` und die zwölf `demo-avatar-NN.png` entfernen; aus `scripts/demo-bilder.mjs` nur die Avatar-Zeichnung (und ein etwaiges Wappen) streichen, Sponsorenlogos, News- und Mannschaftsbilder bleiben und das Skript darf die WebP-Dateien nie überschreiben oder löschen.
2. **Auslieferung:** `BRAND_FILE` erlaubt `png` und `webp`; Inhaltstyp nach Dateiendung (`image/webp`); Pfadschutz und 404-Verhalten bleiben; API-Test für ein WebP-Bild, für ein PNG und für unzulässige Namen.
3. **Wappen:** `logoUrl` des Demovereins auf `/brand/demo-wappen.webp`; auch Migration/Seed-Stellen und Tests, die den alten Namen nennen. Prüfen, wo das Wappen erscheint (Kopfzeile, Seitenleiste, Anmeldeseite, Ladebildschirm, Vereinsdesign, Kassenbericht-PDF, Kaderkarten) und **jeweils hell und dunkel** ansehen: Der weiße Hintergrund darf in der dunklen Darstellung keinen störenden Kasten bilden (Wappen in die vorhandene runde bzw. abgerundete helle Fläche setzen statt die Datei zu ändern). Bei 150 px Auflösung auf großen Flächen (Ladebildschirm, Anmeldeseite am Desktop) die Schärfe beurteilen; **nicht künstlich hochskalieren**, in der Abnahme melden, wo das Bild zu klein wirkt.
4. **Zuordnung der Profilbilder** im Seed (kein Feld „Geschlecht“ in der Datenbank: das Geschlecht steht beim Erzeugen der Personen im Seed bzw. folgt aus dem Vornamen der festen Personen): Erwachsene ab 18 Jahren aus `maenner` oder `frauen`, unter 18 aus `jungen` oder `maedchen`. **Feste Zuordnung** der Demo-Logins und der Familie:

| Person | Bild |
| --- | --- |
| Daniel Schäfer (admin) | `maenner-01` |
| Sandra Hoffmann (vorstand) | `frauen-05` |
| Max Mustermann (trainer) | `maenner-02` |
| Max Becker (spieler, B-Jugend) | `jungen-01` |
| Julia Neumann (eltern) | `frauen-03` |
| Leon Neumann (E-Jugend) | `jungen-02` |
| Mia Neumann (F-Jugend) | `maedchen-03` |
| Petra Schulz (kasse) | `frauen-02` |
| Heike Brandt (mitglied) | `frauen-04` |

Übrige Personen: **deterministisch** (gleiche Bilder nach jedem `pnpm db:reset`, Auswahl aus einer stabilen Zahl je Person), Trainer, Vorstand, Kassenwarte und weitere Amtsträger mit Bild, übrige Erwachsene etwa **30 %**, je Mannschaft **höchstens fünf Kinder** mit Bild, **keine Wiederholung innerhalb einer Mannschaftsliste**, Eltern und ihre Kinder nie dasselbe Bild. Der Rest zeigt bewusst Initialen, damit der Rückfall ohne Bild sichtbar bleibt. Die bisherige Regel „Personen ab Jahrgang 2009 ohne Bild“ entfällt für diese Zuordnung (Kinderbilder sind gezeichnet).
5. **Anzeige prüfen:** Browserskript (`pnpm browser-check scripts/e2e/…`, neues Skript oder bestehendes erweitern), angemeldet als `admin`, `trainer`, `eltern`, `spieler`: Profil und „Ich“-Kopf, Kader (Karten und Tabelle), Mitgliederliste und -detail, Teilnehmerliste und Kader-Pop-up, Aufstellungsplaner, Suche, Kommentare, „Meine Kinder“, Desktop und Handy, hell und dunkel; jedes Bild muss laden (kein kaputtes Symbol), Rundung und Zuschnitt (100-px-Quelle) bei den größten Darstellungen beurteilen.
6. **Abschluss:** `docs/DEMODATEN.md` (Zeilen „Bilder“ und Wappen) und `docs/FUNKTIONEN.md` anpassen, Demodaten-Zähler/Tests nachziehen, `pnpm db:reset` muss laufen, Kontrastprüfung nur für die betroffenen Routen (Profil, Kader, Mitglieder, Anmeldung).

## Abnahme
Eine zusammengefasste Bildübersicht (Wappen an allen Stellen hell und dunkel; je ein Bildschirm mit Avataren am Handy und am Desktop; die neun festen Personen), kurze Liste erledigt / abweichend / offen, Hinweis, wo die 150-px-Auflösung des Wappens nicht ausreicht.
