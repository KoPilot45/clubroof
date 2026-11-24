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
$stations = items('stations');
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
foreach ($clips as $i => $c) {
    $c['_no'] = sprintf('%02d', $i + 1);
    $c['_tc'] = trim($c['tc']) !== '' ? $c['tc'] : auto_tc($i);
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
$cvYears = array_filter(array_map('strval', array_keys($cvGroups)), 'ctype_digit');
$cvMin = $cvYears ? min($cvYears) : '';

$jsonld = $seo['jsonld'] ? build_jsonld($seo, $hero, array_column($social, 'url'), $langs, $clips) : '';

$hasMail = str_contains((string)$contact['email'], '@');

ob_start();
require dirname(__DIR__) . '/templates/page.php';
send_html((string)ob_get_clean(), (bool)$seo['noindex'], $cacheKey);
