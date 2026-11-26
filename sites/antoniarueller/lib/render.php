<?php
declare(strict_types=1);

require_once __DIR__ . '/imgvar.php';

require_once __DIR__ . '/i18n.php';

// Hilfen für die öffentliche Seite

/** Nur #RRGGBB zulassen (verhindert Einschleusen von CSS über Einstellungen oder importierte Daten). */
function css_color(mixed $v, string $fallback = '#000000'): string
{
    return preg_match('~^#[0-9a-fA-F]{6}$~', (string)$v) ? (string)$v : $fallback;
}

function cache_dir(): string
{
    return AR_ROOT . '/data/cache';
}

/** Neue Dateiversionen (Code/CSS/JS/Konfiguration) erzeugen automatisch einen neuen Zwischenspeicher. */
function page_build_id(): string
{
    $s = '';
    foreach (['templates/page.php', 'templates/legal.php', 'templates/favicon.php', 'lib/render.php', 'lib/schema.php', 'lib/page.php', 'assets/site.css', 'assets/site.js'] as $f) {
        $s .= (string)@filemtime(AR_ROOT . '/' . $f) . '|';
    }
    $s .= (string)@filemtime(config_file()) . '|';
    return substr(md5($s), 0, 10);
}

function clear_page_cache(): void
{
    foreach (glob(cache_dir() . '/*.html') ?: [] as $f) {
        @unlink($f);
    }
}

/** @return array{0: bool, 1: string}|null [noindex, html] */
function read_page_cache(string $key): ?array
{
    $f = cache_dir() . '/' . $key . '-' . page_build_id() . '.html';
    if (!is_file($f) || filemtime($f) < time() - 6 * 3600) {
        return null;
    }
    $raw = (string)@file_get_contents($f);
    $nl = strpos($raw, "\n");
    if ($nl === false) {
        return null;
    }
    $meta = json_decode(substr($raw, 0, $nl), true);
    return [!empty($meta['noindex']), substr($raw, $nl + 1)];
}

function write_page_cache(string $key, string $html, bool $noindex): void
{
    $dir = cache_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) {
        return;
    }
    $build = page_build_id();
    $tmp = $dir . '/.tmp-' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode(['noindex' => $noindex]) . "\n" . $html, LOCK_EX) === false) {
        return;
    }
    @rename($tmp, $dir . '/' . $key . '-' . $build . '.html');
    foreach (glob($dir . '/' . $key . '-*.html') ?: [] as $old) {
        if (!str_ends_with($old, '-' . $build . '.html')) {
            @unlink($old);
        }
    }
}

/**
 * Logoleiste: jedes Logo (Datei) nur einmal, in der Reihenfolge des jeweils neuesten Eintrags.
 * Gibt je Logo [logo, org, url] zurück; Einträge ohne Logo erscheinen nicht.
 */
function cv_logo_strip(array $groups): array
{
    $out = [];
    foreach ($groups as $rows) {
        foreach ($rows as $r) {
            $lg = (string)($r['logo'] ?? '');
            if ($lg !== '' && upload_url($lg) !== '' && !isset($out[$lg])) {
                $out[$lg] = ['logo' => $lg, 'org' => (string)$r['org'], 'url' => (string)($r['url'] ?? '')];
            }
        }
    }
    return array_values($out);
}

function img_attrs(string $name): string
{
    if (upload_url($name) === '') {
        return '';
    }
    $i = @getimagesize(AR_ROOT . '/uploads/' . $name);
    return $i ? ' width="' . (int)$i[0] . '" height="' . (int)$i[1] . '"' : '';
}

/** Fokuspunkt „x,y“ (Prozent) → CSS object-position. */
function focus_pos(string $f): string
{
    return preg_match('~^(\d{1,3}(?:\.\d)?),(\d{1,3}(?:\.\d)?)$~', $f, $m) ? $m[1] . '% ' . $m[2] . '%' : '50% 50%';
}

