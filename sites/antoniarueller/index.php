<?php
// Einstiegspunkt. Bewusst einfache Syntax, damit auch eine zu alte PHP-Version eine klare Meldung zeigt.
if (version_compare(PHP_VERSION, '8.1.0', '<')) {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(500);
    echo "Diese Seite braucht PHP 8.1 oder neuer (hier: " . PHP_VERSION . ").\nBitte im Ionos-Kundencenter unter Hosting > PHP-Version eine neuere Version wählen.";
    exit;
}
require __DIR__ . '/lib/page.php';
