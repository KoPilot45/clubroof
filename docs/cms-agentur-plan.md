# Plan: SEO/GEO-CMS für Kundenwebseiten (Agentur-Baukasten)

Stand: 27.11.2026. Grundlage: Erfahrungen aus dem Projekt „antoniarueller.de“ (Onepager mit eigenem PHP-CMS, 105 ausgelieferte Versionen).
Zweck dieses Dokuments: Startunterlage für ein neues Claude-Projekt. Es enthält Ziele, Entscheidungen mit Empfehlung, Architektur, Funktionsumfang, Qualitätsregeln, Phasenplan und eine Startvorlage (Abschnitt 17).

---

## 1. Vision und Abgrenzung

**Idee.** Ein fertiges, durchoptimiertes CMS als gemeinsame Basis für Kundenwebseiten einer SEO/GEO-Agentur. Jeder Kunde bekommt ein eigenes Erscheinungsbild über **individuell entworfene Bausteine (Templates)**, die im Backend zu Seiten zusammengesetzt werden. Die technische Suchmaschinen- und KI-Optimierung ist im Kern eingebaut und muss nicht pro Kunde neu gebaut werden.

**Kern-Versprechen (Verkaufsargumente).**
1. Technisch saubere Seiten ab Werk: schnell, barrierefrei, korrekte Struktur, Schema.org, Sitemap, hreflang, Redirect-Verwaltung.
2. GEO (Auffindbarkeit in KI-Antworten): klar strukturierte, zitierfähige Inhalte, FAQ-/Fakten-Bausteine, Autoren- und Quellenangaben, `llms.txt`, Steuerung der KI-Crawler, Auswertung der KI-Crawler-Abrufe.
3. Datenschutz ohne Cookie-Banner: eigene Schriften, keine Fremd-Embeds, cookielose Statistik.
4. Redaktion ohne Technikwissen: „Seite anlegen → Abschnitte wählen → Felder ausfüllen“.
5. Agentur-Vorteil: neue Kundenwebseite = neues Theme-Paket (Design-Tokens + Bausteine), nicht neues CMS.

**Nicht-Ziele (bewusst).**
- Kein WordPress-Ersatz für alles (kein Plugin-Marktplatz, kein Shop, keine Mitgliederbereiche in Version 1).
- Kein Page-Builder mit freier Pixelpositionierung. Layout entsteht nur aus vorgefertigten Bausteinen: Das schützt Design, Performance und SEO.
- Kein Multi-Tenant-SaaS in Version 1 (siehe Entscheidung E1).

**Ehrliche Einordnung zu SEO/GEO.** Kein CMS „garantiert“ Rankings oder KI-Zitate. Das CMS liefert die technische Grundlage und macht gute Praxis zum Standardweg. Der Rest ist Inhalt, Autorität und Zeit. Dieses Versprechen sollte auch im Vertrieb so formuliert werden. Manche GEO-Maßnahmen haben unsichere Wirkung (z. B. `llms.txt` ist kein offizieller Standard und wird nicht von allen Diensten ausgewertet). Sie sind billig einzubauen, aber nicht als Garantie zu verkaufen.

---

## 2. Lehren aus dem Antonia-Rüller-Projekt

### Was sich bewährt hat (übernehmen)
| Erkenntnis | Folge für das neue CMS |
|---|---|
| **Schema-getriebene Formulare.** Felder, Typen, Grenzen, Defaults stehen in einer Beschreibung; Formular, Validierung, Speichern und Übersetzungstabelle leiten sich daraus ab. | Jeder Baustein bringt sein Feldschema mit (Manifest). Keine handgeschriebenen Formulare pro Baustein. |
| **Rechte nur serverseitig.** Rollen sind Rechtepakete. | Gleich. Zusätzlich Agentur-Rolle vs. Kunden-Rolle. |
| **Entwurf und Veröffentlichen getrennt**, Vorschau mit allen Entwürfen, „Frühere Fassungen“. | Pro Seite und pro Baustein. Vorschau-Link zum Teilen. |
| **Stil-Varianten pro Bereich** (aktuell + 2 Alternativen, Auswahlkarten mit echten Screenshots). Kunden sehen, was sie wählen. | Bausteine bekommen **Varianten**. Vorschaubilder werden automatisch aus der echten Seite erzeugt, nicht gezeichnet. |
| **Design-Tokens statt Hex-Werte.** 14 Paletten mit Lesbarkeitsprüfung, abgeleitete Töne werden berechnet. Live-Vorschau beim Ändern. | Pro Kunde Tokens (Farben, Schrift, Größen). Kontrastprüfung im Backend. |
| **Server-Rendering + Seiten-Cache**, kein Frontend-Framework. | Gleich. Schnell, SEO-freundlich, einfach zu hosten. |
| **Strenge Sicherheit** (CSP, CSRF, Login per E-Mail-Code, Rate-Limit, Uploadprüfung, Audit-Log, wöchentliche Sicherung). | Als Kern übernehmen, nicht pro Kunde neu bauen. |
| **Selftest gegen echte Datenbank** plus Browserprüfungen (Kontrast, axe, Screenshots). Jede Funktion mit Test. | Pflicht für Kern und jeden Baustein (Abschnitt 12). |
| **Cookielose Statistik** mit Unterscheidung „echte Besuche“ (Interaktionssignal), Crawler getrennt, 404-Liste, Zurücksetzen zum Livegang mit Sicherung. | Als Standardmodul. Inklusive KI-Crawler-Auswertung (GEO-Argument). |
| **Export/Import der Übersetzungen** mit KI-Prompt und Vorschau-Prüfung. | Standardmodul für Mehrsprachigkeit. |
| **Mockups als Entscheidungsgrundlage** (HTML-Artefakte, mehrere Varianten, Desktop + Handy). | Fester Schritt im Template-Prozess (Abschnitt 11). |
| **Pakete + Dokumentation als Gedächtnis.** `CLAUDE.md` + `docs/` tragen den Stand, pro Paket eine Sitzung. | Gleiche Arbeitsweise (Abschnitt 14). |

