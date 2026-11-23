<?php
declare(strict_types=1);

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

function img_attrs(string $name): string
{
    if (upload_url($name) === '') {
        return '';
    }
    $i = @getimagesize(AR_ROOT . '/uploads/' . $name);
    return $i ? ' width="' . (int)$i[0] . '" height="' . (int)$i[1] . '"' : '';
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
    ];
    $p = $paths[$kind] ?? $paths['text'];
    return '<svg aria-hidden="true" width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' . $p . '</svg>';
}

function rec_dot(int $px = 10): string
{
    return '<span class="ar-rec" style="width:' . $px . 'px;height:' . $px . 'px"></span>';
}

function sec_head(string $no, string $label, string $right, string $mb = '40px'): string
{
    return '<div class="sec-head" style="margin-bottom:' . $mb . '"><span class="sec-l">' . rec_dot() . '<span class="rec-t">REC</span><span>' . e($no) . ' — ' . e(tr($label)) . '</span></span>'
        . ($right !== '' ? '<span class="muted">' . e($right) . '</span>' : '') . '</div>';
}

function fmt_month(string $date): string
{
    return preg_match('~^(\d{4})-(\d{2})~', $date, $m) ? $m[2] . '/' . $m[1] : '';
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

function auto_tc(int $i): string
{
    $sec = ($i + 1) * 33 - 21;
    return sprintf('00:%02d:%02d:%02d', intdiv($sec, 60), $sec % 60, ($i * 7) % 25);
}

/** Breite eines Clips im Schnittplatz (Vielfaches einer Grundbreite). */
const TL_WEIGHTS = ['short' => 0.7, 'normal' => 1.0, 'long' => 1.6];

/**
 * Schnittplatz berechnen: jede Spur ist eine Kette aus Clips in Listenreihenfolge (ohne Datumsmaßstab).
 * @param array $clips veröffentlichte Referenzen in Listenreihenfolge
 * @return array byTrack: Code => [['id', 'w', 'year' (Jahr, wenn es hier beginnt)]], ticks: Zahl der Lineal-Felder, sum: je Spur
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
        $byTrack[$code][] = ['id' => $c['_id'], 'w' => TL_WEIGHTS[$c['tl_len'] ?? 'normal'] ?? 1.0, 'year' => ($y !== '' && ($last[$code] ?? '') !== $y) ? $y : ''];
        if ($y !== '') {
            $last[$code] = $y;
        }
    }
    $max = 0.0;
    foreach ($byTrack as $list) {
        $max = max($max, array_sum(array_column($list, 'w')));
    }
    return ['byTrack' => $byTrack, 'ticks' => max(16, (int)ceil($max) + 1)];
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
    krsort($g);
    return $g;
}

function cv_when(array $r): string
{
    if (trim($r['when_label']) !== '') {
        return $r['when_label'];
    }
    $a = fmt_month((string)$r['from']);
    $b = fmt_month((string)$r['to']);
    if ($r['ongoing']) {
        return tr('seit') . ' ' . $a;
    }
    return $b !== '' ? $a . ' — ' . $b : $a;
}

function ent(string $s): string
{
    return implode('', array_map(fn($c) => '&#' . ord($c) . ';', str_split($s)));
}

function legal_inline(string $s): string
{
    $s = e($s);
    // E-Mail-Adressen als HTML-Zeichencodes (für Menschen lesbar und klickbar, für einfache Adress-Sammler nicht)
    $s = preg_replace_callback('~[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}~', fn($m) => '<a href="' . ent('mailto:' . $m[0]) . '">' . ent($m[0]) . '</a>', $s);
    // URLs und www.-Adressen verlinken
    return preg_replace_callback('~\b((?:https?://|www\.)[^\s<]+[^\s<.,;:)\]])~u', function ($m) {
        $u = $m[1];
        $href = str_starts_with($u, 'www.') ? 'https://' . $u : $u;
        return '<a href="' . $href . '" target="_blank" rel="noopener noreferrer">' . $u . '</a>';
    }, $s);
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
            $url = safe_url($c['url']);
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
                    'genre' => $c['format'], 'inLanguage' => current_lang(),
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
