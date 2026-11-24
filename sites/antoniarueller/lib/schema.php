<?php
declare(strict_types=1);

require_once __DIR__ . '/legal_defaults.php';

/**
 * Datenmodell: jede Eingabemaske im Admin entsteht aus diesen Definitionen.
 *  - collections = Listen (hinzufügen, sortieren, Papierkorb)
 *  - groups      = einzelne Bereiche (Singletons)
 *
 * Feldtypen: text, textarea, markup (Text mit *kursiv* / **GROSS** / ==Akzent==), date, month,
 *            select, switch, bool, number, range, color, url, image, pdf, gallery
 */

const MARKUP_HINT = 'Hervorhebungen: *kursiv*, **GROSSSCHRIFT**, ==Akzentfarbe==';

function media_options(): array
{
    return ['video' => 'Video / TV', 'text' => 'Text / Online', 'radio' => 'Radio', 'podcast' => 'Podcast', 'social' => 'YouTube / Social'];
}

function wave_options(): array
{
    return ['auto' => 'Automatisch (wechselt)', '1' => 'Gespräch (Sprechblöcke mit Pausen)', '2' => 'Reportage (Atmo mit Stimmen-Spitzen)', '3' => 'Atmo (ruhiger Klangteppich)', '4' => 'Zwei Stimmen (Wechselrede)'];
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
        'label' => 'Referenzen (Showreel)', 'singular' => 'Referenz', 'title' => 'title', 'sub' => ['outlet', 'date_label'], 'star' => 'featured',
        'help' => 'Alle Arbeitsproben. Die Reihenfolge hier bestimmt die Nummerierung („01, 02 …“). Mit dem Schalter blendest du eine Referenz ein oder aus, mit dem Stern hebst du sie als „Featured“ ganz oben hervor (immer nur eine). Entfernte Referenzen landen zuerst im Papierkorb.',
        'fields' => [
            f('section', '', 'Inhalt'),
            f('text', 'title', 'Titel', ['required' => true, 'max' => 200]),
            f('text', 'short', 'Kurzname (für den Schnittplatz)', ['max' => 40, 'hint' => 'Erscheint im Clip des Schnittplatzes, z. B. „Istanbul“.']),
            f('text', 'outlet', 'Redaktion / Sender', ['max' => 120]),
            f('select', 'tl_track', 'Kategorie', ['options_from' => 'tracks', 'required' => true, 'hint' => 'Die Kategorie bestimmt die Spur im Schnittplatz, die Farbe und das Symbol. Kategorien legst du unter „Arbeiten → Kategorien“ an.']),
            f('date', 'date', 'Datum (Veröffentlichung)', ['hint' => 'Bestimmt die Anzeige „MM/JJJJ“ und das Jahres-Fähnchen im Schnittplatz.']),
            f('text', 'date_label', 'Datumsanzeige überschreiben (optional)', ['max' => 40, 'hint' => 'Nur nötig für Zeiträume wie „2024–2025“ oder wenn kein genaues Datum bekannt ist.']),
            f('text', 'role', 'Rolle', ['max' => 80]),
            f('textarea', 'desc', 'Beschreibung', ['max' => 600]),
            f('image', 'still', 'Vorschaubild (optional)', ['hint' => 'Erscheint als quadratische Kachel in der Liste „Alle Beiträge“ und im Featured-Block. Mit dem Fokuspunkt legst du fest, welcher Ausschnitt sichtbar bleibt.']),
            f('text', 'still_credit', 'Bildnachweis (optional)', ['max' => 80, 'hint' => 'z. B. „Bild: buten un binnen“. Erscheint klein im Bild.']),
            f('section', '', 'Link zum Beitrag'),
            f('switch', 'link_mode', 'Wo liegt der Beitrag?', ['options' => ['external' => 'Externer Link', 'hosted' => 'Beitrag selbst hosten'], 'default' => 'external']),
            f('url', 'url', 'Link zum Beitrag', ['show_if' => ['link_mode', 'external']]),
            f('text', 'link_text', 'Linktext', ['max' => 60, 'default' => 'Zum Beitrag', 'dict' => true, 'show_if' => ['link_mode', 'external']]),
            f('bool', 'new_tab', 'Link in neuem Tab öffnen', ['default' => true, 'show_if' => ['link_mode', 'external']]),
            f('switch', 'hosted_kind', 'Was soll sich öffnen?', ['options' => ['images' => 'Bilder', 'pdf' => 'PDF'], 'default' => 'images', 'show_if' => ['link_mode', 'hosted']]),
            f('text', 'gallery_text', 'Linktext', ['max' => 60, 'default' => 'Beitrag ansehen', 'dict' => true, 'show_if' => ['link_mode', 'hosted'], 'hint' => 'Beschriftung des Knopfes in der Kachel und im Featured.']),
            f('gallery', 'gallery', 'Bilder', ['show_if' => ['link_mode', 'hosted'], 'show_if2' => ['hosted_kind', 'images'], 'max_items' => 30, 'hint' => 'Auf der Seite öffnen sich die Bilder in dieser Reihenfolge in einer Galerie (Lightbox). Die Bildunterschrift ist optional.']),
            f('pdf', 'pdf_file', 'PDF', ['show_if' => ['link_mode', 'hosted'], 'show_if2' => ['hosted_kind', 'pdf'], 'hint' => 'Das PDF öffnet sich beim Klick in einem neuen Tab.']),
            f('bool', 'published', 'Auf der Seite anzeigen', ['default' => true, 'hidden' => true]),
            f('bool', 'featured', 'Featured', ['hidden' => true]),
        ],
    ];
    $s['collections']['tracks'] = [
        'label' => 'Kategorien', 'singular' => 'Kategorie', 'title' => 'label', 'sub' => ['code'],
        'help' => 'Jede Kategorie (Video, Online, Radio …) ist eine Spur im Schnittplatz und ordnet die Referenzen. Reihenfolge, Farben und Symbol sind frei wählbar.',
        'fields' => [
            f('text', 'code', 'Spurkürzel', ['required' => true, 'max' => 6, 'hint' => 'z. B. V1, T1, A1 (wird in der Spurliste des Schnittplatzes gezeigt).']),
            f('text', 'label', 'Bezeichnung', ['required' => true, 'max' => 40, 'hint' => 'Erscheint an der Referenz und in der Spur, z. B. „Online“.']),
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
            f('textarea', 'desc', 'Kurzbeschreibung (optional)', ['max' => 200, 'rows' => 3, 'ideal' => [80, 180], 'hint' => 'Erscheint unter dem Titel, ein bis zwei Sätze. Höchstens 200 Zeichen.']),
            f('text', 'duration', 'Dauer', ['max' => 20, 'hint' => 'z. B. 32 Min.']),
            f('text', 'outlet', 'Sender / Plattform', ['max' => 120]),
            f('date', 'date', 'Veröffentlicht am'),
            f('url', 'spotify', 'Link Spotify'),
            f('url', 'apple', 'Link Apple Podcasts'),
            f('url', 'audiothek', 'Link ARD Audiothek'),
            f('text', 'other_label', 'Weitere Plattform (Name)', ['max' => 30]),
            f('url', 'other_url', 'Weitere Plattform (Link)'),
            f('select', 'wave', 'Tonspur-Darstellung', ['options' => wave_options(), 'default' => 'auto', 'hint' => 'Nur Optik. „Automatisch“ lässt die Tonspuren der Folgen der Reihe nach wechseln.']),
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
        'help' => 'Die Einträge werden automatisch nach Jahr des Beginns gruppiert (neueste zuerst). Die Jahreszahl ist farbig, wenn in diesem Jahr mindestens eine Station mit „Läuft noch“ beginnt, sonst als Umriss.',
        'fields' => [
            f('text', 'role', 'Rolle', ['max' => 80, 'hint' => 'z. B. „Autorin“ – das Komma setzt die Seite selbst.']),
            f('text', 'org', 'Organisation', ['required' => true, 'max' => 120]),
            f('month', 'from', 'Beginn', ['required' => true]),
            f('month', 'to', 'Ende'),
            f('bool', 'ongoing', 'Läuft noch („seit …“)', ['hint' => 'Färbt zugleich die Jahreszahl des Beginns auf der Seite ein.']),
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
            f('text', 'name', 'Sprache', ['required' => true, 'max' => 40, 'tr' => true]),
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
    $s['collections']['social'] = [
        'label' => 'Social-Media-Profile', 'singular' => 'Profil', 'title' => 'label', 'sub' => ['url'],
        'help' => 'Erscheinen als Buttons unter „Schreib mir“, im Handy-Menü und als Profile für Suchmaschinen (Schema.org). Alles optional – leere Liste = keine Buttons.',
        'fields' => [
            f('text', 'label', 'Beschriftung', ['required' => true, 'max' => 30, 'tr' => false, 'hint' => 'z. B. LinkedIn, Instagram, Bluesky, Mastodon, YouTube, Xing.']),
            f('url', 'url', 'Link zum Profil', ['required' => true]),
            f('bool', 'published', 'Anzeigen', ['default' => true]),
        ],
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
            f('text', 'menu_label', 'Titel im Handy-Menü', ['max' => 30, 'default' => 'AR / Menü', 'dict' => true]),
        ],
    ];
    $s['groups']['seo'] = [
        'label' => 'SEO & Suche',
        'help' => 'Wie die Seite bei Google & Co. und beim Teilen erscheint. Vorschau der Dateien: robots.txt, sitemap.xml, llms.txt (Links unten).',
        'fields' => [
            f('section', '', 'Sichtbarkeit'),
            f('bool', 'noindex', 'Seite für Suchmaschinen sperren (noindex)', ['hint' => 'Setzt noindex/nofollow, sperrt alles in robots.txt und schaltet Sitemap und llms.txt ab. Sinnvoll, solange die Seite noch nicht öffentlich sein soll.']),
            f('section', '', 'Titel & Beschreibung'),
            f('text', 'title', 'Seitentitel', ['max' => 70, 'ideal' => [40, 60], 'default' => 'Antonia Rüller – Journalistin', 'hint' => 'Ideal 40–60 Zeichen. Name und Beruf nach vorn, z. B. „Antonia Rüller – Journalistin & Reporterin, Bremen“.']),
            f('textarea', 'description', 'Beschreibung (Meta-Description)', ['max' => 170, 'ideal' => [120, 160], 'rows' => 3, 'hint' => 'Ideal 120–160 Zeichen: Wer, wofür, wo.']),
            f('image', 'og_image', 'Vorschaubild beim Teilen (1200 × 630 px)', ['hint' => 'Leer = Foto aus dem Startbereich.']),
            f('section', '', 'Person: strukturierte Daten für Google (Schema.org)', ['adv' => true]),
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
            f('section', '', 'Bestätigung der Webmaster-Konten (optional)', ['adv' => true]),
            f('text', 'google_verify', 'Google Search Console: Inhalt des Meta-Tags', ['max' => 120, 'hint' => 'Nur der Wert aus content="…".']),
            f('text', 'bing_verify', 'Bing Webmaster Tools: Inhalt des Meta-Tags', ['max' => 120]),
            f('section', '', 'robots.txt', ['adv' => true]),
            f('select', 'ai_bots', 'KI-Crawler', ['options' => ['allow' => 'Erlauben', 'block' => 'Training sperren (GPTBot, ClaudeBot, Google-Extended, CCBot u. a.)'], 'default' => 'allow', 'hint' => 'robots.txt ist eine Bitte, keine Sperre – seriöse Anbieter halten sich daran.']),
            f('textarea', 'robots_extra', 'Zusätzliche Zeilen für robots.txt', ['rows' => 4, 'max' => 1000, 'hint' => 'Nur für Fortgeschrittene. Beispiel: Disallow: /uploads/privat/']),
            f('section', '', 'llms.txt (Überblick für KI-Assistenten)', ['adv' => true]),
            f('bool', 'llms_enabled', 'llms.txt bereitstellen', ['default' => true]),
            f('textarea', 'llms_summary', 'Kurzbeschreibung für KI-Assistenten', ['rows' => 4, 'max' => 600, 'hint' => 'Leer = die Meta-Description. Sachlich formulieren: wer du bist, wofür du stehst, wo man Arbeiten findet.']),
            f('textarea', 'llms_extra', 'Zusätzlicher Text (Markdown)', ['rows' => 5, 'max' => 3000, 'hint' => 'z. B. Hinweise zur Nutzung deiner Beiträge, Zitierregeln, Pressekontakt.']),
        ],
    ];
    $s['groups']['hero'] = [
        'label' => 'Hero-Bereich',
        'fields' => [
            f('text', 'first', 'Vorname', ['max' => 40, 'default' => 'Antonia']),
            f('text', 'last', 'Nachname', ['max' => 40, 'default' => 'Rüller']),
            f('textarea', 'lead', 'Einleitung', ['max' => 300]),
            f('text', 'meta', 'Zeile oben (Beruf · Ort)', ['max' => 80]),
            f('text', 'now_label', 'Überschrift „Aktuell“', ['max' => 30, 'default' => 'Aktuell']),
            f('textarea', 'now_lines', 'Aktuell (eine Zeile pro Eintrag)', ['max' => 200]),
            f('image', 'photo', 'Foto (am besten freigestellt, WebP/PNG)'),
            f('text', 'photo_alt', 'Bildbeschreibung (Alt-Text)', ['max' => 160, 'required' => true]),
        ],
    ];
    $s['groups']['sections'] = [
        'label' => 'Abschnitte',
        'help' => 'Jeder Abschnitt der Seite hat einen eigenen Bereich: Mit dem Schieberegler blendest du den ganzen Abschnitt ein oder aus, darunter bearbeitest du seine Texte (Abschnittsname, Überschrift, Beschriftungen). Die Inhalte selbst (Referenzen, Folgen, Stationen …) pflegst du über den Link im jeweiligen Bereich.',
        'fields' => [
            f('section', '', 'Start (Intro)', ['card' => true, 'note' => 'Der Startbereich ist immer sichtbar.', 'link' => ['g', 'hero']]),
            f('text', 'intro_label', 'Abschnittsname in der REC-Zeile', ['max' => 30, 'default' => 'Intro', 'dict' => true]),
            f('text', 'hero_tc', 'Timecode rechts oben', ['max' => 30, 'default' => 'TC 00:00:00:01', 'dict' => true]),

            f('section', '', 'Leitfragen', ['card' => true, 'toggle' => 'on_questions', 'link' => ['c', 'questions']]),
            f('bool', 'on_questions', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'q_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Was mich antreibt', 'dict' => true]),
            f('text', 'q_right', 'Rechts neben „REC“', ['max' => 40, 'default' => 'Zwei Fragen']),

            f('section', '', 'Showreel', ['card' => true, 'toggle' => 'on_show', 'note' => 'Das Featured ganz oben wird mit dem Stern in der Referenzen-Liste gewählt und ist von diesem Schalter unabhängig.', 'link' => ['c', 'clips']]),
            f('bool', 'on_show', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'show_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Showreel', 'dict' => true]),
            f('text', 'show_h1', 'Überschrift, Teil 1 (Großschrift)', ['max' => 20, 'default' => 'Show']),
            f('text', 'show_h2', 'Überschrift, Teil 2 (kursiv)', ['max' => 20, 'default' => 'reel']),
            f('text', 'show_right', 'Zeile rechts', ['max' => 80, 'hint' => 'Leer = automatisch (Anzahl, Kategorien und Zeitraum).']),
            f('section', '', 'Hervorgehobener Beitrag', ['sub' => true]),
            f('text', 'feat_label', 'Beschriftung im Featured-Block', ['max' => 30, 'default' => 'Featured', 'dict' => true]),
            f('text', 'feat_by', 'Wort vor dem Namen im Featured („Von …“)', ['max' => 20, 'default' => 'Von', 'dict' => true]),
            f('section', '', 'Schnittplatz', ['sub' => true]),
            f('text', 'editor_title', 'Titel des Schnittplatzes', ['max' => 40, 'default' => 'Schnittplatz · Reel №1']),
            f('text', 'editor_hint', 'Hinweis in der Leiste des Schnittplatzes', ['max' => 60, 'default' => 'Clip anklicken: springt zum Beitrag', 'dict' => true]),
            f('text', 'editor_track', 'Spaltenkopf der Spuren', ['max' => 20, 'default' => 'Spur', 'dict' => true]),
            f('section', '', 'Beitragsliste', ['sub' => true]),
            f('text', 'show_all', 'Titel der Liste', ['max' => 40, 'default' => 'Alle Beiträge']),
            f('text', 'show_unit', 'Wort für die Anzahl in der automatischen Zeile rechts', ['max' => 20, 'default' => 'Clips', 'dict' => true, 'hint' => 'z. B. „Clips“ oder „Beiträge“.']),
            f('text', 'role_label', 'Beschriftung vor der Rolle in den Kacheln', ['max' => 20, 'default' => 'Rolle:', 'dict' => true]),

            f('section', '', 'Podcast', ['card' => true, 'toggle' => 'on_podcast', 'link' => ['c', 'episodes']]),
            f('bool', 'on_podcast', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'pod_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Podcast', 'dict' => true]),
            f('text', 'pod_h1', 'Überschrift, Teil 1', ['max' => 20, 'default' => 'Hör']),
            f('text', 'pod_h2', 'Überschrift, Teil 2 (kursiv)', ['max' => 20, 'default' => 'mal rein.']),
            f('text', 'pod_right', 'Zeile rechts', ['max' => 40, 'default' => 'Audio · On Air', 'hint' => 'Leer = keine Zeile.']),
            f('text', 'pod_listen', 'Beschriftung vor den Plattform-Knöpfen', ['max' => 30, 'default' => 'Anhören bei', 'dict' => true]),
            f('text', 'pod_episode', 'Wort für „Folge“', ['max' => 20, 'default' => 'Folge', 'dict' => true]),

            f('section', '', 'Über mich', ['card' => true, 'toggle' => 'on_about', 'link' => ['g', 'about']]),
            f('bool', 'on_about', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'about_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Über mich', 'dict' => true]),

            f('section', '', 'Stationen', ['card' => true, 'toggle' => 'on_stations', 'link' => ['c', 'stations']]),
            f('bool', 'on_stations', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'st_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Stationen', 'dict' => true]),
            f('text', 'st_right', 'Zeile rechts', ['max' => 40, 'default' => 'Sender & Redaktionen']),

            f('section', '', 'Lebenslauf', ['card' => true, 'toggle' => 'on_cv', 'link' => ['c', 'cv']]),
            f('bool', 'on_cv', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'cv_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Lebenslauf', 'dict' => true]),
            f('text', 'cv_h1', 'Überschrift, Teil 1', ['max' => 20, 'default' => 'Lebens']),
            f('text', 'cv_h2', 'Überschrift, Teil 2 (kursiv)', ['max' => 20, 'default' => 'lauf']),
            f('text', 'cv_right', 'Zeile rechts', ['max' => 60, 'default' => 'rückwärts abgespielt']),
            f('text', 'cv_today', 'Wort für „heute“ (Zeitraum in der Zeile rechts)', ['max' => 20, 'default' => 'heute', 'dict' => true]),
            f('text', 'cv_since', 'Wort für „seit“ (laufende Stationen)', ['max' => 20, 'default' => 'seit', 'dict' => true]),
            f('text', 'cv_before', 'Beschriftung „Davor“', ['max' => 20, 'default' => 'Davor']),
            f('text', 'cv_pdf_label', 'Knopf für den CV-Download', ['max' => 30, 'default' => 'CV als PDF']),

            f('section', '', 'Off the record', ['card' => true, 'toggle' => 'on_off', 'note' => 'Die große Überschrift „Off the record“ mit dem durchgestrichenen „the“ ist fest gestaltet.', 'link' => ['c', 'offrecord']]),
            f('bool', 'on_off', 'Abschnitt auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'off_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Off the record', 'dict' => true]),
            f('text', 'off_right', 'Zeile rechts', ['max' => 40, 'default' => 'Nicht zitierfähig']),
            f('text', 'off_hint', 'Hinweis unter der Überschrift', ['max' => 120, 'default' => 'Zum Aufdecken über die Balken fahren oder tippen.']),

            f('section', '', 'Kontakt & Fußzeile', ['card' => true, 'toggle' => 'on_contact', 'note' => 'Bei ausgeschaltetem Kontakt bleibt die Fußzeile mit Impressum und Datenschutz immer sichtbar.', 'link' => ['g', 'contact']]),
            f('bool', 'on_contact', 'Kontaktbereich auf der Seite zeigen', ['default' => true, 'card_toggle' => true]),
            f('text', 'contact_label', 'Abschnittsname in der REC-Zeile', ['max' => 40, 'default' => 'Kontakt', 'dict' => true]),
            f('text', 'mail_fail', 'Hinweis, wenn sich das Mailprogramm nicht öffnet', ['max' => 80, 'default' => 'Mailprogramm öffnet sich nicht? Adresse:', 'dict' => true]),
            f('text', 'copy_label', 'Knopf „Kopieren“', ['max' => 20, 'default' => 'Kopieren', 'dict' => true]),
            f('text', 'copied_label', 'Bestätigung „Kopiert“', ['max' => 20, 'default' => 'Kopiert', 'dict' => true]),
            f('text', 'foot_imprint', 'Fußzeile: Link zum Impressum', ['max' => 30, 'default' => 'Impressum', 'dict' => true]),
            f('text', 'foot_privacy', 'Fußzeile: Link zum Datenschutz', ['max' => 30, 'default' => 'Datenschutz', 'dict' => true]),
        ],
    ];
    $s['groups']['timeline'] = [
        'label' => 'Schnittplatz: Hinweis',
        'fields' => [
            f('text', 'hint_mobile', 'Hinweis unter dem Schnittplatz auf dem Handy', ['max' => 80, 'default' => 'Clip antippen: springt zum Beitrag']),
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
            f('text', 'cta_label', 'Button in der Kopfzeile', ['max' => 24, 'default' => 'Schreib mir', 'hint' => 'Öffnet eine E-Mail an die Adresse unten. Leer = kein Button. Ohne E-Mail-Adresse wird der Button nicht gezeigt.']),
            f('text', 'mail_label', 'Beschriftung des E-Mail-Buttons', ['max' => 30, 'default' => 'E-Mail schreiben']),
            f('text', 'email', 'E-Mail-Adresse', ['max' => 120, 'hint' => 'Steht nicht im Seitenquelltext: Die Adresse wird erst beim Klick auf den Button geladen (Spam-Schutz). Im Impressum wird sie, falls dort eingetragen, nur codiert ausgegeben.']),
            f('pdf', 'cv_pdf', 'Lebenslauf als PDF'),
            f('text', 'copyright', 'Copyright-Zeile', ['max' => 120, 'default' => '© 2026 Antonia Rüller']),
            f('text', 'photo_credit', 'Fotonachweis', ['max' => 120, 'hint' => 'z. B. „Fotos: Name“ – leer = nichts anzeigen.']),
            f('url', 'photo_credit_url', 'Fotonachweis: Link (optional)', ['hint' => 'Der Fotonachweis in der Fußzeile wird dann zum Link, z. B. auf die Seite der Fotografin. Öffnet in einem neuen Tab.']),
            f('text', 'end_note', 'Schlusszeile', ['max' => 60, 'default' => 'Stop — Ende Reel №1']),
        ],
    ];
    $s['groups']['legal'] = [
        'label' => 'Impressum & Datenschutz',
        'help' => 'Vorlagen: Angaben in [eckigen Klammern] ersetzen oder löschen. Mit der Werkzeugleiste formatierst du Überschriften, fette Wörter, Aufzählungen und Links (auch zur Datenschutzerklärung bzw. zum Impressum). Die Seiten erscheinen unter /impressum und /datenschutz. Keine Rechtsberatung – bitte prüfen lassen.',
        'fields' => [
            f('textarea', 'impressum', 'Impressum', ['rich' => true, 'rows' => 22, 'max' => 20000, 'default' => legal_defaults()['impressum']]),
            f('textarea', 'datenschutz', 'Datenschutzerklärung', ['rich' => true, 'rows' => 30, 'max' => 40000, 'default' => legal_defaults()['datenschutz']]),
        ],
    ];

    return $s;
}

