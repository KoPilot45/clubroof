<?php
declare(strict_types=1);

require_once __DIR__ . '/forms.php';
require_once __DIR__ . '/views2.php';
require_once __DIR__ . '/login_views.php';
require_once __DIR__ . '/stats_views.php';
require_once __DIR__ . '/ui.php';
require_once __DIR__ . '/translate.php';

function a(string $q = ''): string
{
    return AR_BASE . '/admin/' . ($q !== '' ? '?' . $q : '');
}

function admin_head(string $title, ?array $user = null): void
{
    ?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title) ?> – Verwaltung</title>
<link rel="icon" href="<?= AR_BASE ?>/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/fonts.css">
<link rel="stylesheet" href="<?= AR_BASE ?>/admin/admin.css?v=<?= @filemtime(__DIR__ . '/admin.css') ?>">
</head>
<body>
<?php
}

function admin_foot(): void
{
    echo '<script src="' . AR_BASE . '/admin/admin.js?v=' . @filemtime(__DIR__ . '/admin.js') . '" defer></script></body></html>';
}

function csrf_field(array $user): string
{
    return '<input type="hidden" name="_csrf" value="' . e($user['csrf']) . '">';
}

function layout_start(array $user, string $title, string $active = '', bool $wide = false): void
{
    admin_head($title, $user);
    $fl = $GLOBALS['flash'] ?? null;
    ?>
<a class="skip" href="#main">Zum Inhalt springen</a>
<div class="shell">
<aside class="side" id="side">
<a class="brand" href="<?= a() ?>"><span class="dot"></span><span class="brand-t">Verwaltung</span><small>antoniarueller.de</small></a>
<?php render_sidebar($user, $active); ?>
</aside>
<div class="main">
<header class="bar">
<button type="button" class="menu-btn" id="menuBtn" aria-label="Menü öffnen" aria-expanded="false" aria-controls="side"><?= aicon('menu', 22) ?></button>
<button type="button" class="gs-btn" id="gsBtn" aria-label="Suchen (Strg+K)"><?= aicon('search') ?><span>Suchen</span><kbd>Strg K</kbd></button>
<a class="view-site" href="<?= AR_BASE ?>/" target="_blank" rel="noopener"><?= aicon('external', 16) ?> Seite ansehen</a>
<a class="bar-help" href="<?= a('p=help') ?>" aria-label="Hilfe"><?= aicon('help', 20) ?></a>
<span class="who"><?= e($user['name'] ?: $user['email']) ?></span>
<form method="post" action="<?= a() ?>" class="inline"><?= csrf_field($user) ?><input type="hidden" name="action" value="logout"><button class="btn small ghost"><?= aicon('logout', 16) ?> <span class="lbl">Abmelden</span></button></form>
</header>
<main id="main"<?= $wide ? ' class="wide"' : '' ?>>
<?php if ($fl && $fl['type'] === 'err'): ?><div class="flash err" role="alert"><?= e($fl['msg']) ?></div><?php endif; ?>
<h1><?= e($title) ?></h1>
<?php
    if ($fl && $fl['type'] !== 'err') {
        echo '<div class="toast ok" role="status" id="toast"><span>' . aicon('check', 18) . e($fl['msg']) . '</span>';
        if (!empty($fl['undo'])) {
            echo '<form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="restore"><input type="hidden" name="ret" value="list"><input type="hidden" name="id" value="' . (int)$fl['undo'] . '"><button class="toast-undo">Rückgängig</button></form>';
        }
        echo '<button type="button" class="toast-x" aria-label="Schließen">×</button></div>';
    }
    render_search_box($user);
    echo '<nav class="tabbar" aria-label="Schnellzugriff"><a href="' . a() . '"' . ($active === 'home' ? ' class="on" aria-current="page"' : '') . '>' . aicon('home', 22) . '<span>Übersicht</span></a><a href="' . a('p=list&c=clips') . '"' . ($active === 'c:clips' ? ' class="on"' : '') . '>' . aicon('film', 22) . '<span>Referenzen</span></a><a href="' . a('p=stats') . '"' . ($active === 'stats' ? ' class="on"' : '') . '>' . aicon('chart', 22) . '<span>Statistik</span></a><button type="button" id="tabSearch">' . aicon('search', 22) . '<span>Suchen</span></button><button type="button" id="tabMenu">' . aicon('menu', 22) . '<span>Menü</span></button></nav>';
}

