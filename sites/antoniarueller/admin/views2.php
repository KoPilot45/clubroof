<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/media.php';
require_once __DIR__ . '/../lib/checks.php';
require_once __DIR__ . '/../lib/stats.php';
require_once __DIR__ . '/../lib/backup.php';
require_once __DIR__ . '/../lib/dashboard.php';

function kb(int $b): string
{
    return $b >= 1048576 ? number_format($b / 1048576, 1, ',', '.') . ' MB' : max(1, (int)round($b / 1024)) . ' KB';
}

// ---------- Übersicht ----------
function kpi(string $label, string $valueHtml, string $subHtml = '', string $level = '', string $href = ''): string
{
    $inner = '<span class="k-l">' . e($label) . '</span><strong class="k-v">' . $valueHtml . '</strong>' . ($subHtml !== '' ? '<span class="k-s">' . $subHtml . '</span>' : '');
    return $href !== '' ? '<a class="kpi ' . $level . '" href="' . e($href) . '">' . $inner . '</a>' : '<div class="kpi ' . $level . '">' . $inner . '</div>';
}

function view_home(array $user): void
{
    $isOwner = $user['role'] === 'owner';
    $h = (int)date('G');
    $first = trim(explode(' ', (string)($user['name'] ?: ''))[0]);
    layout_start($user, ($h < 11 ? 'Guten Morgen' : ($h < 18 ? 'Guten Tag' : 'Guten Abend')) . ($first !== '' ? ', ' . $first : ''), 'home', true);

    // 1. Schnellaktionen
    echo '<div class="quick"><a class="btn small" href="' . a('p=edit&c=clips') . '">+ Neue Referenz</a><a class="btn small" href="' . a('p=edit&c=episodes') . '">+ Neue Podcast-Folge</a><a class="btn small ghost" href="' . AR_BASE . '/" target="_blank" rel="noopener">Seite ansehen ↗</a><a class="btn small ghost" href="' . e(preview_url()) . '" target="_blank" rel="noopener">Vorschau ↗</a>';
    if ($isOwner) {
        echo '<form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="backup_now"><button class="btn small ghost">Jetzt sichern</button></form>';
    }
    echo '</div>';

    // 2. Warnleiste (nur wenn nötig)
    echo '<div class="alerts" aria-label="Hinweise">';
    foreach (dash_alerts($user) as [$lvl, $txt, $link]) {
        echo '<a class="alert ' . e($lvl) . '" href="' . e($link) . '"><span class="al-i" aria-hidden="true">!</span>' . e($txt) . '</a>';
    }
    echo '<a class="alert bad" id="alert-self" href="' . a('p=check') . '" hidden data-paths="' . e(implode(',', array_map(fn($p) => AR_BASE . '/' . $p, ['config.php', 'lib/bootstrap.php', 'data/', 'data/backups/', 'error_log']))) . '"><span class="al-i" aria-hidden="true">!</span><span class="al-t"></span></a>';
    echo '<a class="alert warn" id="alert-ssl" href="' . a('p=check') . '" hidden><span class="al-i" aria-hidden="true">!</span><span class="al-t"></span></a></div>';

    // 3. Kennzahlen
    $st = stats_summary();
    $vals = array_values($st['days']);
    $prevWeek = array_sum(array_slice($vals, -14, 7));
    $thisWeek = $st['week'];
    $trend = $prevWeek > 0 ? (int)round(($thisWeek - $prevWeek) / $prevWeek * 100) : null;
    $trendTxt = $trend === null ? '' : ' · ' . ($trend >= 0 ? '↑ ' : '↓ ') . abs($trend) . ' % zur Vorwoche';
    $act = dash_activity(8);
    $checks = readiness_checks();
    $must = array_filter($checks, fn($c) => $c[0] === 'must');
    $mustOk = count(array_filter($must, fn($c) => $c[1]));
    $tp = translation_progress();
    $pct = $tp['total'] ? (int)round($tp['done'] / $tp['total'] * 100) : 100;
    $drafts = open_drafts();
    $prev = dash_previous_login($user['email']);

    echo '<div class="kpis" style="--n:' . ($isOwner ? 6 : 5) . '">';
    echo kpi('Besuche heute', (string)$st['today'], '7 Tage: ' . $thisWeek . e($trendTxt), '', a('p=stats'));
    if ($act) {
        echo kpi('Letzte Änderung', e(rel_time($act[0]['at'])), e(who_name($act[0]['who'])) . ' · ' . e($act[0]['text']), '', $act[0]['link']);
    } else {
        echo kpi('Letzte Änderung', '–', 'Noch keine Änderungen');
    }
    if ($isOwner) {
        $last = backup_last();
        $age = $last ? (time() - $last) / 86400 : 999;
        echo kpi('Letztes Backup', $last ? e(rel_time($last)) : 'keins', $last ? e(date('d.m.Y H:i', $last)) . ' Uhr' : 'Jetzt sichern empfohlen', $age <= 8 ? 'ok' : ($age <= 14 ? 'warn' : 'bad'), a('p=backup'));
    }
    echo kpi('Dein letzter Login', $prev ? e(rel_time($prev['at'])) : '–', $prev ? e(date('d.m.Y H:i', $prev['at'])) . ' · ' . e($prev['device'] ?: 'Gerät unbekannt') : 'Das ist deine erste erfasste Anmeldung', '', a('p=sessions'));
    echo kpi('Offene Entwürfe', (string)count($drafts), $drafts ? 'noch nicht öffentlich' : 'alles veröffentlicht', $drafts ? 'warn' : 'ok', $drafts ? '#entwuerfe' : '');
    echo kpi('Startklar · Englisch', $mustOk . '/' . count($must), 'Pflichtpunkte · Englisch ' . $pct . ' %', $mustOk === count($must) ? 'ok' : 'warn', '#startklar');
    echo '</div>';

    echo '<div class="dash-cols"><div class="dash-col">';

    // Aufgaben: Entwürfe
    if ($drafts) {
        echo '<section class="card warnbox" id="entwuerfe"><h2>Offene Entwürfe (' . count($drafts) . ')</h2><p class="hint">Diese Änderungen sind noch nicht öffentlich.</p><ul class="plain">';
        foreach ($drafts as $d) {
            $href = $d['kind'] === 'item' ? a('p=edit&c=' . $d['coll'] . '&id=' . $d['ref']) : a('p=group&g=' . $d['ref']);
            echo '<li><a href="' . e($href) . '">' . e($d['label']) . '</a> <small>' . ($d['new'] ? 'neu · ' : '') . e(who_name($d['who'])) . ', ' . e(when_fmt($d['at'])) . '</small></li>';
        }
        echo '</ul><p><a class="btn small ghost" href="' . e(preview_url()) . '" target="_blank" rel="noopener">Vorschau ansehen ↗</a> <form method="post" action="' . a() . '" class="inline" data-confirm="Alle Entwürfe jetzt veröffentlichen?">' . csrf_field($user) . '<input type="hidden" name="action" value="publish_all"><button class="btn small">Alle veröffentlichen</button></form></p></section>';
    }

    // Aufgaben: Startklar (nur Offenes, Erledigtes eingeklappt)
    $open = array_filter($checks, fn($c) => !$c[1]);
    $done = array_filter($checks, fn($c) => $c[1]);
    echo '<section class="card" id="startklar"><h2>Startklar? <span class="score">' . $mustOk . ' von ' . count($must) . ' Pflichtpunkten</span></h2><div class="meter"><span style="width:' . (int)round($mustOk / max(1, count($must)) * 100) . '%"></span></div>';
    if ($open) {
        echo '<ul class="check">';
        foreach ($open as [$lvl, $ok, $text, $link]) {
            echo '<li class="' . ($lvl === 'must' ? 'bad' : 'meh') . '"><span class="mark" aria-hidden="true">' . ($lvl === 'must' ? '!' : '○') . '</span> <a href="' . e($link) . '">' . e($text) . '</a>' . ($lvl === 'nice' ? ' <small>(empfohlen)</small>' : '') . '</li>';
        }
        echo '</ul>';
    } else {
        echo '<p class="hint">Alles erledigt. Sehr gut.</p>';
    }
    if ($done) {
        echo '<details class="fold"><summary>✓ ' . count($done) . ' erledigt</summary><ul class="check">';
        foreach ($done as [$lvl, $ok, $text, $link]) {
            echo '<li class="ok"><span class="mark" aria-hidden="true">✓</span> <a href="' . e($link) . '">' . e($text) . '</a></li>';
        }
        echo '</ul></details>';
    }
    echo '</section>';

    // Aufgaben: Platzhalter, nach Bereich gruppiert und eingeklappt
    $ph = find_placeholders();
    $byArea = [];
    foreach ($ph as $x) {
        $byArea[$x['area']][] = $x;
    }
    echo '<section class="card"><h2>Platzhalter in Texten <span class="score">' . count($ph) . '</span></h2>';
    if (!$ph) {
        echo '<p class="hint">Keine Texte mit [eckigen Klammern] gefunden. Sehr gut.</p>';
    } else {
        echo '<p class="hint">Diese Stellen sind noch Platzhalter und sollten vor dem Start ersetzt oder gelöscht werden.</p>';
        foreach ($byArea as $area => $list) {
            echo '<details class="fold"><summary>' . e($area) . ' <span class="cnt">' . count($list) . '</span></summary><ul class="plain">';
            foreach ($list as $x) {
                echo '<li><a href="' . e($x['link']) . '">' . ($x['item'] !== '' ? e($x['item']) . ' · ' : '') . e($x['field']) . '</a> <code>' . e(mb_strimwidth($x['snippet'], 0, 50, '…')) . '</code></li>';
            }
            echo '</ul></details>';
        }
    }
    echo '</section>';

    // Aufgaben: Englisch
    echo '<section class="card"><h2>Englische Fassung <span class="score">' . $pct . ' % übersetzt</span></h2><div class="meter"><span style="width:' . $pct . '%"></span></div>';
    if ($tp['missing_by_area']) {
        echo '<details class="fold"><summary>Noch offen nach Bereich</summary><ul class="plain">';
        foreach (array_slice($tp['missing_by_area'], 0, 8, true) as $area => $n) {
            echo '<li>' . e($area) . ': <strong>' . $n . '</strong> Felder</li>';
        }
        echo '</ul></details>';
    }
    echo '<p class="hint">Unübersetzte Felder zeigen auf der englischen Seite den deutschen Text. In jedem Formular wechselst du oben auf „English“. <a href="' . AR_BASE . '/en/" target="_blank" rel="noopener">Englische Seite ansehen ↗</a></p></section>';

    echo '</div><div class="dash-col">';

    // Aktivität
    echo '<section class="card"><h2>Letzte Änderungen</h2>';
    if (!$act) {
        echo '<p class="hint">Noch keine Änderungen.</p>';
    } else {
        echo '<ul class="act">';
        foreach ($act as $x) {
            $t = e($x['text']);
            echo '<li><span class="act-w">' . e(who_name($x['who'])) . '</span> ' . ($x['link'] !== '' ? '<a href="' . e($x['link']) . '">' . $t . '</a>' : $t) . ' <small title="' . e(when_fmt($x['at'])) . '">' . e(rel_time($x['at'])) . '</small></li>';
        }
        echo '</ul>';
    }
    echo '<p class="hint"><a href="' . a('p=log') . '">Gesamtes Protokoll</a></p></section>';

    // Anmeldungen und Sicherheit
    echo '<section class="card"><h2>Anmeldungen &amp; Sicherheit</h2>';
    $logins = dash_logins();
    echo '<table class="mini"><thead><tr><th>Konto</th><th>Letzte Anmeldung</th><th>Passwort</th></tr></thead><tbody>';
    foreach ($logins as $l) {
        if (!$isOwner && $l['email'] !== $user['email']) {
            continue;
        }
        echo '<tr><td>' . e($l['name']) . ($l['role'] === 'owner' ? ' <small>(Inhaber)</small>' : '') . '</td><td>' . ($l['at'] ? e(rel_time($l['at'])) . '<br><small>' . e($l['device'] ?: 'Gerät unbekannt') . '</small>' : 'noch nie') . '</td><td>' . ($l['pw'] ? '<span class="pill ok">ja</span>' : '<span class="pill">nein</span>') . '</td></tr>';
    }
    echo '</tbody></table>';
    if ($isOwner) {
        $fails = dash_count_audit(['login_failed', 'login_failed_pw']);
        $locks = dash_count_audit(['login_locked']);
        echo '<p class="secstats"><span>Fehlversuche (7 Tage): <strong>' . $fails . '</strong></span><span>Sperren (7 Tage): <strong>' . $locks . '</strong></span><span>Aktive Geräte: <strong>' . dash_active_devices() . '</strong></span></p>';
    }
    echo '<p class="hint"><a href="' . a('p=sessions') . '">Geräte verwalten</a>' . ($isOwner ? ' · <a href="' . a('p=users') . '">Zugänge</a>' : '') . '</p></section>';

    // Besuche
    $max = max(1, max($st['days']));
    echo '<section class="card" id="besuche"><h2>Besuche <span class="score">letzte 30 Tage</span></h2><div class="stats"><div><strong>' . $st['today'] . '</strong><small>heute</small></div><div><strong>' . $thisWeek . '</strong><small>7 Tage</small></div><div><strong>' . $st['total'] . '</strong><small>30 Tage</small></div><div><strong>' . $st['hits'] . '</strong><small>Aufrufe (30 Tage)</small></div></div><div class="bars" role="img" aria-label="Besuche pro Tag">';
    foreach ($st['days'] as $day => $n) {
        echo '<span title="' . e(date('d.m.', strtotime($day))) . ': ' . $n . '" style="height:' . max(2, (int)round($n / $max * 100)) . '%"></span>';
    }
    echo '</div>';
    $tot = max(1, $st['dev']['m'] + $st['dev']['t'] + $st['dev']['d']);
    $enN = 0;
    $allN = 0;
    foreach ($st['pages'] as $pg => $n) {
        $allN += $n;
        if (str_ends_with($pg, '-en')) {
            $enN += $n;
        }
    }
    echo '<div class="cols"><div><h3>Geräte &amp; Sprache</h3><p>Handy ' . (int)round($st['dev']['m'] / $tot * 100) . ' % · Tablet ' . (int)round($st['dev']['t'] / $tot * 100) . ' % · Rechner ' . (int)round($st['dev']['d'] / $tot * 100) . ' %<br>Deutsch ' . ($allN ? (int)round(($allN - $enN) / $allN * 100) : 0) . ' % · Englisch ' . ($allN ? (int)round($enN / $allN * 100) : 0) . ' %</p>';
    $label = ['home' => 'Startseite', 'home-en' => 'Startseite (Englisch)', 'impressum' => 'Impressum', 'datenschutz' => 'Datenschutz', 'impressum-en' => 'Imprint', 'datenschutz-en' => 'Privacy'];
    echo '<h3>Seiten</h3><ul class="plain">';
    foreach (array_slice($st['pages'], 0, 5, true) as $pg => $n) {
        echo '<li>' . e($label[$pg] ?? $pg) . ': ' . $n . '</li>';
    }
    echo '</ul></div><div><h3>Woher kommen Besucher?</h3>';
    echo $st['refs'] ? '<ul class="plain">' : '<p class="hint">Noch keine Verweise.</p>';
    foreach ($st['refs'] as $r => $n) {
        echo '<li>' . e($r) . ': ' . $n . '</li>';
    }
    echo $st['refs'] ? '</ul>' : '';
    echo '</div></div><p class="hint">Ein Gerät zählt höchstens einmal pro Stunde als Besuch. Gespeichert werden nur Stunde, Seite, Gerätetyp und verweisende Domain – ohne Cookies und ohne IP-Adresse. Bots und „Do Not Track“ werden nicht gezählt. <a href="' . a('p=stats') . '">Alle Auswertungen →</a></p></section>';

    echo '</div></div>';

    // 5. Technik (eingeklappt)
    $tech = dash_tech();
    echo '<details class="card tech"><summary><strong>Technik</strong> <span class="score">PHP, Speicher, Zertifikat</span></summary><dl class="kv">';
    echo '<div><dt>PHP-Version</dt><dd>' . e($tech['php']) . '</dd></div><div><dt>Datenbank</dt><dd>' . e($tech['db']) . '</dd></div>';
    echo '<div><dt>Einträge</dt><dd>' . $tech['items'] . ' (Papierkorb: ' . $tech['trash'] . ')</dd></div>';
    echo '<div><dt>Bilder (uploads/)</dt><dd>' . kb($tech['uploads']) . '</dd></div>';
    echo '<div><dt>Sicherungen</dt><dd>' . $tech['backup_n'] . ' Dateien, ' . kb($tech['backups']) . '</dd></div>';
    echo '<div><dt>SSL-Zertifikat</dt><dd id="ssl-val" data-url="' . e(a('p=ssl_json')) . '">wird geprüft …</dd></div>';
    echo '</dl><p class="hint"><a href="' . a('p=check') . '">Zum Systemcheck</a></p></details>';
    layout_end();
}

