<?php
declare(strict_types=1);

require_once __DIR__ . '/legal_defaults.php';

/**
 * Datenmodell: jede Eingabemaske im Admin entsteht aus diesen Definitionen.
 *  - collections = Listen (hinzufügen, sortieren, Papierkorb)
 *  - groups      = einzelne Bereiche (Singletons)
 *
 * Feldtypen: text, textarea, markup (Text mit *kursiv* / **GROSS** / ==Akzent==), date, month,
 *            select, bool, number, range, color, url, image, pdf
 */

const MARKUP_HINT = 'Hervorhebungen: *kursiv*, **GROSSSCHRIFT**, ==Akzentfarbe==';

function media_options(): array
{
    return ['video' => 'Video / TV', 'text' => 'Text / Online', 'radio' => 'Radio', 'podcast' => 'Podcast', 'social' => 'YouTube / Social'];
}

function anchor_options(): array
{
    return ['arbeiten' => 'Arbeiten', 'podcast' => 'Podcast', 'lebenslauf' => 'Lebenslauf', 'ueber' => 'Über mich', 'offtherecord' => 'Off the record', 'kontakt' => 'Kontakt'];
}

function f(string $type, string $key, string $label, array $o = []): array
{
    return ['type' => $type, 'key' => $key, 'label' => $label] + $o;
}

