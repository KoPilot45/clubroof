<?php
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(404);
    echo 'Seite nicht gefunden.';
    exit;
}
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/render.php';
http_response_code(404);
if (($_SERVER['REDIRECT_STATUS'] ?? '') === '404') {
    require_once __DIR__ . '/lib/stats.php';
    stats_log_404((string)($_SERVER['REDIRECT_URL'] ?? $_SERVER['REQUEST_URI'] ?? '/'), (string)($_SERVER['HTTP_REFERER'] ?? ''));
}
security_headers();
header('X-Robots-Tag: noindex');
$site = setting('site');
$seo = setting('seo');
$legalTitle = 'Seite nicht gefunden';
$legalBody = '<p>Diese Seite gibt es nicht (mehr).</p><p><a href="' . e(AR_BASE) . '/">Zur Startseite</a></p>';
require __DIR__ . '/templates/legal.php';
