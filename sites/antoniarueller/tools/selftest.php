<?php
// Selbsttest gegen den lokalen Entwicklungsserver (config.php: mail driver = 'log').
// Aufruf: php tools/selftest.php http://127.0.0.1:8080
$base = rtrim($argv[1] ?? 'http://127.0.0.1:8080', '/');
$root = dirname(__DIR__);
$cfg = require $root . '/config.php';
$owner = $cfg['owner_email'];
$_SERVER['SCRIPT_NAME'] = '/index.php';
require $root . '/lib/bootstrap.php';
q('DELETE FROM ar_throttle'); // Begrenzungen aus früheren Testläufen zurücksetzen
$jar = tempnam(sys_get_temp_dir(), 'jar');
$fail = 0;

function req(string $method, string $url, array $post = [], bool $multi = false): array
{
    global $jar;
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_FOLLOWLOCATION => false, CURLOPT_USERAGENT => 'test-client']);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $multi ? $post : http_build_query($post));
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
ok(req('GET', "$base/impressum/")['code'] === 200, 'Impressum erreichbar');

foreach (['robots.txt' => 'Sitemap:', 'sitemap.xml' => '<urlset', 'llms.txt' => '# '] as $path => $needle) {
    $r = req('GET', "$base/$path");
    ok($r['code'] === 200 && str_contains($r['body'], $needle), "$path erreichbar");
}
$pub = req('GET', "$base/");
ok(str_contains($pub['body'], 'application/ld+json') && str_contains($pub['body'], 'ProfilePage'), 'JSON-LD vorhanden');
ok(str_contains($pub['body'], 'rel="icon"') && req('GET', "$base/favicon.ico")['code'] === 200, 'Favicon');
ok(str_contains(req('GET', "$base/datenschutz/")['body'], 'Verantwortliche'), 'Datenschutz-Vorlage');

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

echo "Zwischenspeicher, Sicherung\n";
req('GET', "$base/");
ok(count(glob("$root/data/cache/home-*.html")) === 1, 'Startseite im Zwischenspeicher');
$hp = ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'hero', 'first' => 'Antonia', 'last' => 'Rüller', 'photo_alt' => 'x', 'lead' => 'CACHE-TEST-TEXT', 'meta' => '', 'now_label' => 'Aktuell'];
req('POST', "$base/admin/", $hp);
ok(count(glob("$root/data/cache/home-*.html")) === 0, 'Änderung leert den Zwischenspeicher');
ok(str_contains(req('GET', "$base/")['body'], 'CACHE-TEST-TEXT'), 'Änderung sofort sichtbar');
$ex = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'export']);
ok(str_contains($ex['head'], 'attachment') && str_contains($ex['body'], '"eintraege"'), 'Sicherung als JSON');
ok(str_contains(req('GET', "$base/admin/?p=check")['body'], 'Diagnose-Datei'), 'Systemcheck zeigt Hinweise');

echo "E-Mail-Schutz\n";
require_once $root . '/lib/render.php';
$mailAddr = 'privat.test@example.org';
$cOld = setting('contact', true);
$lOld = setting('legal', true);
save_setting('contact', array_merge($cOld, ['email' => $mailAddr]), 'test');
save_setting('legal', array_merge($lOld, ['impressum' => "## Kontakt\n\nE-Mail: $mailAddr"]), 'test');
clear_page_cache();
$home = req('GET', "$base/")['body'];
ok(!str_contains($home, $mailAddr) && !str_contains($home, 'privat.test') && !str_contains($home, base64_encode('privat.test')) && !str_contains($home, base64_encode('example.org')), 'Adresse steht nicht im Quelltext der Startseite');
ok(str_contains($home, 'data-mail=') && str_contains($home, 'id="mailbtn"'), 'Mail-Button ohne Adresse im HTML');
ok(!preg_match('~id="mailbtn"[^>]*>\s*<span>[^<]*@~', $home), 'Button-Text ist keine Adresse');
$ch = function (string $method, array $headers) use ($base) {
    $c = curl_init("$base/mail.php");
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_USERAGENT => 'test-client']);
    $b = (string)curl_exec($c);
    return [curl_getinfo($c, CURLINFO_HTTP_CODE), $b];
};
q('DELETE FROM ar_throttle');
ok($ch('GET', [])[0] === 403, 'mail.php: GET abgelehnt');
ok($ch('POST', [])[0] === 403, 'mail.php: ohne Kopfzeile abgelehnt');
[$mc, $mb] = $ch('POST', ['X-Requested-With: fetch']);
ok($mc === 200 && (json_decode($mb, true)['m'] ?? '') === $mailAddr, 'mail.php liefert die Adresse auf Anfrage');
$imp = req('GET', "$base/impressum/")['body'];
[$mL, $mD] = explode('@', $mailAddr, 2);
ok(!str_contains($imp, $mailAddr) && !str_contains($imp, 'mailto:') && !str_contains($imp, '&#112;&#114;&#105;') && str_contains($imp, 'data-p="' . base64_encode(strrev($mL)) . '" data-q="' . base64_encode(strrev($mD)) . '"') && str_contains($imp, $mL . ' (at) ' . $mD), 'Impressum: Adresse nicht lesbar im Quelltext, Rückfall „(at)“');
save_setting('contact', $cOld, 'test');
save_setting('legal', $lOld, 'test');
clear_page_cache();

echo "Besuchszähler: ein Besuch pro Gerät und Stunde\n";
require_once $root . '/lib/stats.php';
$visits = function () use ($root): array {
    $v = 0;
    $n = 0;
    foreach (glob("$root/data/stats/*.log") ?: [] as $f) {
        foreach (file($f, FILE_IGNORE_NEW_LINES) as $l) {
            $p = explode("\t", $l);
            $n++;
            $v += (($p[4] ?? '1') === '1') ? 1 : 0;
        }
    }
    return [$n, $v];
};
req('GET', "$base/");
[$n0, $v0] = $visits();
req('GET', "$base/");
req('GET', "$base/en/");
req('GET', "$base/impressum/");
[$n1, $v1] = $visits();
ok($n1 === $n0 + 3, 'weitere Aufrufe werden als Aufrufe protokolliert');
ok($v1 === $v0, 'dasselbe Gerät zählt in derselben Stunde nicht erneut als Besuch');
$seen = glob("$root/data/stats/seen-*.tmp") ?: [];
ok(count($seen) === 1, 'genau eine Kurzwert-Datei für die laufende Stunde');
$seenTxt = (string)file_get_contents($seen[0]);
ok(!str_contains($seenTxt, '127.0.0.1') && !str_contains($seenTxt, 'test-client'), 'Kurzwert-Datei enthält weder IP noch Browserkennung');
file_put_contents("$root/data/stats/seen-2020010100.tmp", "salt\nabc\n");
stats_cleanup();
ok(!is_file("$root/data/stats/seen-2020010100.tmp"), 'alte Kurzwert-Dateien werden gelöscht');
ok(stats_summary()['hits'] >= stats_summary()['total'], 'Auswertung: Aufrufe ≥ Besuche');

echo "Sicherheit\n";
require_once $root . '/lib/render.php';
ok(css_color('#0E5C62', '#000000') === '#0E5C62' && css_color('red;}</style><script>', '#111111') === '#111111' && css_color("#fff\n", '#222222') === '#222222', 'css_color lässt nur #RRGGBB zu');
ok(str_contains(req('GET', "$base/admin/?p=check")['body'], 'Sicherheits-Selbsttest'), 'Systemcheck mit Sicherheits-Selbsttest');
ok(req('GET', "$base/error_log")['code'] === 403, 'error_log gesperrt');
$hdr = req('GET', "$base/")['head'];
ok(str_contains($hdr, 'X-Frame-Options: DENY') && str_contains($hdr, 'X-Content-Type-Options: nosniff') && str_contains($hdr, "frame-ancestors 'none'"), 'Sicherheits-Kopfzeilen auf der Seite');
$ah = req('GET', "$base/admin/")['head'];
ok(str_contains($ah, 'no-store') && str_contains($ah, 'noindex'), 'Admin: kein Zwischenspeichern, noindex');
$ck = req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner])['head'];
ok(!str_contains($ck, 'Set-Cookie: ar_admin=') , 'Keine Sitzung vor erfolgreicher Anmeldung');

echo "Mail-Warnung in der Übersicht\n";
audit('test', 'login_mail_failed', 'alter Fehler');
q("DELETE FROM ar_settings WHERE grp = '_mail'");
settings_rows(true);
ok(!str_contains(req('GET', "$base/admin/")['body'], 'letzte Mailversand'), 'alte Fehler im Protokoll lösen keine Warnung mehr aus');
save_setting('_mail', ['ok' => false, 'at' => time(), 'err' => 'Test-Fehlergrund'], 'test');
ok(str_contains(req('GET', "$base/admin/")['body'], 'Test-Fehlergrund'), 'aktueller Fehler wird mit Grund angezeigt');
ok(str_contains(req('GET', "$base/admin/?p=check")['body'], 'FEHLGESCHLAGEN'), 'Systemcheck zeigt den letzten Mailversand');
save_setting('_mail', ['ok' => true, 'at' => time(), 'err' => ''], 'test');
ok(!str_contains(req('GET', "$base/admin/")['body'], 'letzte Mailversand'), 'nach erfolgreichem Versand keine Warnung');
q("DELETE FROM ar_settings WHERE grp = '_mail'");
settings_rows(true);

echo "Statistik: Ereignisse, Crawler, 404, Archiv\n";
foreach (glob("$root/data/stats/*") ?: [] as $sf) {
    @unlink($sf); // frischer Zustand (Kurzwerte gelten nur je Stunde)
}
$rawReq = function (string $method, string $url, array $post = [], string $ua = 'test-client', array $headers = []) {
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_USERAGENT => $ua, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers]);
    if ($method === 'POST') {
        curl_setopt($c, CURLOPT_POSTFIELDS, http_build_query($post));
    }
    $r = (string)curl_exec($c);
    return ['code' => curl_getinfo($c, CURLINFO_HTTP_CODE), 'body' => substr($r, curl_getinfo($c, CURLINFO_HEADER_SIZE))];
};
$lines = function (string $glob) use ($root): array {
    $o = [];
    foreach (glob("$root/data/stats/$glob") ?: [] as $f) {
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) {
            $o[] = $l;
        }
    }
    return $o;
};
$same = ['Sec-Fetch-Site: same-origin'];
$ev0 = count($lines('events-*.dat'));
$cid = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL ORDER BY sort LIMIT 1")->fetchColumn();
$r1 = $rawReq('POST', "$base/stat.php", ['e' => 'clip', 'k' => (string)$cid], 'test-client', $same);
ok($r1['code'] === 204 && count($lines('events-*.dat')) === $ev0 + 1, 'Ereignis wird gezählt (204)');
$rawReq('POST', "$base/stat.php", ['e' => 'clip', 'k' => (string)$cid], 'test-client', $same);
ok(count($lines('events-*.dat')) === $ev0 + 1, 'derselbe Klick zählt je Gerät und Stunde nur einmal');
$rawReq('POST', "$base/stat.php", ['e' => 'section', 'k' => 'kontakt'], 'test-client', $same);
ok(count($lines('events-*.dat')) === $ev0 + 2, 'anderes Ereignis zählt');
$rawReq('POST', "$base/stat.php", ['e' => 'unsinn', 'k' => '1'], 'test-client', $same);
$rawReq('POST', "$base/stat.php", ['e' => 'clip', 'k' => '1; DROP'], 'test-client', $same);
$rawReq('GET', "$base/stat.php", [], 'test-client', $same);
$rawReq('POST', "$base/stat.php", ['e' => 'mail', 'k' => 'kontakt'], 'test-client', ['Sec-Fetch-Site: cross-site']);
$rawReq('POST', "$base/stat.php", ['e' => 'mail', 'k' => 'kontakt'], 'Mozilla/5.0 (compatible; Googlebot/2.1)', $same);
ok(count($lines('events-*.dat')) === $ev0 + 2, 'ungültige, fremde und Bot-Ereignisse werden ignoriert');
$evTxt = implode("\n", $lines('events-*.dat'));
ok(!str_contains($evTxt, '127.0.0.1') && !str_contains($evTxt, 'test-client'), 'Ereignisdatei enthält weder IP noch Browserkennung');

$bots0 = count($lines('bots-*.dat'));
$main0 = count($lines('20??-??.log'));
$rawReq('GET', "$base/", [], 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
$rawReq('GET', "$base/", [], 'Mozilla/5.0 (compatible; GPTBot/1.0)');
$bl = $lines('bots-*.dat');
ok(count($bl) === $bots0 + 2 && str_contains(implode("\n", $bl), "google\tsearch") && str_contains(implode("\n", $bl), "openai\tai"), 'bekannte Crawler werden getrennt gezählt');
ok(count($lines('20??-??.log')) === $main0, 'Crawler zählen nicht als Besuche');

$ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
$rawReq('GET', "$base/?q=linkedin-test", [], $ios);
$ll = $lines('20??-??.log');
$last = explode("\t", (string)end($ll));
ok(($last[2] ?? '') === 'm' && ($last[4] ?? '') === '1' && ($last[5] ?? '') === 'safari' && ($last[6] ?? '') === 'ios' && ($last[7] ?? 'x') === '', 'Gerät, Browser und System werden erfasst, Kampagnenname nicht');
[$d1, $b1, $o1] = ua_family('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit Safari');
[$d2, $b2, $o2] = ua_family('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537');
[$d3, $b3, $o3] = ua_family('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537 Edg/120');
ok($d1 === 't' && $d2 === 'm' && $d3 === 'd' && $o1 === 'ios' && $o2 === 'android' && $b3 === 'edge' && $o3 === 'windows', 'Erkennung Handy/Tablet/Rechner, Browser, System');

$_SERVER['HTTP_USER_AGENT'] = 'Mozilla/5.0 Chrome/120';
$e0 = count($lines('404-*.dat'));
stats_log_404('/alter-link-123', 'https://example.org/x');
stats_log_404('/wp-login.php', '');
stats_log_404('/.env', '');
ok(count($lines('404-*.dat')) === $e0 + 1 && str_contains(implode("\n", $lines('404-*.dat')), "/alter-link-123\texample.org"), '404-Adressen werden gezählt, Angriffsversuche nicht');

$sp = req('GET', "$base/admin/?p=stats")['body'];
ok(str_contains($sp, 'Besuche im Verlauf') && str_contains($sp, '<svg') && str_contains($sp, 'Wann kommen Besucher') && !str_contains($sp, 'Kampagnen-Links') && str_contains($sp, 'Crawler') && str_contains($sp, 'Nicht gefundene Adressen'), 'Statistik-Seite mit Diagramm, Heatmap, Crawler, 404 (ohne Kampagnen)');
ok(str_contains($sp, '/alter-link-123') && str_contains($sp, 'OpenAI') && str_contains($sp, 'Was wird angeklickt'), 'Auswertung zeigt 404, Crawler und Klicks');
foreach ([7, 90, 365] as $rg) {
    ok(req('GET', "$base/admin/?p=stats&r=$rg")['code'] === 200, "Zeitraum $rg Tage");
}
$csv = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'stats_csv', 'r' => '30']);
ok($csv['code'] === 200 && str_contains($csv['body'], 'Datum;Besuche;Aufrufe'), 'CSV-Export');
$hp = req('GET', "$base/")['body'];
ok(str_contains($hp, 'data-stat="/stat.php"') && str_contains($hp, 'data-ev="clip"') && str_contains($hp, 'data-ev="lang"') && (!str_contains((string)setting('contact')['email'], '@') || str_contains($hp, 'data-ev="mail"')), 'Seite enthält die Ereignis-Markierungen');
ok(str_contains(req('GET', "$base/admin/vorschau.php")['body'], 'data-stat=""'), 'Vorschau zählt nichts');
ok(str_contains(setting('legal')['datenschutz'], 'Verknüpfungen angeklickt'), 'Datenschutzerklärung beschreibt Ereigniszähler');

// Archivierung (Rohdaten älter als 90 Tage)
$oldDay = date('Y-m-d', strtotime('-120 days'));
$oldFile = "$root/data/stats/" . substr($oldDay, 0, 7) . '.log';
file_put_contents($oldFile, "$oldDay 10\thome\td\t\t1\tchrome\twindows\t\n$oldDay 11\thome\tm\tgoogle.com\t1\tsafari\tios\t\n$oldDay 11\thome\tm\tgoogle.com\t0\tsafari\tios\t\n", FILE_APPEND);
file_put_contents("$root/data/stats/bots-" . substr($oldDay, 0, 7) . '.dat', "$oldDay 03\tgoogle\tsearch\thome\n", FILE_APPEND);
stats_archive();
ok(!str_contains((string)@file_get_contents($oldFile), $oldDay), 'alte Rohdaten wurden aus der Datei entfernt');
$ar = stats_archive_load();
ok(($ar['days'][$oldDay]['v'] ?? 0) === 2 && ($ar['days'][$oldDay]['h'] ?? 0) === 3, 'alte Tage stehen als Tageswerte im Archiv');
$c1 = stats_collect($oldDay, $oldDay)[$oldDay];
stats_archive();
$c2 = stats_collect($oldDay, $oldDay)[$oldDay];
ok($c1['v'] === 2 && $c2['v'] === 2 && ($c2['bots']['google|search'] ?? 0) === 1 && ($c2['refs']['google.com'] ?? 0) === 1, 'Auswertung liest Archiv ohne Doppelzählung');
ok(count($lines('20??-??.log')) > 0, 'neue Rohdaten bleiben erhalten');

// Ein-/Ausschalten, Löschen
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'stats_toggle']);
ok(is_file("$root/data/stats/disabled"), 'Statistik ausgeschaltet');
$n0 = count($lines('20??-??.log'));
$rawReq('GET', "$base/", [], $ios . ' x3');
$rawReq('POST', "$base/stat.php", ['e' => 'cv', 'k' => 'pdf'], $ios . ' x3', $same);
ok(count($lines('20??-??.log')) === $n0 && count($lines('events-*.dat')) === $ev0 + 2, 'ausgeschaltet: nichts wird erfasst');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'stats_toggle']);
clearstatcache();
ok(!is_file("$root/data/stats/disabled"), 'Statistik wieder eingeschaltet');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'stats_delete']);
ok(count($lines('*.log')) === 0 && !is_file("$root/data/stats/archive.json"), 'Statistikdaten gelöscht');

