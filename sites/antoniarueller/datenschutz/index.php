<?php
// Eigener Ordner, damit /datenschutz/ ohne Rewrite-Regeln funktioniert.
$d = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
$_SERVER['SCRIPT_NAME'] = $d . '/index.php';
$_GET['seite'] = 'datenschutz';
require dirname(__DIR__) . '/index.php';