### Was Probleme gemacht hat (vermeiden)
| Problem im Antonia-Projekt | Gegenmaßnahme |
|---|---|
| **Migrationen und Neuinstallation laufen auseinander.** Ein Überschriften-Merge hat auf frischen Installationen doppelte Texte erzeugt („LEBENSLAUFLAUF“); Datenschutztexte der Standardvorlage und der migrierten Texte waren verschieden. | Jede Migration hat einen **Neuinstallations-Guard** und einen Test „frische DB = migrierte DB“. Standardtexte nur an **einer** Stelle pflegen. |
| **Seitenspezifische Annahmen im Code** (feste Abschnittsnamen, feste Nummernlogik, „Stationen“ als Menüpunkt). | Alles, was ein Kunde benennen kann, kommt aus dem Backend und wird nie von Code oder Migration überschrieben. |
| **Neue Varianten nachträglich in bestehende Bereiche eingebaut** (Stil-System kam erst in Version 91). | Das Varianten-Konzept von Anfang an im Block-Manifest. |
| **Fehlende Neben-Funktionen erst spät entdeckt** (Featured-Beitrag hatte keine Varianten, nur ein Weg für Bilder, Menü-Markierung beim Hochscrollen). | Checkliste je Baustein (Abschnitt 12.3) und Review „jeder Bereich: Varianten, Handy, Hell/Dunkel, Sprachen, leere Zustände“. |
| **Statistik anfangs durch Bots verfälscht** (99 % „Direkt“, Scanner-Treffer als Besuche; 404-Liste zeigte nur `/404.php`). | Interaktionssignal von Beginn an, 404 mit echter Adresse, Crawler-Erkennung, `REDIRECT_URL`-Fallbacks (Hoster-Unterschiede!). |
| **Hoster-Eigenheiten** (IONOS: Apache, kein Shell-Zugriff, FTP-ZIP, `ErrorDocument`-Variablen, `.htaccess`-Fallen, Caching). | Hosting-Matrix vorab (E2) und Testliste „läuft auf Zielhoster“. |
| **Große Einzeldateien/Prompts, Kontextverlust** in langen KI-Sitzungen. | Kleine Module, Pakete, Doku als Gedächtnis (Abschnitt 14). |
| **Fremdquellen für Bilder/Texte** (Platzhalter, fehlende Beitragsbilder beim Testen). | Demo-Daten + Beispielbilder gehören zum Kern-Repository (Seed) und zu jedem Baustein (Beispielinhalt). |
| **Kontrastfehler bei Hell/Dunkel und bei neuen Paletten** wurden erst nach Sichtprüfung entdeckt. | Automatischer Kontrasttest über alle Paletten × Bausteine × Varianten im CI. |

---

## 3. Produktkonzept

### 3.1 Rollen
- **Agentur-Admin** (Inhaber): Alles. Theme/Bausteine freischalten, Updates einspielen, SEO-Audit-Details, System, Sicherungen.
- **Kunden-Redakteur:** Seiten und Beiträge anlegen/bearbeiten, Medien, Übersetzungen, Statistik lesen. Darf keine Bausteine definieren, keine Tokens ändern (außer freigegebene Paletten), keine Systemeinstellungen.
- **Kunden-Inhaber (optional):** wie Redakteur plus Nutzer, Veröffentlichen, Statistik-Reset.
- **Rechte** als Pakete (nicht als Personenarten). Berechtigungen serverseitig prüfen.

### 3.2 Hauptbegriffe
- **Seite** (hierarchisch, `/leistungen/seo-audit`): besteht aus **Abschnitten**.
- **Abschnitt** (Block): ein Baustein-Typ + Variante + Daten + „sichtbar“-Schalter.
- **Inhaltstyp**: Seite, Beitrag, Portfolio/Referenz, optional weitere (Team, Standort, FAQ-Eintrag). Jeder Typ hat Felder, Archivseite, Einzelvorlage.
- **Kategorie/Schlagwort** (Taxonomie), Zuordnung zu Inhaltstypen.
- **Globale Elemente:** Kopfzeile, Fußzeile, Navigation, wiederverwendbare Abschnitte (z. B. CTA-Band).
- **Theme-Paket:** Design-Tokens, Bausteine, Beispielinhalte, Vorschaubilder eines Kunden.

### 3.3 Backend-Ablauf („Seite anlegen“)
1. **Seite anlegen:** Typ wählen, Titel, URL-Pfad (automatisch, änderbar), übergeordnete Seite, Sprache.
2. **Abschnitte:** Liste mit Ziehen und Pfeilen (wie „Aufbau der Seite“ im Antonia-Backend), Schalter „Sichtbar“, Duplizieren, Entfernen mit Rückgängig.
3. **„+ Abschnitt hinzufügen“:** Bausteinbibliothek als **Karten mit echten Vorschaubildern**, gruppiert (Einstieg/Hero, Text, Bild/Galerie, Leistungen, Referenzen, Team, FAQ, Kontakt, Listen, Sonstiges), mit Suche.
4. **Variante wählen** (Auswahlkarten, Standard zuerst).
5. **Formular des Abschnitts** (aus dem Feldschema): Text, Markup (`*kursiv*`), Bild mit Fokuspunkt und Alt-Text, Link (intern/extern), Wiederholgruppen (Karten, FAQ-Einträge), Auswahl, Schalter.
6. **Live-Vorschau:** eingebettete echte Seite (iframe `?embed=1` ohne Banner), Wechsel Desktop/Handy.
7. **SEO-Panel** (Titel, Beschreibung, Fokusbegriff, OG-Bild, noindex, Canonical, Schema-Typ) mit **Ampel-Audit**.
8. **Speichern als Entwurf / Veröffentlichen**, Vorschau-Link, Revisionsliste.

Vorbild: Das Antonia-Backend zeigt, dass Redakteurinnen schnell zurechtkommen, wenn (a) die Auswahl sichtbar ist (Screenshots statt Dropdown), (b) die Vorschau sofort reagiert und (c) das Formular nur das Nötige zeigt.

---

## 4. Wichtige Entscheidungen (mit Empfehlung)