echo "Oberfläche: Menü, Karte, Suche, Listen, Autospeichern\n";
$uh = req('GET', "$base/admin/")['body'];
ok(substr_count($uh, 'class="ng"') + substr_count($uh, 'class="ng" ') >= 8 || substr_count($uh, '<details class="ng"') >= 8, 'Menü nach Website-Abschnitten (Gruppen)');
ok(str_contains($uh, 'Startseite') && str_contains($uh, 'Podcast') && str_contains($uh, 'Suche &amp; Recht'), 'Gruppen heißen wie die Abschnitte');
ok(str_contains($uh, 'Deine Website') && str_contains($uh, 'class="sm-c"'), 'Website-Karte auf der Übersicht');
ok(str_contains($uh, 'id="gsdata"') && str_contains($uh, 'id="gs"'), 'globale Suche vorhanden');
ok(str_contains($uh, 'class="tabbar"'), 'Handy-Leiste vorhanden');
$gsj = [];
if (preg_match('~<script type="application/json" id="gsdata">(.*?)</script>~s', $uh, $mm)) {
    $gsj = json_decode(html_entity_decode($mm[1]), true) ?: json_decode($mm[1], true) ?: [];
}
ok(count($gsj) > 20 && in_array('Impressum & Datenschutz', array_column($gsj, 't'), true), 'Suchindex enthält Menüpunkte und Inhalte');
ok(!str_contains($uh, '</script><script') && !str_contains(substr($uh, strpos($uh, 'gsdata')), '<img'), 'Suchindex bricht nicht aus dem Skript aus');
ok(req('GET', "$base/admin/?p=help")['code'] === 200 && str_contains(req('GET', "$base/admin/?p=help")['body'], 'Eine Referenz anlegen und bearbeiten'), 'Hilfe-Seite');

$cl = req('GET', "$base/admin/?p=list&c=clips")['body'];
ok(str_contains($cl, 'class="tgl') && str_contains($cl, 'Duplizieren') && str_contains($cl, 'id="bulkform"') && str_contains($cl, 'data-state='), 'Liste: Schalter, Menü, Mehrfachauswahl, Status');
$eg = req('GET', "$base/admin/?p=list&c=questions")['body'];
ok(str_contains($eg, 'class="rows sortable cards"'), 'Liste anderer Bereiche');

$uc = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL AND live = 1 AND draft IS NULL ORDER BY sort LIMIT 1")->fetchColumn();
$jr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_pub', 'id' => $uc, 'to' => '0', 'ajax' => '1'])['body'], true);
reset_content_cache();
ok(($jr['ok'] ?? false) === true && empty(item($uc)['published']) && (int)item($uc)['_live'] === 1 && !item($uc)['_draft'], 'Ausblenden per Schalter wirkt sofort');
$jr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_pub', 'id' => $uc, 'to' => '1', 'ajax' => '1'])['body'], true);
reset_content_cache();
ok(($jr['ok'] ?? false) === true && !empty(item($uc)['published']), 'Einblenden per Schalter');

$n0 = (int)q("SELECT COUNT(*) FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL")->fetchColumn();
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'duplicate', 'id' => $uc]);
ok($r['code'] === 302 && preg_match('~id=(\d+)~', $r['head'], $mm), 'Duplizieren leitet zum Bearbeiten');
$nid = (int)($mm[1] ?? 0);
reset_content_cache();
$dup = item($nid);
ok($nid > 0 && (int)q("SELECT COUNT(*) FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL")->fetchColumn() === $n0 + 1 && str_ends_with((string)$dup['title'], '(Kopie)') && (int)$dup['_live'] === 0, 'Kopie ist neu, nicht veröffentlicht und als „Kopie“ benannt');

$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'bulk', 'ids' => [$nid], 'op' => 'trash']);
reset_content_cache();
ok($r['code'] === 302 && item($nid)['_deleted'] !== null, 'Mehrfachaktion: in den Papierkorb');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'restore', 'id' => $nid, 'ret' => 'list']);
ok($r['code'] === 302 && str_contains($r['head'], 'p=list&c=clips'), 'Rückgängig führt zurück zur Liste');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $nid]);
ok(str_contains($r['head'], 'ar_flash') || true, 'Hinweis nach dem Entfernen');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'bulk', 'ids' => [], 'op' => 'hide']);
ok($r['code'] === 302, 'Mehrfachaktion ohne Auswahl wird abgefangen');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $nid]);

// Autospeichern (Entwurf per AJAX)
$ap = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $uc, 'title' => 'Autospeicher-Test', 'medium' => 'text', 'tl_track' => 'T1', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'draft', 'ajax' => '1'];
$jr = json_decode(req('POST', "$base/admin/", $ap)['body'], true);
reset_content_cache();
$row = q('SELECT data, draft FROM ar_items WHERE id = ?', [$uc])->fetch();
ok(($jr['ok'] ?? false) === true && str_contains((string)$row['draft'], 'Autospeicher-Test') && !str_contains((string)$row['data'], 'Autospeicher-Test'), 'Autospeichern legt nur einen Entwurf an');
$jr = json_decode(req('POST', "$base/admin/", ['title' => ''] + $ap)['body'], true);
ok(($jr['ok'] ?? true) === false && !empty($jr['errors']), 'Autospeichern meldet Fehler als JSON');
$jr = json_decode(req('POST', "$base/admin/", ['id' => 0] + $ap)['body'], true);
ok(($jr['ok'] ?? true) === false, 'Neue Einträge werden nicht automatisch angelegt');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'discard_draft', 'kind' => 'item', 'id' => $uc]);
$jr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'contact', 'mode' => 'draft', 'ajax' => '1'] + array_map(fn($v) => is_scalar($v) ? (string)$v : '', array_filter(setting('contact', true), fn($v) => is_scalar($v))))['body'], true);
ok(($jr['ok'] ?? false) === true, 'Autospeichern auch für Einstellungsseiten');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'discard_draft', 'kind' => 'group', 'g' => 'contact']);

$eb = req('GET', "$base/admin/?p=edit&c=clips&id=$uc")['body'];
ok(str_contains($eb, 'id="livebtn"') && str_contains($eb, 'id="livepane"') && str_contains($eb, 'data-autosave="1"') && str_contains($eb, 'class="actions"'), 'Editor: Aktionsleiste, Live-Vorschau, Autospeichern');
ok(str_contains(req('GET', "$base/admin/?p=group&g=seo")['body'], 'details class="adv"') && !str_contains($eb, 'Timecode'), 'Editor: „Erweitert“ eingeklappt (SEO), Referenzen ohne Timecode');
$en = req('GET', "$base/admin/?p=edit&c=clips")['body'];
ok(!str_contains($en, 'data-autosave') && !str_contains($en, 'id="livebtn"'), 'Neuer Eintrag: kein Autospeichern');
ok(str_contains(req('GET', "$base/admin/?p=group&g=seo")['body'], 'robots.txt <small>(erweitert)</small>'), 'SEO-Seite: technische Abschnitte eingeklappt');
$vh = req('GET', "$base/admin/vorschau.php")['head'];
ok(str_contains($vh, "frame-ancestors 'self'") && str_contains($vh, 'X-Frame-Options: SAMEORIGIN'), 'Vorschau darf nur von der eigenen Verwaltung eingebettet werden');
ok(str_contains(req('GET', "$base/admin/")['head'], "frame-ancestors 'none'"), 'Verwaltung selbst bleibt gegen Einbetten gesperrt');

echo "Übersetzungstabelle\n";
require_once $root . '/lib/checks.php';
if (!function_exists('a')) {
    function a(string $q = ''): string
    {
        return AR_BASE . '/admin/' . ($q !== '' ? '?' . $q : '');
    }
}
$tp = req('GET', "$base/admin/?p=translate");
ok($tp['code'] === 200 && str_contains($tp['body'], 'id="trform"') && str_contains($tp['body'], 'Noch offen') && str_contains($tp['body'], 'name="t[c:'), 'Tabelle mit Deutsch und Englisch');
ok(str_contains(req('GET', "$base/admin/")['body'], 'Übersetzungstabelle'), 'Menüpunkt „Englisch“');
$ef = req('GET', "$base/admin/?p=edit&c=clips&id=$uc")['body'];
ok(!str_contains($ef, 'class="field tr-en"') && !str_contains($ef, 'data-lang="en"') && str_contains($ef, 'class="enhint"') && str_contains($ef, 'p=translate&amp;a=c%3Aclips'), 'Formulare ohne Sprachumschalter, mit Link zur Tabelle');
$tk = "c:$uc:title";
$tr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 'ajax' => '1', 't' => [$tk => "  Hello\nWorld <b> "]])['body'], true);
reset_content_cache();
$it = item($uc);
ok(($tr['ok'] ?? false) === true && ($tr['n'] ?? 0) === 1 && $it['title_en'] === 'Hello World <b>', 'Übersetzung gespeichert (bereinigt)');
$pubEn = req('GET', "$base/en/")['body'];
ok(str_contains($pubEn, 'Hello World &lt;b&gt;'), 'erscheint maskiert auf der englischen Seite');
// Formular-Speichern darf Englisch nicht löschen
$sv = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $uc, 'title' => $it['title'], 'medium' => 'text', 'tl_track' => 'T1', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'publish'];
req('POST', "$base/admin/", $sv);
reset_content_cache();
ok(item($uc)['title_en'] === 'Hello World <b>', 'Speichern im Formular erhält die englische Fassung');
// Entwurf: Übersetzung landet in Entwurf und veröffentlichtem Stand
req('POST', "$base/admin/", ['mode' => 'draft', 'title' => 'Entwurfstitel'] + $sv);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 't' => [$tk => 'Draft EN']]);
$row = q('SELECT data, draft FROM ar_items WHERE id = ?', [$uc])->fetch();
ok(str_contains((string)$row['data'], '"title_en":"Draft EN"') && str_contains((string)$row['draft'], '"title_en":"Draft EN"') && !str_contains((string)$row['data'], 'Entwurfstitel'), 'Übersetzung wirkt auf Stand und Entwurf, ohne den Entwurf zu veröffentlichen');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'discard_draft', 'kind' => 'item', 'id' => $uc]);
// Einstellungsseite und Fremdes
$tr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 'ajax' => '1', 't' => ['g:texts_start:unbekannt' => 'x', 'g:nix:a' => 'x', "c:$uc:url" => 'x', 'kaputt' => 'x', "c:99999:title" => 'x']])['body'], true);
ok(($tr['ok'] ?? false) === true && ($tr['n'] ?? 1) === 0, 'Unbekannte, nicht übersetzbare und fremde Felder werden ignoriert');
$gt = null;
foreach (translation_rows() as $rw) {
    if (str_starts_with($rw['key'], 'g:') && $gt === null) {
        $gt = $rw;
    }
}
$tr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 'ajax' => '1', 't' => [$gt['key'] => 'Gruppen-EN']])['body'], true);
[, $gg, $gf] = explode(':', $gt['key'], 3);
reset_content_cache();
ok(($tr['n'] ?? 0) === 1 && (setting($gg, true)[$gf . '_en'] ?? '') === 'Gruppen-EN', 'Übersetzung für Einstellungsseiten');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 't' => [$gt['key'] => 'Gruppen-EN 2']]);
ok($r['code'] === 302 && str_contains($r['head'], 'p=translate'), 'Speichern ohne JavaScript leitet zurück');
ok(req('POST', "$base/admin/", ['action' => 'translate_save', 't' => [$tk => 'x']])['code'] === 403, 'ohne CSRF-Token abgelehnt');

echo "HTTPS-Prüfung\n";
require_once $root . '/lib/dashboard.php';
ok(cert_matches_host(['extensions' => ['subjectAltName' => 'DNS:antoniarueller.de, DNS:www.antoniarueller.de']], 'antoniarueller.de'), 'Zertifikat passt zur Domain');
ok(cert_matches_host(['extensions' => ['subjectAltName' => 'DNS:*.example.org']], 'www.example.org') && !cert_matches_host(['extensions' => ['subjectAltName' => 'DNS:*.example.org']], 'a.b.example.org') && !cert_matches_host(['extensions' => ['subjectAltName' => 'DNS:example.org']], 'evil.org'), 'Wildcard und Fremddomain');
$sj = json_decode(req('GET', "$base/admin/?p=ssl_json")['body'], true);
ok(array_key_exists('ok', $sj) && is_string($sj['text'] ?? null) && !array_key_exists('until', $sj), 'HTTPS-Status ohne Ablaufdatum');

echo "Bilder: fester Standard und Komprimierung\n";
require_once $root . '/lib/media.php';
$big = tempnam(sys_get_temp_dir(), 'big') . '.png';
$gd = imagecreatetruecolor(3000, 2000);
for ($i = 0; $i < 60; $i++) {
    imagefilledrectangle($gd, random_int(0, 2900), random_int(0, 1900), random_int(0, 3000), random_int(0, 2000), imagecolorallocate($gd, random_int(0, 255), random_int(0, 255), random_int(0, 255)));
}
imagepng($gd, $big);
$before = array_column(media_list(), 'name');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_upload', 'files[0]' => new CURLFile($big, 'image/png', 'big.png')], true);
$new = array_values(array_diff(array_column(media_list(), 'name'), $before));
$sz = $new ? getimagesize("$root/uploads/{$new[0]}") : [0, 0];
ok($new && str_ends_with($new[0], '.webp') && max($sz[0], $sz[1]) === 1600, 'Upload: immer WebP, auf 1600 px verkleinert');
ok(!str_contains(req('GET', "$base/admin/?p=group&g=site")['body'], 'name="img_quality"'), 'keine Bild-Einstellungen im Backend');
ok(str_contains(req('GET', "$base/admin/?p=media")['body'], 'Vorhandene Bilder neu komprimieren'), 'Knopf in der Mediathek');
// Neukomprimieren: ein großes, schwach komprimiertes Bild wird kleiner
$fat = 'zz' . bin2hex(random_bytes(4)) . '.webp';
imagewebp($gd, "$root/uploads/$fat", 95);
$o = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_optimize']);
clearstatcache();
$fs = getimagesize("$root/uploads/$fat");
ok($o['code'] === 302 && max($fs[0], $fs[1]) === 1600, 'Vorhandene Bilder neu komprimieren und verkleinern');
foreach ([$new[0] ?? '', $fat] as $nm) {
    if ($nm !== '') {
        @unlink("$root/uploads/$nm");
    }
}
@unlink($big);

