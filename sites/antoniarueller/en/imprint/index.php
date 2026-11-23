<?php
define('AR_LANG', 'en');
$_SERVER['SCRIPT_NAME'] = rtrim(dirname(dirname(dirname($_SERVER['SCRIPT_NAME']))), '/') . '/index.php';
$_GET['seite'] = 'impressum';
require dirname(__DIR__, 2) . '/index.php';
