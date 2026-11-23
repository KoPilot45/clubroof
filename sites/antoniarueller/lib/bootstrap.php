<?php
declare(strict_types=1);

if (defined('AR_ROOT')) {
    return;
}
define('AR_ROOT', dirname(__DIR__));
mb_internal_encoding('UTF-8');
date_default_timezone_set('Europe/Berlin');
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Basispfad (falls die Seite in einem Unterordner liegt)
(function () {
    $dir = dirname($_SERVER['SCRIPT_NAME'] ?? '/');
    if (basename($dir) === 'admin') {
        $dir = dirname($dir);
    }
    define('AR_BASE', rtrim(str_replace('\\', '/', $dir), '/'));
})();

function fatal(string $msg, int $code = 500): never
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $msg;
    exit;
}

function cfg(?string $key = null, mixed $default = null): mixed
{
    static $c = null;
    if ($c === null) {
        $file = AR_ROOT . '/config.php';
        if (!is_file($file)) {
            $sample = @file_get_contents(AR_ROOT . '/config.sample.php');
            if ($sample === false) {
                fatal('config.sample.php fehlt.');
            }
            $sample = str_replace(
                ['__SECRET__', '__DBFILE__'],
                [bin2hex(random_bytes(32)), 'ar_' . bin2hex(random_bytes(8)) . '.sqlite'],
                $sample
            );
            if (@file_put_contents($file, $sample, LOCK_EX) === false) {
                fatal('config.php konnte nicht angelegt werden. Bitte config.sample.php als config.php kopieren und Schreibrechte für den Ordner prüfen.');
            }
            @chmod($file, 0640);
        }
        $c = require $file;
    }
    if ($key === null) {
        return $c;
    }
    $v = $c;
    foreach (explode('.', $key) as $part) {
        if (!is_array($v) || !array_key_exists($part, $v)) {
            return $default;
        }
        $v = $v[$part];
    }
    return $v;
}

function e(mixed $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function hmac(string $s): string
{
    return hash_hmac('sha256', $s, (string)cfg('secret'));
}

function client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/** Nur http(s), mailto, Anker und relative Links zulassen. */
function safe_url(string $u): string
{
    $u = trim($u);
    if ($u === '') {
        return '';
    }
    if (preg_match('~^(https?://|mailto:|#|/)~i', $u)) {
        return preg_match('~[\x00-\x1f\s]~', $u) ? str_replace(' ', '%20', preg_replace('~[\x00-\x1f]~', '', $u)) : $u;
    }
    if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $u)) {
        return '';
    }
    return 'https://' . $u;
}

function upload_url(string $name): string
{
    return preg_match('~^[a-z0-9_-]+\.(jpg|png|webp|pdf)$~', $name) ? AR_BASE . '/uploads/' . $name : '';
}

function security_headers(bool $admin = false): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    if (is_https()) {
        header('Strict-Transport-Security: max-age=31536000');
    }
    if ($admin) {
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex, nofollow');
    }
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';
require_once __DIR__ . '/content.php';