| Nr. | Frage | Empfehlung | Begründung / Alternativen |
|---|---|---|---|
| **E1** | Eine Installation pro Kunde oder Multi-Tenant? | **Eine Installation pro Kunde** (Single-Tenant), gemeinsamer Kern als versioniertes Paket, Kunde = Theme-Paket + Konfiguration. | Einfach, Datenschutz-sauber (getrennte Daten), läuft auf normalem Webhosting, Fehler betreffen nur einen Kunden. Multi-Tenant lohnt erst ab vielen Kunden und braucht eigenes Betriebskonzept. |
| **E2** | Zielhosting? | **Klassisches Shared Hosting (IONOS, Apache, PHP 8.2+, MariaDB)** als Mindestanforderung; optional VPS. | Kunden haben oft schon Hosting; Erfahrung existiert. Dafür: kein Shell-Zugriff, Updates per ZIP/FTP oder Web-Updater. |
| **E3** | Framework oder eigener schlanker Kern? | **Eigener schlanker Kern in PHP ohne großes Framework**, klar modularisiert, Composer nur wo nötig (oder gar nicht). | Läuft überall, wenig Angriffsfläche, volle Kontrolle über SEO-Ausgabe. Alternative Laravel/Symfony: mehr Struktur, aber höhere Hoster-Anforderungen. |
| **E4** | Datenbank? | **MariaDB/MySQL live, SQLite für Entwicklung** (wie bisher), Zugriff nur über eine kleine DB-Schicht. | Bewährt. Migrationen testen auf beiden. |
| **E5** | Seiteninhalte als JSON oder normalisiert? | **Abschnitte als JSON je Seite/Abschnitt** (Felddaten), Beziehungen (Seite, Kategorie, Medien, Redirect) relational. | Flexibel für Bausteine ohne Schemaänderung, gleichzeitig suchbar über Relationen. |
| **E6** | Editor-Prinzip? | **Formulare je Baustein + Live-Vorschau** (kein Inline-Editing, kein freier Rich-Text-Editor). Begrenztes Text-Markup (fett/kursiv/Link/Liste). | Verhindert kaputtes HTML, hält Struktur und SEO sauber. |
| **E7** | Mehrsprachigkeit? | **Deutsch Hauptsprache + weitere Sprachen als Spiegel-Seiten** mit Zuordnung, hreflang automatisch; Übersetzungstabelle und Export/Import. | Erfahrung aus Antonia (de/en). Pro Kunde optional. |
| **E8** | Updates ausliefern? | **Kern-Version als ZIP und Web-Updater** (Prüfsumme, Sicherung, Migrationen), Kunden-Theme getrennt im Ordner `themes/<kunde>`. | Updates ohne Überschreiben von Kundendaten und Theme. |
| **E9** | Modulgrenzen für Wiederverwendung des Antonia-Codes? | Teile **extrahieren**, nicht kopieren (Abschnitt 13). | Sonst entstehen zwei Codebasen. |

---

## 5. Architektur

### 5.1 Ordnerstruktur (Vorschlag)
```
/ (Webroot)
  index.php                 Front-Controller (alle Seitenaufrufe)
  admin/                    Backend (eigene Einstiegspunkte, strenge CSP)
  core/                     Kern (versioniert, wird bei Updates ersetzt)
    lib/                    auth, db, schema, forms, blocks, render, seo, media, cache, mail, stats, i18n, backup, updater
    blocks/                 Standard-Bausteine (Manifest + Template + CSS)
    migrations/             nummerierte Migrationen
  themes/<kunde>/           Kundenpaket (bleibt bei Updates unangetastet)
    theme.json              Tokens, Schriften, freigegebene Bausteine, Navigation-Slots
    blocks/                 kundenspezifische Bausteine
    assets/                 CSS, Schriften, Logos
    seed/                   Beispielinhalt + Bilder
  data/                     DB (SQLite dev), Cache, Statistik, Sicherungen (per .htaccess gesperrt)
  uploads/                  Medien (Originale + erzeugte Varianten)
  config.php                Zugangsdaten (nie im Repository)
```
Wichtig: `config.php` und alle Geheimnisse nie ins Repository; Beispieldatei `config.sample.php`.

### 5.2 Anfrage-Ablauf (Frontend)
1. `index.php` ermittelt Sprache, Pfad → **Router** (Seite, Beitrag, Archiv, Kategorie, Sitemap, `robots.txt`, `llms.txt`, Redirect, 404).
2. **Redirect-Tabelle** wird zuerst geprüft (301/302, mit Treffer-Zähler).
3. Seite laden → Abschnitte → je Baustein **Template rendern** (reines PHP, Variablen aus dem Feldschema, alles maskiert).
4. **Layout** (Kopf, Navigation, Fuß) + SEO-Head (Title, Description, Canonical, hreflang, OG, JSON-LD) aus **einer** zentralen Funktion.
5. **Seiten-Cache** (Datei, Schlüssel = Seite + Sprache + Build-ID), Leeren bei jeder Veröffentlichung. Hinweis: Statistik-Hit darf auch bei Cache-Treffer zählen (im Antonia-Projekt so gelöst).
6. Statistik-Hit und Sicherheits-Header.

### 5.3 Kernmodule
`auth` (E-Mail-Code, optional Passwort, Sitzungen, Rate-Limit) · `db` · `schema` (Feldtypen, Validierung) · `forms` (Formulargenerator) · `blocks` (Registry, Manifest, Varianten) · `render` · `seo` (Head, JSON-LD, Sitemap, robots, llms) · `media` (Upload, Prüfung, Varianten) · `cache` · `mail` · `stats` · `i18n` · `backup` · `updater` · `redirects` · `audit` (SEO-Prüfungen) · `search` (interne Suche, optional).

---

## 6. Datenmodell (Skizze)

```
sites_settings(group, data JSON, draft JSON, updated_at, updated_by)   -- globale Einstellungen (SEO, Tokens-Auswahl, Kopf/Fuß, Mail)
content_types(key, label, fields JSON, has_archive, route_pattern)       -- Seite, Beitrag, Portfolio …
entries(id, type, parent_id, slug, path, lang, translation_group,
        title, status(draft|published|scheduled|archived), published_at, modified_at,
        author_id, seo JSON, data JSON, draft JSON, sort)                  -- „Seiten und Inhalte“
sections(id, entry_id, block, variant, data JSON, visible, sort)         -- Abschnitte einer Seite (oder JSON-Liste in entries.data)
terms(id, taxonomy, slug, label, parent_id, lang) ; entry_terms(entry_id, term_id)
media(id, file, mime, w, h, alt, caption, focus, credit, variants JSON, hash)
menus(id, key, items JSON, lang)                                          -- Navigation, Fußzeile
redirects(id, from_path, to, code, hits, last_hit, created_at)
revisions(id, entry_id, data JSON, user, created_at, label)
users(id, email, role, pw_hash, last_login) ; sessions ; login_codes ; throttle
audit_log(id, user, action, target, at)
translations(key, lang, text, src_hash)                                   -- bei Bedarf statt `_en`-Felder
```
Regeln aus dem Antonia-Projekt:
- **Zeiten in UTC** speichern, Anzeige in Zeitzone der Seite.
- **Jede fachliche Tabelle trägt die Seiten-/Kundenkennung**, falls später doch mehrere Seiten in einer Installation laufen (billiger Vorbehalt für E1).
- **Soft-Delete** (Papierkorb) für Inhalte, mit endgültigem Löschen.
- **Entwurf und Live getrennt** (`draft` neben `data`), Veröffentlichen kopiert.
- **Migration + Seed gemeinsam ändern**, `reset` muss immer laufen.

