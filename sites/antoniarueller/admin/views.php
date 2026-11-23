<?php
declare(strict_types=1);

require_once __DIR__ . '/forms.php';
require_once __DIR__ . '/views2.php';

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

function layout_start(array $user, string $title, string $active = ''): void
{
    admin_head($title, $user);
    $s = schema();
    $trashN = 0;
    foreach (array_keys($s['collections']) as $c) {
        $trashN += (int)q('SELECT COUNT(*) FROM ar_items WHERE coll = ? AND deleted_at IS NOT NULL', [$c])->fetchColumn();
    }
    ?>
<div class="shell">
<aside class="side" id="side">
<a class="brand" href="<?= a() ?>"><span class="dot"></span>Verwaltung<small>antoniarueller.de</small></a>
<nav>
<a href="<?= a() ?>" class="<?= $active === 'home' ? 'on' : '' ?>">Übersicht</a>
<?php foreach (admin_menu() as $head => $entries): ?>
<div class="nav-h"><?= e($head) ?></div>
<?php foreach ($entries as [$kind, $key]):
    $label = $kind === 'c' ? $s['collections'][$key]['label'] : $s['groups'][$key]['label'];
    $href = $kind === 'c' ? a('p=list&c=' . $key) : a('p=group&g=' . $key); ?>
<a href="<?= $href ?>" class="<?= $active === $kind . ':' . $key ? 'on' : '' ?>"><?= e($label) ?></a>
<?php endforeach; endforeach; ?>
<div class="nav-h">System</div>
<a href="<?= a('p=media') ?>" class="<?= $active === 'media' ? 'on' : '' ?>">Mediathek</a>
<a href="<?= a('p=trash') ?>" class="<?= $active === 'trash' ? 'on' : '' ?>">Papierkorb<?php if ($trashN): ?> <span class="badge"><?= $trashN ?></span><?php endif; ?></a>
<?php if ($user['role'] === 'owner'): ?><a href="<?= a('p=users') ?>" class="<?= $active === 'users' ? 'on' : '' ?>">Zugänge</a>
<a href="<?= a('p=backup') ?>" class="<?= $active === 'backup' ? 'on' : '' ?>">Sicherung</a><?php endif; ?>
<a href="<?= a('p=account') ?>" class="<?= $active === 'account' ? 'on' : '' ?>">Mein Konto</a>
<a href="<?= a('p=sessions') ?>" class="<?= $active === 'sessions' ? 'on' : '' ?>">Geräte</a>
<a href="<?= a('p=log') ?>" class="<?= $active === 'log' ? 'on' : '' ?>">Protokoll</a>
<a href="<?= a('p=check') ?>" class="<?= $active === 'check' ? 'on' : '' ?>">Systemcheck</a>
</nav>
</aside>
<div class="main">
<header class="bar">
<button type="button" class="menu-btn" id="menuBtn" aria-label="Menü" aria-expanded="false">☰</button>
<a class="view-site" href="<?= AR_BASE ?>/" target="_blank" rel="noopener">Seite ansehen ↗</a>
<span class="who"><?= e($user['name'] ?: $user['email']) ?></span>
<form method="post" action="<?= a() ?>" class="inline"><?= csrf_field($user) ?><input type="hidden" name="action" value="logout"><button class="btn small ghost">Abmelden</button></form>
</header>
<main>
<?php if (!empty($GLOBALS['flash'])): ?><div class="flash <?= e($GLOBALS['flash']['type']) ?>" role="status"><?= e($GLOBALS['flash']['msg']) ?></div><?php endif; ?>
<h1><?= e($title) ?></h1>
<?php
}

function layout_end(): void
{
    echo '</main></div></div>';
    admin_foot();
}

