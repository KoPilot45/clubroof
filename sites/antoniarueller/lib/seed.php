<?php
declare(strict_types=1);

/** Startinhalte: der aktuelle Stand der Seite (Entwurf vom Artefakt). Danach wird alles im Admin gepflegt. */
function seed_defaults(PDO $pdo): void
{
    $now = time();
    $ins = $pdo->prepare('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)');
    $add = function (string $coll, array $rows) use ($ins, $now) {
        $def = schema()['collections'][$coll];
        foreach (array_values($rows) as $i => $row) {
            $data = array_merge(field_defaults($def['fields']), $row);
            $ins->execute([$coll, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $i + 1, $now, $now, 'seed']);
        }
    };
    $set = function (string $grp, array $over) use ($pdo, $now) {
        $data = array_merge(field_defaults(schema()['groups'][$grp]['fields']), $over);
        $pdo->prepare('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)')
            ->execute([$grp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, 'seed']);
    };

    // Bilder aus dem Entwurf übernehmen
    $up = AR_ROOT . '/uploads';
    if (!is_dir($up)) {
        @mkdir($up, 0755, true);
    }
    $hero = $portrait = '';
    foreach (['antonia-hero.webp' => 'seed-hero.webp', 'antonia-portrait.jpg' => 'seed-portrait.jpg'] as $from => $to) {
        if (is_file(AR_ROOT . '/seed-assets/' . $from) && @copy(AR_ROOT . '/seed-assets/' . $from, "$up/$to")) {
            if ($to === 'seed-hero.webp') {
                $hero = $to;
            } else {
                $portrait = $to;
            }
        }
    }

    $set('site', []);
    $set('seo', ['description' => 'Antonia Rüller – Journalistin und Reporterin in Bremen. Recherche und dokumentarisches Erzählen für Radio, Podcast und Bewegtbild.', 'noindex' => false]);
    $set('hero', [
        'lead' => 'Recherche und dokumentarisches Erzählen — für Radio, Podcast und Bewegtbild, in Deutschland und im Ausland.',
        'meta' => 'Journalistin & Reporterin · Bremen',
        'now_lines' => "Investigativ-Recherche\nRadio Bremen · seit 11/2026",
        'photo' => $hero, 'photo_alt' => 'Antonia Rüller im roten Pullover, Arme verschränkt',
    ]);
    $set('sections', []);
    $set('timeline', []);
    $set('about', [
        'portrait' => $portrait, 'portrait_alt' => 'Porträt von Antonia Rüller vor grüner Wand',
        'headline' => 'Ich brenne für *Innovation*, für *Aktivismus* — und vor allem für **Menschen.**',
        'text1' => 'Ich bin in Essen aufgewachsen. Mein Vater ist Elektriker, meine Mutter Altenpflegerin. Als Kind habe ich klassisches Ballett getanzt, mit Prüfungen in London — ab fünfzehn habe ich gekellnert, um das zu bezahlen. Nach der Schule habe ich zwei Jahre in Frankreich gelebt und dort verschiedene Jobs gemacht.',
        'text2' => 'Sieben Jahre war ich beim WDR, als Autorin und Reporterin für die Lokalzeit, WDR aktuell und das YouTube-Format MordOrte. 2025 habe ich mich bewusst noch einmal für ein Volontariat entschieden, bei Radio Bremen. Seitdem habe ich in Genf, im ARD-Hauptstadtstudio, beim Y-Kollektiv und im ARD-Studio Istanbul gearbeitet. Ab November 2026 recherchiere ich im Investigativ-Bereich von Radio Bremen.',
    ]);
    $set('contact', [
        'email' => '', 'photo_credit' => '', 'photo_credit_url' => '',
    ]);
    $set('legal', legal_defaults());


    $add('social', [['label' => 'LinkedIn', 'url' => 'https://www.linkedin.com/in/antonia-r%C3%BCller-85836320a/', 'published' => true]]);
    $add('nav', [
        ['label' => 'Arbeiten', 'anchor' => 'arbeiten', 'desktop' => true], ['label' => 'Podcast', 'anchor' => 'podcast', 'desktop' => false],
        ['label' => 'Über mich', 'anchor' => 'ueber', 'desktop' => true], ['label' => 'Lebenslauf', 'anchor' => 'lebenslauf', 'desktop' => true],
        ['label' => 'Off the record', 'anchor' => 'offtherecord', 'desktop' => false], ['label' => 'Kontakt', 'anchor' => 'kontakt', 'desktop' => true],
    ]);
    $add('questions', [
        ['number' => '01', 'text' => 'Wie verändern *politische Umbrüche* das Leben von Menschen?'],
        ['number' => '02', 'text' => 'Wer hat **Macht** — und wer kämpft um *Selbstbestimmung*?'],
    ]);
    $add('tracks', [
        ['code' => 'V1', 'label' => 'Video / TV', 'icon' => 'video', 'bg' => '#0b3f44', 'fg' => '#f3ecdf'],
        ['code' => 'T1', 'label' => 'Online', 'icon' => 'text', 'bg' => '#172526', 'fg' => '#f3ecdf'],
        ['code' => 'T2', 'label' => 'Magazin', 'icon' => 'text', 'bg' => '#c9deda', 'fg' => '#172526'],
        ['code' => 'A1', 'label' => 'Radio', 'icon' => 'radio', 'bg' => '#0e5c62', 'fg' => '#fbf6ee'],
        ['code' => 'P1', 'label' => 'Podcast', 'icon' => 'podcast', 'bg' => '#e8ddcb', 'fg' => '#172526'],
    ]);

    // Referenzen: Datum aus der alten Position der Zeitleiste zurückgerechnet (2024-01-01 bis 2026-12-31)
    $t0 = strtotime('2024-01-01');
    $span = strtotime('2026-12-31') - $t0;
    $d = fn(float $pos) => date('Y-m-d', (int)($t0 + $span * $pos / 100));
    $clip = fn(array $c) => $c + ['published' => true, 'new_tab' => str_starts_with($c['url'], 'http'), 'link_text' => $c['link_text'] ?? 'Zum Beitrag'];
    $add('clips', array_map($clip, [
        ['title' => 'Was kostet ein bisschen Sicherheit?', 'short' => 'Istanbul', 'outlet' => 'ARD-Studio Istanbul', 'format' => 'Radio', 'date' => $d(75), 'date_label' => '2026', 'role' => 'Autorin', 'desc' => 'Radiobeitrag über Wohnkosten und Erdbebensicherheit in Istanbul, ausgehend vom Einsturz in Maltepe.', 'medium' => 'radio', 'tl_track' => 'A1', 'tl_end' => $d(82), 'url' => '#arbeiten', 'link_text' => '[Link einfügen]'],
        ['title' => 'Solomütter', 'short' => 'Solomütter', 'outlet' => 'Y-Kollektiv Podcast', 'format' => 'Podcast', 'date' => $d(80), 'date_label' => '[Datum]', 'role' => 'Autorin', 'desc' => 'Podcastfolge über Samenspende und Solomutterschaft – mit zwei Frauen, die diesen Weg gegangen sind.', 'medium' => 'podcast', 'tl_track' => 'P1', 'tl_end' => $d(88), 'url' => '#arbeiten', 'link_text' => '[Link, sobald veröffentlicht]'],
        ['title' => '[Titel]', 'short' => 'Außenpolitik Iran', 'outlet' => 'ARD-Hauptstadtstudio', 'format' => 'Radio', 'date' => $d(86), 'date_label' => '2026', 'role' => 'Autorin', 'desc' => 'Radiobeitrag zur deutschen Außenpolitik mit Bezug zum Iran.', 'medium' => 'radio', 'tl_track' => 'A1', 'tl_end' => $d(93), 'url' => '#arbeiten', 'link_text' => '[Link einfügen]'],
        ['title' => 'Toter im Wald: Radtrikot führt Ermittler aus Österreich nach Bremen', 'short' => 'Cold Case', 'outlet' => 'buten un binnen', 'format' => 'Online · Cold Case', 'date' => '2026-08-15', 'role' => 'Autorin', 'desc' => 'Ein unbekannter Toter, ein auffälliges Trikot – und die Frage, wer dieser Mann war.', 'medium' => 'text', 'tl_track' => 'T1', 'url' => 'https://www.butenunbinnen.de/toter-oesterreich-bremen-cold-case-radtrikot-100.html'],
        ['title' => 'Mehr als 300 Kilometer pendeln für einen Arzttermin?', 'short' => 'Pendeln', 'outlet' => 'buten un binnen', 'format' => 'Video · Selbstversuch', 'date' => '2026-03-10', 'role' => 'Reporterin', 'desc' => 'Selbstversuch: monatelang kein Hausarzt in Bremen – für den Facharzt geht es mit dem Zug zurück.', 'medium' => 'video', 'tl_track' => 'V1', 'url' => 'https://www.butenunbinnen.de/videos/fach-arzt-suche-bremen-100.html', 'featured' => true, 'headline' => 'Mehr als ==300== Kilometer *pendeln* für einen Arzttermin?'],
        ['title' => '8 Monate verzweifelte Suche: So zeigt sich der Ärztemangel in Bremen', 'short' => 'Ärztemangel', 'outlet' => 'buten un binnen', 'format' => 'Online', 'date' => '2026-03-12', 'role' => 'Autorin', 'desc' => 'Wie der Ärztemangel in Bremen Patientinnen und Patienten trifft.', 'medium' => 'text', 'tl_track' => 'T1', 'url' => 'https://www.butenunbinnen.de/nachrichten/aerzteversorgung-bremen-102.html'],
        ['title' => 'Cybermobbing: EU plant schärfere Regeln', 'short' => 'Cybermobbing', 'outlet' => 'Good News Magazin', 'format' => 'Online · Politik', 'date' => '2026-02-05', 'role' => 'Autorin', 'desc' => 'Was die EU gegen Cybermobbing plant.', 'medium' => 'text', 'tl_track' => 'T2', 'url' => 'https://goodnews-magazin.de/cybermobbing-eu-plant-neue-gesetze/'],
        ['title' => 'Klimaklagen zwingen Politik und Konzerne zum Handeln', 'short' => 'Klimaklagen', 'outlet' => 'Good News Magazin', 'format' => 'Online · Klima', 'date' => '2026-01-10', 'role' => 'Autorin', 'desc' => 'Wie Klimaklagen vor Gericht immer häufiger Erfolg haben.', 'medium' => 'text', 'tl_track' => 'T2', 'url' => 'https://goodnews-magazin.de/klima-klagen-gericht-werden-erfolgreicher/'],
        ['title' => 'Regen, Schimmel, Pilze: Bremer Mieter protestieren gegen LEG-Konzern', 'short' => 'LEG-Mieter', 'outlet' => 'buten un binnen', 'format' => 'Online', 'date' => '2025-12-08', 'role' => 'Autorin', 'desc' => 'Mieterinnen und Mieter wehren sich gegen Mängel in ihren Wohnungen.', 'medium' => 'text', 'tl_track' => 'T1', 'url' => 'https://www.butenunbinnen.de/nachrichten/leg-mieter-maengel-bremen-wasser-100.html'],
        ['title' => '[Titel]', 'short' => 'MordOrte', 'outlet' => 'WDR Lokalzeit · MordOrte', 'format' => 'Film · YouTube', 'date' => '2024-02-20', 'date_label' => '2024–2025', 'role' => 'Autorin', 'desc' => '20-minütiger Film für das YouTube-Format MordOrte.', 'medium' => 'video', 'tl_track' => 'V1', 'url' => '#arbeiten', 'link_text' => '[Link einfügen]'],
        ['title' => '[Titel]', 'short' => 'Lokalzeit', 'outlet' => 'WDR Lokalzeit', 'format' => 'TV', 'date' => '', 'date_label' => '[Jahr]', 'role' => 'Autorin & Reporterin', 'desc' => '[Ein Satz zum Inhalt]', 'medium' => 'video', 'tl_track' => '', 'url' => '#arbeiten', 'link_text' => '[Link einfügen]'],
    ]));

    $add('episodes', [
        ['show' => '[Podcast-Name]', 'number' => '[№]', 'title' => '[Titel der Folge]', 'duration' => '[Dauer]', 'outlet' => '[Sender / Plattform]', 'spotify' => '', 'apple' => '', 'audiothek' => '', 'published' => true],
    ]);
    // Logos der Stationen (freigestellte WebP) in die Mediathek legen
    $logoOf = [];
    foreach (glob(AR_ROOT . '/seed-assets/logos/*.webp') ?: [] as $lf) {
        if (@copy($lf, "$up/" . basename($lf))) {
            $logoOf[basename($lf, '.webp')] = basename($lf);
        }
    }
    $lg = fn(string $k) => $logoOf[$k] ?? '';
    $add('cv', [
        ['org' => 'Radio Bremen', 'logo' => $lg('logo-radio-bremen'), 'role' => 'Investigativ-Recherche', 'from' => '2026-11', 'ongoing' => true, 'desk' => 'Radio'],
        ['org' => 'ARD-Studio Istanbul', 'logo' => $lg('logo-ard'), 'role' => 'Autorin', 'from' => '2026-01', 'when_label' => '2026', 'desk' => 'Radio'],
        ['org' => 'ARD-Hauptstadtstudio', 'logo' => $lg('logo-ard-hauptstadtstudio'), 'role' => 'Autorin', 'from' => '2026-01', 'when_label' => '2026', 'desk' => 'Radio'],
        ['org' => 'Good News Magazin', 'logo' => $lg('logo-good-news'), 'role' => 'Autorin', 'from' => '2026-01', 'ongoing' => true, 'desk' => 'Online'],
        ['org' => 'Radio Bremen / buten un binnen', 'logo' => $lg('logo-radio-bremen'), 'role' => 'Volontärin', 'from' => '2025-01', 'ongoing' => true, 'desk' => 'Radio'],
        ['org' => 'Y-Kollektiv Podcast', 'logo' => $lg('logo-y-kollektiv'), 'role' => 'Autorin', 'from' => '2025-01', 'when_label' => '2025', 'desk' => 'Podcast'],
        ['org' => 'SRF Genf', 'role' => 'Station', 'from' => '2025-01', 'when_label' => '2025'],
        ['org' => 'WELT', 'logo' => $lg('logo-welt'), 'role' => 'Online-Autorin', 'from' => '2021-02', 'to' => '2021-09', 'desk' => 'Online'],
        ['org' => 'WDR', 'logo' => $lg('logo-wdr'), 'role' => 'Autorin', 'from' => '2019-06', 'ongoing' => true, 'desk' => 'TV'],
        ['org' => 'ZDF heute-show · Prime Productions', 'logo' => $lg('logo-heute-show'), 'role' => '[Rolle]', 'from' => '2019-04', 'to' => '2019-05', 'desk' => 'TV'],
        ['org' => 'ARD', 'logo' => $lg('logo-ard'), 'role' => 'Übersetzerin', 'from' => '2019-01', 'when_label' => '2019'],
        ['org' => 'WDR', 'logo' => $lg('logo-wdr'), 'role' => 'Autorin & Reporterin', 'from' => '2018-01', 'when_label' => 'rund 7 Jahre · Lokalzeit, WDR aktuell, MordOrte', 'desk' => 'TV'],
        ['org' => 'WDR', 'logo' => $lg('logo-wdr'), 'role' => 'Producerin', 'from' => '2018-01', 'ongoing' => true, 'desk' => 'TV'],
        ['org' => 'ARD-Studio Istanbul', 'logo' => $lg('logo-ard'), 'role' => '[Rolle]', 'from' => '2017-06', 'to' => '2017-08', 'desk' => 'Radio'],
        ['org' => 'WDR', 'logo' => $lg('logo-wdr'), 'role' => 'Werkstudentin', 'from' => '2016-06', 'to' => '2018-06', 'desk' => 'TV'],
        ['org' => 'Radio Bochum 98.5', 'logo' => $lg('logo-radio-bochum'), 'role' => '[Rolle]', 'from' => '2016-07', 'to' => '2019-05', 'desk' => 'Radio'],
        ['org' => 'funk', 'logo' => $lg('logo-funk'), 'role' => 'Freie Mitarbeiterin', 'from' => '2015-01', 'to' => '2016-04', 'desk' => 'Online'],
    ]);
    $add('before', [
        ['text' => 'Studium, *TU Dortmund*', 'side' => '[Studiengang · Jahre]'],
        ['text' => 'Zwei Jahre *Frankreich*', 'side' => 'nach der Schule · verschiedene Jobs'],
        ['text' => 'Aufgewachsen in *Essen*', 'side' => 'Klassisches Ballett, Prüfungen in London'],
    ]);
    $add('crossmedia', [
        ['icon' => 'text', 'label' => 'Text', 'outlets' => 'buten un binnen · WELT · Good News'],
        ['icon' => 'video', 'label' => 'Video', 'outlets' => 'WDR Lokalzeit · WDR aktuell · buten un binnen'],
        ['icon' => 'radio', 'label' => 'Radio', 'outlets' => 'ARD-Studio Istanbul · ARD-Hauptstadtstudio'],
        ['icon' => 'podcast', 'label' => 'Podcast', 'outlets' => 'Y-Kollektiv Podcast'],
        ['icon' => 'social', 'label' => 'YouTube', 'outlets' => 'MordOrte · WDR'],
    ]);
    $add('languages', [['name' => 'Deutsch'], ['name' => 'Englisch'], ['name' => 'Französisch'], ['name' => 'Türkisch', 'note' => '(im Aufbau)']]);
    $add('offrecord', [
        ['question' => 'Lieblingsrecherche', 'answer' => '[Antwort: die Recherche, an die sie am liebsten zurückdenkt]'],
        ['question' => 'Die Geschichte, die ich noch erzählen will', 'answer' => '[Antwort: ein Thema, das ihr keine Ruhe lässt]'],
        ['question' => 'Bestes Interview', 'answer' => '[Antwort: wer, wo — und warum es hängen blieb]'],
        ['question' => 'Wenn ich nicht recherchiere', 'answer' => '[Antwort: Hobby, Ort, Ritual]'],
        ['question' => 'Mein Podcast-Tipp', 'answer' => '[Antwort: der Podcast, den sie allen empfiehlt]'],
        ['question' => 'Wo ich als Nächstes recherchieren will', 'answer' => '[Antwort: Ort oder Thema]'],
    ]);
}