function layout_end(): void
{
    echo '</main></div></div>';
    admin_foot();
}

// ---------- Papierkorb ----------
function view_trash(array $user): void
{
    $s = schema();
    layout_start($user, 'Papierkorb', 'trash');
    $any = false;
    echo '<p class="lead">Entfernte Einträge liegen hier, bis du sie endgültig löschst. Wiederhergestellte Einträge erscheinen am Ende der jeweiligen Liste.</p>';
    foreach ($s['collections'] as $coll => $def) {
        $rows = items($coll, true);
        if (!$rows) {
            continue;
        }
        $any = true;
        echo '<h2 class="fs">' . e($def['label']) . '</h2><ul class="rows trash">';
        foreach ($rows as $r) {
            $title = trim((string)($r[$def['title']] ?? '')) ?: '(ohne Titel)';
            echo '<li class="row"><span class="r-main"><strong>' . e(mb_strimwidth($title, 0, 90, '…')) . '</strong><small>Entfernt am ' . e(date('d.m.Y H:i', (int)$r['_deleted'])) . ' Uhr</small></span><span class="r-act">';
            echo '<form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="restore"><input type="hidden" name="id" value="' . $r['_id'] . '"><button class="btn small">Wiederherstellen</button></form>';
            echo '<form method="post" action="' . a() . '" class="inline" data-confirm="„' . e($title) . '“ endgültig löschen? Das kann nicht rückgängig gemacht werden."><input type="hidden" name="action" value="purge">' . csrf_field($user) . '<input type="hidden" name="id" value="' . $r['_id'] . '"><button class="btn small danger">Endgültig löschen</button></form>';
            echo '</span></li>';
        }
        echo '</ul>';
    }
    if (!$any) {
        echo '<p class="empty">Der Papierkorb ist leer.</p>';
    } else {
        echo '<form method="post" action="' . a() . '" class="inline" data-confirm="Alle Einträge im Papierkorb endgültig löschen? Das kann nicht rückgängig gemacht werden.">' . csrf_field($user) . '<input type="hidden" name="action" value="empty_trash"><button class="btn danger">Papierkorb leeren</button></form>';
    }
    layout_end();
}

