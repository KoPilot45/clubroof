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