---

## 7. Das Baustein-System (Herzstück)

### 7.1 Manifest eines Bausteins (`block.json`)
```json
{
  "key": "leistungen-karten",
  "label": "Leistungen als Karten",
  "group": "Leistungen",
  "description": "3–6 Karten mit Titel, Text und Link.",
  "seo": { "heading": "h2", "schema": null, "notes": "Karten-Titel sind h3." },
  "variants": {
    "standard": { "label": "Raster", "preview": "vorschau/standard.jpg" },
    "liste":    { "label": "Liste mit Symbol" }
  },
  "fields": [
    { "key": "title",   "type": "text",     "label": "Überschrift", "required": true, "max": 70 },
    { "key": "intro",   "type": "textarea", "label": "Einleitung", "max": 300, "markup": true },
    { "key": "cards",   "type": "repeater", "label": "Karten", "min": 2, "max": 6, "fields": [
        { "key": "title", "type": "text", "required": true, "max": 50 },
        { "key": "text",  "type": "textarea", "max": 200 },
        { "key": "icon",  "type": "icon" },
        { "key": "link",  "type": "link" }
    ]}
  ],
  "example": { "title": "Unsere Leistungen", "cards": [ ... ] }
}
```
Dazu `template.php` (Ausgabe), optional `variants/<name>.php`, `style.css` (nur Tokens verwenden, keine festen Farben), `script.js` (nur falls nötig, ohne Abhängigkeiten).

### 7.2 Feldtypen (Mindestumfang)
`text`, `textarea`, `markup` (begrenzt: kursiv/fett/Akzent), `richtext-lite` (Absätze, Listen, Links; serverseitig bereinigt), `number`, `select`, `toggle`, `color-token` (nur Tokens), `icon` (feste Bibliothek), `image` (mit Fokuspunkt, Alt-Text-Pflicht, Bildnachweis), `gallery`, `file` (PDF), `video-url` (Klick-zum-Laden, kein sofortiges Einbetten), `link` (intern per Auswahl einer Seite, extern mit `rel`-Regeln), `relation` (Seite/Beitrag/Portfolio wählen), `repeater` (Wiederholgruppe), `date`, `address`, `opening-hours`.
Jeder Feldtyp: Validierung, Bereinigung, Darstellung im Formular, Beitrag zur Übersetzungstabelle, Beitrag zum SEO-Audit.

### 7.3 Varianten (aus dem Antonia-Stilsystem)
- Variante ist **eine Eigenschaft des Abschnitts**, nicht global (anders als bei Antonia, wo Stile je Bereich global waren). Zusätzlich optional „Standardvariante je Baustein“ im Theme.
- Unbekannte Variante fällt auf Standard zurück (Test).
- Nur das CSS der verwendeten Varianten wird geladen.
- **Vorschaubilder entstehen automatisch** (Skript rendert Beispielinhalt in Standardfarben/-schrift, schneidet auf festes Seitenverhältnis, füllt Hintergrund auf) und werden im Backend als Auswahlkarten gezeigt. Dieses Skript hat sich im Antonia-Projekt als sehr nützlich erwiesen.

### 7.4 Dynamische Bausteine
Beitragsliste (Typ, Kategorie, Anzahl, Sortierung, Variante: Karten/Zeilen/Magazin), Portfolio-Raster mit Kategorie-Filter, „Verwandte Inhalte“, Kategorie-Übersicht, Suche, Kontaktformular, Standortliste. Dynamisch heißt: Daten kommen aus Inhaltstypen; der Baustein speichert nur die Abfrage-Einstellungen. Paginierung mit echten Links (`?seite=2` oder `/seite/2`) und `rel="next/prev"`-unabhängiger Canonical-Logik.

### 7.5 Globale und wiederverwendbare Bausteine
Kopfzeile, Fußzeile, CTA-Band, Kontaktblock: einmal pflegen, überall nutzen („Referenz auf globalen Abschnitt“). Änderung wirkt überall; Seite zeigt im Backend „global“.

### 7.6 Qualitätsregeln für jeden Baustein
1. Genau **eine** Überschriftenebene-Logik (kein eigenes `h1`; `h1` nur im Seitenkopf). Hierarchie wird geprüft.
2. Bilder immer über den Bild-Helfer (srcset, Breite/Höhe gesetzt, `loading`, `fetchpriority` für das Hero-Bild).
3. Nur Tokens (Farbe/Schrift/Abstand), keine festen Hex-Werte außer in definierten Ausnahmen.
4. Fokus-Sichtbarkeit, Tastaturbedienung, Touch-Ziele, `prefers-reduced-motion`.
5. Leere Zustände: Felder leer → Element entfällt, keine leeren Rahmen.
6. Längenbegrenzungen im Schema, Umbruchverhalten getestet (lange Wörter, 2 Zeilen/10 Zeilen).
7. Handy zuerst, dann Desktop, Hell/Dunkel (falls Theme beides hat).
8. Beispielinhalt + Vorschaubild + Test + Dokumentationstext (Zweck, wann nutzen, SEO-Auswirkung).

---

## 8. SEO- und GEO-Funktionen (USP)