// ---------- Zugänge ----------
function view_users(array $user): void
{
    if ($user['role'] !== 'owner') {
        fatal('Nur der Inhaber darf Zugänge verwalten.', 403);
    }
    layout_start($user, 'Zugänge', 'users');
    $rows = q('SELECT * FROM ar_users ORDER BY id')->fetchAll();
    echo '<p class="lead">Wer sich anmelden darf. Jede Person erhält bei der Anmeldung einen Code per E-Mail. Das Postfach muss <strong>nicht</strong> auf der Domain der Seite liegen – und soll es auch nicht.</p><ul class="rows">';
    foreach ($rows as $r) {
        echo '<li class="row"><span class="r-main"><strong>' . e($r['name'] ?: $r['email']) . '</strong><small>' . e($r['email']) . ' · ' . ($r['role'] === 'owner' ? 'Inhaber' : 'Bearbeiter') . ' · letzte Anmeldung: ' . ($r['last_login'] ? e(date('d.m.Y H:i', (int)$r['last_login'])) : 'noch nie') . '</small></span>';
        $lockRem = login_lock_remaining((string)$r['email']);
        echo '<span class="r-act">';
        echo '<span class="pill' . ($r['pw_hash'] ? ' ok' : '') . '">Passwort: ' . ($r['pw_hash'] ? 'ja' : 'nein') . '</span>';
        if ($lockRem > 0) {
            echo '<span class="pill bad">gesperrt</span><form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="user_unlock"><input type="hidden" name="id" value="' . $r['id'] . '"><button class="btn small">Sperre aufheben</button></form>';
        }
        if ($r['pw_hash']) {
            echo '<form method="post" action="' . a() . '" class="inline" data-confirm="Passwort von ' . e($r['email']) . ' entfernen? Die Person meldet sich danach nur mit dem E-Mail-Code an und kann ein neues Passwort festlegen.">' . csrf_field($user) . '<input type="hidden" name="action" value="user_pw_clear"><input type="hidden" name="id" value="' . $r['id'] . '"><button class="btn small ghost">Passwort zurücksetzen</button></form>';
        }
        if ($r['role'] !== 'owner') {
            echo '<form method="post" action="' . a() . '" class="inline" data-confirm="Zugang von ' . e($r['email']) . ' entfernen?">' . csrf_field($user) . '<input type="hidden" name="action" value="remove_user"><input type="hidden" name="id" value="' . $r['id'] . '"><button class="btn small danger-o">Entfernen</button></form>';
        }
        echo '</span>';
        echo '</li>';
    }
    ?>
</ul>
<h2 class="fs">Zugang hinzufügen</h2>
<form method="post" action="<?= a() ?>" class="form"><?= csrf_field($user) ?><input type="hidden" name="action" value="add_user">
<div class="field"><label for="un">Name</label><input id="un" name="name" maxlength="120" placeholder="z. B. Antonia"></div>
<div class="field"><label for="ue">E-Mail-Adresse <span class="req">*</span></label><input id="ue" name="email" type="email" required><small class="hint">Bearbeiter dürfen alle Inhalte ändern, aber keine Zugänge verwalten.</small></div>
<div class="actions"><button class="btn">Zugang anlegen</button></div></form>
<?php
    layout_end();
}

// ---------- Protokoll ----------
function view_log(array $user): void
{
    layout_start($user, 'Protokoll', 'log');
    $rows = q('SELECT * FROM ar_audit ORDER BY id DESC LIMIT 150')->fetchAll();
    echo '<p class="lead">Die letzten 150 Aktionen: Anmeldungen und Änderungen.</p><table class="log"><thead><tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Details</th></tr></thead><tbody>';
    foreach ($rows as $r) {
        echo '<tr><td>' . e(date('d.m.Y H:i', (int)$r['ts'])) . '</td><td>' . e($r['who']) . '</td><td>' . e($r['action']) . '</td><td>' . e($r['detail']) . '</td></tr>';
    }
    echo '</tbody></table>';
    layout_end();
}