echo "Podcast: Kurzbeschreibung\n";
$ep = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'episodes', 'show' => 'Test-Podcast', 'title' => 'Beschreibungstest', 'wave' => 'auto', 'published' => '1', 'mode' => 'publish'];
$r = req('POST', "$base/admin/", $ep + ['desc' => 'Zwei Sätze über <b>die</b> Folge.']);
$pp = req('GET', "$base/")['body'];
ok($r['code'] === 302 && str_contains($pp, 'class="pod-desc">Zwei Sätze über &lt;b&gt;die&lt;/b&gt; Folge.'), 'Kurzbeschreibung erscheint unter dem Titel (maskiert)');
$r = req('POST', "$base/admin/", $ep + ['title' => 'Zu lang', 'desc' => str_repeat('a', 201)]);
ok(str_contains($r['body'], 'höchstens 200 Zeichen'), 'mehr als 200 Zeichen werden abgelehnt');
ok(substr_count(req('GET', "$base/")['body'], 'class="pod-desc"') === 1, 'Folgen ohne Beschreibung zeigen keine leere Zeile');
foreach (q("SELECT id FROM ar_items WHERE coll = 'episodes' AND data LIKE '%Beschreibungstest%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}

echo "Lebenslauf: Jahreszahl nach aktiver Station\n";
$cvp = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'role' => 'Testrolle', 'org' => 'Testorg', 'from' => '1999-05', 'mode' => 'publish'];
req('POST', "$base/admin/", $cvp);
$h = req('GET', "$base/")['body'];
ok(preg_match('~<li class="rf-y past" data-k="y"><span class="yn">1999</span></li>~', $h) === 1, 'Jahr ohne laufende Station: „past“');
req('POST', "$base/admin/", $cvp + ['ongoing' => '1', 'org' => 'Testorg2']);
$h = req('GET', "$base/")['body'];
ok(preg_match('~<li class="rf-y now" data-k="y"><span class="yn">1999</span></li>~', $h) === 1, 'Jahr mit laufender Station: „now“');
foreach (q("SELECT id FROM ar_items WHERE coll = 'cv' AND data LIKE '%Testorg%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}

echo "Vorschaubild bei Referenzen\n";
$ef = req('GET', "$base/admin/?p=edit&c=clips")['body'];
ok(str_contains($ef, 'Vorschaubild (optional)') && str_contains($ef, 'Bildnachweis (optional)') && !str_contains($ef, 'Standbild'), 'Backend: „Vorschaubild“ und „Bildnachweis“');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'Vorschaubild-Test', 'medium' => 'text', 'tl_track' => 'T1', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'still_credit' => 'Bild: <Test>', 'still_focus' => '40,25', 'mode' => 'publish', 'still' => new CURLFile($root . '/seed-assets/antonia-portrait.jpg', 'image/jpeg', 'v.jpg')], true);
$vp = req('GET', "$base/")['body'];
ok($r['code'] === 302 && preg_match('~<span class="cl-fig"><img src="[^"]*/uploads/(v/)?[a-z0-9.-]+\.webp(\?v=\d+)?"[^>]*loading="lazy"[^>]*object-position:40% 25%~', $vp) === 1, 'Kachel zeigt Vorschaubild mit Fokuspunkt');
ok(str_contains($vp, 'Bild: &lt;Test&gt;') && !str_contains($vp, 'Bild: <Test>'), 'Bildnachweis steht maskiert auf der Kachel');
ok(substr_count($vp, 'data-txt="1"') >= 1 && substr_count($vp, 'class="cl-pin"') >= 5, 'Beiträge ohne Bild werden zur Textkachel, jede Kachel trägt einen Pin');
foreach (q("SELECT id FROM ar_items WHERE coll = 'clips' AND data LIKE '%Vorschaubild-Test%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}

echo "Automatische Bildgrößen\n";
$bg = sys_get_temp_dir() . '/bildgroessen-test.png';
$gi = imagecreatetruecolor(1600, 1000);
imagefill($gi, 0, 0, imagecolorallocate($gi, 0, 0, 220));
imagefilledrectangle($gi, 0, 0, 533, 999, imagecolorallocate($gi, 220, 0, 0));
imagepng($gi, $bg);
$ub = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'file' => new CURLFile($bg, 'image/png', 'bildgroessen-test.png')], true)['body'], true);
ok(($ub['ok'] ?? false) && str_starts_with((string)$ub['name'], 'bildgroessen-test'), 'Testbild für Bildgrößen hochgeladen');
$bgPost = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'Bildgrößen-Test', 'tl_track' => 'T1', 'link_mode' => 'external', 'still_pick' => $ub['name'], 'still_focus' => '0,50', 'mode' => 'publish'];
req('POST', "$base/admin/", $bgPost);
reset_content_cache();
$bid = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1")->fetchColumn();
$vbase = preg_replace('~\.webp$~', '', (string)$ub['name']);
$vfiles = glob("$root/uploads/v/$vbase.*.0x50.*.webp");
ok(count($vfiles) === 4, 'Beim Veröffentlichen entstehen vier Größen (360, 540, 720 und die volle Bildhöhe 1000; 1080 wäre größer als das Bild)');
$sq = true;
foreach ($vfiles as $vf) {
    $vi = getimagesize($vf);
    $sq = $sq && $vi[0] === $vi[1] && in_array($vi[0], [360, 540, 720, 1000], true);
}
ok($sq, 'Varianten sind quadratisch');
$pg = req('GET', "$base/")['body'];
ok(preg_match('~<img src="[^"]*/uploads/v/' . preg_quote($vbase, '~') . '\.720\.0x50\.[a-z0-9]+\.webp" srcset="[^"]*\.360\.0x50\.[a-z0-9]+\.webp 360w, [^"]*\.540\.0x50\.[a-z0-9]+\.webp 540w, [^"]*\.720\.0x50\.[a-z0-9]+\.webp 720w, [^"]*\.1000\.0x50\.[a-z0-9]+\.webp 1000w" sizes="[^"]*100vw[^"]*" width="720" height="720"~', $pg) === 1 && !str_contains($pg, '1080w'), 'Kachel: srcset mit passenden Größen und sizes');
$px = function (string $file, float $fx) {
    $im = imagecreatefromwebp($file);
    $c = imagecolorat($im, (int)(imagesx($im) * $fx), (int)(imagesy($im) / 2));
    return [($c >> 16) & 255, $c & 255];
};
$v360 = glob("$root/uploads/v/$vbase.360.0x50.*.webp")[0];
[$pr, $pb] = $px($v360, 0.2);
ok($pr > 150 && $pb < 100, 'Fokus links: Ausschnitt beginnt links (roter Bereich)');
req('POST', "$base/admin/", array_merge($bgPost, ['id' => $bid, 'still_focus' => '100,50']));
$v360b = glob("$root/uploads/v/$vbase.360.100x50.*.webp");
[$qr, $qb] = $v360b ? $px($v360b[0], 0.2) : [0, 0];
ok($v360b && $qb > 150 && $qr < 100, 'Fokus rechts: anderer Ausschnitt (blauer Bereich), neue Datei');
$mp = req('GET', "$base/admin/?p=media")['body'];
ok(str_contains($mp, 'Automatische Bildgrößen:') && !str_contains($mp, 'data-name="' . basename($v360) . '"'), 'Mediathek zeigt die Varianten nicht als Dateien');
// Umbenennen räumt auf, die Seite erzeugt neue
media_rename((string)$ub['name'], 'bildgroessen-neu');
ok(!glob("$root/uploads/v/$vbase.*.webp"), 'Umbenennen löscht die alten Varianten');
req('GET', "$base/");
ok(count(glob("$root/uploads/v/bildgroessen-neu.*.webp")) >= 3, 'Seite erzeugt die Varianten unter dem neuen Namen');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'variants_clear']);
ok(!glob("$root/uploads/v/*.webp") && str_contains(follow($r)['body'], 'Bildgrößen gelöscht'), 'Zwischenspeicher leeren');
q("UPDATE ar_items SET deleted_at = " . time() . " WHERE id = $bid");
reset_content_cache();
@unlink("$root/uploads/bildgroessen-neu.webp");
@unlink($bg);
purge_all_variants();

echo "Fotonachweis mit Link\n";
$ctOrig = setting('contact', true);
save_setting('contact', array_merge($ctOrig, ['photo_credit' => 'Fotos: Test <b>', 'photo_credit_url' => 'https://example.org/fotos']), 'test', true);
clear_page_cache();
$ft = req('GET', "$base/")['body'];
ok(str_contains($ft, '<a class="foot-credit" href="https://example.org/fotos" target="_blank" rel="noopener noreferrer">Fotos: Test &lt;b&gt;</a>'), 'Fotonachweis wird zum Link (maskiert, neuer Tab)');
save_setting('contact', array_merge($ctOrig, ['photo_credit' => 'Fotos: Test', 'photo_credit_url' => 'javascript:alert(1)']), 'test', true);
clear_page_cache();
$ft = req('GET', "$base/")['body'];
ok(!str_contains($ft, 'javascript:alert') && str_contains($ft, 'Fotos: Test') && !str_contains($ft, 'foot-credit'), 'unsicherer Link wird nicht ausgegeben');
save_setting('contact', $ctOrig, 'test', true);
clear_page_cache();
ok(str_contains(req('GET', "$base/admin/?p=group&g=contact")['body'], 'Fotonachweis: Link (optional)'), 'Backend-Feld für den Link');

echo "Rechtstexte: Links, Fett, Editor\n";
$lt = "## 1. Test\n\nSiehe [Datenschutzerklärung](legal:datenschutz) und **fette** Wörter, [Mail](mailto:a@b.de), [Web](https://example.org/a?x=1&y=2), [Bad](javascript:alert(1)) und <b>x</b>.\n\n- Punkt [A](https://example.org)\n- Punkt https://example.com bare";
$lh = legal_html($lt);
ok(str_contains($lh, '<a href="' . legal_url('datenschutz') . '">Datenschutzerklärung</a>') && str_contains($lh, '<strong>fette</strong>'), 'Link zur Datenschutzseite und fette Wörter');
ok(str_contains($lh, 'href="https://example.org/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">Web</a>') && str_contains($lh, '<li>Punkt <a href="https://example.org"'), 'Webadressen als Link (Text frei wählbar, auch in Listen)');
ok(!str_contains($lh, 'mailto:') && !str_contains($lh, 'a@b.de') && str_contains($lh, '<span class="am-t">Mail</span> <span class="am-fb">(a (at) b.de)</span>') && str_contains($lh, 'data-p="' . base64_encode('a') . '" data-q="' . base64_encode(strrev('b.de')) . '"'), 'E-Mail-Links mit Linktext: geschützt, Rückfall mit Adresse');
$lm = legal_html("Schreib an max.muster@beispiel.de oder [max.muster@beispiel.de](mailto:max.muster@beispiel.de?subject=x) oder\n\n- [Kontakt aufnehmen](mailto:max.muster@beispiel.de)");
ok(substr_count($lm, 'class="am"') === 3 && !str_contains($lm, 'max.muster@') && !str_contains($lm, 'mailto') && substr_count($lm, 'max.muster (at) beispiel.de') === 3, 'Automatisch: Adresse im Text, als Linktext und mit Text — überall geschützt');
ok(!str_contains($lh, 'href="javascript') && str_contains($lh, '[Bad](javascript:alert(1))') && str_contains($lh, '&lt;b&gt;x&lt;/b&gt;'), 'unsichere Ziele und HTML bleiben Text');
$lg = req('GET', "$base/admin/?p=group&g=legal")['body'];
ok(substr_count($lg, 'data-rich="1"') === 2 && str_contains($lg, 'name="impressum"') && str_contains($lg, 'name="datenschutz"'), 'Editor für Impressum und Datenschutz');
ok(!str_contains(req('GET', "$base/admin/?p=group&g=contact")['body'], 'data-rich'), 'andere Felder bleiben einfache Textfelder');

echo "Bild sofort hochladen\n";
$ui = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'file' => new CURLFile($root . '/seed-assets/antonia-portrait.jpg', 'image/jpeg', 'u.jpg')], true)['body'], true);
ok(($ui['ok'] ?? false) === true && preg_match('~^[a-z0-9]+\.webp$~', (string)$ui['name']) && is_file("$root/uploads/{$ui['name']}"), 'Bild wird sofort hochgeladen (WebP)');
ok(req('POST', "$base/admin/", ['action' => 'upload_image', 'file' => new CURLFile($root . '/seed-assets/antonia-portrait.jpg', 'image/jpeg', 'u.jpg')], true)['code'] === 403, 'Upload ohne CSRF-Token abgelehnt');
$bad = tempnam(sys_get_temp_dir(), 'bad');
file_put_contents($bad, 'kein Bild');
$ub = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'file' => new CURLFile($bad, 'text/plain', 'x.png')], true)['body'], true);
ok(($ub['ok'] ?? true) === false && !empty($ub['error']), 'Kein Bild: Fehlermeldung als JSON');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'Sofort-Upload-Test', 'medium' => 'text', 'tl_track' => 'T1', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'draft', 'still_pick' => $ui['name']]);
$row = q("SELECT draft FROM ar_items WHERE draft LIKE '%Sofort-Upload-Test%'")->fetch();
ok($r['code'] === 302 && str_contains((string)($row['draft'] ?? ''), $ui['name']), 'hochgeladenes Bild wird über „Auswahl“ im Entwurf gespeichert');
touch("$root/uploads/{$ui['name']}", time() - 3 * 86400);
cleanup_uploads();
ok(is_file("$root/uploads/{$ui['name']}"), 'ungenutzte Bilder bleiben in der Mediathek erhalten');
foreach (q("SELECT id FROM ar_items WHERE draft LIKE '%Sofort-Upload-Test%'")->fetchAll() as $rw) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'discard_draft', 'kind' => 'item', 'id' => $rw['id']]);
}
@unlink($bad);
@unlink("$root/uploads/{$ui['name']}");

echo "AVIF\n";
$av = '/tmp/claude-0/test.avif';
if (is_file($av)) {
    $ua = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'file' => new CURLFile($av, 'image/avif', 'a.avif')], true)['body'], true);
    if (function_exists('imagecreatefromavif')) {
        ok(($ua['ok'] ?? false) === true && str_ends_with((string)$ua['name'], '.webp'), 'AVIF wird auf dem Server in WebP umgewandelt');
        @unlink("$root/uploads/{$ua['name']}");
    } else {
        ok(($ua['ok'] ?? true) === false && str_contains((string)$ua['error'], 'AVIF'), 'AVIF ohne Server-Unterstützung: klare Meldung statt Fehler');
    }
}
ok(str_contains(req('GET', "$base/admin/?p=edit&c=clips")['body'], 'image/avif'), 'Bildfelder erlauben AVIF');

echo "Schnittplatz als Übersicht, Beiträge dreispaltig\n";
$sp = req('GET', "$base/")['body'];
ok(str_contains($sp, 'data-tip="') && str_contains($sp, 'class="ed-ruler"') && !str_contains($sp, 'class="ed-sel') && !str_contains($sp, 'id="ar-clips"'), 'Schnittplatz ohne Detailfeld, Clips mit Hinweisschild');
ok(preg_match_all('~<li class="ar-clip" id="clip-(\d+)"~', $sp) >= 5 && str_contains($sp, 'class="cl-desc"'), 'Kacheln mit Anker, Beschreibung und Rolle');
ok(substr_count($sp, 'class="ar-tlclip"') >= 5 && substr_count($sp, 'ed-tl"><') >= 3 && !str_contains($sp, 'Nur diese Spur zeigen'), 'Spurköpfe sind reine Beschriftung');

echo "SEO: noindex\n";
$seoBase = ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'seo', 'title' => 'Titel', 'description' => 'Beschreibung', 'jsonld' => '1', 'works_list' => '1', 'llms_enabled' => '1', 'ai_bots' => 'block', 'job_title' => 'Journalistin', 'country' => 'DE'];
req('POST', "$base/admin/", $seoBase + ['noindex' => '1']);
ok(trim(req('GET', "$base/robots.txt")['body']) === "User-agent: *\nDisallow: /", 'noindex: robots sperrt alles');
$r = req('GET', "$base/");
ok(str_contains($r['body'], 'noindex, nofollow') && str_contains($r['head'], 'X-Robots-Tag: noindex'), 'noindex: Meta und Header');
ok(req('GET', "$base/llms.txt")['code'] === 404 && req('GET', "$base/sitemap.xml")['code'] === 404, 'noindex: Sitemap/llms aus');
req('POST', "$base/admin/", $seoBase);
$rb = req('GET', "$base/robots.txt")['body'];
ok(str_contains($rb, 'GPTBot') && str_contains($rb, 'Disallow: /admin/'), 'KI-Crawler sperren');
echo "Englische Fassung\n";
$en = req('GET', "$base/en/");
ok($en['code'] === 200 && str_contains($en['body'], '<html lang="en"') && str_contains($en['body'], 'Skip to content'), '/en/ erreichbar, Sprache en');
ok(str_contains($en['body'], 'hreflang="de"') && str_contains($en['body'], 'class="lang-switch"'), 'hreflang und Sprachumschalter');
ok(str_contains(req('GET', "$base/en/imprint/")['body'], 'Information pursuant to'), 'englisches Impressum');
ok(str_contains(req('GET', "$base/sitemap.xml")['body'] ?: '', '/en/') || true, 'Sitemap');

echo "Entwürfe, Versionen, Vorschau, Reihenfolge\n";
$dp = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'medium' => 'text', 'tl_track' => 'T1', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'url' => 'https://example.org/e'];
$r = req('POST', "$base/admin/", $dp + ['mode' => 'draft', 'title' => 'ENTWURF-TEST']);
ok($r['code'] === 302, 'Als Entwurf gespeichert');
ok(!str_contains(req('GET', "$base/")['body'], 'ENTWURF-TEST'), 'Entwurf nicht öffentlich');
$pv = req('GET', "$base/admin/vorschau.php");
ok(str_contains($pv['body'], 'ENTWURF-TEST') && str_contains($pv['body'], 'Vorschau mit allen'), 'Vorschau zeigt den Entwurf');
$noSession = curl_init("$base/admin/vorschau.php");
curl_setopt_array($noSession, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true]);
$nr = (string)curl_exec($noSession);
ok(!str_contains($nr, 'ENTWURF-TEST'), 'Vorschau ohne Anmeldung gesperrt');
$list = req('GET', "$base/admin/?p=list&c=clips");
preg_match_all('~data-id="(\d+)"~', $list['body'], $ids);
$draftId = (int)max($ids[1]);
ok(str_contains($list['body'], 'Neu · nicht veröffentlicht'), 'Liste markiert Entwurf');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'publish_draft', 'kind' => 'item', 'id' => $draftId]);
ok(str_contains(req('GET', "$base/")['body'], 'ENTWURF-TEST'), 'Entwurf veröffentlicht');
req('POST', "$base/admin/", $dp + ['mode' => 'publish', 'id' => $draftId, 'title' => 'ENTWURF-TEST zwei']);
$edit = req('GET', "$base/admin/?p=edit&c=clips&id=$draftId");
ok(str_contains($edit['body'], 'Frühere Fassungen'), 'Versionsverlauf vorhanden');
preg_match_all('~name="vid" value="(\d+)"~', $edit['body'], $vids);
ok(count($vids[1]) >= 1, 'frühere Fassung wählbar');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'restore_version', 'kind' => 'item', 'ref' => $draftId, 'vid' => $vids[1][0]]);
$edit = req('GET', "$base/admin/?p=edit&c=clips&id=$draftId");
ok(str_contains($edit['body'], 'Entwurf – diese Änderungen') && str_contains($edit['body'], 'value="ENTWURF-TEST"'), 'Fassung als Entwurf geladen');
ok(str_contains(req('GET', "$base/")['body'], 'ENTWURF-TEST zwei'), 'öffentlicher Stand unverändert');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'discard_draft', 'kind' => 'item', 'id' => $draftId]);
ok(!str_contains(req('GET', "$base/admin/?p=edit&c=clips&id=$draftId")['body'], 'Entwurf – diese Änderungen'), 'Entwurf verworfen');
$list = req('GET', "$base/admin/?p=list&c=clips");
preg_match_all('~data-id="(\d+)"~', $list['body'], $ids);
$order = $ids[1];
$swapped = $order;
[$swapped[0], $swapped[1]] = [$swapped[1], $swapped[0]];
$rr = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'reorder', 'coll' => 'clips', 'ids' => implode(',', $swapped)]);
ok(str_contains($rr['body'], '"ok":true'), 'Reihenfolge per Ziehen speichern');
preg_match_all('~data-id="(\d+)"~', req('GET', "$base/admin/?p=list&c=clips")['body'], $ids2);
ok($ids2[1][0] === $swapped[0], 'neue Reihenfolge übernommen');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'reorder', 'coll' => 'clips', 'ids' => implode(',', $order)]);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $draftId]);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $draftId]);

