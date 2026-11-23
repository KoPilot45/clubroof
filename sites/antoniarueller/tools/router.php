<?php
// Nur für lokale Entwicklung: php -S 127.0.0.1:8080 -t . tools/router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = dirname(__DIR__);
if (preg_match('~^/(impressum|datenschutz)/?$~', $path, $m)) { $_GET['seite'] = $m[1]; require $root . '/index.php'; return true; }
if (preg_match('~^/(robots\.txt|sitemap\.xml|llms\.txt)$~', $path, $m)) { require $root . '/' . ['robots.txt' => 'robots', 'sitemap.xml' => 'sitemap', 'llms.txt' => 'llms'][$m[1]] . '.php'; return true; }
if (preg_match('~^/(lib|data|templates|tools|seed-assets)/|^/config~', $path)) { http_response_code(403); echo 'Gesperrt'; return true; }
if ($path !== '/' && is_file($root . $path)) { return false; }
if (is_dir($root . $path) && is_file($root . rtrim($path, '/') . '/index.php')) { chdir($root . rtrim($path, '/')); $_SERVER['SCRIPT_NAME'] = rtrim($path, '/') . '/index.php'; require $root . rtrim($path, '/') . '/index.php'; return true; }
require $root . '/index.php'; return true;
