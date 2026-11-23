<?php
// Selbsttest gegen den lokalen Entwicklungsserver (config.php: mail driver = 'log').
// Aufruf: php tools/selftest.php http://127.0.0.1:8080
$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
$root = dirname(__DIR__);
$cfg = require $root . '/config.php';
$owner = $cfg['owner_email'];
$jar = tempnam(sys_get_temp_dir(), 'jar');
$fail = 0;

function req(string $method, string $url, array $post = []): array
{
    global $jar;
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_FOLLOWLOCATION => false, CURLOPT_USERAGENT => 'test-client']);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
    }
    $r = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['code' => $code, 'head' => substr((string)$r, 0, $hs), 'body' => substr((string)$r, $hs)];
}
function ok(bool $c, string $msg): void
{
    global $fail;
    echo ($c ? '  OK   ' : '  FAIL ') . $msg . "\n";
    if (!$c) {
        $fail++;
    }
}
function follow(array $r): array
{
    global $base;
    if (preg_match('~Location: (\S+)~i', $r['head'], $m)) {
        $u = $m[1];
        return req('GET', $u[0] === '/' ? $base . $u : $u);
    }
    return $r;
}
function csrf(string $html): string
{
    preg_match('~name="_csrf" value="([a-f0-9]+)"~', $html, $m);
    return $m[1] ?? '';
}

echo "Öffentliche Seite\n";
$r = req('GET', "$base/");
ok($r['code'] === 200 && str_contains($r['body'], 'Antonia'), 'Startseite 200');
ok(str_contains($r['head'], 'Content-Security-Policy'), 'CSP-Header');
ok(!str_contains($r['body'], 'fonts.googleapis'), 'keine Google-Fonts');
ok(substr_count($r['body'], '<li class="ar-clip') === 11, '11 Referenzen in der Liste');
foreach (['lib/bootstrap.php', 'config.php', 'data/', 'templates/page.php', 'tools/selftest.php'] as $p) {
    $c = req('GET', "$base/$p")['code'];
    ok(in_array($c, [403, 404], true), "$p gesperrt ($c)");
}
ok(req('GET', "$base/impressum")['code'] === 200, 'Impressum erreichbar');

echo "Anmeldung\n";
@unlink("$root/data/mail.log");
$r = req('GET', "$base/admin/");
ok(str_contains($r['body'], 'Code senden'), 'Login-Seite');
$r = req('POST', "$base/admin/", ['action' => 'request', 'email' => 'fremd@example.com']);
ok(str_contains($r['body'], 'Code eingeben') && !is_file("$root/data/mail.log"), 'Unbekannte Adresse: neutrale Antwort, keine Mail');
$r = req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
ok(is_file("$root/data/mail.log"), 'Code-Mail ausgelöst');
preg_match('~(\d{4}) (\d{4})~', (string)@file_get_contents("$root/data/mail.log"), $m);
$code = ($m[1] ?? '') . ($m[2] ?? '');
$r = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => '00000000']);
ok(str_contains($r['body'], 'ungültig'), 'Falscher Code abgelehnt');
$r = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $code]);
ok($r['code'] === 302 && str_contains($r['head'], 'ar_admin'), 'Richtiger Code: angemeldet');
$home = req('GET', "$base/admin/");
ok(str_contains($home['body'], 'Referenzen'), 'Übersicht nach Login');
$tok = csrf($home['body']);

echo "Referenzen: anlegen, bearbeiten, Papierkorb\n";
$base_post = ['action' => 'save_item', 'coll' => 'clips', 'title' => 'Test-Referenz <b>', 'medium' => 'radio', 'date' => '2025-06-15', 'tl_track' => 'A1', 'published' => '1', 'new_tab' => '1', 'link_text' => 'Los'];
$r = req('POST', "$base/admin/", $base_post + ['url' => 'https://example.org/x']);
ok($r['code'] === 403, 'Ohne CSRF-Token abgelehnt');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'url' => 'javascript:alert(1)'] + $base_post);
ok(str_contains($r['body'], 'ungültiger Link'), 'javascript:-Link abgelehnt');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'url' => 'https://example.org/x'] + $base_post);
ok($r['code'] === 302, 'Referenz gespeichert');
$pub = req('GET', "$base/");
ok(str_contains($pub['body'], 'Test-Referenz &lt;b&gt;') && !str_contains($pub['body'], 'Test-Referenz <b>'), 'erscheint maskiert auf der Seite');
ok(substr_count($pub['body'], '<li class="ar-clip') === 12, 'jetzt 12 Referenzen');
$list = req('GET', "$base/admin/?p=list&c=clips");
preg_match_all('~name="id" value="(\d+)"~', $list['body'], $ids);
$newId = (int)max($ids[1]);
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $newId]);
ok($r['code'] === 302, 'In den Papierkorb');
ok(!str_contains(req('GET', "$base/")['body'], 'Test-Referenz'), 'nicht mehr öffentlich');
$trash = req('GET', "$base/admin/?p=trash");
ok(str_contains($trash['body'], 'Test-Referenz') && str_contains($trash['body'], 'Wiederherstellen'), 'im Papierkorb sichtbar');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'restore', 'id' => $newId]);
ok(str_contains(req('GET', "$base/")['body'], 'Test-Referenz'), 'wiederhergestellt: wieder öffentlich');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $newId]);
ok(str_contains(req('GET', "$base/admin/?p=list&c=clips")['body'], 'Test-Referenz'), 'Löschen ohne Papierkorb wirkungslos');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $newId]);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $newId]);
ok(!str_contains(req('GET', "$base/admin/?p=trash")['body'], 'Test-Referenz'), 'endgültig gelöscht');

echo "Zeitleiste, Einstellungen, Zugänge\n";
$tlp = ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'timeline', 'end' => '2026-12-31', 'min_w' => '2.8', 'hint_mobile' => 'x'];
$r = req('POST', "$base/admin/", $tlp + ['start' => '2023-01-01']);
ok($r['code'] === 302, 'Zeitraum der Zeitleiste ändern');
ok(str_contains(req('GET', "$base/")['body'], '>2023<'), 'Spalte 2023 erscheint');
req('POST', "$base/admin/", $tlp + ['start' => '2024-01-01']);
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'add_user', 'email' => 'antonia@antoniarueller.de', 'name' => 'A']);
ok(str_contains(follow($r)['body'], 'eigenen Domain'), 'Domain-Postfach als Zugang abgelehnt');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'logout']);
ok(str_contains(req('GET', "$base/admin/")['body'], 'Code senden'), 'Abgemeldet');
ok(!str_contains(req('GET', "$base/admin/?p=trash")['body'], 'Papierkorb leeren'), 'ohne Login kein Zugriff');

echo $fail ? "\n$fail FEHLER\n" : "\nAlles bestanden\n";
exit($fail ? 1 : 0);