function schema(): array
{
    static $s = null;
    if ($s !== null) {
        return $s;
    }
    $s = ['collections' => [], 'groups' => []];

    // ---------- Listen ----------
    $s['collections']['clips'] = [
        'label' => 'Referenzen (Showreel)', 'singular' => 'Referenz', 'title' => 'title', 'sub' => ['outlet', 'date_label'],
        'help' => 'Alle Arbeitsproben. Die Reihenfolge hier bestimmt die Nummerierung („01, 02 …“). Entfernte Referenzen landen zuerst im Papierkorb.',
        'fields' => [
            f('section', '', 'Inhalt'),
            f('text', 'title', 'Titel', ['required' => true, 'max' => 200]),
            f('text', 'short', 'Kurzname (für die Zeitleiste)', ['max' => 40, 'hint' => 'Erscheint im Balken der Zeitleiste, z. B. „Istanbul“.']),
            f('text', 'outlet', 'Redaktion / Sender', ['max' => 120]),
            f('select', 'medium', 'Kategorie', ['options' => media_options(), 'default' => 'text']),
            f('text', 'format', 'Format', ['max' => 120, 'hint' => 'z. B. „Online · Politik“ oder „Video · Selbstversuch“.']),
            f('date', 'date', 'Datum (Veröffentlichung)', ['hint' => 'Bestimmt die Position in der Zeitleiste und die Anzeige „MM/JJJJ“.']),
            f('text', 'date_label', 'Datumsanzeige überschreiben (optional)', ['max' => 40, 'hint' => 'Nur nötig für Zeiträume wie „2024–2025“ oder wenn kein genaues Datum bekannt ist.']),
            f('text', 'role', 'Rolle', ['max' => 80]),
            f('textarea', 'desc', 'Beschreibung', ['max' => 600]),
            f('url', 'url', 'Link zum Beitrag'),
            f('text', 'link_text', 'Linktext', ['max' => 60, 'default' => 'Zum Beitrag']),
            f('bool', 'new_tab', 'Link in neuem Tab öffnen', ['default' => true]),
            f('bool', 'published', 'Auf der Seite anzeigen', ['default' => true, 'hint' => 'Ausschalten = Entwurf (nicht sichtbar, aber nicht gelöscht).']),
            f('section', '', 'Hauptclip („Featured“)'),
            f('bool', 'featured', 'Als Hauptclip oben zeigen', ['hint' => 'Es wird der erste Hauptclip der Liste gezeigt.']),
            f('markup', 'headline', 'Große Überschrift (optional)', ['max' => 200, 'hint' => 'Standard ist der Titel. ' . MARKUP_HINT]),
            f('image', 'still', 'Standbild (optional)'),
            f('section', '', 'Zeitleiste'),
            f('select', 'tl_track', 'Spur in der Zeitleiste', ['options_from' => 'tracks', 'empty' => 'Nicht in der Zeitleiste zeigen', 'hint' => 'Spuren (Video, Online, Radio …) legst du unter „Zeitleiste → Spuren“ an.']),
            f('date', 'tl_end', 'Enddatum (optional)', ['hint' => 'Für längere Produktionen. Leer = kurzer Balken am Datum.']),
            f('number', 'tl_pos', 'Position manuell (0–100 %, optional)', ['min' => 0, 'max' => 100, 'step' => 0.1, 'hint' => 'Überschreibt die automatische Position aus dem Datum.']),
            f('number', 'tl_w', 'Balkenbreite manuell (% , optional)', ['min' => 0.5, 'max' => 100, 'step' => 0.1]),
            f('text', 'tc', 'Timecode (optional)', ['max' => 11, 'hint' => 'Leer = wird automatisch vergeben, Format 00:01:47:10.']),
        ],
    ];
    $s['collections']['tracks'] = [
        'label' => 'Zeitleiste: Spuren', 'singular' => 'Spur', 'title' => 'label', 'sub' => ['code'],
        'help' => 'Die Zeilen der Zeitleiste im Showreel. Farben und Symbol sind frei wählbar.',
        'fields' => [
            f('text', 'code', 'Kürzel', ['required' => true, 'max' => 6, 'hint' => 'z. B. V1, T1, A1 (wird in der Spurliste links gezeigt).']),
            f('text', 'label', 'Bezeichnung', ['required' => true, 'max' => 40]),
            f('select', 'icon', 'Symbol', ['options' => media_options(), 'default' => 'text']),
            f('color', 'bg', 'Balkenfarbe', ['default' => '#0B3F44']),
            f('color', 'fg', 'Schriftfarbe im Balken', ['default' => '#F3ECDF']),
        ],
    ];
    $s['collections']['episodes'] = [
        'label' => 'Podcast-Folgen', 'singular' => 'Folge', 'title' => 'title', 'sub' => ['show', 'number'],
        'help' => 'Folgen werden nicht abgespielt, sondern verlinken auf Spotify, Apple, ARD Audiothek usw.',
        'fields' => [
            f('text', 'show', 'Podcast-Name', ['required' => true, 'max' => 120]),
            f('text', 'number', 'Folge', ['max' => 20, 'hint' => 'z. B. „12“ – leer lassen, wenn es keine Nummer gibt.']),
            f('text', 'title', 'Titel der Folge', ['required' => true, 'max' => 200]),
            f('text', 'duration', 'Dauer', ['max' => 20, 'hint' => 'z. B. 32 Min.']),
            f('text', 'outlet', 'Sender / Plattform', ['max' => 120]),
            f('date', 'date', 'Veröffentlicht am'),
            f('url', 'spotify', 'Link Spotify'),
            f('url', 'apple', 'Link Apple Podcasts'),
            f('url', 'audiothek', 'Link ARD Audiothek'),
            f('text', 'other_label', 'Weitere Plattform (Name)', ['max' => 30]),
            f('url', 'other_url', 'Weitere Plattform (Link)'),
            f('bool', 'published', 'Auf der Seite anzeigen', ['default' => true]),
        ],
    ];
    $s['collections']['stations'] = [
        'label' => 'Stationen (Sender & Redaktionen)', 'singular' => 'Station', 'title' => 'name', 'sub' => [],
        'fields' => [
            f('text', 'name', 'Name', ['required' => true, 'max' => 60]),
            f('bool', 'highlight', 'Farbig hervorheben (aktuelle Station)'),
        ],
    ];
    $s['collections']['cv'] = [
        'label' => 'Lebenslauf: Stationen', 'singular' => 'Station', 'title' => 'org', 'sub' => ['role', 'when_label'],
        'help' => 'Die Einträge werden automatisch nach Jahr des Beginns gruppiert (neueste zuerst).',
        'fields' => [
            f('text', 'role', 'Rolle', ['max' => 80, 'hint' => 'z. B. „Autorin“ – das Komma setzt die Seite selbst.']),
            f('text', 'org', 'Organisation', ['required' => true, 'max' => 120]),
            f('month', 'from', 'Beginn', ['required' => true]),
            f('month', 'to', 'Ende'),
            f('bool', 'ongoing', 'Läuft noch („seit …“)'),
            f('text', 'when_label', 'Zeitangabe überschreiben (optional)', ['max' => 120, 'hint' => 'Leer = automatisch aus Beginn/Ende, z. B. „06/2016 — 06/2018“.']),
        ],
    ];
    $s['collections']['before'] = [
        'label' => 'Lebenslauf: „Davor“', 'singular' => 'Eintrag', 'title' => 'text', 'sub' => ['side'],
        'fields' => [
            f('markup', 'text', 'Text', ['required' => true, 'max' => 160, 'hint' => MARKUP_HINT]),
            f('text', 'side', 'Zusatz rechts', ['max' => 160]),
        ],
    ];
    $s['collections']['crossmedia'] = [
        'label' => 'Über mich: Crossmedial', 'singular' => 'Kachel', 'title' => 'label', 'sub' => ['outlets'],
        'fields' => [
            f('select', 'icon', 'Symbol', ['options' => media_options(), 'default' => 'text']),
            f('text', 'label', 'Bezeichnung', ['required' => true, 'max' => 30]),
            f('text', 'outlets', 'Redaktionen', ['max' => 200, 'hint' => 'z. B. „buten un binnen · WELT · Good News“']),
        ],
    ];
    $s['collections']['languages'] = [
        'label' => 'Über mich: Sprachen', 'singular' => 'Sprache', 'title' => 'name', 'sub' => ['note'],
        'fields' => [
            f('text', 'name', 'Sprache', ['required' => true, 'max' => 40]),
            f('text', 'note', 'Zusatz (z. B. „im Aufbau“)', ['max' => 40]),
        ],
    ];
    $s['collections']['offrecord'] = [
        'label' => 'Off the record', 'singular' => 'Frage', 'title' => 'question', 'sub' => [],
        'help' => 'Die Antwort ist auf der Seite zunächst geschwärzt und wird beim Darüberfahren sichtbar.',
        'fields' => [
            f('text', 'question', 'Frage', ['required' => true, 'max' => 120]),
            f('textarea', 'answer', 'Antwort', ['max' => 400]),
        ],
    ];
    $s['collections']['questions'] = [
        'label' => 'Leitfragen („Was mich antreibt“)', 'singular' => 'Frage', 'title' => 'text', 'sub' => ['number'],
        'fields' => [
            f('text', 'number', 'Nummer', ['max' => 4, 'default' => '01']),
            f('markup', 'text', 'Frage', ['required' => true, 'max' => 240, 'hint' => MARKUP_HINT]),
        ],
    ];
    $s['collections']['marquee'] = [
        'label' => 'Laufband (Wörter)', 'singular' => 'Wort', 'title' => 'word', 'sub' => [],
        'fields' => [f('text', 'word', 'Wort', ['required' => true, 'max' => 40])],
    ];
    $s['collections']['nav'] = [
        'label' => 'Navigation', 'singular' => 'Menüpunkt', 'title' => 'label', 'sub' => ['anchor'],
        'help' => 'Menüpunkte oben (Desktop) und im Handy-Menü.',
        'fields' => [
            f('text', 'label', 'Beschriftung', ['required' => true, 'max' => 30]),
            f('select', 'anchor', 'Springt zu', ['options' => anchor_options(), 'default' => 'arbeiten']),
            f('bool', 'desktop', 'Auch in der Kopfzeile am Desktop zeigen', ['default' => true]),
        ],
    ];

    // ---------- Einzelbereiche ----------
    $s['groups']['site'] = [
        'label' => 'Allgemein & Design', 'help' => 'Farben und Kopfzeile. Titel und Beschreibung für Suchmaschinen findest du unter „SEO & Suche“.',
        'fields' => [
            f('section', '', 'Farben'),
            f('color', 'accent', 'Akzentfarbe (Buttons, Zahlen)', ['default' => '#0E5C62']),
            f('color', 'rec', 'Rec-Rot (blinkender Punkt)', ['default' => '#C42F24']),
            f('section', '', 'Kopfzeile'),
            f('text', 'header_label', 'Text links oben', ['max' => 60, 'default' => 'AR / Reel 2025–26']),
        ],
    ];
    $s['groups']['seo'] = [
        'label' => 'SEO & Suche',
        'help' => 'Wie die Seite bei Google & Co. und beim Teilen erscheint. Vorschau der Dateien: robots.txt, sitemap.xml, llms.txt (Links unten).',
        'fields' => [
            f('section', '', 'Sichtbarkeit'),
            f('bool', 'noindex', 'Seite für Suchmaschinen sperren (noindex)', ['hint' => 'Setzt noindex/nofollow, sperrt alles in robots.txt und schaltet Sitemap und llms.txt ab. Sinnvoll, solange die Seite noch nicht öffentlich sein soll.']),
            f('section', '', 'Titel & Beschreibung'),
            f('text', 'title', 'Seitentitel', ['max' => 70, 'default' => 'Antonia Rüller – Journalistin', 'hint' => 'Ideal 40–60 Zeichen. Name und Beruf nach vorn, z. B. „Antonia Rüller – Journalistin & Reporterin, Bremen“.']),
            f('textarea', 'description', 'Beschreibung (Meta-Description)', ['max' => 170, 'rows' => 3, 'hint' => 'Ideal 120–160 Zeichen: Wer, wofür, wo.']),
            f('image', 'og_image', 'Vorschaubild beim Teilen (1200 × 630 px)', ['hint' => 'Leer = Foto aus dem Startbereich.']),
            f('section', '', 'Person: strukturierte Daten für Google (Schema.org)'),
            f('bool', 'jsonld', 'Strukturierte Daten ausgeben', ['default' => true, 'hint' => 'Helfen Suchmaschinen, dich als Person, Journalistin und Autorin deiner Beiträge zu erkennen.']),
            f('text', 'job_title', 'Berufsbezeichnung', ['max' => 80, 'default' => 'Journalistin und Reporterin']),
            f('text', 'works_for', 'Arbeitgeber / Redaktion', ['max' => 80, 'default' => 'Radio Bremen']),
            f('url', 'works_for_url', 'Webseite des Arbeitgebers', ['default' => 'https://www.radiobremen.de']),
            f('text', 'location', 'Ort', ['max' => 60, 'default' => 'Bremen']),
            f('text', 'country', 'Land (Kürzel)', ['max' => 2, 'default' => 'DE']),
            f('textarea', 'same_as', 'Weitere Profile (ein Link pro Zeile)', ['rows' => 4, 'max' => 800, 'hint' => 'LinkedIn aus dem Kontaktbereich wird automatisch ergänzt. Sinnvoll: Autorenseiten bei Sendern, Wikipedia, Mastodon/Bluesky, DJV-Profil, ORCID.']),
            f('textarea', 'knows_about', 'Themenschwerpunkte (einer pro Zeile)', ['rows' => 6, 'max' => 800, 'default' => "Investigativjournalismus\nRecherche\nPolitik\nGesundheitspolitik\nKlimapolitik\nTürkei\nRadio\nPodcast\nVideo", 'hint' => 'Wofür soll man dich finden?']),
            f('textarea', 'alumni', 'Ausbildung / Hochschulen (eine pro Zeile)', ['rows' => 3, 'max' => 400, 'default' => 'TU Dortmund']),
            f('bool', 'works_list', 'Referenzen als Werkliste ausgeben', ['default' => true, 'hint' => 'Jede Referenz mit echtem Link wird als Beitrag mit dir als Autorin ausgezeichnet.']),
            f('section', '', 'Bestätigung der Webmaster-Konten (optional)'),
            f('text', 'google_verify', 'Google Search Console: Inhalt des Meta-Tags', ['max' => 120, 'hint' => 'Nur der Wert aus content="…".']),
            f('text', 'bing_verify', 'Bing Webmaster Tools: Inhalt des Meta-Tags', ['max' => 120]),
            f('section', '', 'robots.txt'),
            f('select', 'ai_bots', 'KI-Crawler', ['options' => ['allow' => 'Erlauben', 'block' => 'Training sperren (GPTBot, ClaudeBot, Google-Extended, CCBot u. a.)'], 'default' => 'allow', 'hint' => 'robots.txt ist eine Bitte, keine Sperre – seriöse Anbieter halten sich daran.']),
            f('textarea', 'robots_extra', 'Zusätzliche Zeilen für robots.txt', ['rows' => 4, 'max' => 1000, 'hint' => 'Nur für Fortgeschrittene. Beispiel: Disallow: /uploads/privat/']),
            f('section', '', 'llms.txt (Überblick für KI-Assistenten)'),
            f('bool', 'llms_enabled', 'llms.txt bereitstellen', ['default' => true]),
            f('textarea', 'llms_summary', 'Kurzbeschreibung für KI-Assistenten', ['rows' => 4, 'max' => 600, 'hint' => 'Leer = die Meta-Description. Sachlich formulieren: wer du bist, wofür du stehst, wo man Arbeiten findet.']),
            f('textarea', 'llms_extra', 'Zusätzlicher Text (Markdown)', ['rows' => 5, 'max' => 3000, 'hint' => 'z. B. Hinweise zur Nutzung deiner Beiträge, Zitierregeln, Pressekontakt.']),
        ],
    ];
    $s['groups']['hero'] = [
        'label' => 'Startbereich (Hero)',
        'fields' => [
            f('text', 'first', 'Vorname', ['max' => 40, 'default' => 'Antonia']),
            f('text', 'last', 'Nachname', ['max' => 40, 'default' => 'Rüller', 'hint' => 'Ein „ü“ wird als „u“ mit zwei roten Punkten dargestellt.']),
            f('textarea', 'lead', 'Einleitung', ['max' => 300]),
            f('text', 'meta', 'Zeile oben (Beruf · Ort)', ['max' => 80]),
            f('text', 'now_label', 'Überschrift „Aktuell“', ['max' => 30, 'default' => 'Aktuell']),
            f('textarea', 'now_lines', 'Aktuell (eine Zeile pro Eintrag)', ['max' => 200]),
            f('image', 'photo', 'Foto (am besten freigestellt, WebP/PNG)'),
            f('text', 'photo_alt', 'Bildbeschreibung (Alt-Text)', ['max' => 160, 'required' => true]),
            f('section', '', 'Namensschild am Foto'),
            f('text', 'tag_live', 'Kleine Zeile oben', ['max' => 40, 'default' => 'Live · Bremen']),
            f('text', 'tag_name', 'Name', ['max' => 60, 'default' => 'Antonia Rüller']),
            f('text', 'tag_role', 'Rolle', ['max' => 60]),
        ],
    ];
    $s['groups']['sections'] = [
        'label' => 'Abschnittstitel',
        'help' => 'Überschriften und Begleittexte der einzelnen Abschnitte.',
        'fields' => [
            f('section', '', 'Leitfragen'),
            f('text', 'q_right', 'Rechts neben „REC“', ['max' => 40, 'default' => 'Zwei Fragen']),
            f('section', '', 'Showreel'),
            f('text', 'show_h1', 'Überschrift, Teil 1 (Großschrift)', ['max' => 20, 'default' => 'Show']),
            f('text', 'show_h2', 'Überschrift, Teil 2 (kursiv)', ['max' => 20, 'default' => 'reel']),
            f('text', 'show_right', 'Zeile rechts', ['max' => 80, 'hint' => 'Leer = automatisch (Anzahl Clips und Zeitraum).']),
            f('text', 'show_all', 'Titel der Liste', ['max' => 40, 'default' => 'Alle Clips']),
            f('text', 'editor_title', 'Titel der Zeitleiste', ['max' => 40, 'default' => 'Schnittplatz · Reel №1']),
            f('section', '', 'Podcast'),
            f('text', 'pod_h1', 'Überschrift, Teil 1', ['max' => 20, 'default' => 'Hör']),
            f('text', 'pod_h2', 'Überschrift, Teil 2 (kursiv)', ['max' => 20, 'default' => 'mal rein.']),
            f('text', 'pod_right', 'Zeile rechts', ['max' => 40, 'default' => 'Audio · On Air']),
            f('section', '', 'Stationen & Lebenslauf'),
            f('text', 'st_right', 'Stationen: Zeile rechts', ['max' => 40, 'default' => 'Sender & Redaktionen']),
            f('text', 'cv_h1', 'Lebenslauf Teil 1', ['max' => 20, 'default' => 'Lebens']),
            f('text', 'cv_h2', 'Lebenslauf Teil 2 (kursiv)', ['max' => 20, 'default' => 'lauf']),
            f('text', 'cv_right', 'Lebenslauf: Zeile rechts', ['max' => 60, 'default' => 'rückwärts abgespielt']),
            f('text', 'cv_before', 'Beschriftung „Davor“', ['max' => 20, 'default' => 'Davor']),
            f('text', 'cv_pdf_label', 'Button CV-Download', ['max' => 30, 'default' => 'CV als PDF']),
            f('section', '', 'Off the record'),
            f('text', 'off_right', 'Zeile rechts', ['max' => 40, 'default' => 'Nicht zitierfähig']),
            f('text', 'off_hint', 'Hinweis unter der Überschrift', ['max' => 120, 'default' => 'Zum Aufdecken über die Balken fahren oder tippen.']),
        ],
    ];
    $s['groups']['timeline'] = [
        'label' => 'Zeitleiste: Zeitraum',
        'help' => 'Welcher Zeitraum die Zeitleiste im Showreel abdeckt. Ein Quartal entspricht einer Spalte.',
        'fields' => [
            f('date', 'start', 'Beginn', ['default' => '2024-01-01', 'required' => true]),
            f('date', 'end', 'Ende', ['default' => '2026-12-31', 'required' => true]),
            f('number', 'min_w', 'Mindestbreite eines Balkens (%)', ['min' => 0.5, 'max' => 20, 'step' => 0.1, 'default' => 2.8]),
            f('text', 'hint_mobile', 'Hinweis unter der Handy-Zeitleiste', ['max' => 80, 'default' => 'Pfeile nutzen oder Clip antippen']),
        ],
    ];
    $s['groups']['about'] = [
        'label' => 'Über mich',
        'fields' => [
            f('text', 'right', 'Zeile rechts neben „REC“', ['max' => 40, 'default' => 'TC 00:03:58:12']),
            f('image', 'portrait', 'Porträtfoto'),
            f('text', 'portrait_alt', 'Bildbeschreibung (Alt-Text)', ['max' => 160, 'required' => true]),
            f('text', 'onair', 'Stempel am Foto', ['max' => 12, 'default' => 'On Air', 'hint' => 'Leer = kein Stempel.']),
            f('markup', 'headline', 'Große Aussage', ['max' => 240, 'hint' => MARKUP_HINT]),
            f('textarea', 'text1', 'Text, linke Spalte', ['max' => 1500]),
            f('textarea', 'text2', 'Text, rechte Spalte', ['max' => 1500]),
            f('text', 'cross_label', 'Überschrift „Crossmedial“', ['max' => 40, 'default' => 'Crossmedial unterwegs']),
            f('text', 'lang_label', 'Überschrift „Sprachen“', ['max' => 40, 'default' => 'Sprachen']),
        ],
    ];
    $s['groups']['contact'] = [
        'label' => 'Kontakt & Fußzeile',
        'fields' => [
            f('text', 'right', 'Zeile rechts neben „REC“', ['max' => 40, 'default' => 'TC 00:04:12:00']),
            f('text', 'h1', 'Überschrift, Teil 1', ['max' => 20, 'default' => 'Schreib']),
            f('text', 'h2', 'Überschrift, Teil 2 (kursiv)', ['max' => 20, 'default' => 'mir']),
            f('text', 'intro', 'Einleitung', ['max' => 160, 'default' => 'Für Themen, Recherchen und Zusammenarbeit.']),
            f('text', 'email', 'E-Mail-Adresse', ['max' => 120, 'hint' => 'Wird im Seitenquelltext verschleiert (Spam-Schutz).']),
            f('url', 'linkedin', 'LinkedIn-Link'),
            f('pdf', 'cv_pdf', 'Lebenslauf als PDF'),
            f('text', 'copyright', 'Copyright-Zeile', ['max' => 120, 'default' => '© 2026 Antonia Rüller']),
            f('text', 'photo_credit', 'Fotonachweis', ['max' => 120, 'hint' => 'z. B. „Fotos: Name“ – leer = nichts anzeigen.']),
            f('text', 'end_note', 'Schlusszeile', ['max' => 60, 'default' => 'Stop — Ende Reel №1']),
        ],
    ];
    $s['groups']['legal'] = [
        'label' => 'Impressum & Datenschutz',
        'help' => 'Vorlagen: Angaben in [eckigen Klammern] ersetzen oder löschen. Absätze durch eine Leerzeile trennen, Überschriften mit „## “, Aufzählungen mit „- “. Die Seiten erscheinen unter /impressum und /datenschutz. Keine Rechtsberatung – vor dem Start prüfen (lassen).',
        'fields' => [
            f('textarea', 'impressum', 'Impressum', ['rows' => 22, 'max' => 20000, 'default' => legal_defaults()['impressum']]),
            f('textarea', 'datenschutz', 'Datenschutzerklärung', ['rows' => 30, 'max' => 40000, 'default' => legal_defaults()['datenschutz']]),
        ],
    ];

    return $s;
}

/** Navigationsstruktur der Admin-Seitenleiste */
function admin_menu(): array
{
    return [
        'Seite' => [['g', 'site'], ['g', 'seo'], ['g', 'hero'], ['c', 'nav'], ['c', 'marquee'], ['g', 'sections']],
        'Inhalte' => [['c', 'clips'], ['g', 'timeline'], ['c', 'tracks'], ['c', 'episodes'], ['c', 'stations'], ['c', 'cv'], ['c', 'before'], ['g', 'about'], ['c', 'crossmedia'], ['c', 'languages'], ['c', 'offrecord'], ['c', 'questions'], ['g', 'contact'], ['g', 'legal']],
    ];
}
