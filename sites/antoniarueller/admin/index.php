<?php
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(500);
    echo "Diese Verwaltung braucht PHP 8.1 oder neuer (hier: " . PHP_VERSION . ").";
    exit;
}
require __DIR__ . '/app.php';