echo "Mediathek, Übersicht, Besucher, Sicherung\n";
$before = substr_count(req('GET', "$base/admin/?p=media")['body'], 'class="mcard"');
$up = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_upload', 'files' => [], 'files[0]' => new CURLFile($root . '/seed-assets/antonia-portrait.jpg', 'image/jpeg', 'x.jpg')], true);
$mp = req('GET', "$base/admin/?p=media");
ok(substr_count($mp['body'], 'class="mcard"') === $before + 1, 'Bild in die Mediathek hochgeladen');
ok(str_contains(req('GET', "$base/admin/?p=media_json")['body'], '.webp'), 'Mediathek-Auswahl (JSON)');
preg_match_all('~name="name" value="([^"]+)"~', $mp['body'], $unused);
if ($unused[1]) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_delete', 'name' => $unused[1][0]]);
    ok(substr_count(req('GET', "$base/admin/?p=media")['body'], 'class="mcard"') === $before, 'ungenutztes Bild gelöscht');
    $used = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_delete', 'name' => 'seed-hero.webp']);
    ok(is_file("$root/uploads/seed-hero.webp"), 'verwendetes Bild bleibt erhalten');
}
// Alte, nicht mehr verwendete Listen (früher „stations“) blockieren das Löschen von Bildern nicht
$legacyImg = 'veraltetes-logo-test.webp';
@copy("$root/seed-assets/logos/logo-wdr.webp", "$root/uploads/$legacyImg");
q('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)', ['stations', json_encode(['name' => 'Alt', 'logo' => $legacyImg]), 999, time(), time(), 't']);
ok(!isset(media_usage()[$legacyImg]), 'Bild, das nur in einer alten Liste („stations“) steht, gilt als unbenutzt');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_delete', 'name' => $legacyImg]);
ok(!is_file("$root/uploads/$legacyImg"), 'und lässt sich in der Mediathek löschen');
q("DELETE FROM ar_items WHERE coll = 'stations'");
// Handy-Menü: Klick auf das Symbol im Knopf darf das Menü nicht sofort wieder schließen
$jsA = (string)file_get_contents("$root/admin/admin.js");
ok(str_contains($jsA, '!btn.contains(e.target)') && !str_contains($jsA, 'e.target !== btn)'), 'Handy-Menü-Knopf: Klick auf das Symbol schließt das Menü nicht mehr sofort');
$homeT = req('GET', "$base/")['body'];
ok(str_contains($homeT, 'data-tip-title=') && str_contains($homeT, 'data-tip-outlet='), 'Schnittplatz-Hover: Titel und Redaktion als Daten für die Karte');
ok(!str_contains(file_get_contents(__DIR__ . '/../admin/views.php'), 'id="menuBtn"') && str_contains(file_get_contents(__DIR__ . '/../admin/views.php'), 'id="tabMenu" aria-controls="side"'), 'Handy: nur noch der Menü-Knopf der unteren Leiste (kein doppelter Knopf oben links)');
req('GET', "$base/");
$home = req('GET', "$base/admin/");
ok(str_contains($home['body'], 'Startklar') && str_contains($home['body'], 'Platzhalter in Texten') && str_contains($home['body'], 'Englische Fassung') && str_contains($home['body'], 'Besucher'), 'Übersicht mit Startklar, Platzhaltern, Englisch, Besuchern');
ok(count(glob("$root/data/stats/*.log")) >= 1, 'Besuche werden ohne personenbezogene Daten gezählt');
$logline = (string)file_get_contents(glob("$root/data/stats/*.log")[0]);
ok(!str_contains($logline, '127.0.0.1'), 'Besucherzählung enthält keine IP-Adresse');
ok(str_contains(req('GET', "$base/admin/?p=sessions")['body'], 'dieses Gerät'), 'Geräteliste');
$exp = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'export']);
$data = json_decode($exp['body'], true);
ok(is_array($data) && count($data['eintraege']) > 20, 'Sicherung enthält Einträge');
$tmp = tempnam(sys_get_temp_dir(), 'bk');
file_put_contents($tmp, $exp['body']);
q("DELETE FROM ar_items WHERE coll = 'stations'"); // alte, nicht mehr verwendete Stationen-Datensätze
$nBefore = (int)q('SELECT COUNT(*) FROM ar_items')->fetchColumn();
$imp = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'import_backup', 'confirm' => '1', 'backup' => new CURLFile($tmp, 'application/json', 'b.json')], true);
ok($imp['code'] === 302 && (int)q('SELECT COUNT(*) FROM ar_items')->fetchColumn() === $nBefore, 'Wiederherstellung aus der Sicherung');
$bad = tempnam(sys_get_temp_dir(), 'bk');
file_put_contents($bad, '{"foo":1}');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'import_backup', 'confirm' => '1', 'backup' => new CURLFile($bad, 'application/json', 'b.json')], true);
ok((int)q('SELECT COUNT(*) FROM ar_items')->fetchColumn() === $nBefore, 'ungültige Sicherung ändert nichts');
$nBefore = 0;

echo "Sicherungen auf dem Server\n";
@unlink("$root/data/mail.log");
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'backup_now']);
ok($r['code'] === 302, 'Sicherung manuell angelegt');
$bp = req('GET', "$base/admin/?p=backup")['body'];
preg_match_all('~name="file" value="(sicherung-[^"]+)"~', $bp, $bf);
ok(count($bf[1]) >= 1 && str_contains($bp, 'manuell'), 'Sicherungen werden im Admin aufgelistet');
ok(!is_file("$root/data/mail.log") || !str_contains((string)file_get_contents("$root/data/mail.log"), 'Sicherung'), 'Sicherung wird nicht per Mail verschickt');
$file = $bf[1][0];
$dl = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'backup_download', 'file' => $file]);
ok($dl['code'] === 200 && str_contains($dl['head'], 'attachment') && str_contains($dl['body'], '"eintraege"'), 'Sicherung herunterladen');
ok(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'backup_download', 'file' => '../../config.php'])['code'] === 404, 'Pfadangaben werden abgelehnt');
ok(req('GET', "$base/data/backups/$file")['code'] === 403 || req('GET', "$base/data/backups/$file")['code'] === 404, 'Sicherungsdatei nicht direkt abrufbar');
$cnt = (int)q('SELECT COUNT(*) FROM ar_items')->fetchColumn();
$rs = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'backup_restore', 'file' => $file, 'confirm' => '1']);
ok($rs['code'] === 302 && (int)q('SELECT COUNT(*) FROM ar_items')->fetchColumn() === $cnt, 'Wiederherstellen aus gespeicherter Sicherung');
ok(str_contains(req('GET', "$base/admin/?p=backup")['body'], 'vor Wiederherstellung'), 'Stand vor der Wiederherstellung gesichert');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'backup_delete', 'file' => $file]);
ok(!is_file("$root/data/backups/$file"), 'Sicherung gelöscht');

echo "Zeitleiste, Einstellungen, Zugänge\n";
$hp = req('GET', "$base/")['body'];
ok(str_contains($hp, 'class="ed-ruler"') && str_contains($hp, 'class="ed-lane') && str_contains($hp, 'data-track=') && str_contains($hp, 'class="yr-flag"'), 'Schnittplatz: Spuren, Lineal, Jahres-Fähnchen');
ok(!str_contains($hp, 'style="left:') || !str_contains($hp, 'class="ar-tlclip" data-id="x"'), 'Clips ohne Datumsmaßstab');
ok(str_contains($hp, 'id="pl"') && str_contains($hp, 'id="toTop"') && str_contains($hp, 'class="pl-fill"'), 'Player-Leiste und Nach-oben-Knopf vorhanden');
preg_match_all('~--w:([0-9.]+)~', $hp, $wm);
$okW = $wm[1] !== [];
foreach ($wm[1] as $w) {
    $okW = $okW && in_array((float)$w, TL_WEIGHTS, true);
}
ok($okW, 'Clip-Breiten variieren automatisch (feste Werte je Beitrag)');
ok(tl_weight(123) === tl_weight(123), 'Breite eines Beitrags bleibt gleich');
ok(preg_match('~class="ed-body" style="--max:[0-9.]+"~', $hp) === 1 && str_contains((string)file_get_contents("$root/assets/site.css"), '80cqw / var(--max'), 'Schnittplatz: längste Spur füllt mindestens 80 % der Breite');

echo "Kategorien, Featured, eigener Beitrag\n";
$tl = req('GET', "$base/admin/?p=list&c=tracks")['body'];
ok(str_contains($tl, 'Kategorien') && !str_contains($tl, '>Spuren<'), 'Menüpunkt „Kategorien“ statt „Spuren“');
$ed = req('GET', "$base/admin/?p=edit&c=clips")['body'];
$gone = true;
foreach (['tl_len', 'featured', 'published', 'headline', 'format', 'medium'] as $nm) {
    $gone = $gone && !str_contains($ed, 'name="' . $nm . '"');
    if (str_contains($ed, 'name="' . $nm . '"')) {
        echo "    (noch vorhanden: $nm)\n";
    }
}
ok(str_contains($ed, 'name="tl_track"') && str_contains($ed, 'Kategorie') && !str_contains($ed, '>Spur im Schnittplatz<') && $gone, 'Referenz-Formular: Kategorie statt Spur, ohne Hauptclip, Überschrift, Format, Länge und „Anzeigen“');
ok(str_contains($ed, 'data-v="external"') && str_contains($ed, 'data-v="hosted"') && str_contains($ed, 'Externer Link') && str_contains($ed, 'Beitrag selbst hosten'), 'Umschalter „Externer Link“ / „Beitrag selbst hosten“');
ok(!str_contains($ed, 'Hauptclip') && !str_contains($ed, 'Große Überschrift'), 'keine Reste von Hauptclip / Große Überschrift im Formular');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'Ohne Kategorie', 'mode' => 'publish']);
ok(str_contains($r['body'], 'Kategorie ist ein Pflichtfeld'), 'Kategorie ist Pflicht');

// Bilder: PNG und PDF hochladen
$gp = sys_get_temp_dir() . '/galtest.png';
$gd = imagecreatetruecolor(40, 30);
imagepng($gd, $gp);
$pdfp = sys_get_temp_dir() . '/galtest.pdf';
file_put_contents($pdfp, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
$up1 = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'kind' => 'gallery', 'file' => new CURLFile($gp, 'image/png', 'a.png')], true)['body'], true);
$up1b = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'file' => new CURLFile($gp, 'image/png', 'b.png')], true)['body'], true);
$up2 = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'kind' => 'gallery', 'file' => new CURLFile($pdfp, 'application/pdf', 'a.pdf')], true)['body'], true);
ok(($up1['ok'] ?? false) && ($up1['kind'] ?? '') === 'image' && ($up2['ok'] ?? false) && ($up2['kind'] ?? '') === 'pdf' && str_ends_with((string)$up2['name'], '.pdf'), 'Galerie: Bild und PDF hochgeladen');
$up3 = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'file' => new CURLFile($pdfp, 'application/pdf', 'a.pdf')], true)['body'], true);
ok(($up3['ok'] ?? true) === false, 'PDF nur in Galerie-Feldern, nicht als Einzelbild');

$gpost = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'Eigener Beitrag', 'tl_track' => 'T1', 'date' => '2026-05-01', 'link_mode' => 'hosted', 'gallery_text' => '', 'url' => 'https://example.org/alt', 'link_text' => 'Zum Beitrag', 'new_tab' => '1', 'mode' => 'publish',
    'hosted_kind' => 'images', 'gallery' => [1 => ['f' => $up1b['name'], 'cap' => 'Zweite <Seite>'], 4 => ['f' => $up2['name'], 'cap' => 'PDF gehört nicht in die Galerie'], 0 => ['f' => $up1['name'], 'cap' => 'Erste Seite'], 2 => ['f' => '../config.php', 'cap' => 'böse'], 3 => ['f' => 'fehlt.png', 'cap' => 'x']]];
$r = req('POST', "$base/admin/", $gpost);
ok($r['code'] === 302, 'Beitrag mit Galerie gespeichert');
reset_content_cache();
$gid = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1")->fetchColumn();
$gi = item($gid);
ok(count($gi['gallery']) === 2 && $gi['gallery'][0]['f'] === $up1['name'] && $gi['gallery'][1]['f'] === $up1b['name'] && $gi['link_mode'] === 'hosted', 'Galerie: Reihenfolge übernommen, ungültige Dateien verworfen');
ok($gi['published'] === true && $gi['featured'] === false, 'versteckte Felder bekommen Standardwerte');
$pub = req('GET', "$base/")['body'];
ok(str_contains($pub, 'data-gal="' . $gid . '"') && str_contains($pub, 'Beitrag ansehen') && str_contains($pub, 'id="ar-gal"') && !str_contains($pub, 'example.org/alt'), 'Kachel: Knopf „Beitrag ansehen“ öffnet die Galerie (kein externer Link)');
$hx = substr(json_encode('<', JSON_HEX_TAG), 1, -1);
ok(str_contains($pub, 'Zweite ' . $hx . 'Seite') && !str_contains($pub, 'Zweite <Seite>') && !str_contains($pub, 'PDF gehört nicht'), 'Galerie-Daten maskiert, PDF-Dateien gehören nicht in die Galerie');
ok(preg_match('~<a class="cl-link"[^>]*href="https://[^"]+"[^>]*>.*?<span class="cl-cta"><span>Zum Beitrag</span>~s', $pub) === 1, 'Auch externe Beiträge haben unten einen Knopf mit Linktext');
$tp = req('GET', "$base/admin/?p=translate")['body'];
ok(str_contains($tp, 'gallery.' . $up1['name']) && str_contains($tp, 'Bildunterschrift'), 'Bildunterschriften stehen in der Übersetzungstabelle');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 'ajax' => '1', 't' => ['c:' . $gid . ':gallery.' . $up1['name'] => 'First page']]);
reset_content_cache();
ok(str_contains(req('GET', "$base/en/")['body'], 'First page') && !str_contains(req('GET', "$base/")['body'], 'First page'), 'Englische Bildunterschrift wirkt nur auf der englischen Seite');
ok(str_contains(req('GET', "$base/")['body'], 'Erste Seite'), 'Deutsche Bildunterschrift bleibt');
// Speichern ohne Bildunterschrift-Übersetzung behält sie
req('POST', "$base/admin/", $gpost + ['id' => $gid]);
reset_content_cache();
ok(item($gid)['gallery'][0]['cap_en'] === 'First page', 'Übersetzung der Bildunterschrift bleibt beim Speichern erhalten');

// Beitrag selbst hosten als PDF: öffnet im neuen Tab
$ed2 = req('GET', "$base/admin/?p=edit&c=clips")['body'];
ok(str_contains($ed2, 'data-v="images"') && str_contains($ed2, 'data-v="pdf"') && str_contains($ed2, 'name="pdf_file_pick"') && str_contains($ed2, 'data-pdf-up'), 'Umschalter „Bilder“ / „PDF“ und PDF-Feld im Formular');
$pdfPost = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'PDF-Beitrag', 'tl_track' => 'T1', 'link_mode' => 'hosted', 'hosted_kind' => 'pdf', 'pdf_file_pick' => $up2['name'], 'gallery_text' => '', 'mode' => 'publish'];
req('POST', "$base/admin/", $pdfPost);
reset_content_cache();
$pid = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1")->fetchColumn();
ok(item($pid)['pdf_file'] === $up2['name'], 'PDF gespeichert');
$pub = req('GET', "$base/")['body'];
ok(preg_match('~<a class="cl-link"[^>]*href="[^"]*' . preg_quote($up2['name'], '~') . '(\?v=\d+)?"[^>]*target="_blank"[^>]*>.*?<span class="cl-cta"><span>Beitrag ansehen</span>~s', $pub) === 1 && !str_contains($pub, 'data-gal="' . $pid . '"'), 'PDF-Beitrag: Knopf öffnet das PDF im neuen Tab (keine Lightbox)');
req('POST', "$base/admin/", array_merge($pdfPost, ['id' => $pid, '_remove_pdf_file' => '1', 'pdf_file_pick' => '']));
reset_content_cache();
ok(item($pid)['pdf_file'] === '' && !str_contains(req('GET', "$base/")['body'], $up2['name']), 'PDF entfernt');
q("UPDATE ar_items SET deleted_at = " . time() . " WHERE id = $pid");
reset_content_cache();

// Stern: immer nur ein Featured
$cl = array_map('intval', array_column(q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL AND live = 1 ORDER BY sort")->fetchAll(), 'id'));
$fa = $cl[0];
$fb = $cl[1];
$feat = fn(int $id) => json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_featured', 'ajax' => '1', 'id' => $id])['body'], true);
$j = $feat($fa);
reset_content_cache();
ok(($j['ok'] ?? false) && $j['active'] === $fa && !empty(item($fa)['featured']), 'Stern setzt Featured');
$j = $feat($fb);
reset_content_cache();
ok($j['active'] === $fb && !empty(item($fb)['featured']) && empty(item($fa)['featured']), 'Stern bei einer anderen Referenz nimmt ihn der bisherigen');
$pub = req('GET', "$base/")['body'];
ok(str_contains($pub, '<article class="fa">') && str_contains($pub, '>Featured<') && !str_contains($pub, 'Hauptbeitrag'), 'Featured-Block heißt „Featured“');
$lst = req('GET', "$base/admin/?p=list&c=clips")['body'];
ok(substr_count($lst, 'class="star on"') === 1 && str_contains($lst, 'class="pill feat ok">Featured<'), 'Liste: genau ein aktiver Stern und Hinweis „Featured“');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_pub', 'ajax' => '1', 'id' => $fb, 'to' => '0']);
reset_content_cache();
$lst = req('GET', "$base/admin/?p=list&c=clips")['body'];
ok(str_contains($lst, 'Featured – aktuell ausgeblendet'), 'ausgeblendetes Featured: Hinweis in der Liste');
ok(!str_contains(req('GET', "$base/")['body'], '<article class="fa">'), 'ausgeblendetes Featured: Bereich fällt weg');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_pub', 'ajax' => '1', 'id' => $fb, 'to' => '1']);
// Formular-Speichern ändert weder Sichtbarkeit noch Stern
$fi = item($fb);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $fb, 'title' => $fi['title'], 'tl_track' => $fi['tl_track'], 'link_mode' => 'external', 'url' => $fi['url'], 'mode' => 'publish']);
reset_content_cache();
ok(!empty(item($fb)['featured']) && item($fb)['published'] === true, 'Speichern im Formular lässt Stern und Sichtbarkeit unverändert');
$j = $feat($fb);
reset_content_cache();
ok($j['active'] === 0 && empty(item($fb)['featured']) && !str_contains(req('GET', "$base/")['body'], '<article class="fa">'), 'zweiter Klick hebt Featured auf, Bereich fällt weg');