// ---------- Mediathek ----------
function view_media(array $user): void
{
    layout_start($user, 'Mediathek', 'media');
    $list = media_list();
    $use = media_usage();
    echo '<p class="lead">Alle hochgeladenen Bilder. Du kannst sie in jedem Bildfeld über „Aus Mediathek wählen“ wiederverwenden. Nicht verwendete Bilder lassen sich löschen.</p>';
    echo '<form method="post" action="' . a() . '" enctype="multipart/form-data" class="form" style="margin-bottom:22px">' . csrf_field($user) . '<input type="hidden" name="action" value="media_upload"><div class="field"><label for="mf">Bilder hochladen</label><input type="file" id="mf" name="files[]" accept="image/jpeg,image/png,image/webp" multiple><small class="hint">JPG, PNG oder WebP, je höchstens ' . (int)cfg('max_upload_mb', 8) . ' MB.</small></div><button class="btn">Hochladen</button></form>';
    if (!$list) {
        echo '<p class="empty">Noch keine Bilder.</p>';
    }
    echo '<div class="mlib">';
    foreach ($list as $m) {
        $u = $use[$m['name']] ?? [];
        echo '<figure class="mcard"><img src="' . e($m['url']) . '" alt="" loading="lazy"><figcaption><strong>' . e($m['name']) . '</strong><small>' . $m['w'] . ' × ' . $m['h'] . ' px · ' . kb($m['size']) . '</small>';
        echo $u ? '<small class="used">Verwendet in: ' . e(implode('; ', array_slice($u, 0, 3))) . '</small>' : '<small class="unused">nicht verwendet</small>';
        if (!$u) {
            echo '<form method="post" action="' . a() . '" class="inline" data-confirm="Bild endgültig löschen?">' . csrf_field($user) . '<input type="hidden" name="action" value="media_delete"><input type="hidden" name="name" value="' . e($m['name']) . '"><button class="btn small danger-o">Löschen</button></form>';
        }
        echo '</figcaption></figure>';
    }
    echo '</div>';
    layout_end();
}