/** *kursiv*, **GROSS**, ==Akzent== → HTML (alles andere wird maskiert). */
function mk(string $s): string
{
    $s = e($s);
    $s = preg_replace('~==(.+?)==~u', '<span class="mk-a">$1</span>', $s);
    $s = preg_replace('~\*\*(.+?)\*\*~u', '<span class="mk-c">$1</span>', $s);
    $s = preg_replace('~\*(.+?)\*~u', '<span class="mk-i">$1</span>', $s);
    return $s;
}

function icon(string $kind, int $size = 20): string
{
    $paths = [
        'video' => '<rect x="3" y="6" width="13" height="12" rx="2"></rect><path d="M16 10l5-3v10l-5-3z"></path>',
        'text' => '<path d="M4 6h16M4 11h16M4 16h10"></path>',
        'radio' => '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0M12 18v3"></path>',
        'podcast' => '<path d="M4 15v-3a8 8 0 0 1 16 0v3"></path><rect x="3" y="14" width="4" height="6" rx="1"></rect><rect x="17" y="14" width="4" height="6" rx="1"></rect>',
        'social' => '<path d="M4 5h16v11H9l-5 4z"></path>',
        'share' => '<circle cx="18" cy="5" r="2.6"></circle><circle cx="6" cy="12" r="2.6"></circle><circle cx="18" cy="19" r="2.6"></circle><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"></path>',
        'tv' => '<rect x="3" y="5" width="18" height="12" rx="2"></rect><path d="M8 21h8M12 17v4"></path>',
        'film' => '<rect x="3" y="10" width="18" height="10" rx="1.5"></rect><path d="M3 10l2-5 15-2 .6 3L21 10M8.5 7.7l2.2 2.3M14 6.5l2.2 2.4"></path>',
        'camera' => '<path d="M3 8h4l1.5-2.5h7L17 8h4v11H3z"></path><circle cx="12" cy="13.5" r="3.5"></circle>',
        'newspaper' => '<path d="M5 4h11v15a1 1 0 0 0 1 1H7a2 2 0 0 1-2-2z"></path><path d="M16 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h5"></path>',
        'book' => '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path><path d="M5 17a3 3 0 0 1 3-3h10"></path>',
        'pen' => '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"></path><path d="M14 6.5l3.5 3.5"></path>',
        'live' => '<circle cx="12" cy="12" r="1.8"></circle><path d="M8.7 8.7a4.7 4.7 0 0 0 0 6.6M15.3 8.7a4.7 4.7 0 0 1 0 6.6M5.8 5.8a8.8 8.8 0 0 0 0 12.4M18.2 5.8a8.8 8.8 0 0 1 0 12.4"></path>',
        'chat' => '<path d="M4 4.5h11v8H9l-3 3v-3H4z"></path><path d="M17 9h3v8h-2v3l-3-3h-4v-2"></path>',
        'play' => '<rect x="3" y="5" width="18" height="14" rx="4"></rect><path d="M10 9.4v5.2l4.4-2.6z"></path>',
        'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7.5l9 6 9-6"></path>',
        'search' => '<circle cx="11" cy="11" r="6"></circle><path d="M20 20l-4.5-4.5"></path>',
        'data' => '<path d="M3 20h18M6.5 20v-7M12 20V6M17.5 20v-10"></path>',
        'pin' => '<path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11z"></path><circle cx="12" cy="10" r="2.2"></circle>',
        'globe' => '<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18"></path>',
        'bulb' => '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"></path>',
    ];
    $p = $paths[$kind] ?? $paths['text'];
    return '<svg aria-hidden="true" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' . $p . '</svg>';
}

function rec_dot(int $px = 10): string
{
    return '<span class="ar-rec" style="width:' . $px . 'px;height:' . $px . 'px"></span>';
}

