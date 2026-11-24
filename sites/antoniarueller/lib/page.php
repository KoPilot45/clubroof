<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/render.php';

security_headers();

if (defined('AR_PREVIEW')) {
    require_once __DIR__ . '/auth.php';
    if (!current_user()) {
        header('Location: ' . AR_BASE . '/admin/');
        exit;
    }
    preview_mode(true);
    security_headers(false, true);
    header('Cache-Control: no-store');
}

function emit_html(string $html, bool $noindex): never
{
    if (defined('AR_PREVIEW')) {
        $banner = '<div style="background:#f2b705;color:#172526;padding:10px 16px;font:600 14px system-ui,sans-serif;text-align:center">Vorschau mit allen Entwürfen – Besucher sehen das noch nicht. <a href="' . e(AR_BASE) . '/admin/" style="color:#172526">Zurück zur Verwaltung</a></div>';
        $html = preg_replace('~<body([^>]*)>~', '<body$1>' . $banner, $html, 1);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex, nofollow');
        echo $html;
        exit;
    }
    global $cacheKey;
    require_once __DIR__ . '/stats.php';
    stats_hit((string)($cacheKey ?? 'home'));
    $etag = '"' . md5($html) . '"';
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('ETag: ' . $etag);
    if ($noindex) {
        header('X-Robots-Tag: noindex, nofollow');
    }
    if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304);
        exit;
    }
    echo $html;
    exit;
}

function send_html(string $html, bool $noindex = false, ?string $cacheKey = null): never
{
    if ($cacheKey !== null && !defined('AR_PREVIEW') && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        write_page_cache($cacheKey, $html, $noindex);
    }
    emit_html($html, $noindex);
}

// Zwischenspeicher: Besucher belasten die Datenbank nicht (wird bei jeder Änderung im Admin geleert)
$page = (string)($_GET['seite'] ?? '');
$cacheKey = (in_array($page, ['impressum', 'datenschutz'], true) ? $page : 'home') . (current_lang() === 'en' ? '-en' : '');
if (!defined('AR_PREVIEW') && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $hit = read_page_cache($cacheKey);
    if ($hit) {
        emit_html($hit[1], $hit[0]);
    }
}

$site = setting('site');
$seo = setting('seo');
$hero = setting('hero');
$sec = setting('sections');
// Beschriftungen, die nie leer sein dürfen (Abschnittsnamen, Links der Fußzeile …): leer = Standardtext
foreach (['sections' => &$sec, 'site' => &$site] as $grp => &$vals) {
    foreach (schema()['groups'][$grp]['fields'] as $fd) {
        if (!empty($fd['dict']) && trim((string)($vals[$fd['key']] ?? '')) === '') {
            $vals[$fd['key']] = $fd['default'] ?? '';
        }
    }
}
unset($vals);
$about = setting('about');
$contact = setting('contact');
$tl = setting('timeline');

// Rechtliche Seiten
if ($page === 'impressum' || $page === 'datenschutz') {
    $legal = setting('legal');
    $legalTitle = tr($page === 'impressum' ? 'Impressum' : 'Datenschutz');
    $legalBody = legal_html((string)$legal[$page]);
    ob_start();
    require dirname(__DIR__) . '/templates/legal.php';
    send_html((string)ob_get_clean(), (bool)$seo['noindex'], $cacheKey);
}

$nav = items('nav');
$questions = items('questions');
$tracks = items('tracks');
$episodes = array_values(array_filter(items('episodes'), fn($e) => $e['published']));
$stations = array_values(array_filter(items('stations'), fn($s) => $s['published']));
$cvRows = items('cv');
$before = items('before');
$cross = items('crossmedia');
$langs = items('languages');
$off = items('offrecord');
$social = array_values(array_filter(array_map(function ($x) {
    $x['url'] = safe_url($x['url']);
    return $x;
}, items('social')), fn($x) => $x['published'] && $x['url'] !== ''));

// Referenzen
$clips = array_values(array_filter(items('clips'), fn($c) => $c['published']));
$clipsById = [];
$years = [];
$trackByCode = [];
foreach ($tracks as $t) {
    $trackByCode[$t['code']] = $t;
}
foreach ($clips as $i => $c) {
    // Kategorie → Symbol/Medium und Bezeichnung
    $tk = $trackByCode[$c['tl_track']] ?? null;
    $c['medium'] = $tk['icon'] ?? 'text';
    $c['_cat'] = $tk['label'] ?? '';
    // Beitrag selbst gehostet: Bilder (Lightbox) oder PDF (neuer Tab)
    $c['gallery'] = array_values(array_filter((array)$c['gallery'], fn($g) => !str_ends_with((string)($g['f'] ?? ''), '.pdf')));
    $c['_hosted'] = $c['link_mode'] === 'hosted' && $c['hosted_kind'] !== 'pdf' && $c['gallery'];
    $c['_pdf'] = $c['link_mode'] === 'hosted' && $c['hosted_kind'] === 'pdf' ? upload_url((string)$c['pdf_file']) : '';
    $c['_href'] = $c['link_mode'] === 'hosted' ? $c['_pdf'] : safe_url($c['url']);
    $c['_blank'] = $c['_pdf'] !== '' || $c['new_tab'];
    $c['_cta'] = $c['link_mode'] === 'hosted' ? ($c['gallery_text'] ?: 'Beitrag ansehen') : ($c['link_text'] ?: 'Zum Beitrag');
    $c['_no'] = sprintf('%02d', $i + 1);
    $c['_date'] = clip_date_label($c);
    if ($c['date'] !== '') {
        $years[] = (int)substr($c['date'], 0, 4);
    }
    $clips[$i] = $c;
    $clipsById[$c['_id']] = $c;
}
$timeline = build_timeline($clips, $tracks);
$yearSpan = $years ? (min($years) === max($years) ? (string)min($years) : min($years) . ' — ' . max($years)) : '';
$featured = null;
foreach ($clips as $c) {
    if ($c['featured']) {
        $featured = $c;
        break;
    }
}

$cvGroups = cv_groups($cvRows);
// Abschnitte ein-/ausblenden: Menüpunkte ausgeblendeter Abschnitte entfallen
$showSt = $stations && $sec['on_stations'];
$showCv = $cvGroups && $sec['on_cv'];
$vis = [
    'arbeiten' => $featured !== null || ($clips && $sec['on_show']), 'podcast' => $episodes && $sec['on_podcast'], 'ueber' => (bool)$sec['on_about'],
    'lebenslauf' => $showSt || $showCv, 'offtherecord' => $off && $sec['on_off'], 'kontakt' => (bool)$sec['on_contact'],
];
$nav = array_values(array_filter($nav, fn($n) => $vis[$n['anchor']] ?? true));
$cvYears = array_filter(array_map('strval', array_keys($cvGroups)), 'ctype_digit');
$cvMin = $cvYears ? min($cvYears) : '';

$jsonld = $seo['jsonld'] ? build_jsonld($seo, $hero, array_column($social, 'url'), $langs, $clips) : '';

$hasMail = str_contains((string)$contact['email'], '@');

ob_start();
require dirname(__DIR__) . '/templates/page.php';
send_html((string)ob_get_clean(), (bool)$seo['noindex'], $cacheKey);