### 8.1 Technisches SEO (alles automatisch, pro Seite überschreibbar)
- **Title/Meta-Description** mit Vorlagen (`%Seitentitel% – %Seitenname%`), Längenanzeige, Vorschau (Google-Snippet-Ansicht).
- **Canonical** (selbstreferenzierend, bei Filterseiten auf Hauptseite), `noindex`-Schalter, `robots`-Meta, Paginierung.
- **Sitemap.xml** (Index + je Inhaltstyp, `lastmod` aus echtem Änderungsdatum, Bilder, hreflang-Alternativen), `robots.txt` aus Einstellungen (inkl. Sitemap-Zeile).
- **hreflang** inkl. `x-default`, automatisch aus der Übersetzungs-Zuordnung.
- **Redirect-Manager:** 301/302/410, automatischer Vorschlag bei geändertem Slug (alte URL → neue URL), **404-Monitor mit echter aufgerufener Adresse** (Lehre!), Import/Export als CSV, Ketten- und Schleifenprüfung.
- **Strukturierte Daten (JSON-LD)** automatisch: `Organization`/`LocalBusiness` (mit NAP, Öffnungszeiten, `sameAs`), `WebSite`, `WebPage`, `BreadcrumbList`, `Article`/`BlogPosting` (Autor, `datePublished`, `dateModified`), `Person`, `Service`, `Product` (ohne Bewertungs-Spam), `FAQPage` (nur wenn sichtbar auf der Seite), `ProfilePage`. Validierungsfunktion im Backend. Keine erfundenen Bewertungen/Sterne.
- **Open Graph/Twitter-Card** inklusive automatisch erzeugtem OG-Bild (Fallback-Vorlage mit Titel).
- **Core Web Vitals:** eigene Schriften (`font-display`, Preload, Subsetting), Bilder als WebP (optional AVIF) mit mehreren Breiten, Lazy-Loading unterhalb des sichtbaren Bereichs, Platzhalter-Größen gegen Layout-Verschiebung, kritisches CSS inline (klein), kein Render-blockierendes JS, `Cache-Control`/Komprimierung, ein **Performance-Budget** (Seitengewicht, Anzahl Anfragen) mit Warnung im Audit.
- **Interne Verlinkung:** Linkvorschläge beim Bearbeiten (Seiten mit ähnlichem Thema), Broken-Link-Prüfer (intern sofort, extern per Hintergrundlauf), Brotkrumen.
- **Saubere URLs:** Slug-Regeln, Umlaute, keine doppelten Pfade, Trailing-Slash-Entscheidung einmal festlegen und per Redirect durchsetzen (www/ohne www, http→https wie im Antonia-`.htaccess`).
- **Barrierefreiheit** als SEO-Nachbar: Landmarks, Alt-Texte (Pflichtfeld mit Ausnahme „dekorativ“), Kontraste (Palettenprüfung), Tastatur. Prüfen, ob für den jeweiligen Kunden gesetzliche Pflichten gelten (z. B. Barrierefreiheitsstärkungsgesetz), und das im Vertrieb nicht pauschal versprechen.

### 8.2 Redaktionelles SEO (im Editor)
**SEO-Audit je Seite** als Ampel mit klaren Handlungshinweisen:
- genau ein `h1`, Reihenfolge der Überschriften, Titel-/Description-Länge, Alt-Texte vorhanden, Bildgrößen, Linktexte nicht „hier klicken“, interne/externe Links, Lesbarkeit (Satzlänge), Dopplungs-Warnung (gleicher Titel/Description), Wortanzahl-Hinweis (kein starres Ziel), `noindex` aktiv?
- Optional **Fokusbegriff und Suchintention** als Notizfelder (kein „Keyword-Dichte“-Zwang; das führt zu schlechten Texten).
- **Inhaltsplan/Brief-Feld** pro Seite (Zielgruppe, Hauptfrage, Belege) für die Agentur-Zusammenarbeit.

### 8.3 GEO (Generative Engine Optimization)
Ziel: Inhalte so aufbauen, dass KI-Systeme sie **verstehen, korrekt zuordnen und zitieren** können.
- **Antwort-Bausteine:** FAQ (mit passendem Schema), „Kurzantwort“-Block (direkte Antwort in 1–3 Sätzen oben), Definition/Glossar, Vergleichstabelle, Schritt-für-Schritt, Fakten-Kasten (Zahlen, Quelle, Datum). Klare Überschriften als Fragen sind erlaubt.
- **Autoren- und Quellenangaben:** Autorenprofil (Name, Qualifikation, Foto, `sameAs`), „Zuletzt aktualisiert“ sichtbar (und `dateModified`), Quellen-/Referenzlisten als Baustein. Entspricht den E-E-A-T-Signalen.
- **Entitäten-Konsistenz:** Einheitliche Namen/Adressen/Profile (`sameAs`), Organisation als eigene Entität, gleiche Beschreibung in Schema, Über-uns-Seite und Profilen.
- **`llms.txt` und `llms-full.txt`** generiert aus Seitenstruktur (Titel, Kurzbeschreibung, Links). Als „günstig, Wirkung unsicher“ behandeln.
- **KI-Crawler-Steuerung:** Einstellungen für `robots.txt` je Crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot u. a.) mit klaren Voreinstellungen und Erklärung der Folgen (Training vs. Suche vs. Live-Abruf).
- **Messbarkeit:** Auswertung der **KI-Crawler-Abrufe** in der Statistik (im Antonia-Projekt vorhanden), Referrer von KI-Diensten (Perplexity, ChatGPT, Copilot, Gemini) als eigene Herkunftskategorie, Export für Berichte.
- **Frische und Struktur:** sauberes semantisches HTML, kurze Absätze, Listen, Tabellen, keine Inhalte hinter Skript-Klicks, schnelle Antwortzeit.
- **IndexNow** (Bing, Yandex u. a.) bei Veröffentlichung pingen; für Google gilt weiter Sitemap + Search Console (Hinweis: Google nutzt IndexNow nicht).
- **Hinweis für die Beratung:** Zitierhäufigkeit in KI-Antworten lässt sich nur eingeschränkt messen. Vorschlag: monatliches **Prompt-Monitoring** (feste Liste von Fragen, Ergebnisse dokumentieren) als Agenturleistung, nicht als CMS-Funktion in Version 1.

### 8.4 Lokales SEO (optional je Kunde)
Standortbaustein mit NAP, Öffnungszeiten, Anfahrt, Karte **ohne** automatisches Laden von Google Maps (Klick-zum-Laden oder statisches Bild), `LocalBusiness`-Schema, Landingpage-Vorlagen je Stadt/Leistung mit Warnung vor dünnen Duplikaten.

---

## 9. Datenschutz und Recht

- **Ziel „ohne Cookie-Banner“:** keine Cookies außer technisch notwendigen Sitzungscookies im Backend; eigene Schriften; keine Tracker, keine Fremd-Embeds beim Laden; Videos/Karten nur nach Klick (mit Hinweis).
- **Statistik** wie im Antonia-Projekt: keine IP-Speicherung, nicht umkehrbarer Stunden-Kurzwert, keine Profile, DNT beachten, anonyme Ereigniszähler, Interaktionssignal für „echte Besuche“. **Datenschutztext wird zusammen mit der Funktion gepflegt** (Lehre: Text und Funktion müssen sich gemeinsam ändern; Migration für Bestandskunden).
- **Impressum/Datenschutz:** pro Kunde Vorlage + Platzhalter + Prüfhinweis. Rechtstexte sind Sache des Kunden/Anwalts; das CMS liefert Struktur und Hilfen, keine Rechtsberatung.
- **Auftragsverarbeitung** (Agentur ↔ Kunde, Hoster), Löschkonzept, Datenexport, Backups mit Aufbewahrungsfrist.
- **Kontaktformular:** keine Speicherung im Klartext in der DB nötig (Versand per E-Mail, Protokoll ohne Inhalt), Spam-Schutz ohne Drittanbieter (Honeypot, Zeitprüfung, Limit), Einwilligungstext konfigurierbar.
- **Optionale Dienste** (Analytics, Newsletter, Karten) nur über ein **Einwilligungs-Modul** (Klick-zum-Laden), standardmäßig aus.

