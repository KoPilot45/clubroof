<?php
// Zeitgesteuerte Sicherung (Ionos-Cronjob): legt eine Sicherung in data/backups/ ab. Aufruf: php cron.php  oder  /cron.php?key=… (Schlüssel im Admin unter „Sicherung“).
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    exit(1);
}
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/mail.php';
require __DIR__ . '/lib/backup.php';
require __DIR__ . '/lib/stats.php';
stats_cleanup();
$cli = PHP_SAPI === 'cli';
if (!$cli && !hash_equals(cron_key(), (string)($_GET['key'] ?? ''))) {
    http_response_code(403);
    exit('Nicht erlaubt');
}
header('Content-Type: text/plain; charset=utf-8');
echo backup_create('auto') ? "OK\n" : "FEHLER\n";