// ---------- Geräte ----------
function view_sessions(array $user): void
{
    layout_start($user, 'Geräte & Anmeldungen', 'sessions');
    $me = current_token_hash();
    $sql = 'SELECT s.*, u.email, u.name FROM ar_sessions s JOIN ar_users u ON u.id = s.user_id ' . ($user['role'] === 'owner' ? '' : 'WHERE s.user_id = ' . (int)$user['user_id'] . ' ') . 'ORDER BY s.last_seen DESC';
    $rows = q($sql)->fetchAll();
    echo '<p class="lead">Geräte, auf denen die Verwaltung angemeldet ist. Melde unbekannte oder nicht mehr genutzte Geräte ab.</p><ul class="rows">';
    foreach ($rows as $r) {
        $isMe = hash_equals((string)$r['token_hash'], $me);
        echo '<li class="row"><span class="r-main"><strong>' . e($r['ua_text'] ?: 'Unbekanntes Gerät') . ($isMe ? ' <span class="pill ok">dieses Gerät</span>' : '') . '</strong><small>' . e($r['name'] ?: $r['email']) . ' · angemeldet ' . e(when_fmt((int)$r['created_at'])) . ' · zuletzt aktiv ' . e(when_fmt((int)$r['last_seen'])) . '</small></span>';
        if (!$isMe) {
            echo '<span class="r-act"><form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="session_revoke"><input type="hidden" name="h" value="' . e($r['token_hash']) . '"><button class="btn small danger-o">Abmelden</button></form></span>';
        }
        echo '</li>';
    }
    echo '</ul><form method="post" action="' . a() . '" class="inline" data-confirm="Alle anderen Geräte abmelden?">' . csrf_field($user) . '<input type="hidden" name="action" value="sessions_revoke_others"><button class="btn">Alle anderen Geräte abmelden</button></form>';
    layout_end();
}

