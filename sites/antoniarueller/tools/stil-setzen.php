<?php
// Stile für Entwicklung und Vorschaubilder setzen: php tools/stil-setzen.php bereich=stil ...   (ohne Argumente: alle „aktuell“)
$root = dirname(__DIR__);
$cfg = require $root . '/config.php';
require $root . '/lib/bootstrap.php';
$d = [];
foreach (array_slice($argv, 1) as $a) {
    [$k, $v] = array_pad(explode('=', $a, 2), 2, '');
    $d['st_' . $k] = $v;
}
$has = q('SELECT 1 FROM ar_settings WHERE grp = ?', ['stile'])->fetchColumn();
if ($has) {
    q('UPDATE ar_settings SET data = ?, draft = NULL WHERE grp = ?', [json_encode($d), 'stile']);
} else {
    q('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)', ['stile', json_encode($d), time(), 'werkzeug']);
}
reset_content_cache();
foreach (glob($root . '/data/cache/*') ?: [] as $f) {
    @unlink($f);
}
echo "ok\n";