/**
 * Seitenleiste nach Website-Abschnitten.
 * Gruppe: id => [Titel, Symbol, Beschreibung, Einträge]; Eintrag: [Art (c|g|p), Schlüssel, Menütext, Erklärung, nur Inhaber?]
 */
function admin_nav(): array
{
    return [
        'start' => ['Hero-Bereich', 'home', 'Das Erste, was Besucher sehen.', [
            ['g', 'hero', 'Startbild & Einleitung', 'Foto, Überschrift und Einstiegstext ganz oben.'],
            ['c', 'questions', 'Leitfragen', '„Was mich antreibt“ – die kurzen Fragen mit Nummer.'],
        ]],
        'arbeiten' => ['Arbeiten', 'film', 'Referenzen, Featured und Schnittplatz.', [
            ['c', 'clips', 'Referenzen', 'Alle Arbeitsproben, auch das Featured ganz oben.'],
            ['c', 'tracks', 'Kategorien', 'Video, Online, Radio …: jede Kategorie ist eine Spur im Schnittplatz.'],
        ]],
        'podcast' => ['Podcast', 'mic', 'Folgen mit Links zu den Plattformen.', [
            ['c', 'episodes', 'Folgen', 'Jede Folge mit Titel, Wellenform und Plattform-Links.'],
        ]],
        'ueber' => ['Über mich', 'user', 'Porträt, Text, Sprachen und Medien.', [
            ['g', 'about', 'Text & Porträt', 'Foto und Text im Abschnitt „Über mich“.'],
            ['c', 'crossmedia', 'Crossmedial', 'Die Kacheln mit Medien, in denen Antonia arbeitet.'],
            ['c', 'languages', 'Sprachen', 'Sprachen mit Niveau.'],
        ]],
        'cv' => ['Lebenslauf', 'doc', 'Stationen und frühere Erfahrungen.', [
            ['c', 'cv', 'Stationen', 'Berufliche Stationen mit Zeitraum.'],
            ['c', 'stations', 'Sender & Redaktionen', 'Die Liste der Sender und Redaktionen.'],
            ['c', 'before', 'Davor', 'Frühere Erfahrungen und Ausbildung.'],
        ]],
        'otr' => ['Off the record', 'chat', 'Persönliche Fragen und Antworten.', [
            ['c', 'offrecord', 'Fragen & Antworten', 'Die persönlichen Fragen im Abschnitt „Off the record“.'],
        ]],
        'kontakt' => ['Kontakt', 'mail', 'Kontaktangaben und Profile.', [
            ['g', 'contact', 'Kontakt & Fußzeile', 'E-Mail, Texte beim Kontakt und die Fußzeile.'],
            ['c', 'social', 'Social-Media-Profile', 'Links zu LinkedIn, Instagram usw.'],
        ]],
        'design' => ['Seite & Design', 'palette', 'Farben, Menü und Überschriften.', [
            ['g', 'site', 'Farben & Kopfzeile', 'Akzentfarbe und Verhalten der Kopfzeile.'],
            ['c', 'nav', 'Menü der Webseite', 'Die Menüpunkte oben auf der Seite.'],
            ['g', 'sections', 'Abschnitte', 'Abschnitte ein- oder ausblenden und ihre Texte bearbeiten.'],
        ]],
        'englisch' => ['Englisch', 'globe', 'Die englische Fassung der Seite.', [
            ['p', 'translate', 'Übersetzungstabelle', 'Deutsch und Englisch nebeneinander – alle Texte an einem Ort.'],
        ]],
        'mediathek' => ['Mediathek', 'image', 'Bilder und PDFs.', [
            ['p', 'media', 'Mediathek', 'Alle hochgeladenen Bilder und PDFs: umbenennen, ersetzen, aufräumen.'],
        ]],
        'recht' => ['Suche & Recht', 'search', 'Google, Social-Media-Vorschau, Impressum.', [
            ['g', 'seo', 'SEO & Suche', 'Titel, Beschreibung und Vorschaubild für Suchmaschinen.'],
            ['g', 'legal', 'Impressum & Datenschutz', 'Die rechtlichen Texte (Deutsch und Englisch).'],
        ]],
        'auswertung' => ['Auswertung', 'chart', 'Besuche und Klicks – ohne Cookies.', [
            ['p', 'stats', 'Statistik', 'Besuche, Herkunft und Klicks.'],
        ]],
        'hilfe' => ['Hilfe', 'help', 'Anleitungen mit Bildern.', [
            ['p', 'help', 'Hilfe', 'Ausführliche Anleitungen für alle Bereiche, nach Kapiteln.'],
        ]],
        'system' => ['System', 'gear', 'Zugänge, Sicherung, Technik.', [
            ['p', 'trash', 'Papierkorb', 'Entfernte Einträge wiederherstellen oder löschen.'],
            ['p', 'users', 'Zugänge', 'Wer sich anmelden darf.', true],
            ['p', 'backup', 'Sicherung', 'Backups ansehen, laden und zurückspielen.', true],
            ['p', 'account', 'Mein Konto', 'Name und Passwort.'],
            ['p', 'sessions', 'Geräte', 'Wo du angemeldet bist.'],
            ['p', 'log', 'Protokoll', 'Wer hat wann was geändert.', true],
            ['p', 'check', 'Systemcheck', 'Technische Prüfung der Installation.', true],
        ]],
    ];
}