/** Abschnittszeile in den Stilen „Kapitelzähler“ und „Haarlinie“ (der Stil „aktuell“ steht in sec_head selbst). */
function sec_head_style(string $style, string $no, string $label, string $right, string $mb, string $extra = ''): string
{
    $mbs = ' style="margin-bottom:' . e($mb) . '"';
    $rt = $right !== '' ? '<span class="sh-r">' . e($right) . '</span>' : '';
    if ($style === 'kapitel') {
        $total = style_no_total();
        $n = (int)$no;
        $segs = '';
        for ($i = 1; $i <= $total; $i++) {
            $segs .= '<i' . ($i <= $n ? ' class="on"' : '') . '></i>';
        }
        return '<div class="sec-head sh-kap' . $extra . '"' . $mbs . '><span class="sh-n"><b>' . e($no) . '</b> / ' . sprintf('%02d', $total) . '</span><span class="sh-l">' . e(tr($label)) . '</span><span class="sh-seg" aria-hidden="true">' . $segs . '</span>' . $rt . '</div>';
    }
    return '<div class="sec-head sh-hair' . $extra . '"' . $mbs . '><span class="sh-l">' . e($no) . ' — ' . e(tr($label)) . '</span>' . $rt . '</div>';
}

/** Kopfzeile des Startbereichs („REC 00 — Intro“ …) im gewählten Stil der Abschnittszeile. */
function hero_head(array $sec, array $hero): string
{
    $st = style_of('head');
    if ($st !== 'aktuell') {
        return sec_head_style($st, '00', $sec['intro_label'], (string)$hero['meta'], '0');
    }
    return '<div class="sec-head" style="margin-bottom:0"><span class="sec-l">' . rec_dot() . '<span class="rec-t">REC</span><span>00 — ' . e(tr($sec['intro_label'])) . '</span></span>'
        . '<span class="muted">' . e($hero['meta']) . '</span><span class="muted">' . e($sec['hero_tc']) . '</span></div>';
}

/** Teile des Heros, die alle Hero-Stile brauchen: Foto-HTML und die „Aktuell“-Zeilen. */
function hero_photo_html(array $hero, string $cls, string $sizes): string
{
    $u = upload_url((string)$hero['photo']);
    if ($u === '') {
        return '';
    }
    $hv = img_width_set((string)$hero['photo']);
    return '<img class="' . $cls . '" src="' . e($u) . '"' . ($hv ? ' srcset="' . e($hv['srcset']) . '" sizes="' . e($sizes) . '"' : '') . img_attrs((string)$hero['photo']) . ' alt="' . e($hero['photo_alt']) . '" fetchpriority="high" decoding="async">';
}

function hero_now_lines(array $hero): array
{
    return array_values(array_filter(array_map('trim', explode("\n", (string)$hero['now_lines']))));
}

function sec_head(string $no, string $label, string $right, string $mb = '40px'): string
{
    $st = style_of('head');
    if ($st !== 'aktuell') {
        return sec_head_style($st, $no, $label, $right, $mb);
    }
    return '<div class="sec-head" style="margin-bottom:' . $mb . '"><span class="sec-l">' . rec_dot() . '<span class="rec-t">REC</span><span>' . e($no) . ' — ' . e(tr($label)) . '</span></span>'
        . ($right !== '' ? '<span class="muted">' . e($right) . '</span>' : '') . '</div>';
}

function fmt_month(string $date): string
{
    if (preg_match('~^(\d{4})-(\d{2})~', $date, $m)) {
        return $m[2] . '/' . $m[1];
    }
    return preg_match('~^(\d{4})$~', $date, $m) ? $m[1] : '';
}

function clip_date_label(array $c): string
{
    if (trim($c['date_label']) !== '') {
        return $c['date_label'];
    }
    if ($c['date'] === '') {
        return '';
    }
    return fmt_month($c['date']);
}

/** Breite eines Clips im Schnittplatz: variiert automatisch, bleibt aber für denselben Beitrag immer gleich. */
const TL_WEIGHTS = [0.85, 1.0, 1.15, 1.3, 1.5];

function tl_weight(int $id): float
{
    return TL_WEIGHTS[crc32('clip' . $id) % count(TL_WEIGHTS)];
}

/**
 * Schnittplatz berechnen: jede Kategorie ist eine Spur, jede Spur eine Kette aus Clips in Listenreihenfolge (ohne Datumsmaßstab).
 * @param array $clips veröffentlichte Referenzen in Listenreihenfolge
 * @return array byTrack: Code => [['id', 'w', 'year' (Jahr, wenn es hier beginnt)]], ticks: Zahl der Lineal-Felder, max: Summe der längsten Spur
 */
