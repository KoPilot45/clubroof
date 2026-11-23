<?php
// Eigener Ordner, damit /impressum/ ohne Rewrite-Regeln funktioniert.
$d = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
$_SERVER['SCRIPT_NAME'] = $d . '/index.php';
$_GET['seite'] = 'impressum';
require dirname(__DIR__) . '/index.php';
