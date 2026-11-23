<?php
// Diagnose-Seite. Nach der Fehlersuche LÖSCHEN. Zeigt keine Passwörter an.
ini_set('display_errors', '1');
error_reporting(E_ALL);
header('Content-Type: text/plain; charset=utf-8');
echo "DIAGNOSE antoniarueller.de\n==========================\n\n";
echo "PHP-Version:   " . PHP_VERSION . (version_compare(PHP_VERSION, '8.1.0', '>=') ? "  (OK)" : "  (ZU ALT - mind. 8.1 nötig)") . "\n";
echo "Server:        " . (isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : '?') . "\n";
echo "Ordner:        " . __DIR__ . "\n";
echo "HTTPS erkannt: " . ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'ja' : 'nein') . "  | X-Forwarded-Proto: " . (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) ? $_SERVER['HTTP_X_FORWARDED_PROTO'] : '-') . "\n";
echo "Erweiterungen: ";
foreach (array('pdo', 'pdo_mysql', 'pdo_sqlite', 'mbstring', 'gd', 'openssl', 'fileinfo') as $x) {
    echo $x . '=' . (extension_loaded($x) ? 'ja' : 'NEIN') . ' ';
}
echo "\n\nDateien:\n";
foreach (array('index.php', '.htaccess', 'config.php', 'lib/page.php', 'lib/bootstrap.php', 'lib/schema.php', 'lib/seed.php', 'templates/page.php', 'assets/site.css', 'assets/fonts.css', 'admin/index.php', 'admin/app.php', 'seed-assets/antonia-hero.webp') as $f) {
    echo '  ' . str_pad($f, 34) . (is_file(__DIR__ . '/' . $f) ? 'vorhanden' : 'FEHLT') . "\n";
}
echo "\nSchreibrechte:\n";
foreach (array('data', 'uploads', '.') as $d) {
    echo '  ' . str_pad($d, 10) . (is_writable(__DIR__ . '/' . $d) ? 'beschreibbar' : 'NICHT beschreibbar') . "\n";
}

echo "\nKonfiguration und Datenbank:\n";
if (!is_file(__DIR__ . '/config.php')) {
    echo "  config.php fehlt.\n";
} else {
    try {
        $c = require __DIR__ . '/config.php';
        $db = $c['db'];
        echo '  Treiber: ' . $db['driver'] . '  Host: ' . $db['host'] . '  DB: ' . $db['name'] . '  Benutzer: ' . $db['user'] . "\n";
        if ($db['driver'] === 'mysql') {
            $pdo = new PDO('mysql:host=' . $db['host'] . ';dbname=' . $db['name'] . ';charset=utf8mb4', $db['user'], $db['pass'], array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
            echo "  Verbindung: OK\n  Tabellen: ";
            foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_NUM) as $t) {
                echo $t[0] . ' ';
            }
            echo "\n";
        }
    } catch (Throwable $e) {
        echo '  FEHLER: ' . $e->getMessage() . "\n";
    }
}

echo "\nProgramm laden (Testlauf):\n";
if (version_compare(PHP_VERSION, '8.1.0', '>=')) {
    try {
        $_SERVER['SCRIPT_NAME'] = '/index.php';
        require __DIR__ . '/lib/bootstrap.php';
        require __DIR__ . '/lib/render.php';
        $n = count(items('clips'));
        echo "  OK - Datenbank erreichbar, $n Referenzen gefunden.\n";
    } catch (Throwable $e) {
        echo '  FEHLER: ' . get_class($e) . ': ' . $e->getMessage() . "\n  in " . $e->getFile() . ':' . $e->getLine() . "\n";
    }
}
echo "\n(Ende. Diese Datei danach löschen.)\n";