---

## 10. Sicherheit

Übernehmen aus dem Antonia-Projekt: Login per E-Mail-Code (optional zusätzlich Passwort), Rate-Limit/Sperre, CSRF für alle POST-Aktionen, strenge **CSP** und Security-Header, HTTPS-Erzwingung, Sitzungs-Token gehasht, Upload-Prüfung (Typ, Größe, Bildinhalt, keine ausführbaren Dateien), `data/` gesperrt, Audit-Log, wöchentliche Sicherung (und vor Importen/Updates), Rechte serverseitig, keine Geheimnisse im Repository.
Neu bei Mehrkunden-Betrieb:
- **Update-Kanal:** signierte/prüfsummengesicherte ZIPs, Sicherung vor Update, automatische Migration, Rollback-Pfad.
- **Kunden-Konfiguration** getrennt vom Kern; Kern darf nie Kunden-Theme überschreiben.
- **Passwort-/Code-Richtlinien**, Sitzungsdauer, Abmelden überall.
- **Sicherheitsprüfung** (Abschnitt 12) vor jedem Release; Abhängigkeiten minimal halten.

---

## 11. Template-Prozess pro Kunde (Agentur-Workflow)

1. **Briefing:** Marke, Zielgruppe, Wettbewerber, Inhalte, gewünschte Seitenarten, SEO-/GEO-Ziele, Sprachen.
2. **Design-Tokens:** Palette(n) mit Lesbarkeitsprüfung, Schriften (selbst gehostet, Lizenz prüfen), Größenvoreinstellungen, Radius/Abstände.
3. **Bausteinauswahl:** aus dem Kern-Katalog + Liste kundenspezifischer Bausteine.
4. **Mockups als HTML-Artefakte:** je Baustein 3–4 Varianten (Desktop + Handy, echte Beispieltexte), Rückmeldung des Kunden, Entscheidung festhalten (Dokument `ENTSCHEIDUNGEN`). Das hat im Antonia-Projekt gut funktioniert.
5. **Umsetzung:** Baustein bauen, Beispielinhalt, **Vorschaubilder automatisch erzeugen**, Tests (Abschnitt 12), Dokumentation.
6. **Seitenaufbau:** Agentur legt Startseite und Vorlagen-Seiten an, Kunde befüllt.
7. **Abnahme:** Checkliste (Performance, SEO-Audit grün, Barrierefreiheit, Datenschutz, Handy, Browser).
8. **Livegang:** Statistik zurücksetzen (mit Sicherung), Redirects aus Altseite, Sitemap bei Google/Bing einreichen, Verifizierung.
9. **Pflege:** Updates, Monitoring, monatlicher Bericht.

Alte Webseite des Kunden: **Redirect-Plan** (alle alten URLs erfassen, 1:1 oder thematisch zuordnen), Importer (CSV/WordPress-Export) als Werkzeug der Agentur.

---

## 12. Qualitätssicherung

### 12.1 Tests (Pflicht, im Repository)
- **Selftest gegen echte Datenbank** (HTTP-Anfragen gegen einen lokalen Server, wie `tools/selftest.php` im Antonia-Projekt): Auth, Rechte, jede Route, jeder Baustein rendert, Varianten-Fallback, Validierung, Cache, Redirects, Sitemap/robots/llms, Statistik, Backup/Import, Migrationen.
- **Migrationstest:** „frische Installation“ und „von Version N migriert“ ergeben dieselben Daten/Texte (Lehre!).
- **Browserprüfungen** (Playwright): Screenshots (nur wo nötig), Kontrast aller Bausteine × Varianten × Paletten, **axe-Prüfung**, Handy- und Desktopbreite, Tastaturpfad.
- **Vorschaubilder-Skript** gehört zum Release (veraltete Bilder = Fehler).
- **Performance-Check** (Lighthouse/eigenes Skript) für Beispielseiten, Budgets.
- **SEO-Validierung:** JSON-LD gegen Schema-Regeln, Sitemap-Format, hreflang-Gegenseitigkeit, Canonical, Redirect-Ketten.

### 12.2 Entwicklungsregeln
- Neue Funktion = **Dienst + Route + Test + Bildschirm + Doku-Eintrag + Hilfetext** (ein Paket).
- Texte deutsch, zugleich Übersetzungsschlüssel (im Antonia-Projekt bewährt; Prüfung auf fehlende Übersetzungen im CI).
- Kleine, thematische Commits; Release-ZIP mit Versionsnummer; Änderungsprotokoll.

### 12.3 Checkliste „Baustein fertig“
Felder mit Grenzen · Varianten · Beispielinhalt · Vorschaubild · leere Zustände · Handy/Desktop · Hell/Dunkel (falls Theme) · alle Paletten lesbar · Tastatur/Fokus · Überschriftenebene · Bild-Helfer · Schema/SEO-Hinweise · Übersetzungsfelder · Test · Hilfetext.

---

## 13. Übernahme aus dem Antonia-Projekt

