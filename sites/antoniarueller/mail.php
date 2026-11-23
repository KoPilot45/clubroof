<?php
// Liefert die Kontakt-Adresse erst auf Anfrage (Klick), damit sie nicht im Seitenquelltext steht.
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(500);
    exit;
}
require __DIR__ . '/lib/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
header('X-Content-Type-Options: nosniff');
$site = (string)($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'fetch' || !in_array($site, ['same-origin', 'none'], true)) {
    http_response_code(403);
    echo '{}';
    exit;
}
$bucket = 'mailreq:' . hmac(client_ip());
if (throttle_count($bucket, 3600) >= 30) {
    http_response_code(429);
    echo '{}';
    exit;
}
throttle_hit($bucket);
$email = trim((string)setting('contact')['email']);
echo json_encode(str_contains($email, '@') ? ['m' => $email] : new stdClass(), JSON_UNESCAPED_UNICODE);