// ---------- Systemcheck ----------
function view_check(array $user): void
{
    layout_start($user, 'Systemcheck', 'check');
    $ok = fn(bool $b) => $b ? '<span class="pill ok">OK</span>' : '<span class="pill bad">Prüfen</span>';
    $checks = [
        ['PHP-Version (mind. 8.1)', PHP_VERSION, version_compare(PHP_VERSION, '8.1.0', '>=')],
        ['Datenbank', cfg('db.driver') . ' (verbunden)', true],
        ['PHP-Erweiterung mbstring', extension_loaded('mbstring') ? 'vorhanden' : 'fehlt', extension_loaded('mbstring')],
        ['PHP-Erweiterung GD (Bilder)', extension_loaded('gd') ? 'vorhanden' . (function_exists('imagewebp') ? ', WebP' : ', ohne WebP') . (function_exists('imagecreatefromavif') ? ', AVIF (Server)' : ', AVIF nur über den Browser') : 'fehlt', extension_loaded('gd')],
        ['Ordner uploads/ beschreibbar', is_writable(AR_ROOT . '/uploads') ? 'ja' : 'nein', is_writable(AR_ROOT . '/uploads')],
        ['Ordner data/ beschreibbar', is_writable(AR_ROOT . '/data') ? 'ja' : 'nein', is_writable(AR_ROOT . '/data')],
        ['Verbindung per HTTPS', is_https() ? 'ja' : 'nein (nur lokal in Ordnung)', is_https() || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true)],
        ['Max. Upload-Größe (Server)', (string)ini_get('upload_max_filesize'), true],
        ['Diagnose-Datei entfernt', is_file(AR_ROOT . '/diagnose.php') ? 'diagnose.php liegt noch auf dem Server – bitte löschen' : 'ja', !is_file(AR_ROOT . '/diagnose.php')],
        ['Entwicklungsordner entfernt', is_dir(AR_ROOT . '/tools') ? 'Ordner tools/ liegt noch auf dem Server – bitte löschen' : 'ja', !is_dir(AR_ROOT . '/tools')],
        ['Seiten-Zwischenspeicher', is_dir(cache_dir()) && is_writable(cache_dir()) ? 'aktiv' : 'wird beim ersten Aufruf angelegt', true],
        ['Erkannte Besucher-Adresse (für Begrenzungen)', e_ip_label(), filter_var((string)($_SERVER['REMOTE_ADDR'] ?? ''), FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true)],
        ['Konfiguration außerhalb des Webverzeichnisses', config_file() !== AR_ROOT . '/config.php' ? 'ja (empfohlen)' : 'nein – config.php liegt im Webverzeichnis (gesperrt, aber „oberhalb“ wäre sicherer)', true],
        ['Letzter Mailversand', mail_status_label(), mail_status_ok()],
        ['Mailversand', (string)cfg('mail.driver') . ' · Absender ' . cfg('mail.from'), cfg('mail.driver') !== 'log'],
    ];
    $blocked = [];
    foreach (['data/', 'lib/', 'config.php'] as $path) {
        $blocked[] = $path;
    }
    echo '<table class="log"><tbody>';
    foreach ($checks as [$l, $v, $good]) {
        echo '<tr><td>' . e($l) . '</td><td>' . e($v) . '</td><td>' . $ok($good) . '</td></tr>';
    }
    echo '</tbody></table>';
    echo '<h2 class="fs">Sicherheits-Selbsttest</h2><p class="lead">Prüft jetzt in deinem Browser, ob interne Dateien von außen gesperrt sind. Alles muss „gesperrt“ zeigen.</p><ul class="selfchecks">';
    foreach (['config.php', 'config.sample.php', 'lib/bootstrap.php', 'templates/page.php', 'data/', 'data/backups/', 'seed-assets/', 'error_log', 'diagnose.php', 'tools/selftest.php', 'admin/views.php'] as $p) {
        echo '<li data-path="' . e(AR_BASE . '/' . $p) . '"><code>' . e($p) . '</code> <span class="pill">prüfe …</span></li>';
    }
echo '</ul><h2 class="fs">Mailversand testen</h2><form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="test_mail"><button class="btn">Testmail an ' . e($user['email']) . ' senden</button></form>';
    echo '<p class="hint">Kommt keine Mail an, trage in <code>config.php</code> unter „mail“ den SMTP-Zugang ein (siehe README).</p>';
    if ($user['role'] === 'owner') {
        echo '<h2 class="fs">Sicherung der Inhalte</h2><p class="lead">Lädt alle Texte, Listen und Einstellungen als Datei herunter (ohne Bilder und ohne Zugangsdaten). Bilder liegen im Ordner uploads/ und werden per FTP gesichert.</p><form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="export"><button class="btn ghost">Sicherung herunterladen (JSON)</button></form>';
    }
    layout_end();
}

function e_ip_label(): string
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '?');
    $note = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false ? ' – interne Adresse: hinter einem Proxy teilen sich alle Besucher eine Adresse' : '';
    return $ip . $note;
}

function mail_status_ok(): bool
{
    $ms = json_arr(settings_rows()['_mail']['data'] ?? null);
    return !$ms || !empty($ms['ok']);
}

function mail_status_label(): string
{
    $ms = json_arr(settings_rows()['_mail']['data'] ?? null);
    if (!$ms) {
        return 'noch kein Versand erfasst';
    }
    return (!empty($ms['ok']) ? 'erfolgreich' : 'FEHLGESCHLAGEN') . ' (' . date('d.m.Y H:i', (int)($ms['at'] ?? 0)) . ' Uhr)' . (!empty($ms['err']) ? ' – ' . $ms['err'] : '');
}