function build_timeline(array $clips, array $tracks): array
{
    $codes = array_column($tracks, 'code');
    $byTrack = [];
    $last = [];
    foreach ($clips as $c) {
        $code = (string)$c['tl_track'];
        if ($code === '' || !in_array($code, $codes, true)) {
            continue;
        }
        $y = $c['date'] !== '' ? substr((string)$c['date'], 0, 4) : '';
        $byTrack[$code][] = ['id' => $c['_id'], 'w' => tl_weight((int)$c['_id']), 'year' => ($y !== '' && ($last[$code] ?? '') !== $y) ? $y : ''];
        if ($y !== '') {
            $last[$code] = $y;
        }
    }
    $max = 0.0;
    foreach ($byTrack as $list) {
        $max = max($max, array_sum(array_column($list, 'w')));
    }
    return ['byTrack' => $byTrack, 'ticks' => max(16, (int)ceil($max) + 1), 'max' => max(1.0, round($max, 2))];
}

/** Beschriftung eines Lineal-Feldes (dekorativ, wie ein Timecode-Lineal). */
function ruler_label(int $i): string
{
    $s = $i * 10;
    return sprintf('%02d:%02d', intdiv($s, 60), $s % 60);
}

/** Lebenslauf nach Beginn-Jahr gruppieren. */
function cv_groups(array $rows): array
{
    $g = [];
    foreach ($rows as $r) {
        $y = substr((string)$r['from'], 0, 4) ?: '—';
        $g[$y][] = $r;
    }
    uksort($g, fn($a, $b) => $a === '—' ? 1 : ($b === '—' ? -1 : (int)$b <=> (int)$a));
    return $g;
}

function cv_when(array $r, string $since = ''): string
{
    if (trim($r['when_label']) !== '') {
        return $r['when_label'];
    }
    $a = fmt_month((string)$r['from']);
    $b = fmt_month((string)$r['to']);
    if ($r['ongoing']) {
        return ($since !== '' ? $since : tr('seit')) . ' ' . $a;
    }
    return $b !== '' ? $a . ' — ' . $b : $a;
}

function ent(string $s): string
{
    return implode('', array_map(fn($c) => '&#' . ord($c) . ';', str_split($s)));
}

/**
 * E-Mail-Adresse für Impressum/Datenschutz: nirgends im Quelltext lesbar. Name und Domain stehen rückwärts und
 * Base64-kodiert in Datenattributen; das Seitenskript setzt daraus beim Laden den Link zusammen. Ohne JavaScript
 * (und für Screenreader beim Laden) steht die Adresse als „name (at) domain.de“ da.
 * $text = frei gewählter Linktext (leer = die Adresse selbst).
 */
function mail_span(string $addr, string $text = ''): string
{
    [$l, $d] = explode('@', $addr, 2);
    $fb = e($l . ' (at) ' . $d);
    $attr = ' data-p="' . base64_encode(strrev($l)) . '" data-q="' . base64_encode(strrev($d)) . '"';
    if ($text === '') {
        return '<span class="am"' . $attr . '><span class="am-fb">' . $fb . '</span></span>';
    }
    return '<span class="am"' . $attr . '><span class="am-t">' . $text . '</span> <span class="am-fb">(' . $fb . ')</span></span>';
}

