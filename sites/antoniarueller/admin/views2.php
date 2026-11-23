<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/media.php';
require_once __DIR__ . '/../lib/checks.php';
require_once __DIR__ . '/../lib/stats.php';
require_once __DIR__ . '/../lib/backup.php';

function kb(int $b): string
{
    return $b >= 1048576 ? number_format($b / 1048576, 1, ',', '.') . ' MB' : max(1, (int)round($b / 1024)) . ' KB';
}

// ---------- Übersicht ----------
function view_home(array $user): void
{
    $s = schema();
    layout_start($user, 'Übersicht', 'home');
    $name = $user['name'] ?: 'willkommen';
    echo '<p class="lead">Hier pflegst du alle Inhalte der Seite. Änderungen unter „Veröffentlichen“ sind sofort live, Entwürfe nur in der Vorschau.</p>';

    // Entwürfe
    $drafts = open_drafts();
    if ($drafts) {
        echo '<section class="card warnbox"><h2>Offene Entwürfe (' . count($drafts) . ')</h2><p class="hint">Diese Änderungen sind noch nicht öffentlich.</p><ul class="plain">';
        foreach ($drafts as $d) {
            $href = $d['kind'] === 'item' ? a('p=edit&c=' . $d['coll'] . '&id=' . $d['ref']) : a('p=group&g=' . $d['ref']);
            echo '<li><a href="' . e($href) . '">' . e($d['label']) . '</a> <small>' . ($d['new'] ? 'neu · ' : '') . e(who_name($d['who'])) . ', ' . e(when_fmt($d['at'])) . '</small></li>';
        }
        echo '</ul><p><a class="btn small ghost" href="' . e(preview_url()) . '" target="_blank" rel="noopener">Vorschau ansehen ↗</a> <form method="post" action="' . a() . '" class="inline" data-confirm="Alle Entwürfe jetzt veröffentlichen?">' . csrf_field($user) . '<input type="hidden" name="action" value="publish_all"><button class="btn small">Alle veröffentlichen</button></form></p></section>';
    }

    // Startklar
    $checks = readiness_checks();
    $must = array_filter($checks, fn($c) => $c[0] === 'must');
    $mustOk = count(array_filter($must, fn($c) => $c[1]));
    $niceOk = count(array_filter($checks, fn($c) => $c[0] === 'nice' && $c[1]));
    $niceAll = count($checks) - count($must);
    echo '<section class="card"><h2>Startklar? <span class="score">' . $mustOk . ' von ' . count($must) . ' Pflichtpunkten</span></h2><div class="meter"><span style="width:' . (int)round($mustOk / max(1, count($must)) * 100) . '%"></span></div><ul class="check">';
    foreach ($checks as [$lvl, $ok, $text, $link]) {
        echo '<li class="' . ($ok ? 'ok' : ($lvl === 'must' ? 'bad' : 'meh')) . '"><span class="mark" aria-hidden="true">' . ($ok ? '✓' : ($lvl === 'must' ? '!' : '○')) . '</span> <a href="' . e($link) . '">' . e($text) . '</a>' . ($lvl === 'nice' ? ' <small>(empfohlen)</small>' : '') . '</li>';
    }
    echo '</ul><p class="hint">Empfohlen erledigt: ' . $niceOk . ' von ' . $niceAll . '</p></section>';

    // Platzhalter
    $ph = find_placeholders();
    echo '<section class="card"><h2>Platzhalter in Texten (' . count($ph) . ')</h2>';
    if (!$ph) {
        echo '<p class="hint">Keine Texte mit [eckigen Klammern] gefunden. Sehr gut.</p>';
    } else {
        echo '<p class="hint">Diese Stellen sind noch Platzhalter und sollten vor dem Start ersetzt oder gelöscht werden.</p><ul class="plain">';
        foreach (array_slice($ph, 0, 40) as $x) {
            echo '<li><a href="' . e($x['link']) . '"><strong>' . e($x['area']) . '</strong>' . ($x['item'] !== '' ? ' · ' . e($x['item']) : '') . ' · ' . e($x['field']) . '</a> <code>' . e(mb_strimwidth($x['snippet'], 0, 60, '…')) . '</code></li>';
        }
        if (count($ph) > 40) {
            echo '<li><small>… und ' . (count($ph) - 40) . ' weitere</small></li>';
        }
        echo '</ul>';
    }
    echo '</section>';

    // Englisch
    $tp = translation_progress();
    $pct = $tp['total'] ? (int)round($tp['done'] / $tp['total'] * 100) : 100;
    echo '<section class="card"><h2>Englische Fassung <span class="score">' . $pct . ' % übersetzt</span></h2><div class="meter"><span style="width:' . $pct . '%"></span></div><p class="hint">Unübersetzte Felder zeigen auf der englischen Seite den deutschen Text. In jedem Formular wechselst du oben auf „English“.</p>';
    if ($tp['missing_by_area']) {
        echo '<ul class="plain">';
        foreach (array_slice($tp['missing_by_area'], 0, 6, true) as $area => $n) {
            echo '<li>' . e($area) . ': <strong>' . $n . '</strong> offen</li>';
        }
        echo '</ul>';
    }
    echo '<p><a class="btn small ghost" href="' . AR_BASE . '/en/" target="_blank" rel="noopener">Englische Seite ansehen ↗</a></p></section>';

    // Besucher
    $st = stats_summary();
    $max = max(1, max($st['days']));
    echo '<section class="card"><h2>Besuche <span class="score">letzte 30 Tage</span></h2><div class="stats"><div><strong>' . $st['today'] . '</strong><small>heute</small></div><div><strong>' . $st['week'] . '</strong><small>7 Tage</small></div><div><strong>' . $st['total'] . '</strong><small>30 Tage</small></div><div><strong>' . $st['hits'] . '</strong><small>Aufrufe (30 Tage)</small></div></div><div class="bars" role="img" aria-label="Seitenaufrufe pro Tag">';
    foreach ($st['days'] as $day => $n) {
        echo '<span title="' . e(date('d.m.', strtotime($day))) . ': ' . $n . '" style="height:' . max(2, (int)round($n / $max * 100)) . '%"></span>';
    }
    echo '</div><div class="cols">';
    $tot = max(1, $st['dev']['m'] + $st['dev']['d']);
    echo '<div><h3>Geräte</h3><p>Handy ' . (int)round($st['dev']['m'] / $tot * 100) . ' % · Rechner ' . (int)round($st['dev']['d'] / $tot * 100) . ' %</p><h3>Seiten</h3><ul class="plain">';
    $label = ['home' => 'Startseite', 'home-en' => 'Startseite (Englisch)', 'impressum' => 'Impressum', 'datenschutz' => 'Datenschutz', 'impressum-en' => 'Imprint', 'datenschutz-en' => 'Privacy'];
    foreach (array_slice($st['pages'], 0, 5, true) as $pg => $n) {
        echo '<li>' . e($label[$pg] ?? $pg) . ': ' . $n . '</li>';
    }
    echo '</ul></div><div><h3>Woher kommen Besucher?</h3>';
    echo $st['refs'] ? '<ul class="plain">' : '<p class="hint">Noch keine Verweise.</p>';
    foreach ($st['refs'] as $r => $n) {
        echo '<li>' . e($r) . ': ' . $n . '</li>';
    }
    echo $st['refs'] ? '</ul>' : '';
    echo '</div></div><p class="hint">Ein Gerät zählt höchstens einmal pro Stunde als Besuch (Aufrufe zählen alle Seitenaufrufe). Gespeichert werden nur Stunde, Seite, Gerätetyp und verweisende Domain – ohne Cookies und ohne IP-Adresse. Für die Stunden-Erkennung liegt kurz ein nicht umkehrbarer Kurzwert auf dem Server und wird zum Stundenende gelöscht. Bots und „Do Not Track“ werden nicht gezählt.</p></section>';

    // Bereiche
    echo '<h2 class="fs">Bereiche</h2><div class="tiles">';
    foreach (admin_menu() as $head => $entries) {
        foreach ($entries as [$kind, $key]) {
            $label2 = $kind === 'c' ? $s['collections'][$key]['label'] : $s['groups'][$key]['label'];
            $href = $kind === 'c' ? a('p=list&c=' . $key) : a('p=group&g=' . $key);
            $count = $kind === 'c' ? count(items($key, false, true)) : null;
            echo '<a class="tile" href="' . $href . '"><span class="t-h">' . e($head) . '</span><strong>' . e($label2) . '</strong>' . ($count !== null ? '<span class="t-c">' . $count . ' Einträge</span>' : '') . '</a>';
        }
    }
    echo '</div>';
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