// ---------- Mein Konto ----------
function view_account(array $user, array $errors = []): void
{
    layout_start($user, 'Mein Konto', 'account');
    form_errors($errors);
    $hasPw = (bool)q('SELECT pw_hash FROM ar_users WHERE id = ?', [(int)$user['user_id']])->fetchColumn();
    echo '<form method="post" action="' . a() . '" class="form"><input type="hidden" name="action" value="account_save">' . csrf_field($user);
    echo '<div class="field"><label for="an">Name</label><input id="an" name="name" maxlength="120" value="' . e($user['name']) . '"></div><div class="field"><label>E-Mail-Adresse</label><div>' . e($user['email']) . '</div></div>';
    echo '<h2 class="fs">Zusätzliches Passwort (optional)</h2><p class="hint">Mit Passwort braucht die Anmeldung zusätzlich zum E-Mail-Code dein Passwort. Das schützt auch dann, wenn jemand Zugriff auf dein Postfach hat. Mindestens 12 Zeichen.</p>';
    if ($hasPw) {
        echo '<div class="field"><label for="cp">Aktuelles Passwort</label><input id="cp" type="password" name="current_pw" autocomplete="current-password"></div>';
    }
    echo '<div class="field"><label for="np">' . ($hasPw ? 'Neues Passwort' : 'Passwort festlegen') . '</label><input id="np" type="password" name="new_pw" minlength="12" autocomplete="new-password" data-strength="1"></div><div class="field"><label for="np2">Passwort wiederholen</label><input id="np2" type="password" name="new_pw2" autocomplete="new-password"></div>';
    if ($hasPw) {
        echo '<div class="field check"><label><input type="checkbox" name="remove_pw" value="1"> Passwort wieder entfernen (nur E-Mail-Code)</label></div>';
    }
    echo '<div class="actions"><button class="btn">Speichern</button></div></form>';
    layout_end();
}