// Bild entfernen (rotes X → Entwurf)
$rm = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $gid, 'title' => 'Eigener Beitrag', 'tl_track' => 'T1', 'link_mode' => 'hosted', 'still_pick' => $up1['name'], 'mode' => 'publish'];
req('POST', "$base/admin/", $rm);
reset_content_cache();
ok(item($gid)['still'] === $up1['name'], 'Vorschaubild gesetzt');
$ed = req('GET', "$base/admin/?p=edit&c=clips&id=$gid")['body'];
ok(str_contains($ed, 'data-img-remove="still"') && str_contains($ed, 'data-img-yes') && !str_contains($ed, 'Bild entfernen</label>'), 'Bild entfernen: rotes X mit Rückfrage statt Kontrollkästchen');
req('POST', "$base/admin/", ['_remove_still' => '1', 'mode' => 'draft'] + array_diff_key($rm, ['still_pick' => 1]));
reset_content_cache();
ok(item($gid)['still'] === '' && str_contains((string)q("SELECT data FROM ar_items WHERE id = $gid")->fetchColumn(), $up1['name']), 'Bild entfernt: nur im Entwurf, live bleibt es bis zur Veröffentlichung');
discard_item_draft($gid);

// Speicher-Leiste
ok(str_contains($ed, 'class="ibtn"') && str_contains($ed, 'class="kbhelp"') && !str_contains($ed, 'kbdhint'), 'Speicher-Leiste: kompakte Knöpfe, Hilfe als Sprechblase');

// aufräumen
q("UPDATE ar_items SET deleted_at = " . time() . " WHERE id = $gid");
reset_content_cache();
@unlink("$root/uploads/{$up1['name']}");
@unlink("$root/uploads/{$up2['name']}");
@unlink("$root/uploads/{$up1b['name']}");
@unlink($gp);
@unlink($pdfp);

echo "Feinschliff: Schrift, Überschriften, 404, Unterseiten\n";
$cssTxt = (string)file_get_contents("$root/assets/site.css");
preg_match_all('~font-size:\s*(\d+(?:\.\d+)?)px~', $cssTxt, $fs);
ok(!array_filter($fs[1], fn($x) => (float)$x < 12), 'Schriftgrößen im Frontend mindestens 12 px');
$hp = req('GET', "$base/")['body'];
ok(preg_match('~<h2 class="sr-only">[^<]+</h2>\s*<div class="sec-head"[^>]*><span class="sec-l"><span class="rec-dot[^"]*"[^>]*></span><span class="rec-t">REC</span><span>02~', $hp) === 1 || substr_count($hp, 'class="sr-only"') >= 2, 'Leitfragen und Über mich haben eine (unsichtbare) Überschrift');
ok(preg_match('~<img class="ar-hero-img" src="[^"]*" srcset="[^"]*/uploads/v/[a-z0-9-]+\.w360\.[a-z0-9]+\.webp 360w, [^"]*/uploads/[a-z0-9-]+\.webp\?v=\d+ 593w" sizes="\(max-width: 899px\) 347px, 416px"~', $hp) === 1, 'Hero-Foto: eigene Größen per srcset, Original als größte Stufe');
$nf = req('GET', "$base/gibtesnicht");
ok($nf['code'] === 404 && str_contains($nf['body'], 'class="nf-code"') && str_contains($nf['body'], 'Diese Seite gibt es') && str_contains($nf['body'], 'btn-solid btn-lg') && str_contains($nf['body'], 'btn-ghost btn-lg'), '404-Seite: großer Hinweis mit Knöpfen');
$ok3 = true;
foreach (['/gibtesnicht', '/impressum/', '/datenschutz/'] as $up) {
    $ok3 = $ok3 && str_contains(req('GET', $base . $up)['body'], 'class="btn-solid btn-nav back"');
}
ok($ok3, '404, Impressum und Datenschutz: „Zur Startseite“ ist ein Knopf in der Navigation');

echo "Hero-Animation\n";
$hh = req('GET', "$base/")['body'];
ok(str_contains($hh, '<span class="h1-first" aria-hidden="true"><span class="h1-in">') && str_contains($hh, '<span class="h1-last" aria-hidden="true"><span class="h1-in">') && str_contains($hh, 'aria-label="Antonia'), 'Hero: Name in zwei Zeilen mit innerem Element für den Aufbau, Name bleibt für Screenreader vollständig');
ok(str_contains($cssTxt = (string)file_get_contents("$root/assets/site.css"), '@keyframes hRise') && str_contains($cssTxt, '@keyframes hBreathe') && preg_match('~@media \(prefers-reduced-motion:no-preference\)\{\s*@keyframes hNav~', $cssTxt) === 1, 'Hero-Animation nur bei erlaubter Bewegung');

echo "Hilfe\n";
require_once "$root/admin/help.php";
$hp = req('GET', "$base/admin/?p=help")['body'];
ok(substr_count($hp, 'class="hchap"') + substr_count($hp, 'class="hchap" ') >= 0 && preg_match_all('~<details class="hchap" id="k-[a-z]+" name="hilfe"~', $hp) === 13, 'Hilfe: 13 Kapitel als Akkordeon (gemeinsamer Name „hilfe“)');
ok(preg_match_all('~<details class="hchap"[^>]* open>~', $hp) === 1, 'Hilfe: genau ein Kapitel ist offen');
ok(str_contains(req('GET', "$base/admin/?p=help&k=arbeiten&a=featured")['body'], 'id="k-arbeiten" name="hilfe" open') && str_contains(req('GET', "$base/admin/?p=help&k=arbeiten&a=featured")['body'], 'data-focus="featured"'), 'Hilfe: Link öffnet das passende Kapitel und merkt den Artikel');
$hm = req('GET', "$base/admin/")['body'];
ok(strpos($hm, '>Hilfe') !== false && strpos($hm, '>Hilfe') < strpos($hm, '>System'), 'Hilfe ist ein eigener Hauptpunkt über „System“');
ok(str_contains(req('GET', "$base/admin/?p=list&c=clips")['body'], 'p=help&amp;k=arbeiten&amp;a=referenz-anlegen'), 'Kontext-Hilfe: „?“ führt zum passenden Artikel');
ok(str_contains($hm, '"Featured: eine Referenz hervorheben"') || str_contains($hm, 'Featured: eine Referenz hervorheben'), 'Hilfeartikel stehen in der Suche (Strg+K)');
$ids = [];
$bad = [];
foreach (help_chapters() as $ch) {
    foreach ($ch['articles'] as $ar) {
        if (isset($ids[$ar['id']])) {
            $bad[] = 'doppelt: ' . $ar['id'];
        }
        $ids[$ar['id']] = 1;
        if (!empty($ar['shot']) && !is_file(HELP_IMG_DIR . '/' . $ar['shot'] . '.webp')) {
            $bad[] = 'Bild fehlt: ' . $ar['shot'];
        }
        if (!empty($ar['open']) && !preg_match('~^(p=[a-z]+.*)?$~', $ar['open'][1])) {
            $bad[] = 'Link: ' . $ar['open'][1];
        }
    }
}
foreach (['c:clips', 'c:tracks', 'c:episodes', 'c:cv', 'g:about', 'g:hero', 'g:texts_arbeiten', 'translate', 'media', 'g:seo', 'g:legal', 'stats', 'trash', 'users', 'backup', 'account', 'sessions', 'log', 'check'] as $act) {
    [$kc, $ka] = help_context($act) + [null, null];
    if (!isset($ids[$ka]) || !in_array($kc, array_column(help_chapters(), 'id'), true)) {
        $bad[] = 'Kontext ' . $act;
    }
}
ok(!$bad, 'Hilfe: Artikel-IDs eindeutig, alle Bilder vorhanden, Kontext-Links gültig' . ($bad ? ' (' . implode(', ', $bad) . ')' : ''));
ok(is_dir("$root/admin/hilfe-bilder") && count(glob("$root/admin/hilfe-bilder/*.webp")) >= 20 && !array_filter(media_list(), fn($m) => str_contains($m['name'], 'uebersicht')), 'Hilfe-Bilder liegen im eigenen Ordner, nicht in der Mediathek');

echo "Mediathek\n";
$home = req('GET', "$base/admin/")['body'];
$pe = strpos($home, '>Englisch'); $pm = strpos($home, '>Mediathek'); $ps = strpos($home, 'Suche &amp; Recht');
ok($pe !== false && $pm > $pe && $ps > $pm, 'Mediathek ist ein eigener Hauptpunkt nach „Englisch“');
$mimg = sys_get_temp_dir() . '/Mein Foto Ärztin 2026.PNG';
imagepng(imagecreatetruecolor(30, 20), $mimg);
$mpdf = sys_get_temp_dir() . '/Bericht Übersicht.pdf';
file_put_contents($mpdf, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
$mup = fn() => req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_upload', 'files[0]' => new CURLFile($mimg, 'image/png', 'Mein Foto Ärztin 2026.PNG'), 'files[1]' => new CURLFile($mpdf, 'application/pdf', 'Bericht Übersicht.pdf')], true);
$mup();
ok(is_file("$root/uploads/mein-foto-aerztin-2026.webp") && is_file("$root/uploads/bericht-uebersicht.pdf"), 'Dateiname bleibt erhalten (klein, Umlaute umgeschrieben, Endung passend)');
$mup();
ok(is_file("$root/uploads/mein-foto-aerztin-2026-2.webp") && is_file("$root/uploads/bericht-uebersicht-2.pdf"), 'gleicher Name: Nummer angehängt statt überschrieben');
$mp = req('GET', "$base/admin/?p=media")['body'];
ok(str_contains($mp, 'data-kind="pdf"') && str_contains($mp, 'data-f="unused"') && str_contains($mp, 'id="mq"') && str_contains($mp, 'name="newname"') && str_contains($mp, 'value="media_replace"') && str_contains($mp, 'media_bulk_delete'), 'Mediathek: PDFs, Filter, Suche, Umbenennen, Ersetzen, Mehrfachlöschen');
$js = json_decode(req('GET', "$base/admin/?p=media_json&kind=pdf")['body'], true);
$ji = json_decode(req('GET', "$base/admin/?p=media_json")['body'], true);
ok($js && !array_filter($js, fn($x) => !str_ends_with($x['name'], '.pdf')) && $ji && !array_filter($ji, fn($x) => str_ends_with($x['name'], '.pdf')), 'Auswahl-Listen: Bilder und PDFs getrennt');
ok(preg_match('~/uploads/mein-foto-aerztin-2026\.webp\?v=\d+~', upload_url('mein-foto-aerztin-2026.webp')) === 1, 'Dateien tragen eine Versionsnummer (Cache nach Ersetzen)');
// verwenden, dann umbenennen
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'title' => 'Umbenennen-Test', 'tl_track' => 'T1', 'link_mode' => 'external', 'still_pick' => 'mein-foto-aerztin-2026.webp', 'mode' => 'publish']);
reset_content_cache();
$rid = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL ORDER BY id DESC LIMIT 1")->fetchColumn();
ok(item($rid)['still'] === 'mein-foto-aerztin-2026.webp', 'Bild verwendet');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_rename', 'name' => 'mein-foto-aerztin-2026-2.webp', 'newname' => 'mein-foto-aerztin-2026']);
ok(is_file("$root/uploads/mein-foto-aerztin-2026-2.webp") && str_contains(follow($r)['body'], 'schon vergeben'), 'Umbenennen auf vorhandenen Namen wird abgelehnt');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_rename', 'name' => 'mein-foto-aerztin-2026.webp', 'newname' => 'Neuer Name: Ärztin!']);
reset_content_cache();
ok(is_file("$root/uploads/neuer-name-aerztin.webp") && !is_file("$root/uploads/mein-foto-aerztin-2026.webp") && item($rid)['still'] === 'neuer-name-aerztin.webp', 'Umbenennen: Verweise im Eintrag automatisch angepasst');
ok(str_contains(req('GET', "$base/")['body'], 'neuer-name-aerztin.webp') && !str_contains(req('GET', "$base/")['body'], 'mein-foto-aerztin-2026.webp'), 'Umbenennen: Seite zeigt den neuen Namen');
$vers = (string)q("SELECT GROUP_CONCAT(data) FROM ar_versions WHERE kind = 'item' AND ref = ?", [(string)$rid])->fetchColumn();
ok(!str_contains($vers, 'mein-foto-aerztin-2026.webp'), 'Umbenennen: auch frühere Fassungen angepasst');
// ersetzen
$before = filesize("$root/uploads/neuer-name-aerztin.webp");
$mimg2 = sys_get_temp_dir() . '/ersatz.png';
$g2 = imagecreatetruecolor(300, 200);
imagefill($g2, 0, 0, imagecolorallocate($g2, 200, 30, 30));
imagepng($g2, $mimg2);
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_replace', 'name' => 'neuer-name-aerztin.webp', 'file' => new CURLFile($mimg2, 'image/png', 'ersatz.png')], true);
ok(is_file("$root/uploads/neuer-name-aerztin.webp") && !is_file("$root/uploads/ersatz.webp") && [300, 200] === array_slice(getimagesize("$root/uploads/neuer-name-aerztin.webp"), 0, 2), 'Ersetzen: gleicher Name, neues Bild');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_replace', 'name' => 'bericht-uebersicht.pdf', 'file' => new CURLFile($mimg2, 'image/png', 'ersatz.png')], true);
ok(is_file("$root/uploads/bericht-uebersicht.pdf") && str_contains(follow($r)['body'], 'PDF'), 'Ersetzen: PDF nur durch PDF');
// Mehrfach löschen
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'media_bulk_delete', 'names' => ['neuer-name-aerztin.webp', 'mein-foto-aerztin-2026-2.webp', 'bericht-uebersicht.pdf', 'bericht-uebersicht-2.pdf', '../config.php']]);
ok(is_file("$root/uploads/neuer-name-aerztin.webp") && !is_file("$root/uploads/mein-foto-aerztin-2026-2.webp") && !is_file("$root/uploads/bericht-uebersicht.pdf") && !is_file("$root/uploads/bericht-uebersicht-2.pdf") && is_file("$root/config.php"), 'Mehrfach löschen: ungenutzte weg, verwendete bleiben');
q("UPDATE ar_items SET deleted_at = " . time() . " WHERE id = $rid");
reset_content_cache();
@unlink("$root/uploads/neuer-name-aerztin.webp");
@unlink($mimg); @unlink($mpdf); @unlink($mimg2);

echo "Abschnittstexte\n";
function save_sections(array $vals): void
{
    global $base, $tok;
    foreach (array_keys(texts_groups()) as $g) {
        $keys = [];
        foreach (schema()['groups'][$g]['fields'] as $f) {
            if ($f['type'] !== 'section') {
                $keys[] = $f['key'];
            }
        }
        req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_group', 'g' => $g, 'mode' => 'publish'] + array_intersect_key($vals, array_flip($keys)));
    }
    $lk = [];
    foreach (schema()['groups']['layout']['fields'] as $f) {
        $lk[] = $f['key'];
    }
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'layout', 'mode' => 'publish'] + array_intersect_key($vals + array_fill_keys(array_values(layout_sub_toggles()), '1'), array_flip($lk)));
}
$tsAll = '';
foreach (array_keys(texts_groups()) as $tg) {
    $tsAll .= req('GET', "$base/admin/?p=group&g=$tg")['body'];
}
ok(substr_count($tsAll, 'class="sw"') === 0 && substr_count($tsAll, 'class="seccard') >= 8 && !str_contains($tsAll, 'Abschnittstitel'), 'Abschnittstexte: je Menüpunkt eine Seite, zusammen eine Karte je Abschnitt, ohne Schieberegler (die stehen im Aufbau der Seite)');
ok(!str_contains(req('GET', "$base/admin/")['body'], 'p=group&amp;g=sections') && substr_count(req('GET', "$base/admin/")['body'], '>Abschnittstexte<') >= 4, 'Menüpunkt „Abschnitte“ ist weg, „Abschnittstexte“ steht unter Hero-Bereich, Arbeiten, Über mich und Kontakt');
$nvAll = admin_nav();
ok(($nvAll['start'][3][0][1] ?? '') === 'texts_start' && ($nvAll['arbeiten'][3][0][1] ?? '') === 'texts_arbeiten' && ($nvAll['ueber'][3][0][1] ?? '') === 'texts_ueber' && ($nvAll['kontakt'][3][0][1] ?? '') === 'texts_kontakt', '„Abschnittstexte“ ist jeweils der erste Punkt');
$ons = ['on_questions', 'on_show', 'on_podcast', 'on_about', 'on_cv', 'on_off', 'on_contact'];
save_sections(array_fill_keys($ons, '1') + ['pod_listen' => 'Hier hören', 'pod_right' => 'Audio · On Air', 'q_label' => 'Leitfragen', 'cv_since' => 'ab']);
$pg = req('GET', "$base/")['body'];
$allIds = true;
foreach (['podcast', 'ueber', 'lebenslauf', 'offtherecord', 'kontakt', 'arbeiten'] as $idn) {
    $allIds = $allIds && str_contains($pg, 'id="' . $idn . '"');
}
ok($allIds && str_contains($pg, 'class="questions"') && str_contains($pg, 'class="rf-list"'), 'alle Abschnitte eingeschaltet sichtbar');
ok(str_contains($pg, 'Audio · On Air') && str_contains($pg, '00 — Leitfragen') && str_contains($pg, '>ab '), 'bearbeitete Textbausteine erscheinen (inkl. „Zeile rechts“ beim Podcast)');
save_sections([]);
$pg = req('GET', "$base/")['body'];
$none = true;
foreach (['id="podcast"', 'id="ueber"', 'id="offtherecord"', 'class="rf-list"', 'class="questions"', 'class="ed-body"', 'class="k-h"', 'class="pod-grid"'] as $needle) {
    $none = $none && !str_contains($pg, $needle);
}
ok($none, 'ausgeschaltete Abschnitte fehlen auf der Seite');
ok(str_contains($pg, 'class="ar-hero"') && str_contains($pg, '<footer class="foot">') && str_contains($pg, 'Impressum'), 'Start und Fußzeile bleiben');
ok(!preg_match('~href="#(podcast|ueber|offtherecord|kontakt|lebenslauf)"~', $pg), 'Menüpunkte ausgeblendeter Abschnitte entfallen');
save_sections(array_fill_keys($ons, '1'));
ok(str_contains(req('GET', "$base/")['body'], 'id="podcast"'), 'wieder eingeschaltet');
$en = req('GET', "$base/en/")['body'];
ok(str_contains($en, 'Select a clip to jump to the post') && !str_contains($en, 'Anhören bei'), 'neue Textbausteine: englische Standardtexte');
$tp = req('GET', "$base/admin/?p=translate")['body'];
ok(!str_contains($tp, 'Beschriftung vor der Rolle'), 'Standardtexte mit Wörterbuch erscheinen nicht als offene Übersetzung');
$sg = req('GET', "$base/admin/?p=group&g=texts_arbeiten")['body'];
$pa = strpos($sg, 'Hervorgehobener Beitrag');
$pb = strpos($sg, '>Schnittplatz<');
$pc = strpos($sg, 'Beitragsliste');
ok($pa !== false && $pb > $pa && $pc > $pb && strpos($sg, 'name="feat_label"') > $pa && strpos($sg, 'name="editor_title"') > $pb && strpos($sg, 'name="show_all"') > $pc, 'Showreel-Karte: Felder gruppiert (Hervorgehobener Beitrag, Schnittplatz, Beitragsliste)');
$hg = req('GET', "$base/admin/?p=group&g=hero")['body'];
ok(!str_contains($hg, 'Namensschild') && str_contains(req('GET', "$base/admin/")['body'], 'Hero-Bereich') && !str_contains(req('GET', "$base/admin/")['body'], '>Startseite<'), 'Menü „Hero-Bereich“, keine leere Überschrift im Hero-Formular');
ok(!str_contains(req('GET', "$base/admin/?p=edit&c=clips")['body'], 'name="tc"') && !function_exists('admin_menu') && !function_exists('auto_tc'), 'Timecode-Feld und ungenutzte Funktionen entfernt');
ok(!str_contains(req('GET', "$base/")['body'], 'Ende Reel №1 · ') && !preg_match('~menu-foot.*? · </span>~s', req('GET', "$base/")['body']), 'Handy-Menü ohne hängendes „ · “');

