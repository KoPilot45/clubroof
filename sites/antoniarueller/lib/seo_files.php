<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/render.php';

function text_out(string $body, string $type = 'text/plain'): never
{
    header('Content-Type: ' . $type . '; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Content-Type-Options: nosniff');
    echo $body;
    exit;
}

function robots_txt(): string
{
    $seo = setting('seo');
    if ($seo['noindex']) {
        return "User-agent: *\nDisallow: /\n";
    }
    $o = "# robots.txt – wird aus dem Admin (SEO & Suche) erzeugt\nUser-agent: *\nAllow: /\nDisallow: /admin/\n\n";
    if ($seo['ai_bots'] === 'block') {
        $o .= "# KI-Training: gesperrt. Suche und Assistenten auf Nutzeranfrage bleiben möglich.\n";
        foreach (['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'Meta-ExternalAgent', 'cohere-ai', 'Diffbot', 'Omgilibot', 'ImagesiftBot'] as $bot) {
            $o .= "User-agent: $bot\nDisallow: /\n\n";
        }
    }
    $extra = trim((string)$seo['robots_extra']);
    if ($extra !== '') {
        $o .= $extra . "\n\n";
    }
    return $o . 'Sitemap: ' . abs_url('/sitemap.xml') . "\n";
}

function sitemap_xml(): ?string
{
    if (setting('seo')['noindex']) {
        return null;
    }
    $t = max((int)q('SELECT MAX(updated_at) FROM ar_items')->fetchColumn(), (int)q("SELECT MAX(updated_at) FROM ar_settings WHERE grp <> '_migrations'")->fetchColumn());
    $mod = date('c', $t ?: time());
    $alt = '<xhtml:link rel="alternate" hreflang="de" href="' . e(abs_url('/')) . '"/><xhtml:link rel="alternate" hreflang="en" href="' . e(abs_url('/en/')) . '"/><xhtml:link rel="alternate" hreflang="x-default" href="' . e(abs_url('/')) . '"/>';
    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n"
        . '<url><loc>' . e(abs_url('/')) . '</loc><lastmod>' . $mod . '</lastmod><changefreq>monthly</changefreq><priority>1.0</priority>' . $alt . '</url>' . "\n"
        . '<url><loc>' . e(abs_url('/en/')) . '</loc><lastmod>' . $mod . '</lastmod><changefreq>monthly</changefreq><priority>0.9</priority>' . $alt . '</url>' . "\n</urlset>\n";
}

function llms_txt(): ?string
{
    $seo = setting('seo');
    if ($seo['noindex'] || !$seo['llms_enabled']) {
        return null;
    }
    $hero = setting('hero');
    $about = setting('about');
    $name = trim($hero['first'] . ' ' . $hero['last']);
    $summary = trim($seo['llms_summary']) !== '' ? trim($seo['llms_summary']) : trim($seo['description']);
    $md = "# $name\n\n";
    if ($summary !== '') {
        $md .= '> ' . str_replace("\n", ' ', $summary) . "\n\n";
    }
    $md .= $seo['job_title'] . ($seo['works_for'] ? ' bei ' . $seo['works_for'] : '') . ($seo['location'] ? ', ' . $seo['location'] : '') . ".\n\n";
    foreach ([$about['text1'], $about['text2']] as $p) {
        if (trim($p) !== '') {
            $md .= trim($p) . "\n\n";
        }
    }
    $topics = lines_of($seo['knows_about']);
    if ($topics) {
        $md .= '**Themen:** ' . implode(', ', $topics) . "\n\n";
    }
    $tracksLbl = array_column(items('tracks'), 'label', 'code');
    $clips = array_filter(items('clips'), fn($c) => $c['published'] && ($c['link_mode'] ?? '') !== 'hosted' && str_starts_with(safe_url($c['url']), 'http') && !str_starts_with(trim($c['title']), '['));
    if ($clips) {
        $md .= "## Ausgewählte Arbeiten\n\n";
        foreach ($clips as $c) {
            $meta = implode(', ', array_filter([$c['outlet'], ($tracksLbl[$c['tl_track']] ?? ''), clip_date_label($c)]));
            $md .= '- [' . str_replace(['[', ']'], '', $c['title']) . '](' . safe_url($c['url']) . ')' . ($meta ? ' – ' . $meta : '') . ($c['desc'] ? ': ' . $c['desc'] : '') . "\n";
        }
        $md .= "\n";
    }
    $eps = array_filter(items('episodes'), fn($e) => $e['published'] && !str_starts_with(trim($e['title']), '['));
    if ($eps) {
        $md .= "## Podcast\n\n";
        foreach ($eps as $e) {
            $link = safe_url($e['spotify'] ?: ($e['apple'] ?: ($e['audiothek'] ?: $e['other_url'])));
            $md .= '- ' . ($link ? '[' . $e['title'] . '](' . $link . ')' : $e['title']) . ' – ' . $e['show'] . "\n";
        }
        $md .= "\n";
    }
    $stations = array_map(fn($s) => $s['name'], items('stations'));
    if ($stations) {
        $md .= "## Stationen\n\n" . implode(', ', $stations) . ".\n\n";
    }
    $md .= "## Seiten\n\n- [Startseite mit allen Arbeiten, Lebenslauf und Kontakt](" . abs_url('/') . ")\n- [English version](" . abs_url('/en/') . ")\n- [Impressum](" . abs_url('/impressum/') . ")\n";
    if (trim($seo['llms_extra']) !== '') {
        $md .= "\n## Hinweise\n\n" . trim($seo['llms_extra']) . "\n";
    }
    return $md;
}

/** Schreibt robots.txt, sitemap.xml und llms.txt als echte Dateien (funktioniert ohne Rewrite-Regeln). */
function regenerate_seo_files(): void
{
    $files = ['robots.txt' => robots_txt(), 'sitemap.xml' => sitemap_xml(), 'llms.txt' => llms_txt()];
    foreach ($files as $name => $content) {
        $path = AR_ROOT . '/' . $name;
        if ($content === null) {
            if (is_file($path)) {
                @unlink($path);
            }
        } elseif (!is_file($path) || file_get_contents($path) !== $content) {
            @file_put_contents($path, $content, LOCK_EX);
        }
    }
}

function serve_robots(): never
{
    text_out(robots_txt());
}

function serve_sitemap(): never
{
    $x = sitemap_xml();
    if ($x === null) {
        http_response_code(404);
        text_out("Nicht verfügbar.\n");
    }
    text_out($x, 'application/xml');
}

function serve_llms(): never
{
    $m = llms_txt();
    if ($m === null) {
        http_response_code(404);
        text_out("Nicht verfügbar.\n");
    }
    text_out($m, 'text/markdown');
}