| Modul im Antonia-Code | Übernahme | Anpassung |
|---|---|---|
| `lib/auth.php` (E-Mail-Code, Passwort, Sitzungen, Sperre) | **Direkt** | Rollen erweitern (Agentur/Kunde) |
| `lib/schema.php` + `admin/forms.php` (schema-getriebene Formulare, Feldtypen) | **Kern** | Feldtypen `repeater`, `relation`, `link`, `icon` ergänzen; Schema pro Baustein statt global |
| `lib/content.php` (Speichern, Entwurf/Live, Frühere Fassungen) | **Kern** | Von Gruppen/Listen auf Seiten + Abschnitte verallgemeinern |
| `lib/layout.php` („Aufbau der Seite“: Ziehen/Pfeile/Sichtbar) | **Vorlage für Abschnittsliste** | Verschachtelung entfernen, pro Seite |
| `lib/styles.php`, `assets/stile`, `tools/stil-vorschau.js` | **Konzept + Skript** | Variante statt globaler Stil; Vorschau pro Baustein |
| `lib/colors.php` (Paletten, Tokens, Lesbarkeitsprüfung) | **Direkt** | Palette je Kunde, Token-Export |
| `lib/render.php`, Bild-Helfer (`imgvar`), `media.php` | **Kern** | AVIF optional, Fokuspunkt |
| `lib/seo_files.php` (sitemap, robots, llms) | **Kern** | Mehrere Inhaltstypen, Bilder, hreflang |
| `lib/stats.php`, `admin/stats_views.php` (cookielos, echte Besuche, Crawler, 404, Reset) | **Direkt als Modul** | Seitenpfade statt fester Seiten, KI-Referrer-Kategorie |
| `lib/translate_io.php`, `admin/translate.php` | **Direkt** | Mehr Sprachen (Sprachspalte), Glossar |
| `lib/backup.php`, Papierkorb, Audit | **Direkt** | Updater koppeln |
| `lib/migrations.php` | **Muster** | Nummerierte Dateien statt eine Funktion; Guards, Tests |
| `tools/selftest.php`, Browser-Skripte | **Muster + Teile** | In Testmodule aufteilen |
| Seitenspezifische Bereiche (Hero, Schnittplatz, Pinnwand, Off the record …) | **Als Beispiel-Theme „Antonia“** | Als Bausteine umsetzen; zeigt, dass das System ein echtes Design tragen kann |

Empfehlung: Das Antonia-Projekt **nicht** umbauen, sondern als Referenz-Theme später im neuen System nachbauen („Eigener Test“: Wenn der Onepager als Seite mit Bausteinen funktioniert, trägt das Konzept).

---

## 14. Arbeitsweise mit Claude (im neuen Projekt)

- **`CLAUDE.md`** im Repository: Aufbau, Befehle (`check`, `test`, `reset`), Regeln (Sprache, Sicherheit, Tokens, Texte), Branch-Regel, Verweis auf `docs/`.
- **`docs/PLAN.md`** (dieses Dokument), **`docs/ENTSCHEIDUNGEN.md`** (verbindliche Festlegungen mit Datum), **`docs/FUNKTIONEN.md`** (Stand je Funktion), **`docs/BAUSTEINE.md`** (Katalog), **`docs/PAKETE.md`** (Arbeitspakete mit Status).
- **Pro Funktionspaket eine frische Sitzung;** der Stand steckt in Dokumenten, nicht im Chatverlauf. Wünsche bündeln, bei Kleinigkeiten ohne Rückfrage entscheiden und die Entscheidung benennen.
- **Prüfen sparsam:** Tests und Textprüfungen zuerst; Screenshots nur bei neuer oder geänderter Oberfläche, wenige und zu einer Übersicht zusammengefasst.
- **Mockups vor Umsetzung** bei allem Visuellen (3–4 Varianten, Desktop + Handy, echte Texte).
- **Stärkstes Modell** für Sicherheitsprüfung und große Umbauten, sonst das mittlere.
- **Autonome Pakete** nacheinander sind möglich, wenn Verträge, Tests und Abnahmekriterien vorab stehen.
- **Review-Fragen, die sich bewährt haben:** „Wie sieht es leer aus? Mit sehr langem Text? Auf dem Handy? In der zweiten Sprache? Mit allen Paletten? Mit Tastatur? Was passiert bei einer frischen Installation?“

---

## 15. Phasenplan

Größen: S ≈ 1 Sitzung, M ≈ 2–3, L ≈ 4–6 (grobe Schätzung für Claude-Sitzungen mit Test und Doku).

| Phase | Inhalt | Ergebnis / Abnahme | Größe |
|---|---|---|---|
| **0 · Klärung** | Entscheidungen E1–E9 bestätigen, Zielhoster testen (PHP-Version, `.htaccess`, `ErrorDocument`, Dateirechte), Repository + `CLAUDE.md` + Docs-Gerüst, Namensgebung, Lizenz-/Schriftenfragen | Entscheidungsdokument, Hoster-Testprotokoll | S |
| **1 · Kern** | Projektgerüst, DB-Schicht + Migrationen, Auth/Rollen/Sitzungen, Audit, Medien (Upload, Bildvarianten), Einstellungen, Backup, Selftest-Gerüst | Anmeldung, Mediathek, Einstellungen, Tests grün auf SQLite und MariaDB | L |
| **2 · Seiten und Bausteine** | Inhaltstypen, Seiten (hierarchisch), Abschnitte, Block-Registry + Manifest, Feldtypen, Formulargenerator, „Seite anlegen“-Ablauf, Entwurf/Veröffentlichen, Revisionen, Papierkorb, Live-Vorschau, Frontend-Renderer + Cache | Seite mit 8 Basisbausteinen erstellen und veröffentlichen | L |
| **3 · Basis-Bausteine** | 12–15 Standardbausteine (Hero, Text, Text+Bild, Bildergalerie, Leistungskarten, Zahlen, Zitat, FAQ, CTA, Team, Referenzen, Kontaktformular, Logoleiste, Beitragsliste, Portfolio-Raster), je 2–3 Varianten, Vorschauskript | Katalog mit Vorschaubildern, Qualitätscheckliste erfüllt | L |
| **4 · SEO-Kern** | Head-Erzeugung, Sitemap, robots, hreflang-Grundlage, Redirect-Manager + 404-Monitor, JSON-LD je Seitentyp, SEO-Panel + Audit-Ampel, OG-Bilder, Performance-Helfer | SEO-Audit grün auf Beispielseiten, Validierungstests | L |
| **5 · Inhaltstypen und Archive** | Beiträge, Portfolio, Kategorien/Schlagwörter, Archivseiten, Paginierung, Verwandte Inhalte, interne Suche, Menüs/Navigation, Breadcrumbs | Blog + Portfolio funktionsfähig | M–L |
| **6 · GEO-Paket** | FAQ-/Kurzantwort-/Fakten-/Quellen-Bausteine, Autorenprofile, `llms.txt`, KI-Crawler-Steuerung, KI-Referrer, IndexNow, „Zuletzt aktualisiert“ | GEO-Checkliste, Tests | M |
| **7 · Statistik** | Statistikmodul (echte Besuche, Crawler, 404, Berichte, Zurücksetzen), Datenschutztext-Kopplung | Auswertung im Backend, Datenschutztests | M |
| **8 · Mehrsprachigkeit** | Spiegel-Seiten, Zuordnung, hreflang, Übersetzungstabelle, Export/Import (mehrere Sprachen), Sprachumschalter | zweite Sprache vollständig durchspielbar | M |
| **9 · Theme-System** | `theme.json`, Tokens + Paletten, Kundenbausteine, Theme-Installer/Generator, Beispielinhalte, Kontrast-/axe-Tests im CI | Neuer Kunde in einem Tag aufsetzbar | M–L |
| **10 · Updater und Betrieb** | Update-ZIP, Prüfsumme, Sicherung, Migration, Rollback, Systemprüfung (PHP, Rechte, HTTPS), Wartungsmodus, Onboarding-Anleitung | Update von Version N auf N+1 mit Test | M |
| **11 · Pilot** | Antonia-Theme als Referenz **oder** erster echter Kunde; Abnahme, Messung, Lehren einarbeiten | Livegang, Lessons-Learned-Dokument | M–L |
| **12 · Agentur-Werkzeuge** | Importer (WordPress/CSV), Redirect-Planer, Berichtsvorlagen, Prompt-Monitoring-Vorlage, Preis-/Betriebsmodell | Standardprozess dokumentiert | M |