function legal_inline(string $s): string
{
    $tokens = [];
    $keep = function (string $html) use (&$tokens): string {
        $tokens[] = $html;
        return "\x01" . (count($tokens) - 1) . "\x02";
    };
    $s = e(preg_replace('~[\x01\x02]~', '', $s));
    // [Text](Ziel): Webadresse, E-Mail, Seite der Website („legal:impressum“, „legal:datenschutz“) oder interner Pfad
    $s = preg_replace_callback('~\[([^\]\n]+)\]\(([^)\s]+)\)~u', function ($m) use ($keep) {
        $text = $m[1];
        $u = html_entity_decode($m[2], ENT_QUOTES);
        $isAddr = preg_match('~^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$~', html_entity_decode($text, ENT_QUOTES)) === 1;
        if (preg_match('~^legal:(impressum|datenschutz)$~', $u, $p)) {
            return $keep('<a href="' . e(legal_url($p[1])) . '">' . $text . '</a>');
        }
        if (stripos($u, 'mailto:') === 0) {
            $to = preg_replace('~\?.*$~', '', substr($u, 7));
            if (!preg_match('~^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$~', (string)$to)) {
                return $m[0];
            }
            return $keep(mail_span((string)$to, $isAddr ? '' : $text));
        }
        if (preg_match('~^https?://~i', $u)) {
            return $keep('<a href="' . e($u) . '" target="_blank" rel="noopener noreferrer">' . $text . '</a>');
        }
        if (preg_match('~^[/#]~', $u)) {
            return $keep('<a href="' . e($u) . '">' . $text . '</a>');
        }
        return $m[0];
    }, $s);
    $s = preg_replace('~\*\*(.+?)\*\*~us', '<strong>$1</strong>', $s);
    // E-Mail-Adressen im Text: automatisch geschützt (siehe mail_span)
    $s = preg_replace_callback('~[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}~', fn($m) => mail_span($m[0]), $s);
    // URLs und www.-Adressen verlinken
    $s = preg_replace_callback('~\b((?:https?://|www\.)[^\s<]+[^\s<.,;:)\]])~u', function ($m) {
        $u = $m[1];
        $href = str_starts_with($u, 'www.') ? 'https://' . $u : $u;
        return '<a href="' . $href . '" target="_blank" rel="noopener noreferrer">' . $u . '</a>';
    }, $s);
    return preg_replace_callback('~\x01(\d+)\x02~', fn($m) => $tokens[(int)$m[1]] ?? '', $s);
}

function legal_html(string $text): string
{
    $out = '';
    foreach (preg_split('~\n\s*\n~', trim(str_replace("\r\n", "\n", $text))) as $block) {
        $block = trim($block);
        if ($block === '') {
            continue;
        }
        if (str_starts_with($block, '## ')) {
            $out .= '<h2>' . e(trim(substr($block, 3))) . '</h2>';
        } elseif (preg_match('~^- ~', $block)) {
            $out .= '<ul>';
            foreach (explode("\n", $block) as $li) {
                $out .= '<li>' . legal_inline(preg_replace('~^- ~', '', $li)) . '</li>';
            }
            $out .= '</ul>';
        } else {
            $out .= '<p>' . nl2br(legal_inline($block)) . '</p>';
        }
    }
    return $out;
}

function abs_url(string $path): string
{
    return rtrim((string)cfg('site_url'), '/') . $path;
}

function lines_of(string $s): array
{
    return array_values(array_filter(array_map('trim', preg_split('~\R~', $s) ?: [])));
}

function prune(array $a): array
{
    foreach ($a as $k => $v) {
        if (is_array($v)) {
            $a[$k] = prune($v);
        }
        if ($a[$k] === '' || $a[$k] === null || $a[$k] === []) {
            unset($a[$k]);
        }
    }
    return $a;
}

