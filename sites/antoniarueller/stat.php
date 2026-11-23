<?php
// Nimmt anonyme Ereigniszähler entgegen (Klicks, erreichte Abschnitte). Antwortet immer mit 204.
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    http_response_code(204);
    exit;
}
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/stats.php';
stats_event();