// ---------- Sicherung ----------
function view_backup(array $user): void
{
    if ($user['role'] !== 'owner') {
        fatal('Nur der Inhaber darf Sicherungen verwalten.', 403);
    }
    layout_start($user, 'Sicherung', 'backup');
    $last = backup_last();
    $list = backup_list();
    echo '<p class="lead">Sichert alle Texte, Listen, Einstellungen und Entwürfe (ohne Bilder und Zugangsdaten). Eine automatische Sicherung entsteht bei Anmeldungen alle 7 Tage, die neuesten 15 automatischen und 15 manuellen bleiben erhalten. Letzte Sicherung: <strong>' . ($last ? e(when_fmt($last)) : 'noch keine') . '</strong>.</p>';
    echo '<div class="actions"><form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="backup_now"><button class="btn">Jetzt sichern</button></form> <form method="post" action="' . a() . '" class="inline">' . csrf_field($user) . '<input type="hidden" name="action" value="export"><button class="btn ghost">Aktuellen Stand herunterladen</button></form></div>';
    echo '<h2 class="fs">Gespeicherte Sicherungen (' . count($list) . ')</h2>';
    if (!$list) {
        echo '<p class="empty">Noch keine Sicherung vorhanden.</p>';
    } else {
        echo '<ul class="rows">';
        foreach ($list as $f) {
            $hid = '<input type="hidden" name="file" value="' . e($f['file']) . '">' . csrf_field($user);
            echo '<li class="row"><span class="r-main"><strong>' . e(when_fmt($f['time'])) . '</strong><small>' . e($f['label']) . ' · ' . kb($f['size']) . '</small></span><span class="r-act">';
            echo '<form method="post" action="' . a() . '" class="inline"><input type="hidden" name="action" value="backup_download">' . $hid . '<button class="btn small ghost">Herunterladen</button></form>';
            echo '<form method="post" action="' . a() . '" class="inline" data-confirm="Alle jetzigen Inhalte durch diese Sicherung ersetzen? Der aktuelle Stand wird vorher als Sicherung gespeichert."><input type="hidden" name="action" value="backup_restore"><input type="hidden" name="confirm" value="1">' . $hid . '<button class="btn small">Wiederherstellen</button></form>';
            echo '<form method="post" action="' . a() . '" class="inline" data-confirm="Diese Sicherung endgültig löschen?"><input type="hidden" name="action" value="backup_delete">' . $hid . '<button class="btn small danger-o">Löschen</button></form>';
            echo '</span></li>';
        }
        echo '</ul>';
    }
    echo '<p class="hint">Die Sicherungen liegen auf demselben Server wie die Seite. Lade gelegentlich eine Sicherung herunter und bewahre sie an einem anderen Ort auf. Bilder (Ordner uploads/) sind nicht enthalten und werden per FTP gesichert.</p>';
    echo '<h2 class="fs">Aus Datei wiederherstellen</h2><form method="post" action="' . a() . '" enctype="multipart/form-data" class="form" data-confirm="Alle jetzigen Inhalte werden durch die Sicherung ersetzt. Fortfahren?">' . csrf_field($user) . '<input type="hidden" name="action" value="import_backup"><div class="field"><label for="bf">Sicherungsdatei (.json)</label><input type="file" id="bf" name="backup" accept="application/json,.json" required><small class="hint">Ersetzt alle Inhalte und Einstellungen. Der aktuelle Stand wird vorher als Sicherung gespeichert. Bilder werden nicht verändert.</small></div><div class="field check"><label><input type="checkbox" name="confirm" value="1" required> Ich weiß, dass dabei alle jetzigen Inhalte ersetzt werden.</label></div><button class="btn danger">Wiederherstellen</button></form>';
    $key = cron_key();
    echo '<h2 class="fs">Zeitplan per Cronjob (optional)</h2><p class="hint">Ionos-Kundencenter → Hosting → Cronjobs. Befehl (z. B. täglich):</p><p><code>php ' . e(AR_ROOT) . '/cron.php</code></p><p class="hint">Oder als Web-Adresse für einen externen Zeitplaner:</p><p><code>' . e(abs_url('/cron.php?key=' . $key)) . '</code></p>';
    layout_end();
}
