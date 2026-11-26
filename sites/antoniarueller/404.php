<?php
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(404);
    echo 'Seite nicht gefunden.';
    exit;
}
if (preg_match('~^/en(/|$)~', (string)parse_url((string)($_SERVER['REDIRECT_URL'] ?? $_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH))) {
    define('AR_LANG', 'en');
}
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/render.php';
http_response_code(404);
if (($_SERVER['REDIRECT_STATUS'] ?? '') === '404') {
    require_once __DIR__ . '/lib/stats.php';
    // ursprünglich aufgerufene Adresse: je nach Server steht sie in einer der Variablen (REQUEST_URI zeigt dort manchmal auf 404.php selbst)
    $orig = '';
    foreach (['REDIRECT_URL', 'REDIRECT_REQUEST_URI', 'REDIRECT_SCRIPT_URL', 'REQUEST_URI'] as $k) {
        $v = (string)parse_url((string)($_SERVER[$k] ?? ''), PHP_URL_PATH);
        if ($v !== '' && !preg_match('~/404\.php$~', $v)) {
            $orig = $v;
            break;
        }
    }
    if ($orig !== '') {
        stats_log_404($orig, (string)($_SERVER['HTTP_REFERER'] ?? ''));
    }
}
security_headers();
header('X-Robots-Tag: noindex');
$site = setting('site');
$seo = setting('seo');
$legalTitle = tr('Seite nicht gefunden');
$legalBody = '';
$isNotFound = true;
require __DIR__ . '/templates/legal.php';