/** Strukturierte Daten (JSON-LD): Person, WebSite, ProfilePage und Werkliste. */
function build_jsonld(array $seo, array $hero, array $socialUrls, array $langs, array $clips): string
{
    $name = trim($hero['first'] . ' ' . $hero['last']);
    $pid = abs_url('/#person');
    $lang = ['deutsch' => 'de', 'englisch' => 'en', 'französisch' => 'fr', 'türkisch' => 'tr', 'spanisch' => 'es', 'italienisch' => 'it', 'arabisch' => 'ar', 'russisch' => 'ru'];
    $knowsLang = [];
    foreach ($langs as $l) {
        $code = $lang[mb_strtolower($l['name'])] ?? '';
        if ($code) {
            $knowsLang[] = $code;
        }
    }
    $same = array_values(array_unique(array_filter(array_merge(lines_of($seo['same_as']), $socialUrls))));
    $person = [
        '@type' => 'Person', '@id' => $pid, 'name' => $name, 'url' => abs_url('/'),
        'jobTitle' => $seo['job_title'], 'description' => $seo['description'],
        'image' => upload_url($hero['photo']) ? abs_url(upload_url($hero['photo'])) : '',
        'worksFor' => $seo['works_for'] ? ['@type' => 'Organization', 'name' => $seo['works_for'], 'url' => safe_url($seo['works_for_url'])] : '',
        'homeLocation' => $seo['location'] ? ['@type' => 'Place', 'address' => ['@type' => 'PostalAddress', 'addressLocality' => $seo['location'], 'addressCountry' => strtoupper($seo['country'])]] : '',
        'sameAs' => $same, 'knowsAbout' => lines_of($seo['knows_about']), 'knowsLanguage' => $knowsLang,
        'alumniOf' => array_map(fn($n) => ['@type' => 'EducationalOrganization', 'name' => $n], lines_of($seo['alumni'])),
    ];
    $graph = [
        $person,
        ['@type' => 'WebSite', '@id' => abs_url('/#website'), 'url' => abs_url(current_lang() === 'en' ? '/en/' : '/'), 'name' => $seo['title'], 'inLanguage' => current_lang(), 'publisher' => ['@id' => $pid]],
        ['@type' => 'ProfilePage', '@id' => abs_url('/#profile'), 'url' => abs_url(current_lang() === 'en' ? '/en/' : '/'), 'name' => $seo['title'], 'inLanguage' => current_lang(), 'isPartOf' => ['@id' => abs_url('/#website')], 'mainEntity' => ['@id' => $pid]],
    ];
    if ($seo['works_list']) {
        $items = [];
        foreach ($clips as $c) {
            $url = ($c['link_mode'] ?? '') === 'hosted' ? '' : safe_url($c['url']);
            if (!str_starts_with($url, 'http') || str_starts_with(trim($c['title']), '[')) {
                continue;
            }
            $items[] = [
                '@type' => 'ListItem', 'position' => count($items) + 1,
                'item' => [
                    '@type' => $c['medium'] === 'text' ? 'NewsArticle' : 'CreativeWork',
                    'headline' => $c['medium'] === 'text' ? $c['title'] : '', 'name' => $c['title'], 'description' => $c['desc'], 'url' => $url,
                    'datePublished' => $c['date'], 'author' => ['@id' => $pid],
                    'publisher' => $c['outlet'] ? ['@type' => 'Organization', 'name' => $c['outlet']] : '',
                    'genre' => (string)($c['_cat'] ?? ''), 'inLanguage' => current_lang(),
                ],
            ];
        }
        if ($items) {
            $graph[] = ['@type' => 'ItemList', '@id' => abs_url('/#arbeiten'), 'name' => 'Arbeitsproben von ' . $name, 'itemListElement' => $items];
        }
    }
    return (string)json_encode(['@context' => 'https://schema.org', '@graph' => array_map('prune', $graph)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
}

/**
 * Dekorative Tonspur (48 Balken, Höhe in %). Vier Stile, stabil pro Folge:
 * 1 Gespräch, 2 Reportage, 3 Atmo, 4 Zwei Stimmen.
 */
function wave_bars(int $style, int $seed): array
{
    mt_srand($seed * 7919 + $style * 104729 + 13);
    $b = [];
    switch ($style) {
        case 1: // Sprechblöcke mit kurzen Pausen
            while (count($b) < 48) {
                $len = mt_rand(5, 9);
                for ($i = 0; $i < $len && count($b) < 48; $i++) {
                    $b[] = mt_rand(38, 92);
                }
                for ($i = 0, $p = mt_rand(1, 2); $i < $p && count($b) < 48; $i++) {
                    $b[] = mt_rand(8, 16);
                }
            }
            break;
        case 2: // niedriger Grundpegel, einzelne Spitzen
            for ($i = 0; $i < 48; $i++) {
                $b[] = mt_rand(1, 7) === 1 ? mt_rand(60, 96) : mt_rand(14, 34);
            }
            break;
        case 3: // ruhige Wellen
            for ($i = 0; $i < 48; $i++) {
                $b[] = (int)round(44 + 22 * sin($i / 3.2 + ($seed % 7)) + 10 * sin($i / 1.3) + mt_rand(-4, 4));
            }
            break;
        default: // Wechselrede: hohe und mittlere Blöcke
            $hi = true;
            while (count($b) < 48) {
                $len = mt_rand(6, 10);
                for ($i = 0; $i < $len && count($b) < 48; $i++) {
                    $b[] = $hi ? mt_rand(52, 94) : mt_rand(22, 52);
                }
                $b[] = 10;
                $hi = !$hi;
            }
    }
    mt_srand();
    return array_map(fn($h) => max(6, min(96, (int)$h)), array_slice($b, 0, 48));
}


/** Öffnender Teil des Links einer Beitragskachel (Knopf für Galerie, Link oder Rahmen ohne Ziel). */
function clip_link_open(array $c, string $cls = 'cl-link'): string
{
    if ($c['_hosted']) {
        return '<button type="button" class="' . $cls . '" data-gal="' . (int)$c['_id'] . '" data-ev="clip" data-k="' . (int)$c['_id'] . '">';
    }
    if ($c['_href'] !== '') {
        return '<a class="' . $cls . '" data-ev="clip" data-k="' . (int)$c['_id'] . '" href="' . e($c['_href']) . '" ' . ($c['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '') . '>';
    }
    return '<div class="' . $cls . '">';
}

function clip_link_close(array $c): string
{
    return $c['_hosted'] ? '</button>' : ($c['_href'] !== '' ? '</a>' : '</div>');
}

/** Linktext der Beitragskachel mit Symbol: Pfeil = öffnet auf der Seite, schräger Pfeil = externer Link; leer ohne Ziel. */
function clip_cta_html(array $c): string
{
    if (!$c['_hosted'] && $c['_href'] === '') {
        return '';
    }
    $ic = $c['_hosted']
        ? '<svg class="cl-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'
        : '<svg class="cl-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 16L18 6M9 6h9v9M5 10v9h9"/></svg>';
    $note = (!$c['_hosted'] && $c['_blank']) ? '<span class="sr-only"> (' . e(tr('öffnet in neuem Tab')) . ')</span>' : '';
    return '<span class="cl-cta"><span>' . e(tr($c['_cta'])) . '</span>' . $ic . '</span>' . $note;
}

/** Bild einer Beitragskachel (Vorschaubild mit Fokuspunkt), leer ohne Bild. */
function clip_img_html(array $c, string $sizes = '(max-width: 600px) 90vw, 380px'): string
{
    $u = upload_url((string)$c['still']);
    if ($u === '') {
        return '';
    }
    $iv = img_width_set((string)$c['still']);
    return '<img src="' . e($u) . '"' . ($iv ? ' srcset="' . e($iv['srcset']) . '" sizes="' . e($sizes) . '"' : '') . img_attrs((string)$c['still']) . ' alt="" loading="lazy" decoding="async" style="object-position:' . e(focus_pos((string)($c['still_focus'] ?? ''))) . '">';
}


/** Links einer Podcast-Folge: [[Name, URL], …] (nur gefüllte). */
function podcast_links(array $ep): array
{
    return array_values(array_filter([['Spotify', $ep['spotify']], ['Apple Podcasts', $ep['apple']], ['ARD Audiothek', $ep['audiothek']], [$ep['other_label'] ?: 'Mehr', $ep['other_url']]], fn($l) => $l[1] !== ''));
}

function podcast_links_html(array $ep, string $listen, string $cls): string
{
    $links = podcast_links($ep);
    if (!$links) {
        return '';
    }
    $o = '<div class="pod-btns"><span class="pod-lab">' . e($listen) . '</span>';
    foreach ($links as $l) {
        $o .= '<a class="' . $cls . '" data-ev="podcast" data-k="' . e(trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower($l[0])), '-') ?: 'mehr') . '" href="' . e($l[1]) . '" target="_blank" rel="noopener noreferrer">' . e($l[0]) . ' <span aria-hidden="true">↗</span><span class="sr-only"> (' . e($ep['title']) . ', ' . e(tr('öffnet in neuem Tab')) . ')</span></a>';
    }
    return $o . '</div>';
}