Empfohlene Reihenfolge der ersten Auslieferung (MVP): Phasen 0 → 1 → 2 → 3 (reduziert auf 8 Bausteine) → 4. Danach 5 und 6, weil sie den Verkaufswert tragen.

---

## 16. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Zu großer Funktionsumfang („WordPress nachbauen“) | Nicht-Ziele einhalten; neue Wünsche gegen den Zielkunden („Mittelständler mit 5–30 Seiten“) prüfen |
| Hoster-Unterschiede brechen Funktionen | Hoster-Testliste, Fallbacks (z. B. 404-Variablen), Systemprüfung im Backend |
| Updates zerstören Kundenanpassungen | Strikte Trennung Kern/Theme/Daten, Migrationstests, Sicherung vor Update |
| SEO-/GEO-Versprechen werden nicht gehalten | Ehrliche Kommunikation, Messbarkeit, Berichte (Abschnitt 8) |
| Rechtliche Risiken (Datenschutz, Barrierefreiheit, Urheberrecht von Schriften/Bildern) | Vorlagen + Prüfhinweise, Schriftenlizenz im Theme dokumentieren, AV-Vertrag |
| Ein einziger Entwickler/Agentur = Single Point of Failure | Dokumentation als Gedächtnis, Tests, einfache Architektur |
| Qualität bei vielen Bausteinen sinkt | Verbindliche Checkliste, automatischer Kontrast-/axe-Lauf, Vorschaubild-Pflicht |
| Performance bei vielen Seiten (JSON-Abschnitte, Listen) | Seitencache, Indizes, Paginierung, Messung im Selftest (Budget) |
| Missbrauch der Upload-/Formularfunktionen | Prüfungen wie im Antonia-Projekt, Rate-Limit, strenge CSP |

---

## 17. Startvorlage für das neue Claude-Projekt

### 17.1 Erste Nachricht (Vorschlag)
> Wir bauen ein CMS für Kundenwebseiten einer SEO/GEO-Agentur. Grundlage ist `docs/PLAN.md` (liegt bei). Lies zuerst den Plan, dann lege folgendes an: (1) Repository-Gerüst nach Abschnitt 5.1, (2) `CLAUDE.md` nach Abschnitt 14 (Sprache der Oberfläche: Deutsch), (3) `docs/ENTSCHEIDUNGEN.md` mit den Empfehlungen E1–E9 als „vorgeschlagen“, (4) `docs/PAKETE.md` mit den Phasen 0–4 als Pakete inklusive Abnahmekriterien. Danach zeigst du mir die Entscheidungen E1–E9 zur Bestätigung. Setze noch nichts um, was nicht bestätigt ist.

### 17.2 `CLAUDE.md`-Entwurf (Kurzfassung)
```
# Agentur-CMS – Arbeitsanleitung
Sprache: Oberfläche und Doku Deutsch. Texte sind zugleich Übersetzungsschlüssel.
Aufbau: core/ (Kern), themes/<kunde>/ (Kundenpaket), admin/, data/ (gesperrt), uploads/.
Befehle: check (Lint + Tests), test, reset (frische Demodaten), previews (Vorschaubilder der Bausteine), build (Release-ZIP).
Regeln:
- Rechte nur serverseitig. Geheimnisse nie ins Repository.
- Jede Funktion = Dienst + Route + Test + Bildschirm + Doku + Hilfetext.
- Migration + Seed gemeinsam; Migration mit Neuinstallations-Guard; Test „frisch = migriert“.
- Farben/Schriften nur aus Tokens. Bausteine nach Checkliste (docs/BAUSTEINE.md).
- Namen und Texte, die ein Kunde pflegt, kommen aus dem Backend und werden nie vom Code überschrieben.
- Pro Paket eine Sitzung. Screenshots nur wenn nötig. Mockups vor visueller Umsetzung.
```

### 17.3 Material aus dem Antonia-Projekt zum Mitgeben
Dieses Dokument · Auszüge: `lib/schema.php` (Feldtypen), `lib/styles.php` + `tools/stil-vorschau.js` (Varianten + Vorschaubilder), `lib/colors.php` (Paletten/Lesbarkeit), `lib/stats.php` (cookielose Statistik), `lib/translate_io.php` (Export/Import), `tools/selftest.php` (Teststil), `.htaccess` (Hoster-Erfahrungen) und die Dokumente `docs/antoniarueller-design-pakete.md` und `docs/antoniarueller-seite-und-design-anleitung.pdf` als Beispiel für Paketzuschnitt und Anleitungsstil.

---

## 18. Offene Fragen an dich (vor Phase 0)

1. **Zielkunden:** Größe, Branchen, typische Seitenzahl, wer pflegt Inhalte (Kunde selbst oder Agentur)?
2. **Betriebsmodell:** Hosting übernimmt die Agentur oder der Kunde? Wer zahlt/wartet Updates? Preismodell (Einrichtung + monatlich)?
3. **Wettbewerb:** Soll das CMS an Kunden **verkauft/lizenziert** werden oder bleibt es Agentur-Werkzeug (entscheidet über Lizenz, Dokumentation, Support)?
4. **Sprachen:** Wie oft braucht ein Kunde mehr als eine Sprache?
5. **Formulare/Shop:** Gibt es Kundenwünsche, die Version 1 sprengen (Terminbuchung, Shop, Mitgliederbereich)? Dann Schnittstellenkonzept statt Eigenbau.
6. **Markenname und Domain** für das Produkt.
7. **Pilotkunde:** Antonia-Theme als Referenz nachbauen oder direkt erster echter Kunde?
