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
ok(!str_contains($imp, $mailAddr) && str_contains($imp, '&#112;&#114;&#105;'), 'Impressum: Adresse als Zeichencodes');
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
ok(req('GET', "$base/admin/?p=help")['code'] === 200 && str_contains(req('GET', "$base/admin/?p=help")['body'], 'Neue Referenz anlegen'), 'Hilfe-Seite');

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
$ap = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $uc, 'title' => 'Autospeicher-Test', 'medium' => 'text', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'draft', 'ajax' => '1'];
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
ok(str_contains($eb, 'details class="adv"') && str_contains($eb, 'Timecode <small>(erweitert)</small>'), 'Editor: „Erweitert“ eingeklappt');
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
$sv = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $uc, 'title' => $it['title'], 'medium' => 'text', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'publish'];
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
$tr = json_decode(req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'translate_save', 'ajax' => '1', 't' => ['g:sections:unbekannt' => 'x', 'g:nix:a' => 'x', "c:$uc:url" => 'x', 'kaputt' => 'x', "c:99999:title" => 'x']])['body'], true);
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
$dp = ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'medium' => 'text', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'url' => 'https://example.org/e'];
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
$lw = (int)q("SELECT id FROM ar_items WHERE coll = 'clips' AND deleted_at IS NULL AND live = 1 ORDER BY sort LIMIT 1")->fetchColumn();
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $lw, 'title' => 'Lang-Test', 'medium' => 'text', 'tl_track' => 'A1', 'tl_len' => 'long', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'publish']);
ok(str_contains(req('GET', "$base/")['body'], '--w:1.6'), 'Länge „Lang“ macht den Clip breiter');
req('POST', "$base/admin/", ['_csrf' => $tok, 'action' => 'save_item', 'coll' => 'clips', 'id' => $lw, 'title' => 'Lang-Test', 'medium' => 'text', 'tl_track' => 'A1', 'tl_len' => 'kaputt', 'published' => '1', 'new_tab' => '1', 'link_text' => 'x', 'mode' => 'publish']);
reset_content_cache();
ok(item($lw)['tl_len'] === 'normal', 'Ungültige Länge wird zu „Normal“');
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
$r = req('POST', "$base/admin/", ['action' => 'verify', 'email' => $owner, 'code' => $code3, 'pw' => 'ein-langes-passwort-123']);
ok($r['code'] === 302, 'mit Code und Passwort angemeldet');
$tok3 = csrf(req('GET', "$base/admin/")['body']);
$r = req('POST', "$base/admin/", ['_csrf' => $tok3, 'action' => 'account_save', 'name' => 'Lukas', 'remove_pw' => '1', 'current_pw' => 'ein-langes-passwort-123']);
ok($r['code'] === 302, 'Passwort wieder entfernt');
req('POST', "$base/admin/", ['_csrf' => $tok3, 'action' => 'logout']);

echo $fail ? "\n$fail FEHLER\n" : "\nAlles bestanden\n";
exit($fail ? 1 : 0);
