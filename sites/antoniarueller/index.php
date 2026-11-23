<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/render.php';

security_headers();

function send_html(string $html): never
{
    $etag = '"' . md5($html) . '"';
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('ETag: ' . $etag);
    if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304);
        exit;
    }
    echo $html;
    exit;
}

$site = setting('site');
$hero = setting('hero');
$sec = setting('sections');
$about = setting('about');
$contact = setting('contact');
$tl = setting('timeline');

// Rechtliche Seiten
$page = (string)($_GET['seite'] ?? '');
if ($page === 'impressum' || $page === 'datenschutz') {
    $legal = setting('legal');
    $legalTitle = $page === 'impressum' ? 'Impressum' : 'Datenschutz';
    $legalBody = legal_html((string)$legal[$page]);
    ob_start();
    require __DIR__ . '/templates/legal.php';
    send_html((string)ob_get_clean());
}

$nav = items('nav');
$marquee = items('marquee');
$questions = items('questions');
$tracks = items('tracks');
$episodes = array_values(array_filter(items('episodes'), fn($e) => $e['published']));
$stations = items('stations');
$cvRows = items('cv');
$before = items('before');
$cross = items('crossmedia');
$langs = items('languages');
$off = items('offrecord');

// Referenzen
$clips = array_values(array_filter(items('clips'), fn($c) => $c['published']));
$clipsById = [];
$clipJson = [];
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
$timeline = build_timeline($clips, $tracks, $tl);
foreach ($clips as $c) {
    $clipJson[(string)$c['_id']] = [
        'no' => $c['_no'], 'tc' => $c['_tc'], 'title' => $c['title'], 'desc' => $c['desc'], 'outlet' => $c['outlet'],
        'format' => $c['format'], 'date' => $c['_date'], 'role' => $c['role'], 'link_text' => $c['link_text'],
        'url' => safe_url($c['url']) ?: '#arbeiten', 'new_tab' => (bool)$c['new_tab'], 'medium' => $c['medium'],
        'pos' => round($timeline['pos'][$c['_id']] ?? 0, 2),
    ];
}
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

$mailUser = $mailDomain = '';
if (str_contains($contact['email'], '@')) {
    [$mailUser, $mailDomain] = explode('@', $contact['email'], 2);
}

ob_start();
require __DIR__ . '/templates/page.php';
send_html((string)ob_get_clean());
