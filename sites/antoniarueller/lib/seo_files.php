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

function serve_robots(): never
{
    $seo = setting('seo');
    if ($seo['noindex']) {
        text_out("User-agent: *\nDisallow: /\n");
    }
    $o = "User-agent: *\nDisallow: /admin/\n\n";
    if ($seo['ai_bots'] === 'block') {
        foreach (['GPTBot', 'ClaudeBot', 'anthropic-ai', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'Meta-ExternalAgent', 'cohere-ai', 'Diffbot', 'Omgilibot', 'ImagesiftBot'] as $bot) {
            $o .= "User-agent: $bot\nDisallow: /\n\n";
        }
    }
    $extra = trim((string)$seo['robots_extra']);
    if ($extra !== '') {
        $o .= $extra . "\n\n";
    }
    $o .= 'Sitemap: ' . abs_url('/sitemap.xml') . "\n";
    text_out($o);
}

function serve_sitemap(): never
{
    $seo = setting('seo');
    if ($seo['noindex']) {
        http_response_code(404);
        text_out("Nicht verfügbar.\n");
    }
    $t = max((int)q('SELECT MAX(updated_at) FROM ar_items')->fetchColumn(), (int)q("SELECT MAX(updated_at) FROM ar_settings WHERE grp <> '_migrations'")->fetchColumn());
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n"
        . '<url><loc>' . e(abs_url('/')) . '</loc><lastmod>' . date('c', $t ?: time()) . '</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>' . "\n</urlset>\n";
    text_out($xml, 'application/xml');
}

function serve_llms(): never
{
    $seo = setting('seo');
    if ($seo['noindex'] || !$seo['llms_enabled']) {
        http_response_code(404);
        text_out("Nicht verfügbar.\n");
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
    $clips = array_filter(items('clips'), fn($c) => $c['published'] && str_starts_with(safe_url($c['url']), 'http') && !str_starts_with(trim($c['title']), '['));
    if ($clips) {
        $md .= "## Ausgewählte Arbeiten\n\n";
        foreach ($clips as $c) {
            $meta = implode(', ', array_filter([$c['outlet'], $c['format'], clip_date_label($c)]));
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
    $md .= "## Seiten\n\n- [Startseite mit allen Arbeiten, Lebenslauf und Kontakt](" . abs_url('/') . ")\n- [Impressum](" . abs_url('/impressum') . ")\n";
    if (trim($seo['llms_extra']) !== '') {
        $md .= "\n## Hinweise\n\n" . trim($seo['llms_extra']) . "\n";
    }
    text_out($md, 'text/markdown');
}
