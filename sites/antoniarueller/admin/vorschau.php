<?php
// Vorschau mit allen Entwürfen – nur für Angemeldete (Sitzung gilt nur im Ordner /admin/).
define('AR_PREVIEW', true);
if (($_GET['lang'] ?? '') === 'en') {
    define('AR_LANG', 'en');
}
require dirname(__DIR__) . '/index.php';