// ---------- Anmeldung ----------
function view_login(string $step, string $email, string $error): void
{
    admin_head('Anmelden');
    ?>
<div class="login">
<div class="card">
<div class="brand-l"><span class="dot"></span>Verwaltung <small>antoniarueller.de</small></div>
<?php if ($step === 'email'): ?>
<h1>Anmelden</h1>
<p>Gib deine E-Mail-Adresse ein. Wir senden dir einen Code, mit dem du dich anmeldest.</p>
<form method="post" autocomplete="on">
<input type="hidden" name="action" value="request">
<label for="email">E-Mail-Adresse</label>
<input id="email" name="email" type="email" required autofocus autocomplete="email" value="<?= e($email) ?>">
<button class="btn">Code senden</button>
</form>
<?php else: ?>
<h1>Code eingeben</h1>
<p>Falls die Adresse für die Verwaltung freigegeben ist, haben wir einen 8-stelligen Code geschickt. Er ist <?= (int)cfg('code_valid_minutes', 10) ?> Minuten gültig. Keine Mail da? Bitte auch den Spam-Ordner prüfen.</p>
<?php if ($error): ?><div class="flash err" role="alert"><?= e($error) ?></div><?php endif; ?>
<form method="post">
<input type="hidden" name="action" value="verify">
<input type="hidden" name="email" value="<?= e($email) ?>">
<label for="code">Code</label>
<input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{8,9}" maxlength="9" required autofocus class="code">
<label for="pw">Passwort <small>(nur falls eingerichtet)</small></label>
<input id="pw" name="pw" type="password" autocomplete="current-password">
<button class="btn">Anmelden</button>
</form>
<form method="post" class="again"><input type="hidden" name="action" value="request"><input type="hidden" name="email" value="<?= e($email) ?>"><button class="link">Neuen Code senden</button> · <a href="<?= a() ?>">Andere Adresse</a></form>
<?php endif; ?>
</div>
</div>
<?php
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
        if ($r['role'] !== 'owner') {
            echo '<span class="r-act"><form method="post" action="' . a() . '" class="inline" data-confirm="Zugang von ' . e($r['email']) . ' entfernen?">' . csrf_field($user) . '<input type="hidden" name="action" value="remove_user"><input type="hidden" name="id" value="' . $r['id'] . '"><button class="btn small danger-o">Entfernen</button></form></span>';
        }
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
        ['PHP-Erweiterung GD (Bilder)', extension_loaded('gd') ? 'vorhanden' . (function_exists('imagewebp') ? ', WebP' : ', ohne WebP') : 'fehlt', extension_loaded('gd')],
        ['Ordner uploads/ beschreibbar', is_writable(AR_ROOT . '/uploads') ? 'ja' : 'nein', is_writable(AR_ROOT . '/uploads')],
        ['Ordner data/ beschreibbar', is_writable(AR_ROOT . '/data') ? 'ja' : 'nein', is_writable(AR_ROOT . '/data')],
        ['Verbindung per HTTPS', is_https() ? 'ja' : 'nein (nur lokal in Ordnung)', is_https() || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true)],
        ['Max. Upload-Größe (Server)', (string)ini_get('upload_max_filesize'), true],
        ['Diagnose-Datei entfernt', is_file(AR_ROOT . '/diagnose.php') ? 'diagnose.php liegt noch auf dem Server – bitte löschen' : 'ja', !is_file(AR_ROOT . '/diagnose.php')],
        ['Entwicklungsordner entfernt', is_dir(AR_ROOT . '/tools') ? 'Ordner tools/ liegt noch auf dem Server – bitte löschen' : 'ja', !is_dir(AR_ROOT . '/tools')],
        ['Seiten-Zwischenspeicher', is_dir(cache_dir()) && is_writable(cache_dir()) ? 'aktiv' : 'wird beim ersten Aufruf angelegt', true],
        ['Erkannte Besucher-Adresse (für Begrenzungen)', e_ip_label(), filter_var((string)($_SERVER['REMOTE_ADDR'] ?? ''), FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false || in_array($_SERVER['SERVER_NAME'] ?? '', ['localhost', '127.0.0.1'], true)],
        ['Konfiguration außerhalb des Webverzeichnisses', config_file() !== AR_ROOT . '/config.php' ? 'ja (empfohlen)' : 'nein – config.php liegt im Webverzeichnis (gesperrt, aber „oberhalb“ wäre sicherer)', true],
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