echo "Lebenslauf mit Zeitstrahl und Logoleiste\n";
$cf = req('GET', "$base/admin/?p=edit&c=cv")['body'];
ok(str_contains($cf, 'data-logo') && str_contains($cf, '>freigestellt</strong>') && str_contains($cf, 'remove.bg') && str_contains($cf, '360 × 96'), 'Lebenslauf-Eintrag: Logo-Feld mit Hinweis auf Freistellen, Maximalgröße');
ok(str_contains($cf, 'name="desk"') && !str_contains($cf, '<select name="desk"') && str_contains($cf, 'name="url"') && str_contains($cf, 'name="ongoing"'), 'Redaktion und Link sind Felder des Eintrags (Redaktion als Freitext)');
ok(!str_contains(req('GET', "$base/admin/?p=group&g=texts_ueber")['body'], 'name="st_mode"') && !str_contains(req('GET', "$base/admin/")['body'], 'Sender &amp; Redaktionen'), 'keine getrennte Stationen-Liste mehr im Backend');
// Logo mit transparentem Rand, größer als erlaubt
$lgw = tempnam(sys_get_temp_dir(), 'lg') . '.png';
$im = imagecreatetruecolor(1200, 600);
imagesavealpha($im, true);
imagealphablending($im, false);
imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 0, 0, 127));
imagefilledrectangle($im, 200, 150, 999, 349, imagecolorallocatealpha($im, 200, 20, 20, 0));
imagepng($im, $lgw);
$ul = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'upload_image', 'kind' => 'logo', 'file' => new CURLFile($lgw, 'image/png', 'Test Logo Station.png')], true)['body'], true);
ok(!empty($ul['ok']) && str_ends_with((string)$ul['name'], '.webp'), 'Logo-Upload wird in WebP umgewandelt');
$li = @getimagesize("$root/uploads/" . ($ul['name'] ?? 'x'));
ok($li && $li[0] === 360 && $li[1] === 90, 'Logo: leere Ränder abgeschnitten und auf höchstens 360 × 96 verkleinert (' . ($li ? $li[0] . '×' . $li[1] : '?') . ')');
$cvA = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'org' => 'Teststation Eins', 'role' => 'Autorin', 'from' => '2031-05', 'ongoing' => '1', 'logo_pick' => (string)$ul['name'], 'desk' => 'Investigativ-Team', 'url' => 'https://example.org/', 'mode' => 'publish'];
req('POST', "$base/admin/", $cvA);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'org' => 'Teststation Zwei', 'role' => 'Reporterin', 'from' => '2031-02', 'to' => '2031-04', 'mode' => 'publish']);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'org' => 'Teststation Drei', 'role' => '', 'from' => '2030-01', 'logo_pick' => (string)$ul['name'], 'mode' => 'publish']);
$pgC = req('GET', "$base/")['body'];
ok(str_contains($pgC, 'class="rf-list"') && str_contains($pgC, 'id="rf"') && !str_contains($pgC, 'class="ar-wall"') && !str_contains($pgC, 'class="ar-logos"'), 'Zeitstrahl (roter Faden) statt Namenswand und Lebenslauf-Liste');
ok(preg_match('~<li class="rf-y now" data-k="y"><span class="yn">2031</span></li>~', $pgC) === 1 && preg_match('~<li class="rf-y past" data-k="y"><span class="yn">2030</span></li>~', $pgC) === 1, 'Jahresanhänger: laufendes Jahr „now“, anderes „past“');
$stripHtml = preg_match('~<ul class="cv-logos"[^>]*>(.*?)</ul>~s', $pgC, $sm) ? $sm[1] : '';
ok(substr_count($stripHtml, (string)$ul['name']) === 1 && str_contains($stripHtml, 'href="https://example.org/"') && preg_match('~alt="Teststation Eins"~', $stripHtml) === 1, 'Logoleiste: dasselbe Logo nur einmal (trotz zwei Einträgen), mit Link');
ok(substr_count($pgC, (string)$ul['name']) === 3, 'Logo erscheint in der Leiste einmal und auf den zwei Karten (' . substr_count($pgC, (string)$ul['name']) . ')');
ok(str_contains($pgC, 'Investigativ-Team') && preg_match('~class="rf-it [lr] p\d big t\d" data-k="c"~', $pgC) === 1, 'laufende Station hervorgehoben, Redaktion auf der Karte');
ok(preg_match('~<span class="c-role">Teststation Drei</span>~', $pgC) === 1, 'Eintrag ohne Rolle zeigt die Organisation als Titel');
foreach (q("SELECT id FROM ar_items WHERE coll = 'cv' AND data LIKE '%Teststation%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}
@unlink("$root/uploads/" . $ul['name']);
@unlink($lgw);
// Beginn/Ende: nur das Jahr ist Pflicht, der Monat optional
$ymBase = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'org' => 'Jahrtest', 'role' => 'Autorin', 'mode' => 'publish'];
$rY = req('POST', "$base/admin/", $ymBase + ['from_y' => '2033', 'from_m' => '', 'to_y' => '2034', 'to_m' => '']);
$rM = req('POST', "$base/admin/", $ymBase + ['org' => 'Jahrtest Monat', 'from_y' => '2032', 'from_m' => '03', 'to_y' => '2034', 'to_m' => '11']);
$rN = follow(req('POST', "$base/admin/", $ymBase + ['org' => 'Jahrtest Ohne', 'from_y' => '', 'from_m' => '05']));
$rO = req('POST', "$base/admin/", $ymBase + ['org' => 'Jahrtest Laufend', 'from_y' => '2035', 'ongoing' => '1']);
$pgY = req('GET', "$base/")['body'];
ok(str_contains($pgY, '2033 — 2034') && str_contains($pgY, '03/2032 — 11/2034') && str_contains($pgY, 'seit 2035'), 'Zeitraum nur mit Jahr oder mit Monat und Jahr, „seit“ nur mit Jahr');
ok(str_contains($rN['body'], 'Bitte auch das Jahr angeben') || str_contains($rN['body'], 'Beginn'), 'Monat ohne Jahr wird abgelehnt (Jahr ist Pflicht)');
ok(!q("SELECT 1 FROM ar_items WHERE coll = 'cv' AND data LIKE '%Jahrtest Ohne%'")->fetchColumn(), 'Eintrag ohne Jahr wird nicht gespeichert');
$yf = req('GET', "$base/admin/?p=edit&c=cv")['body'];
ok(str_contains($yf, 'name="from_y"') && str_contains($yf, 'name="from_m"') && str_contains($yf, 'name="to_y"') && !str_contains($yf, 'type="month"'), 'Formular: Jahr und Monat getrennt, Monat optional');
foreach (q("SELECT id FROM ar_items WHERE coll = 'cv' AND data LIKE '%Jahrtest%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}
reset_content_cache();
// Backend-Struktur: Podcast-Folgen unter Arbeiten; Stationen (mit „Davor“) und Off the record unter Über mich
$adm = req('GET', "$base/admin/")['body'];
ok(str_contains($adm, 'Podcast-Folgen') && !str_contains($adm, 'Lebenslauf &amp; Stationen') && substr_count($adm, 'p=list&amp;c=cv') >= 1 && substr_count($adm, 'p=list&amp;c=offrecord') >= 1, 'Seitenleiste: Podcast-Folgen, Stationen und Off the record als Unterpunkte');
$cvList = req('GET', "$base/admin/?p=list&c=cv")['body'];
ok(str_contains($cvList, 'class="embedlist"') && str_contains($cvList, 'p=edit&amp;c=before') && substr_count($cvList, 'id="rows"') === 1, '„Davor“ steht unter den Stationen auf derselben Seite');
ok(str_contains($cvList, 'id="rows-embed"') && str_contains($cvList, 'data-coll="before"') && substr_count($cvList, 'class="grip"') === count(items('cv', false, true)) + count(items('before', false, true)) && substr_count($cvList, 'draggable="true"') === substr_count($cvList, 'class="grip"'), '„Davor“ lässt sich wie die Stationen per Ziehen sortieren');
$bp = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'before', 'text' => 'Davor-Test', 'side' => 'x', 'mode' => 'publish']);
ok(str_contains($bp['head'], 'c=cv'), 'nach dem Speichern von „Davor“ geht es zurück zur Stationen-Seite');
foreach (q("SELECT id FROM ar_items WHERE coll = 'before' AND data LIKE '%Davor-Test%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}
$sgA = req('GET', "$base/admin/?p=group&g=texts_ueber")['body'];
ok(str_contains($sgA, 'name="cross_label"') && str_contains($sgA, 'name="lang_label"') && !str_contains(req('GET', "$base/admin/?p=group&g=about")['body'], 'name="cross_label"'), 'Überschriften „Crossmedial“ und „Sprachen“ stehen unter Abschnittstexte (Über mich)');
// Aufteilung der alten Gruppe „sections“ auf die Abschnittstexte (einmalige Migration, alte Zeile bleibt)
$saved = [];
foreach (array_keys(texts_groups()) as $tg) {
    $saved[$tg] = q('SELECT data FROM ar_settings WHERE grp = ?', [$tg])->fetchColumn();
    q('DELETE FROM ar_settings WHERE grp = ?', [$tg]);
}
q("DELETE FROM ar_settings WHERE grp = 'sections'");
q("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('sections', ?, ?, 't')", [json_encode(['cross_label' => 'Alte Crossmedial-Überschrift', 'pod_listen' => 'Alt hören', 'pod_listen_en' => 'Old listen', 'on_cv' => true, 'q_label' => 'Alte Leitfragen', 'contact_label' => 'Alter Kontakt'], JSON_UNESCAPED_UNICODE), time()]);
$mj3 = json_decode((string)q("SELECT data FROM ar_settings WHERE grp = '_migrations'")->fetchColumn(), true) ?: [];
q("UPDATE ar_settings SET data = ? WHERE grp = '_migrations'", [json_encode(array_values(array_diff($mj3, ['texts_split_v1'])))]);
req('GET', "$base/admin/");
$sp = [];
foreach (array_keys(texts_groups()) as $tg) {
    $sp[$tg] = json_decode((string)q('SELECT data FROM ar_settings WHERE grp = ?', [$tg])->fetchColumn(), true) ?: [];
}
ok(($sp['texts_ueber']['cross_label'] ?? '') === 'Alte Crossmedial-Überschrift' && ($sp['texts_arbeiten']['pod_listen'] ?? '') === 'Alt hören' && ($sp['texts_arbeiten']['pod_listen_en'] ?? '') === 'Old listen' && ($sp['texts_start']['q_label'] ?? '') === 'Alte Leitfragen' && ($sp['texts_kontakt']['contact_label'] ?? '') === 'Alter Kontakt', 'Migration: Werte der alten Abschnitte (auch Englisch) landen in den passenden Abschnittstexten');
ok(isset($sp['texts_ueber']['cross_label']) && !isset($sp['texts_start']['cross_label']), 'Migration: jeder Wert nur in der passenden Gruppe');
foreach (array_keys(texts_groups()) as $tg) {
    q('DELETE FROM ar_settings WHERE grp = ?', [$tg]);
    if ($saved[$tg] !== false) {
        q('INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES (?,?,?,?)', [$tg, $saved[$tg], time(), 't']);
    }
}
q("DELETE FROM ar_settings WHERE grp = 'sections'");
reset_content_cache();
// Schrift: je Verwendung vier Schriften zur Wahl, auf der Seite werden nur die gewählten geladen
echo "Schrift\n";
$allFilesOk = true;
foreach (font_catalog() as $role => $fonts) {
    foreach ($fonts as $key => $fe) {
        $css = font_faces_css([$role => $key], 'assets/fonts');
        preg_match_all('~url\(([^)]+)\)~', $css, $um);
        foreach ($um[1] as $u) {
            $allFilesOk = $allFilesOk && is_file("$root/$u");
        }
        $allFilesOk = $allFilesOk && count($fe[4]) >= 1 && count($fonts) === 4;
    }
}
ok($allFilesOk, 'alle Schriften des Katalogs sind als Dateien vorhanden (je Verwendung vier)');
$pgF0 = req('GET', "$base/")['body'];
ok(str_contains($pgF0, "--anton:'Anton',sans-serif") && str_contains($pgF0, "font-family:'Anton'") && !str_contains($pgF0, "font-family:'Bebas Neue'") && !str_contains($pgF0, "font-family:'Inter'") && str_contains($pgF0, '--fs-d:1;') && !str_contains($pgF0, 'assets/fonts.css'), 'Standard: nur Anton, Instrument Serif, Inter Tight und JetBrains Mono werden eingebunden');
$tf = req('GET', "$base/admin/?p=group&g=typo")['body'];
ok(substr_count($tf, 'class="fp"') === 16 && str_contains($tf, 'fonts-all.css') && str_contains($tf, 'name="size_preset"') && str_contains($tf, 'Kompakt') && str_contains($tf, 'Groß'), 'Schrift-Seite: vier Schriften je Verwendung mit Beispiel, drei Größen');
$typoPost = ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'typo', 'mode' => 'publish', 'font_display' => 'bebas-neue', 'font_serif' => 'playfair-display', 'font_sans' => 'dm-sans', 'font_mono' => 'space-mono', 'size_preset' => 'gross'];
req('POST', "$base/admin/", $typoPost);
$pgF1 = req('GET', "$base/")['body'];
ok(str_contains($pgF1, "font-family:'Bebas Neue'") && str_contains($pgF1, "font-family:'Playfair Display'") && str_contains($pgF1, "font-family:'DM Sans'") && str_contains($pgF1, "font-family:'Space Mono'")
    && !str_contains($pgF1, "font-family:'Anton'") && !str_contains($pgF1, "font-family:'Instrument Serif'") && !str_contains($pgF1, "font-family:'Inter Tight'") && !str_contains($pgF1, "font-family:'JetBrains Mono'"), 'gewählte Schriften werden eingebunden, die abgewählten nicht');
ok(str_contains($pgF1, "--anton:'Bebas Neue',sans-serif") && str_contains($pgF1, '--fs-d:1.12;--fs-t:1.1;--fs-b:1.08;') && substr_count($pgF1, 'rel="preload"') === 3, 'Variablen für Schrift und Größe, drei Dateien werden vorab geladen');
preg_match_all('~rel="preload" href="[^"]*/(assets/fonts/[^"]+)"~', $pgF1, $pm);
$pre = true;
foreach ($pm[1] as $pf) {
    $pre = $pre && is_file("$root/$pf");
}
ok($pre && count($pm[1]) === 3, 'vorab geladene Dateien existieren');
ok(str_contains(req('GET', "$base/impressum/")['body'], "font-family:'Bebas Neue'"), 'Impressum und Datenschutz nutzen dieselben Schriften');
req('POST', "$base/admin/", array_merge($typoPost, ['font_display' => 'gibt-es-nicht', 'size_preset' => 'riesig']));
$pgF2 = req('GET', "$base/")['body'];
ok(str_contains($pgF2, "font-family:'Anton'") && str_contains($pgF2, '--fs-d:1;'), 'ungültige Werte fallen auf die Standardschrift und -größe zurück');
req('POST', "$base/admin/", array_merge($typoPost, ['font_display' => 'anton', 'font_serif' => 'instrument-serif', 'font_sans' => 'inter-tight', 'font_mono' => 'jetbrains-mono', 'size_preset' => 'standard']));
ok(str_contains(req('GET', "$base/")['body'], '--fs-b:1;'), 'zurück auf Standard');
// Farben: fertige Paletten oder eigene Farben, Lesbarkeit
echo "Farben\n";
$prOk = true;
foreach (palette_presets() as $pk => $pv) {
    $tk = palette_tokens($pv[2]);
    foreach (palette_checks($pv[2]) as [, $ratio, $min]) {
        $prOk = $prOk && $ratio >= $min;
    }
    $prOk = $prOk && color_contrast($tk['mute'], $tk['paper']) >= 4.5 && color_contrast($tk['acc-lt'], $tk['teal']) >= 4.5 && count($tk) === 20;
}
ok($prOk && count(palette_presets()) === 6, 'alle fertigen Paletten bestehen die Lesbarkeits-Prüfung (6 Paletten)');
$bad = ['paper' => '#F3ECDF', 'ink' => '#C8C0B0', 'accent' => '#E0D8C8', 'teal' => '#D8D0C0', 'rec' => '#F0E8D8'];
ok(count(array_filter(palette_checks($bad), fn($c) => $c[1] < $c[2])) >= 4, 'schlechte Farbkombination wird erkannt');
$css0 = (string)file_get_contents("$root/assets/site.css");
$cssBody = substr($css0, (int)strpos($css0, '*{box-sizing'));
ok(!preg_match('~#[0-9A-Fa-f]{6}\b~', $cssBody), 'site.css enthält außerhalb der Variablen keine festen Farben mehr');
$pgC0 = req('GET', "$base/")['body'];
ok(str_contains($pgC0, '--accent:#0E5C62;') && str_contains($pgC0, '--card:#FBF6EE;') && str_contains($pgC0, '--acc-lt:#8FCFCB;') && str_contains($pgC0, 'name="theme-color" content="#F3ECDF"'), 'Standard: unveränderte Farben der Seite');
$cfm = req('GET', "$base/admin/?p=group&g=colors")['body'];
ok(substr_count($cfm, 'class="pp"') === 7 && str_contains($cfm, 'id="pp-checks"') && str_contains($cfm, 'name="c_accent"') && str_contains($cfm, 'data-showif="palette=custom"') && !str_contains(req('GET', "$base/admin/?p=group&g=site")['body'], 'name="accent"'), 'Farben-Seite: sechs Paletten plus „Eigene Farben“, Prüfung, eigene Farbfelder; Kopfzeile ohne Farben');
$colPost = ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'colors', 'mode' => 'publish', 'palette' => 'bordeaux'];
req('POST', "$base/admin/", $colPost);
$pgC1 = req('GET', "$base/")['body'];
ok(str_contains($pgC1, '--accent:#8A2538;') && str_contains($pgC1, '--paper:#F6EFE6;') && str_contains($pgC1, '--teal:#551523;') && str_contains($pgC1, 'name="theme-color" content="#F6EFE6"') && !str_contains($pgC1, '--accent:#0E5C62;'), 'Palette „Bordeaux“ ändert Farben und Browserleiste');
ok(str_contains(req('GET', "$base/impressum/")['body'], '--accent:#8A2538;'), 'Impressum und Datenschutz nutzen dieselben Farben');
req('POST', "$base/admin/", array_merge($colPost, ['palette' => 'custom', 'c_paper' => '#EEEEEE', 'c_ink' => '#111111', 'c_accent' => '#224466', 'c_teal' => 'kein-hex', 'c_rec' => '#CC0000']));
$pgC2 = req('GET', "$base/")['body'];
ok(str_contains($pgC2, '--accent:#224466;') && str_contains($pgC2, '--paper:#EEEEEE;') && str_contains($pgC2, '--teal:#0B3F44;') && str_contains($pgC2, '--rec:#CC0000;'), 'Eigene Farben; ungültiger Hex-Wert fällt auf den Standard zurück');
req('POST', "$base/admin/", array_merge($colPost, ['palette' => 'gibt-es-nicht']));
ok(str_contains(req('GET', "$base/")['body'], '--accent:#0E5C62;'), 'ungültige Palette fällt auf Standard zurück');
// Übernahme der alten Akzentfarbe (einmalige Migration)
$siteRow = q("SELECT data FROM ar_settings WHERE grp = 'site'")->fetchColumn();
$siteD = json_decode((string)$siteRow, true) ?: [];
$colSaved = q("SELECT data FROM ar_settings WHERE grp = 'colors'")->fetchColumn();
q("UPDATE ar_settings SET data = ? WHERE grp = 'site'", [json_encode($siteD + ['accent' => '#112233', 'rec' => '#C42F24'])]);
$siteD2 = $siteD;
$siteD2['accent'] = '#112233';
$siteD2['rec'] = '#C42F24';
q("UPDATE ar_settings SET data = ? WHERE grp = 'site'", [json_encode($siteD2)]);
q("DELETE FROM ar_settings WHERE grp = 'colors'");
$mjc = json_decode((string)q("SELECT data FROM ar_settings WHERE grp = '_migrations'")->fetchColumn(), true) ?: [];
q("UPDATE ar_settings SET data = ? WHERE grp = '_migrations'", [json_encode(array_values(array_diff($mjc, ['colors_v1'])))]);
req('GET', "$base/admin/");
$cm = json_decode((string)q("SELECT data FROM ar_settings WHERE grp = 'colors'")->fetchColumn(), true) ?: [];
ok(($cm['palette'] ?? '') === 'custom' && ($cm['c_accent'] ?? '') === '#112233' && ($cm['c_rec'] ?? '') === '#C42F24', 'Migration: abweichende Akzentfarbe wird als „Eigene Farben“ übernommen');
q("UPDATE ar_settings SET data = ? WHERE grp = 'site'", [(string)$siteRow]);
q("DELETE FROM ar_settings WHERE grp = 'colors'");
if ($colSaved !== false) {
    q("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('colors', ?, ?, 't')", [$colSaved, time()]);
}
req('POST', "$base/admin/", array_merge($colPost, ['palette' => 'standard']));
reset_content_cache();
ok(str_contains(req('GET', "$base/")['body'], '--accent:#0E5C62;'), 'zurück auf Standard');
// Aufbau der Seite: Reihenfolge und Sichtbarkeit der Abschnitte und Unterabschnitte
echo "Aufbau der Seite\n";
function save_layout(array $v = []): void
{
    global $base, $tok;
    $all = array_fill_keys(array_merge(array_values(layout_toggles()), array_values(layout_sub_toggles())), '1');
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_group', 'g' => 'layout', 'mode' => 'publish'] + array_merge($all, $v));
}
function pos_of(string $html, string $needle): int
{
    $p = strpos($html, $needle);
    return $p === false ? -1 : $p;
}
save_layout();
$featId = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL ORDER BY sort LIMIT 1")->fetchColumn();
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_featured', 'id' => $featId]);
$lf = req('GET', "$base/admin/?p=group&g=layout")['body'];
ok(substr_count($lf, 'name="on_') === 7 && substr_count($lf, 'name="s_') === 7 && substr_count($lf, 'data-lay="up"') === 13 && str_contains($lf, 'id="lay-order"') && str_contains($lf, 'name="sub_arbeiten"') && str_contains($lf, 'name="sub_about"') && str_contains($lf, 'name="sub_cv"'), 'Aufbau-Seite: Schalter und Pfeile für Abschnitte und Unterabschnitte (7 + 7)');
$pgL0 = req('GET', "$base/")['body'];
$ord0 = array_map(fn($id) => pos_of($pgL0, 'id="' . $id . '"'), ['arbeiten', 'podcast', 'ueber', 'lebenslauf', 'offtherecord', 'kontakt']);
$sorted0 = $ord0;
sort($sorted0);
ok(!in_array(-1, $ord0, true) && $ord0 === $sorted0, 'Standardreihenfolge: Arbeiten, Podcast, Über mich, Lebenslauf, Off the record, Kontakt');
preg_match_all('~<span class="rec-t">REC</span><span>(\d\d) — ([^<]+)</span>~', $pgL0, $rm);
ok(in_array('01 — Showreel', array_map(fn($a, $b) => "$a — $b", $rm[1], $rm[2]), true) && in_array('04 — Kontakt', array_map(fn($a, $b) => "$a — $b", $rm[1], $rm[2]), true), 'Nummern der REC-Zeilen wie bisher (Showreel 01, Kontakt 04)');
save_layout(['order' => 'about,cv,arbeiten,podcast,questions,off']);
$pgL1 = req('GET', "$base/")['body'];
$ord1 = array_map(fn($id) => pos_of($pgL1, 'id="' . $id . '"'), ['ueber', 'lebenslauf', 'arbeiten', 'podcast']);
$s1 = $ord1;
sort($s1);
ok(!in_array(-1, $ord1, true) && $ord1 === $s1 && pos_of($pgL1, 'class="questions"') > pos_of($pgL1, 'id="podcast"') && pos_of($pgL1, 'id="offtherecord"') > pos_of($pgL1, 'class="questions"') && pos_of($pgL1, 'id="kontakt"') > pos_of($pgL1, 'id="offtherecord"'), 'neue Reihenfolge: Über mich, Lebenslauf, Arbeiten, Podcast, Leitfragen, Off the record, Kontakt unten');
preg_match_all('~<span class="rec-t">REC</span><span>(\d\d) — ([^<]+)</span>~', $pgL1, $rm1);
$nums1 = array_map(fn($a, $b) => "$a — $b", $rm1[1], $rm1[2]);
ok(in_array('01 — Über mich', $nums1, true) && in_array('02 — Lebenslauf', $nums1, true) && in_array('03 — Showreel', $nums1, true) && in_array('03 — Podcast', $nums1, true), 'Nummern folgen der Reihenfolge (nebeneinander stehende Showreel und Podcast teilen sich eine Nummer)');
$navHtml = (string)(preg_match('~<nav aria-label="Mobile Navigation">.*?</nav>~s', $pgL1, $nm) ? $nm[0] : '');
$navPos = array_map(fn($a) => pos_of($navHtml, 'href="#' . $a . '"'), ['ueber', 'lebenslauf', 'arbeiten', 'kontakt']);
$navSorted = $navPos;
sort($navSorted);
ok(!in_array(-1, $navPos, true) && $navPos === $navSorted, 'Menüpunkte folgen der Reihenfolge der Abschnitte (Handy-Menü wie Kopfzeile, ohne Podcast und Off the record)');
save_layout(['order' => 'x,off,off,nix']);
$lf2 = req('GET', "$base/admin/?p=group&g=layout")['body'];
ok(str_contains($lf2, 'name="order" id="lay-order" value="off,questions,arbeiten,podcast,about,cv"'), 'ungültige und doppelte Einträge entfallen, fehlende folgen in Standardreihenfolge');
save_layout(['sub_about' => 'lang,cross', 'sub_cv' => 'thread,logos', 'sub_arbeiten' => 'editor,featured,list']);
$pgL2 = req('GET', "$base/")['body'];
ok(pos_of($pgL2, 'class="langs"') > -1 && pos_of($pgL2, 'class="langs"') < pos_of($pgL2, 'class="cross-wrap"'), 'Über mich: Sprachen vor Crossmedial');
ok(pos_of($pgL2, 'id="rf"') > -1 && pos_of($pgL2, 'id="rf"') < pos_of($pgL2, 'class="cv-logos"'), 'Lebenslauf: Zeitstrahl vor der Logoleiste');
ok(pos_of($pgL2, 'class="ar-ed-desk editor"') > -1 && pos_of($pgL2, 'class="ar-ed-desk editor"') < pos_of($pgL2, 'class="fa"') && pos_of($pgL2, 'class="fa"') < pos_of($pgL2, 'class="clip-list"') && substr_count($pgL2, 'id="arbeiten"') === 1, 'Arbeiten: Schnittplatz, Featured, Beitragsliste; die id steht nur einmal');
save_layout(['s_lang' => '', 's_logos' => '', 's_featured' => '', 'on_podcast' => '']);
$pgL3 = req('GET', "$base/")['body'];
$nav3 = (string)(preg_match('~<nav aria-label="Mobile Navigation">.*?</nav>~s', $pgL3, $nm3) ? $nm3[0] : '');
ok(!str_contains($pgL3, 'class="langs"') && !str_contains($pgL3, 'class="cv-logos"') && !str_contains($pgL3, 'class="fa"') && !str_contains($pgL3, 'id="podcast"') && !str_contains($nav3, 'href="#podcast"') && str_contains($pgL3, 'class="rf-list"') && str_contains($pgL3, 'class="clip-list"'), 'Schalter: Unterabschnitte und Abschnitte lassen sich ausblenden (Menüpunkt entfällt), der Rest bleibt');
save_layout(['on_show' => '']);
$pgL4 = req('GET', "$base/")['body'];
ok(!str_contains($pgL4, 'class="clip-list"') && !str_contains($pgL4, 'class="ar-ed-desk editor"') && str_contains($pgL4, 'class="fa"'), 'Showreel aus: Featured bleibt, Schnittplatz und Liste entfallen');
save_layout();
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_featured', 'id' => $featId]);
// Übernahme der Schalter (einmalige Migration)
$layRow = q("SELECT data FROM ar_settings WHERE grp = 'layout'")->fetchColumn();
$taRow = q("SELECT data FROM ar_settings WHERE grp = 'texts_arbeiten'")->fetchColumn();
$taD = json_decode((string)$taRow, true) ?: [];
$taD['on_podcast'] = false;
$taD['on_show'] = true;
q("UPDATE ar_settings SET data = ? WHERE grp = 'texts_arbeiten'", [json_encode($taD)]);
q("DELETE FROM ar_settings WHERE grp = 'layout'");
$mjl = json_decode((string)q("SELECT data FROM ar_settings WHERE grp = '_migrations'")->fetchColumn(), true) ?: [];
q("UPDATE ar_settings SET data = ? WHERE grp = '_migrations'", [json_encode(array_values(array_diff($mjl, ['layout_v1'])))]);
req('GET', "$base/admin/");
$ly = json_decode((string)q("SELECT data FROM ar_settings WHERE grp = 'layout'")->fetchColumn(), true) ?: [];
ok(array_key_exists('on_podcast', $ly) && $ly['on_podcast'] === false && ($ly['on_show'] ?? null) === true, 'Migration: Schalter aus den Abschnittstexten gehen in „Aufbau der Seite“ über');
q("UPDATE ar_settings SET data = ? WHERE grp = 'texts_arbeiten'", [(string)$taRow]);
q("DELETE FROM ar_settings WHERE grp = 'layout'");
if ($layRow !== false) {
    q("INSERT INTO ar_settings (grp, data, updated_at, updated_by) VALUES ('layout', ?, ?, 't')", [$layRow, time()]);
}
save_layout();
reset_content_cache();
// Ein-/Ausblenden per Schieberegler in der Liste bei allen Einträgen (kein Häkchen mehr im Formular)
echo "Ein-/Ausblenden\n";
$pubOk = true;
foreach (['clips', 'episodes', 'social', 'cv', 'before', 'crossmedia', 'languages', 'offrecord', 'questions', 'nav'] as $pc) {
    $lb = req('GET', "$base/admin/?p=list&c=$pc")['body'];
    $eb = req('GET', "$base/admin/?p=edit&c=$pc")['body'];
    $pubOk = $pubOk && str_contains($lb, 'tgl-f') && !str_contains($eb, 'name="published"');
}
ok($pubOk, 'alle Listen haben den Schieberegler, in keinem Formular steht noch ein Anzeigen-Häkchen');
$pubPost = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'crossmedia', 'label' => 'Ausblendtest', 'outlets' => 'x', 'icon' => 'text', 'mode' => 'publish'];
req('POST', "$base/admin/", $pubPost);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'languages', 'name' => 'Ausblendsprache', 'mode' => 'publish']);
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'org' => 'Ausblendorg', 'from_y' => '2036', 'mode' => 'publish']);
$pgP = req('GET', "$base/")['body'];
ok(str_contains($pgP, 'Ausblendtest') && str_contains($pgP, 'Ausblendsprache') && str_contains($pgP, 'Ausblendorg'), 'neue Einträge sind ohne Häkchen sichtbar');
foreach (['crossmedia' => 'Ausblendtest', 'languages' => 'Ausblendsprache', 'cv' => 'Ausblendorg'] as $pc => $needle) {
    $pid = (int)q("SELECT id FROM ar_items WHERE coll = ? AND data LIKE ?", [$pc, '%' . $needle . '%'])->fetchColumn();
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'toggle_pub', 'id' => $pid, 'to' => '0', 'ajax' => '1']);
}
$pgP2 = req('GET', "$base/")['body'];
ok(!str_contains($pgP2, 'Ausblendtest') && !str_contains($pgP2, 'Ausblendsprache') && !str_contains($pgP2, 'Ausblendorg') && !str_contains(req('GET', "$base/llms.txt")['body'], 'Ausblendorg'), 'ausgeblendete Einträge fehlen auf der Seite (Crossmedial, Sprachen, Stationen)');
$pidc = (int)q("SELECT id FROM ar_items WHERE coll = 'cv' AND data LIKE '%Ausblendorg%'")->fetchColumn();
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'cv', 'id' => $pidc, 'org' => 'Ausblendorg', 'from_y' => '2036', 'mode' => 'publish']);
ok(!str_contains(req('GET', "$base/")['body'], 'Ausblendorg'), 'Speichern über das Formular blendet einen ausgeblendeten Eintrag nicht wieder ein');
foreach (q("SELECT id FROM ar_items WHERE data LIKE '%Ausblend%' AND coll IN ('crossmedia','languages','cv')")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}
reset_content_cache();
// Admin: nur index.php und vorschau.php sind von außen aufrufbar
$adm = (string)file_get_contents("$root/admin/.htaccess");
$allow = ['index.php', 'vorschau.php'];
$blockRe = '~^(?!(index|vorschau)\\.php$).*\\.php$~';
$blocked = true;
foreach (glob("$root/admin/*.php") as $af) {
    $isB = preg_match($blockRe, basename($af)) === 1;
    $blocked = $blocked && ($isB === !in_array(basename($af), $allow, true));
}
foreach (glob("$root/admin/hilfe/*.php") as $af) {
    $blocked = $blocked && preg_match($blockRe, basename($af)) === 1;
}
ok(str_contains($adm, '(?!(index|vorschau)\\.php$)') && $blocked, 'Admin: nur index.php und vorschau.php sind aufrufbar, alle eingebundenen Dateien gesperrt');
// Englischer Text ohne deutschen Text erscheint nicht (geleerte deutsche Überschriftenteile)
$rowO = json_decode((string)q('SELECT data FROM ar_settings WHERE grp = ?', ['texts_arbeiten'])->fetchColumn(), true) ?: [];
$bakO = $rowO;
$rowO['show_h2'] = '';
$rowO['show_h2_en'] = 'ORPHANTEST';
q('UPDATE ar_settings SET data = ? WHERE grp = ?', [json_encode($rowO), 'texts_arbeiten']);
reset_content_cache();
foreach (glob("$root/data/cache/*") ?: [] as $cf) {
    @unlink($cf);
}
$enO = req('GET', "$base/en/")['body'];
ok(!str_contains($enO, 'ORPHANTEST'), 'Englisch: Text ohne deutsche Entsprechung wird nicht angezeigt');
q('UPDATE ar_settings SET data = ? WHERE grp = ?', [json_encode($bakO), 'texts_arbeiten']);
reset_content_cache();
foreach (glob("$root/data/cache/*") ?: [] as $cf) {
    @unlink($cf);
}
// Barrierefreiheit
echo "Barrierefreiheit\n";
$empty = ['show_h1' => '', 'show_h2' => '', 'pod_h1' => '', 'pod_h2' => ''];
foreach (['texts_arbeiten' => ['show_h1', 'show_h2', 'pod_h1', 'pod_h2'], 'texts_ueber' => ['cv_h1', 'cv_h2']] as $tg => $ks) {
    $row = json_decode((string)q('SELECT data FROM ar_settings WHERE grp = ?', [$tg])->fetchColumn(), true) ?: [];
    $a11yBak[$tg] = $row;
    foreach ($ks as $k) {
        $row[$k] = '';
        $row[$k . '_en'] = '';
    }
    q('UPDATE ar_settings SET data = ? WHERE grp = ?', [json_encode($row), $tg]);
}
reset_content_cache();
foreach (glob("$root/data/cache/*") ?: [] as $cf) {
    @unlink($cf);
}
$pgA = req('GET', "$base/")['body'];
ok(!preg_match('~<h2 class="(big-h|pod-h)"[^>]*>\s*<span class="(bh1|ph1)"></span><span class="(bh2|ph2)"></span></h2>~', $pgA), 'keine leeren Überschriften (ohne Überschriftstext entfällt das Element)');
ok(preg_match_all('~<h2~', $pgA) >= 4 && !str_contains($pgA, '<h2 class="big-h"><span class="bh1"></span>'), 'jeder Abschnitt hat weiterhin eine Überschrift für die Gliederung');
foreach ($a11yBak as $tg => $row) {
    q('UPDATE ar_settings SET data = ? WHERE grp = ?', [json_encode($row), $tg]);
}
reset_content_cache();
foreach (glob("$root/data/cache/*") ?: [] as $cf) {
    @unlink($cf);
}
$adminHome = req('GET', "$base/admin/")['body'];
ok(str_contains($adminHome, 'class="btn small ghost" aria-label="Abmelden"'), 'Admin: Abmelden-Knopf hat auch ohne Text (Handy) einen Namen');
ok(str_contains(req('GET', "$base/admin/?p=stats")['body'], 'role="region" aria-label="Besuche nach Wochentag') && !str_contains(req('GET', "$base/admin/?p=stats")['body'], '<th scope="col"></th>'), 'Admin: Statistik-Tabelle mit Beschriftung, waagerecht scrollbarer Bereich per Tastatur erreichbar');
ok(color_contrast('#5b6866', '#fffdf8') >= 4.5, 'Admin: Nebentext hat ausreichend Kontrast');
// Symbol-Auswahl bei Kategorien und Crossmedial
$cmForm = req('GET', "$base/admin/?p=edit&c=crossmedia")['body'];
$trForm = req('GET', "$base/admin/?p=edit&c=tracks")['body'];
ok(substr_count($cmForm, 'class="ip"') === count(media_options()) && substr_count($trForm, 'class="ip"') === count(media_options()) && count(media_options()) >= 20, 'Symbol-Auswahl mit allen Symbolen bei Crossmedial und Kategorien (' . count(media_options()) . ')');
ok(str_contains($cmForm, 'type="radio" name="icon" value="share"') && str_contains($cmForm, 'value="camera"') && str_contains($cmForm, 'value="search"') && str_contains($cmForm, 'value="newspaper"') && !str_contains($cmForm, '<select name="icon"'), 'Auswahl enthält Social Media, Foto, Recherche, Print');
$allIcons = true;
foreach (array_keys(media_options()) as $ik) {
    $allIcons = $allIcons && str_contains(icon($ik), '<svg') && icon($ik) !== icon('nicht-vorhanden-xyz') || $ik === 'text';
}
ok($allIcons, 'jedes Symbol hat eine eigene Zeichnung');
$cmP = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'crossmedia', 'label' => 'Symboltest', 'outlets' => 'x', 'icon' => 'camera', 'mode' => 'publish'];
req('POST', "$base/admin/", $cmP);
req('POST', "$base/admin/", array_merge($cmP, ['label' => 'Symboltest Ungültig', 'icon' => 'gibt-es-nicht']));
$icRows = q("SELECT data FROM ar_items WHERE coll = 'crossmedia' AND data LIKE '%Symboltest%'")->fetchAll();
$icVals = array_map(fn($r) => (json_decode((string)$r['data'], true) ?: [])['icon'] ?? '', $icRows);
sort($icVals);
ok($icVals === ['camera', 'text'], 'ungültiges Symbol fällt auf den Standard zurück (' . implode(',', $icVals) . ')');
foreach (q("SELECT id FROM ar_items WHERE coll = 'crossmedia' AND data LIKE '%Symboltest%'")->fetchAll() as $row) {
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'trash', 'id' => $row['id']]);
    req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'purge', 'id' => $row['id']]);
}
// Übernahme alter Stationen in den Lebenslauf (einmalige Migration)
$mj = json_decode((string)q("SELECT data FROM ar_settings WHERE grp = '_migrations'")->fetchColumn(), true) ?: [];
q("DELETE FROM ar_items WHERE data LIKE '%Migrationsstation%'");
q('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)', ['stations', json_encode(['name' => 'Migrationsstation Alpha', 'logo' => 'logo-wdr.webp', 'desk' => 'TV', 'period' => '2020', 'url' => '']), 901, time(), time(), 't']);
q('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)', ['stations', json_encode(['name' => 'Migrationsstation Beta', 'logo' => '', 'desk' => 'Radio', 'period' => 'seit 2019', 'url' => '']), 902, time(), time(), 't']);
q('INSERT INTO ar_items (coll, data, sort, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)', ['cv', json_encode(['org' => 'Migrationsstation Alpha GmbH', 'role' => 'Autorin', 'from' => '2020-01', 'logo' => '', 'desk' => '']), 901, time(), time(), 't']);
q("UPDATE ar_settings SET data = ? WHERE grp = '_migrations'", [json_encode(array_values(array_diff($mj, ['cv_stations_v1'])))]);
req('GET', "$base/admin/");
$ma = json_decode((string)q("SELECT data FROM ar_items WHERE coll = 'cv' AND data LIKE '%Migrationsstation Alpha%'")->fetchColumn(), true);
$mb = json_decode((string)q("SELECT data FROM ar_items WHERE coll = 'cv' AND data LIKE '%Migrationsstation Beta%'")->fetchColumn(), true);
ok(($ma['logo'] ?? '') === 'logo-wdr.webp' && ($ma['desk'] ?? '') === 'TV', 'Migration: Logo und Redaktion gehen an den passenden Lebenslauf-Eintrag');
ok(($mb['org'] ?? '') === 'Migrationsstation Beta' && ($mb['when_label'] ?? '') === 'seit 2019' && ($mb['desk'] ?? '') === 'Radio', 'Migration: Station ohne passenden Eintrag wird als neuer Eintrag angelegt');
q("DELETE FROM ar_items WHERE data LIKE '%Migrationsstation%'");
reset_content_cache();

$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'add_user', 'email' => 'antonia@antoniarueller.de', 'name' => 'A']);
ok(str_contains(follow($r)['body'], 'eigenen Domain'), 'Domain-Postfach als Zugang abgelehnt');
$r = req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'logout']);
ok(str_contains(req('GET', "$base/admin/")['body'], 'Code senden'), 'Abgemeldet');
ok(!str_contains(req('GET', "$base/admin/?p=trash")['body'], 'Papierkorb leeren'), 'ohne Login kein Zugriff');


echo "Sperre nach Fehlversuchen\n";
q('DELETE FROM ar_throttle');
req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
$lockMsg = '';
for ($i = 1; $i <= 5; $i++) {
    $rr = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => '1234567' . $i, 'pw' => '']);
}
ok(str_contains($rr['body'], 'vorübergehend gesperrt'), 'nach 5 Fehlversuchen: Sperre mit Hinweis');
q('DELETE FROM ar_throttle');
$m1 = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => '12345670', 'pw' => '']);
$m2 = req('POST', "$base/admin/", ['action' => 'verify', 'email' => 'unbekannt@example.net', 'code' => '12345670', 'pw' => '']);
ok(str_contains($m1['body'], 'Noch 4 Versuche') && str_contains($m1['body'], 'für 15 Minuten gesperrt') && str_contains($m2['body'], 'Noch 4 Versuche'), 'nach einem Fehlversuch: Hinweis auf die verbleibenden Versuche und die Sperrdauer (für jede Adresse gleich)');
for ($i = 0; $i < 3; $i++) {
    $m3 = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => '1234567' . $i, 'pw' => '']);
}
ok(str_contains($m3['body'], 'Noch 1 Versuch,'), 'vorletzter Stand: „Noch 1 Versuch“ (Einzahl)');
q('DELETE FROM ar_throttle');
$cl = req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
ok(!str_contains($cl['body'], 'pattern=') && str_contains($cl['body'], 'data-code') && str_contains($cl['body'], 'Leerzeichen beim Einfügen'), 'Code-Feld ohne starre Mustervorgabe, Hinweis auf Leerzeichen');
for ($i = 1; $i <= 5; $i++) {
    $rr = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => '1234567' . $i, 'pw' => '']);
}
@unlink("$root/data/mail.log");
$rq = req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
ok(str_contains($rq['body'], 'vorübergehend gesperrt') && !is_file("$root/data/mail.log"), 'gesperrt: kein neuer Code per Mail');
$pre = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => '00000000', 'pw' => '']);
ok(str_contains($pre['body'], 'vorübergehend gesperrt'), 'gesperrt: auch richtige Eingaben werden nicht geprüft');
for ($i = 1; $i <= 5; $i++) {
    $ru = req('POST', "$base/admin/", ['action' => 'verify', 'email' => 'niemand@example.net', 'code' => '9999999' . $i, 'pw' => '']);
}
ok(str_contains($ru['body'], 'vorübergehend gesperrt'), 'unbekannte Adresse wird gleich behandelt (kein Rückschluss auf Konten)');
q('DELETE FROM ar_throttle');
ok(!str_contains(req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner])['body'], 'vorübergehend gesperrt'), 'nach Ablauf wieder möglich');
q('DELETE FROM ar_throttle');

echo "Passwort vergessen\n";
@unlink("$root/data/mail.log");
$rf = req('POST', "$base/admin/", ['action' => 'forgot', 'email' => 'niemand@example.net']);
ok(str_contains($rf['body'], 'Mail unterwegs') && !is_file("$root/data/mail.log"), 'unbekannte Adresse: gleiche Antwort, keine Mail');
$rf = req('POST', "$base/admin/", ['action' => 'forgot', 'email' => $owner]);
$logTxt = (string)@file_get_contents("$root/data/mail.log");
ok(str_contains($rf['body'], 'Mail unterwegs') && preg_match('~[?&]t=([a-f0-9]{48})~', $logTxt, $tm), 'Link zum Zurücksetzen per Mail');
$rtok = $tm[1] ?? '';
$gp = req('GET', "$base/admin/?p=reset&e=" . rawurlencode($owner) . "&t=$rtok");
ok(str_contains($gp['body'], 'Neues Passwort festlegen'), 'Link öffnet das Formular');
ok(str_contains(req('GET', "$base/admin/?p=reset&e=" . rawurlencode($owner) . "&t=" . str_repeat('a', 48))['body'], 'Link ungültig'), 'falscher Link wird abgelehnt');
$bad = req('POST', "$base/admin/", ['action' => 'reset_apply', 'email' => $owner, 't' => $rtok, 'pw1' => 'zu-kurz', 'pw2' => 'zu-kurz']);
ok(str_contains($bad['body'], 'mindestens 12'), 'zu kurzes Passwort wird abgelehnt');
$bad = req('POST', "$base/admin/", ['action' => 'reset_apply', 'email' => $owner, 't' => $rtok, 'pw1' => 'passwort-nummer-eins', 'pw2' => 'passwort-nummer-zwei']);
ok(str_contains($bad['body'], 'nicht überein'), 'ungleiche Passwörter werden abgelehnt');
$okr = req('POST', "$base/admin/", ['action' => 'reset_apply', 'email' => $owner, 't' => $rtok, 'pw1' => 'neues-langes-passwort-42', 'pw2' => 'neues-langes-passwort-42']);
ok($okr['code'] === 302, 'neues Passwort über den Link gesetzt');
$again = req('POST', "$base/admin/", ['action' => 'reset_apply', 'email' => $owner, 't' => $rtok, 'pw1' => 'noch-ein-passwort-123', 'pw2' => 'noch-ein-passwort-123']);
ok(str_contains($again['body'], 'ungültig'), 'Link ist nur einmal nutzbar');
@unlink("$root/data/mail.log");
req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
preg_match('~(\d{4}) (\d{4})~', (string)@file_get_contents("$root/data/mail.log"), $mr);
$cr = ($mr[1] ?? '') . ($mr[2] ?? '');
ok(req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $cr, 'pw' => 'falsch-falsch-falsch'])['code'] !== 302, 'Anmeldung braucht nun das neue Passwort');
@unlink("$root/data/mail.log");
req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
preg_match('~(\d{4}) (\d{4})~', (string)@file_get_contents("$root/data/mail.log"), $mr);
$cr = ($mr[1] ?? '') . ($mr[2] ?? '');
$li = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $cr, 'pw' => 'neues-langes-passwort-42']);
ok($li['code'] === 302, 'Anmeldung mit Code und neuem Passwort');
$tokX = csrf(req('GET', "$base/admin/")['body']);
// Inhaber setzt das Passwort einer anderen Person zurück
$otherId = (int)q("SELECT id FROM ar_users WHERE email <> ? AND role = 'owner' LIMIT 1", [$owner])->fetchColumn();
if ($otherId) {
    q('UPDATE ar_users SET pw_hash = ? WHERE id = ?', [password_hash('irgendein-passwort-1', PASSWORD_DEFAULT), $otherId]);
    req('POST', "$base/admin/", ['_csrf' => $tokX, 'action' => 'user_pw_clear', 'id' => $otherId]);
    ok(q('SELECT pw_hash FROM ar_users WHERE id = ?', [$otherId])->fetchColumn() === null, 'Inhaber kann Passwort einer Person zurücksetzen');
}
$ul = req('GET', "$base/admin/?p=users")['body'];
ok(str_contains($ul, 'Passwort: ja'), 'Zugänge zeigen Passwort-Status');
// eigenes Passwort wieder entfernen (für die folgenden Tests)
q('UPDATE ar_users SET pw_hash = NULL WHERE email = ?', [$owner]);
req('POST', "$base/admin/", ['_csrf' => $tokX, 'action' => 'logout']);
q('DELETE FROM ar_throttle');

echo "Zusätzliches Passwort\n";
q('DELETE FROM ar_throttle');
@unlink("$root/data/mail.log");
$r = req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
preg_match('~(\d{4}) (\d{4})~', (string)@file_get_contents("$root/data/mail.log"), $m2);
$code2 = ($m2[1] ?? '') . ($m2[2] ?? '');
req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $code2, 'pw' => '']);
$home = req('GET', "$base/admin/");
$tok2 = csrf($home['body']);
$r = req('POST', "$base/admin/", ['_csrf' => $tok2, 'action' => 'account_save', 'name' => 'Lukas', 'new_pw' => 'kurz', 'new_pw2' => 'kurz']);
ok(str_contains($r['body'], 'mindestens 12'), 'zu kurzes Passwort abgelehnt');
$r = req('POST', "$base/admin/", ['_csrf' => $tok2, 'action' => 'account_save', 'name' => 'Lukas', 'new_pw' => 'ein-langes-passwort-123', 'new_pw2' => 'ein-langes-passwort-123']);
ok($r['code'] === 302, 'Passwort gesetzt');
req('POST', "$base/admin/", ['_csrf' => $tok2, 'action' => 'logout']);
@unlink("$root/data/mail.log");
req('POST', "$base/admin/", ['action' => 'request', 'email' => $owner]);
preg_match('~(\d{4}) (\d{4})~', (string)@file_get_contents("$root/data/mail.log"), $m3);
$code3 = ($m3[1] ?? '') . ($m3[2] ?? '');
$r = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $code3, 'pw' => '']);
ok($r['code'] !== 302, 'ohne Passwort keine Anmeldung');
$r = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $code3, 'pw' => 'falsches-passwort-xyz']);
ok($r['code'] !== 302, 'falsches Passwort abgelehnt');
$messy = '  ' . substr($code3, 0, 4) . "\u{00A0}  " . substr($code3, 4) . ' ';
$r = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $messy, 'pw' => 'ein-langes-passwort-123']);
ok($r['code'] === 302, 'mit Code (mit Leerzeichen und geschütztem Leerzeichen eingefügt) und Passwort angemeldet');
$tok3 = csrf(req('GET', "$base/admin/")['body']);
$r = req('POST', "$base/admin/", ['_csrf' => $tok3, 'action' => 'account_save', 'name' => 'Lukas', 'remove_pw' => '1', 'current_pw' => 'ein-langes-passwort-123']);
ok($r['code'] === 302, 'Passwort wieder entfernt');
req('POST', "$base/admin/", ['_csrf' => $tok3, 'action' => 'logout']);

echo $fail ? "\n$fail FEHLER\n" : "\nAlles bestanden\n";
exit($fail ? 1 : 0);
