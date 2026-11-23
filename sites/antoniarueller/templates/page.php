<?php
/** Öffentliche Seite. Variablen kommen aus index.php. */
$acc = css_color($site['accent'], '#0E5C62');
$rec = css_color($site['rec'], '#C42F24');
$ph = fn(string $v): string => $v; // Platzhalter
$mediaLabel = media_options();
$short = ['video' => 'Video', 'text' => 'Text', 'radio' => 'Radio', 'podcast' => 'Podcast', 'social' => 'Social'];
$nDesktop = 0;
$arbeitenOn = $featured ? 'feat' : 'show';
?>
<!DOCTYPE html>
<html lang="<?= e(current_lang()) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($seo['title']) ?></title>
<?php if ($seo['description'] !== ''): ?><meta name="description" content="<?= e($seo['description']) ?>">
<meta property="og:description" content="<?= e($seo['description']) ?>">
<meta name="twitter:description" content="<?= e($seo['description']) ?>">
<?php endif; ?>
<meta name="robots" content="<?= $seo['noindex'] ? 'noindex, nofollow' : 'index, follow, max-image-preview:large' ?>">
<meta name="author" content="<?= e(trim($hero['first'] . ' ' . $hero['last'])) ?>">
<meta property="og:title" content="<?= e($seo['title']) ?>">
<meta property="og:type" content="website">
<meta property="og:locale" content="<?= current_lang() === 'en' ? 'en_US' : 'de_DE' ?>">
<meta property="og:site_name" content="<?= e(trim($hero['first'] . ' ' . $hero['last'])) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($seo['title']) ?>">
<?php $og = $seo['og_image'] ?: $hero['photo']; if ($og !== '' && upload_url($og) !== ''): ?><meta property="og:image" content="<?= e(abs_url(upload_url($og))) ?>">
<meta name="twitter:image" content="<?= e(abs_url(upload_url($og))) ?>">
<?php endif; ?>
<?php if (cfg('site_url')): $selfUrl = abs_url(current_lang() === 'en' ? '/en/' : '/'); ?><link rel="canonical" href="<?= e($selfUrl) ?>">
<meta property="og:url" content="<?= e($selfUrl) ?>">
<link rel="alternate" hreflang="de" href="<?= e(abs_url('/')) ?>">
<link rel="alternate" hreflang="en" href="<?= e(abs_url('/en/')) ?>">
<link rel="alternate" hreflang="x-default" href="<?= e(abs_url('/')) ?>">
<?php endif; ?>
<?php if ($seo['google_verify'] !== ''): ?><meta name="google-site-verification" content="<?= e($seo['google_verify']) ?>">
<?php endif; ?>
<?php if ($seo['bing_verify'] !== ''): ?><meta name="msvalidate.01" content="<?= e($seo['bing_verify']) ?>">
<?php endif; ?>
<meta name="theme-color" content="#F3ECDF">
<?php require __DIR__ . '/favicon.php'; ?>
<link rel="preload" href="<?= AR_BASE ?>/assets/fonts/anton-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="<?= AR_BASE ?>/assets/fonts/instrument-serif-latin-400-italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="<?= AR_BASE ?>/assets/fonts/inter-tight-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/fonts.css?v=1">
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/site.css?v=<?= @filemtime(AR_ROOT . '/assets/site.css') ?>">
<style>:root{--accent:<?= e($acc) ?>;--rec:<?= e($rec) ?>}</style>
<?php if ($jsonld !== ''): ?><script type="application/ld+json"><?= $jsonld ?></script><?php endif; ?>
</head>
<body>
<div class="ar-root" data-stat="<?= defined('AR_PREVIEW') ? '' : e(AR_BASE) . '/stat.php' ?>">
<a class="skip" href="#inhalt"><?= tr('Zum Inhalt springen') ?></a>

<header class="top-wrap" id="topbar">
<div class="top">
<div class="top-l"><?= rec_dot() ?><span><?= e($site['header_label']) ?></span></div>
<nav class="ar-nav" aria-label="<?= tr('Hauptnavigation') ?>">
<?php foreach ($nav as $n): if (!$n['desktop']) { continue; } $nDesktop++; ?>
<a href="#<?= e($n['anchor']) ?>" data-nav="<?= e($n['anchor']) ?>"><?= sprintf('%02d', $nDesktop) ?> <?= e($n['label']) ?></a>
<?php endforeach; ?>
</nav>
<span class="lang-switch" role="group" aria-label="<?= current_lang() === 'en' ? 'Language' : 'Sprache' ?>"><a data-ev="lang" data-k="de" href="<?= e(lang_url('de', $page)) ?>" hreflang="de" lang="de"<?= current_lang() === 'de' ? ' aria-current="true"' : '' ?>>DE</a><a data-ev="lang" data-k="en" href="<?= e(lang_url('en', $page)) ?>" hreflang="en" lang="en"<?= current_lang() === 'en' ? ' aria-current="true"' : '' ?>>EN</a></span>
<?php if ($hasMail && trim($contact['cta_label']) !== ''): ?><a class="btn-solid btn-nav ar-nav-cta" href="#kontakt" data-ev="mail" data-k="kopfzeile" data-mail="<?= e(AR_BASE) ?>/mail.php"><?= e($contact['cta_label']) ?> <span aria-hidden="true">↗</span></a><?php endif; ?>
<button type="button" class="ar-burger" id="burger" aria-label="<?= tr('Menü öffnen') ?>" aria-expanded="false" aria-controls="menu"><svg aria-hidden="true" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 2h18M1 12h18"></path></svg></button>
</div>
<div class="pl" id="pl" aria-hidden="true"><span class="pl-fill"></span><span class="pl-dot"></span></div>
</header>

<main id="inhalt">
<section class="ar-hero" aria-label="<?= tr('Intro') ?>">
<div class="sec-head" style="margin-bottom:0"><span class="sec-l"><?= rec_dot() ?><span class="rec-t">REC</span><span>00 — <?= tr('Intro') ?></span></span>
<span class="muted"><?= e($hero['meta']) ?></span><span class="muted">TC 00:00:00:01</span></div>
<h1 aria-label="<?= e(trim($hero['first'] . ' ' . $hero['last'])) ?>">
<span class="h1-first ar-outline" aria-hidden="true"><?= e($hero['first']) ?></span>
<span class="h1-last" aria-hidden="true"><?= str_replace('ü', '<span class="uwrap">u<span class="udot d1"></span><span class="udot d2"></span></span>', e($hero['last'])) ?></span>
</h1>
<div class="hero-copy">
<?php if ($hero['lead'] !== ''): ?><p class="hero-lead"><?= e($hero['lead']) ?></p><?php endif; ?>
<?php $nl = array_values(array_filter(array_map('trim', explode("\n", $hero['now_lines'])))); if ($nl): ?>
<div class="hero-now"><span class="muted"><?= e($hero['now_label']) ?></span><?php foreach ($nl as $l): ?><span><?= e($l) ?></span><?php endforeach; ?></div>
<?php endif; ?>
</div>
<div class="ar-hero-media">
<span class="ar-hero-circle" aria-hidden="true"></span>
<?php if (upload_url($hero['photo']) !== ''): ?><img class="ar-hero-img" src="<?= e(upload_url($hero['photo'])) ?>"<?= img_attrs($hero['photo']) ?> alt="<?= e($hero['photo_alt']) ?>" fetchpriority="high" decoding="async"><?php endif; ?>
<div class="ar-hero-tag">
<span class="tag-live"><span class="ar-rec" style="width:8px;height:8px;background:#F3ECDF"></span><?= e($hero['tag_live']) ?></span>
<span class="tag-name"><?= e($hero['tag_name']) ?></span>
<span class="tag-role"><?= e($hero['tag_role']) ?></span>
</div>
</div>
</section>

<?php if ($marquee): ?>
<div class="marquee" aria-hidden="true"><div class="ar-track">
<?php for ($r = 0; $r < 4; $r++): foreach ($marquee as $i => $w): ?><span><?= e($w['word']) ?></span><?php if ($i < count($marquee) - 1): ?><span class="amp">&amp;</span><?php endif; endforeach; ?><span style="color:var(--accent)">●</span><?php endfor; ?>
</div></div>
<?php endif; ?>

<?php if ($questions): ?>
<section aria-label="<?= tr('Was mich antreibt') ?>" style="padding-top:112px">
<?= sec_head('00', 'Was mich antreibt', $sec['q_right']) ?>
<div class="questions">
<?php foreach ($questions as $i => $q): ?>
<p class="<?= $i % 2 ? 'ar-q2' : '' ?>"><span class="q-no"><?= e($q['number']) ?></span><span class="q-text"><?= mk($q['text']) ?></span></p>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>

<?php if ($featured): $fc = $featured; $fImg = upload_url($fc['still']); $fBy = array_filter([trim($hero['first'] . ' ' . $hero['last']), trim((string)$fc['role']), trim((string)$fc['outlet'])]); ?>
<section id="arbeiten" aria-label="<?= tr('Featured Clip') ?>" style="padding-top:96px">
<article class="fa">
<div class="fa-mast"><span><?= tr('Hauptbeitrag') ?></span><span><?= e(media_label($fc['medium'])) ?></span><span><?= e(implode(' · ', array_filter([(string)$fc['outlet'], (string)$fc['_date']]))) ?></span></div>
<div class="fa-body<?= $fImg !== '' ? ' has-img' : '' ?>">
<div class="fa-main">
<?php if (trim((string)$fc['format']) !== ''): ?><p class="fa-kick"><?= e($fc['format']) ?></p><?php endif; ?>
<h2 class="ar-feat-h"><?= mk($fc['headline'] !== '' ? $fc['headline'] : $fc['title']) ?></h2>
<?php if ($fc['desc'] !== ''): ?><p class="fa-stand"><?= e($fc['desc']) ?></p><?php endif; ?>
<div class="fa-foot">
<span class="fa-by"><?= $fBy ? e(tr('Von')) . ' <b>' . e(array_shift($fBy)) . '</b>' . ($fBy ? ' · ' . e(implode(' · ', $fBy)) : '') : '' ?></span>
<?php if ($fc['url'] !== ''): ?><a class="fa-cta" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>" href="<?= e(safe_url($fc['url'])) ?>" <?= $fc['new_tab'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><?= icon($fc['medium'], 16) ?><span><?= e($fc['link_text']) ?></span><span aria-hidden="true">→</span></a><?php endif; ?>
</div>
</div>
<?php if ($fImg !== ''): ?><figure class="fa-img"><img src="<?= e($fImg) ?>" alt="" loading="lazy"></figure><?php else: ?><div class="fa-no" aria-hidden="true"><?= e($fc['_no']) ?></div><?php endif; ?>
</div>
</article>
</section>
<?php endif; ?>

<?php if ($clips): $first = $clips[0]; ?>
<section aria-label="<?= tr('Showreel') ?>" <?= $featured ? '' : 'id="arbeiten"' ?> style="padding-top:128px">
<?= sec_head('01', 'Showreel', $sec['show_right'] !== '' ? $sec['show_right'] : count($clips) . ' ' . tr('Clips') . ' · ' . implode(', ', array_unique(array_map(fn($c) => media_label($c['medium']), $clips))) . ($yearSpan ? ' · ' . $yearSpan : ''), '24px') ?>
<h2 class="big-h"><span class="bh1"><?= e($sec['show_h1']) ?></span><span class="bh2"><?= e($sec['show_h2']) ?></span></h2>

<div class="ar-ed-desk editor">
<div class="ed-bar">
<span class="ed-t"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block"></span><?= e($sec['editor_title']) ?></span>
<span class="ed-icons"><?php foreach (['video' => 'Video', 'text' => 'Text', 'radio' => 'Radio', 'podcast' => 'Podcast', 'social' => 'Social'] as $k => $l): ?><span><?= icon($k, 14) ?><?= tr($l) ?></span><?php endforeach; ?></span>
<span style="color:#C9DEDA"><?= tr('Clip anklicken für Details') ?></span>
</div>
<div class="ed-body">
<div class="ed-tracks">
<div class="ed-row ed-head"><?= tr('Spur') ?></div>
<?php foreach ($tracks as $t): ?><button type="button" class="ed-row ed-tl" data-track="<?= e($t['code']) ?>" aria-pressed="false" title="<?= e(tr('Nur diese Spur zeigen')) ?>"><?= icon($t['icon'], 18) ?><span class="tl-t"><span><?= e($t['code']) ?></span><span class="muted"><?= e($t['label']) ?></span></span></button><?php endforeach; ?>
</div>
<div class="ed-scroll">
<div class="ed-grid">
<div class="ed-ruler" aria-hidden="true"><?php for ($i = 0; $i < $timeline['ticks']; $i++): ?><span><?= ruler_label($i) ?></span><?php endfor; ?></div>
<?php foreach ($tracks as $t): $lane = $timeline['byTrack'][$t['code']] ?? []; ?>
<div class="ed-lane<?= $lane ? '' : ' is-empty' ?>" data-track="<?= e($t['code']) ?>">
<?php foreach ($lane as $b): $c = $clipsById[$b['id']]; ?>
<button type="button" class="ar-tlclip" data-id="<?= $c['_id'] ?>" aria-pressed="<?= $c['_id'] === $first['_id'] ? 'true' : 'false' ?>" title="<?= e($c['title']) ?>" style="--w:<?= $b['w'] ?>;background:<?= css_color($t['bg'], '#172526') ?>;color:<?= css_color($t['fg'], '#F3ECDF') ?>"><?php if ($b['year'] !== ''): ?><span class="yr-flag" aria-hidden="true"><?= e($b['year']) ?></span><?php endif; ?><span class="tl-no"><?= e($c['_no']) ?></span><?php if ($c['short'] !== ''): ?><span class="tl-sh"><?= e($c['short']) ?></span><?php endif; ?></button>
<?php endforeach; ?>
</div>
<?php endforeach; ?>
<span class="playhead" id="playhead" aria-hidden="true"><span></span></span>
</div>
</div>
</div>
<div class="ed-sel">
<div class="ed-sel-l">
<span class="sel-no" data-f="no"><?= e($first['_no']) ?></span>
<div class="sel-col">
<span class="muted sel-prog"><span class="ar-rec" style="width:8px;height:8px"></span><?= tr('Programm') ?> · TC <span data-f="tc"><?= e($first['_tc']) ?></span></span>
<span class="sel-title" data-f="title"><?= e($first['title']) ?></span>
<span class="sel-desc" data-f="desc"><?= e($first['desc']) ?></span>
<span class="sel-meta"><?= tr('Redaktion:') ?> <span data-f="outlet"><?= e($first['outlet']) ?></span> · <span data-f="format"><?= e($first['format']) ?></span> · <span data-f="date"><?= e($first['_date']) ?></span> · <?= tr('Rolle:') ?> <span data-f="role"><?= e($first['role']) ?></span></span>
</div>
</div>
<div class="ed-sel-r" role="group" aria-label="<?= e(tr('Clip wechseln')) ?>">
<button type="button" class="circ ed-prev" aria-label="<?= tr('Vorheriger Clip') ?>"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 9 12l9 6z"></path><path d="M6 6v12"></path></svg></button>
<a class="btn-solid" data-ev="clip" data-f-href href="<?= e(safe_url($first['url']) ?: '#arbeiten') ?>" <?= $first['new_tab'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><span data-f="link_text"><?= e($first['link_text']) ?></span> <span aria-hidden="true">↗</span></a>
<button type="button" class="circ circ-acc ed-next" aria-label="<?= tr('Nächster Clip') ?>"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l9 6-9 6z"></path><path d="M18 6v12"></path></svg></button>
<span class="mob-count ed-count"><span data-f="no" style="font-size:14px;font-weight:600"><?= e($first['_no']) ?></span><span class="muted" style="font-size:10px"> / <?= count($clips) ?></span></span>
</div>
</div>
</div>

<div class="ar-ed-mob">
<div class="mob-panel" data-medium="<?= e($first['medium']) ?>" id="mobpanel">
<div class="mob-top"><span><?= rec_dot(7) ?><?= tr('Programm') ?></span><span>TC <span data-f="tc"><?= e($first['_tc']) ?></span></span></div>
<div class="mob-mid"><span class="mob-no" data-f="no"><?= e($first['_no']) ?></span>
<span class="mob-ic"><?php foreach ($short as $k => $l): ?><span class="mi mi-<?= $k ?>"><?= icon($k, 18) ?><?= tr($l) ?></span><?php endforeach; ?></span></div>
<span class="mob-title" data-f="title"><?= e($first['title']) ?></span>
<span class="mob-meta"><span data-f="outlet"><?= e($first['outlet']) ?></span> · <span data-f="date"><?= e($first['_date']) ?></span> · <span data-f="role"><?= e($first['role']) ?></span></span>
<a class="btn-solid btn-block" data-ev="clip" data-f-href href="<?= e(safe_url($first['url']) ?: '#arbeiten') ?>" <?= $first['new_tab'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><span data-f="link_text"><?= e($first['link_text']) ?></span> ↗</a>
</div>
<div class="mob-nav">
<button type="button" class="circ" id="prevClip" aria-label="<?= tr('Vorheriger Clip') ?>"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 9 12l9 6z"></path><path d="M6 6v12"></path></svg></button>
<span class="mob-count"><span data-f="no" style="font-size:14px;font-weight:600"><?= e($first['_no']) ?></span><span class="muted" style="font-size:10px"> / <?= count($clips) ?></span></span>
<button type="button" class="circ circ-acc" id="nextClip" aria-label="<?= tr('Nächster Clip') ?>"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l9 6-9 6z"></path><path d="M18 6v12"></path></svg></button>
</div>
<div class="mob-tl">
<div class="mob-tl-l"><?php foreach ($tracks as $t): ?><div class="mob-lane-i"><?= icon($t['icon'], 15) ?></div><?php endforeach; ?></div>
<div class="mob-tl-r"><div class="mob-grid">
<?php foreach ($tracks as $t): $lane = $timeline['byTrack'][$t['code']] ?? []; ?><div class="mob-lane<?= $lane ? '' : ' is-empty' ?>"><?php foreach ($lane as $b): $c = $clipsById[$b['id']]; ?><button type="button" class="ar-tlclip mini" data-id="<?= $c['_id'] ?>" aria-pressed="<?= $c['_id'] === $first['_id'] ? 'true' : 'false' ?>" aria-label="Clip <?= e($c['_no']) ?>: <?= e($c['short'] ?: $c['title']) ?>" style="--w:<?= $b['w'] ?>;background:<?= css_color($t['bg'], '#172526') ?>;color:<?= css_color($t['fg'], '#F3ECDF') ?>"><span class="tl-no"><?= e($c['_no']) ?></span></button><?php endforeach; ?></div><?php endforeach; ?>
<span class="playhead mob-ph" id="playheadm" aria-hidden="true"><span></span></span>
</div></div>
</div>
<p class="muted" style="margin:10px 0 0;font-size:10px"><?= e($tl['hint_mobile']) ?> · <?= e($yearSpan) ?></p>
</div>

<div class="muted list-h"><?= e($sec['show_all']) ?></div>
<ol class="clip-list">
<?php foreach ($clips as $c): ?>
<li class="ar-clip<?= $c['_id'] === $first['_id'] ? ' on' : '' ?>" data-id="<?= $c['_id'] ?>">
<a data-ev="clip" data-k="<?= (int)$c['_id'] ?>" href="<?= e(safe_url($c['url']) ?: '#arbeiten') ?>" <?= $c['new_tab'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
<span class="cl-no"><?= e($c['_no']) ?></span>
<span class="cl-tc muted"><span>TC <?= e($c['_tc']) ?></span><span style="color:var(--ink)"><?= icon($c['medium'], 20) ?></span></span>
<span class="cl-main"><span class="ar-clip-title"><?= e($c['title']) ?></span><span class="cl-desc"><?= e($c['desc']) ?></span></span>
<span class="cl-side"><span><?= e($c['outlet']) ?> <span aria-hidden="true" style="color:var(--accent)">↗</span></span><span class="muted"><?= e(implode(' · ', array_filter([$c['format'], $c['_date']]))) ?></span><?php if ($c['role'] !== ''): ?><span class="muted"><?= tr('Rolle:') ?> <?= e($c['role']) ?></span><?php endif; ?><span class="cl-link"><?= e($c['link_text']) ?></span></span>
</a></li>
<?php endforeach; ?>
</ol>
</section>
<script type="application/json" id="ar-clips"><?= json_encode($clipJson, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<?php endif; ?>

<?php if ($episodes): ?>
<section id="podcast" aria-label="<?= tr('Podcast') ?>" style="padding-top:128px">
<?= sec_head('01', 'Podcast', '', '32px') ?>
<div class="pod-grid">
<h2 class="pod-h"><span class="ph1"><?= e($sec['pod_h1']) ?></span><span class="ph2"><?= e($sec['pod_h2']) ?></span></h2>
<div class="pod-list">
<?php foreach ($episodes as $n => $ep):
    $links = array_values(array_filter([['Spotify', $ep['spotify']], ['Apple Podcasts', $ep['apple']], ['ARD Audiothek', $ep['audiothek']], [$ep['other_label'] ?: 'Mehr', $ep['other_url']]], fn($l) => $l[1] !== ''));
    $style = in_array($ep['wave'], ['1', '2', '3', '4'], true) ? (int)$ep['wave'] : ($n % 4) + 1;
    $bars = wave_bars($style, $ep['_id']); ?>
<article class="pod-card">
<div class="pod-top">
<span class="pod-ic" aria-hidden="true"><?= icon('podcast', 30) ?></span>
<div class="pod-t"><span class="pod-show"><?= e($ep['show']) ?><?= $ep['number'] !== '' ? ' · ' . tr('Folge') . ' ' . e($ep['number']) : '' ?></span><span class="pod-title"><?= e($ep['title']) ?></span></div>
</div>
<div class="wave wave-<?= $style ?>" aria-hidden="true"><?php foreach ($bars as $h): ?><span style="height:<?= $h ?>%"></span><?php endforeach; ?></div>
<?php if ($ep['duration'] !== '' || $ep['outlet'] !== ''): ?><div class="pod-meta"><span><?= e($ep['duration']) ?></span><span><?= e($ep['outlet']) ?></span></div><?php endif; ?>
<?php if ($links): ?><div class="pod-btns"><span class="pod-lab"><?= tr('Anhören bei') ?></span><?php foreach ($links as $l): ?><a class="pod-btn" data-ev="podcast" data-k="<?= e(trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower($l[0])), '-') ?: 'mehr') ?>" href="<?= e($l[1]) ?>" target="_blank" rel="noopener noreferrer"><?= e($l[0]) ?> <span aria-hidden="true">↗</span><span class="sr-only"> (<?= e($ep['title']) ?>, <?= tr('öffnet in neuem Tab') ?>)</span></a><?php endforeach; ?></div><?php endif; ?>
</article>
<?php endforeach; ?>
</div>
</div>
</section>
<?php endif; ?>

<section id="ueber" aria-label="<?= tr('Über') ?>" style="padding-top:144px">
<?= sec_head('02', 'Über mich', $about['right'], '48px') ?>
<div class="about">
<?php if (upload_url($about['portrait']) !== ''): ?>
<div class="about-img"><img src="<?= e(upload_url($about['portrait'])) ?>"<?= img_attrs($about['portrait']) ?> alt="<?= e($about['portrait_alt']) ?>" loading="lazy" decoding="async"><?php if ($about['onair'] !== ''): ?><span class="ar-onair"><?= e($about['onair']) ?></span><?php endif; ?></div>
<?php endif; ?>
<div class="about-r">
<?php if ($about['headline'] !== ''): ?><p class="about-h"><?= mk($about['headline']) ?></p><?php endif; ?>
<div class="about-cols"><?php foreach ([$about['text1'], $about['text2']] as $t): if ($t === '') { continue; } ?><p><?= nl2br(e($t)) ?></p><?php endforeach; ?></div>
<?php if ($cross): ?>
<div class="about-block"><span class="muted lab"><?= e($about['cross_label']) ?></span>
<?php $nc = count($cross); $wide = $nc <= 5 ? $nc : (int)ceil($nc / 2); $mid = $nc <= 3 ? $nc : (int)ceil($nc / 2); ?><div class="cross-wrap"><div class="cross" style="--n:<?= $wide ?>;--m:<?= $mid ?>"><?php foreach ($cross as $c): ?><div class="cross-t"><span class="cross-h"><?= icon($c['icon'], 22) ?><?= e($c['label']) ?></span><span class="cross-o"><?= e($c['outlets']) ?></span></div><?php endforeach; ?></div></div></div>
<?php endif; ?>
<?php if ($langs): ?>
<div class="about-block"><span class="muted lab"><?= e($about['lang_label']) ?></span>
<p class="langs"><?php foreach ($langs as $i => $l): ?><?= $i ? ' <span class="sl">/</span> ' : '' ?><?= e($l['name']) ?><?= $l['note'] !== '' ? ' <span class="note">' . e($l['note']) . '</span>' : '' ?><?php endforeach; ?></p></div>
<?php endif; ?>
</div>
</div>
</section>

<?php if ($stations): ?>
<section id="lebenslauf" aria-label="<?= tr('Stationen') ?>" style="padding-top:144px">
<?= sec_head('03', 'Stationen', $sec['st_right'], '24px') ?>
<p class="ar-wall">
<?php foreach ($stations as $i => $s): ?><span class="ar-st"><span class="<?= $s['highlight'] ? 'st-hl' : 'ar-outline' ?>"><?= e($s['name']) ?></span><?php if ($i < count($stations) - 1): ?><span class="ar-sl">/</span><?php endif; ?></span>
<?php endforeach; ?>
</p>
</section>
<?php endif; ?>

<?php if ($cvGroups): ?>
<section aria-label="<?= tr('Lebenslauf') ?>" <?= $stations ? '' : 'id="lebenslauf"' ?> style="padding-top:120px">
<?= sec_head('03', 'Lebenslauf', ($cvMin ? $cvMin . ' — ' . tr('heute') : '') . ($sec['cv_right'] !== '' ? ' · ' . $sec['cv_right'] : ''), '24px') ?>
<h2 class="big-h" style="margin-bottom:56px"><span class="bh1"><?= e($sec['cv_h1']) ?></span><span class="bh2"><?= e($sec['cv_h2']) ?></span></h2>
<ol class="cv">
<?php foreach ($cvGroups as $year => $rows): ?>
<li><span class="cv-y <?= (int)$year >= (int)date('Y') - 1 ? 'ar-year-now' : 'ar-year-past' ?>"><?= e($year) ?></span>
<div class="cv-items">
<?php foreach ($rows as $r): ?><div class="cv-it"><span class="cv-dot" aria-hidden="true"></span><span class="cv-role"><?= $r['role'] !== '' ? e($r['role']) . ', ' : '' ?><span class="mk-i"><?= e($r['org']) ?></span></span><span class="cv-when"><?= e(cv_when($r)) ?></span></div>
<?php endforeach; ?>
</div></li>
<?php endforeach; ?>
</ol>
<?php if ($before): ?>
<div class="cv-before"><span class="cv-before-l muted"><?= e($sec['cv_before']) ?></span>
<div class="cv-before-r"><?php foreach ($before as $b): ?><div class="cv-it2"><span class="cv-role"><?= mk($b['text']) ?></span><span class="cv-when"><?= e($b['side']) ?></span></div><?php endforeach; ?></div></div>
<?php endif; ?>
<?php if (upload_url($contact['cv_pdf']) !== ''): ?><div style="display:flex;justify-content:flex-end;margin-top:24px"><a class="btn-solid" data-ev="cv" data-k="pdf" href="<?= e(upload_url($contact['cv_pdf'])) ?>" target="_blank" rel="noopener" download><?= e($sec['cv_pdf_label']) ?> <span aria-hidden="true">↓</span></a></div><?php endif; ?>
</section>
<?php endif; ?>


<?php if ($off): ?>
<section id="offtherecord" aria-label="<?= tr('Off the record') ?>" style="padding-top:144px">
<div class="sec-head off-head" style="margin-bottom:24px"><span class="sec-l"><span style="width:10px;height:10px;border-radius:50%;border:1.5px solid var(--mute);box-sizing:border-box;display:inline-block"></span><span style="font-weight:600">Off</span><span>04 — Off the record</span></span><span><?= e($sec['off_right']) ?></span></div>
<h2 class="big-h" style="margin-bottom:16px"><span class="oh1">Off <span class="the">the<span class="strike" aria-hidden="true"></span></span></span> <span class="oh2">record</span></h2>
<p class="muted" style="margin:0 0 32px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;font-family:'JetBrains Mono',monospace"><?= e($sec['off_hint']) ?></p>
<dl class="off">
<?php foreach ($off as $o): ?><div class="off-r"><dt><?= e($o['question']) ?></dt><dd><button type="button" class="ar-redact"><?= e($o['answer']) ?></button></dd></div>
<?php endforeach; ?>
</dl>
</section>
<?php endif; ?>

<section id="kontakt" aria-label="<?= tr('Kontakt') ?>" style="padding-top:176px;padding-bottom:48px">
<?= sec_head('05', 'Kontakt', $contact['right'], '0') ?>
<h2 class="k-h"><span class="ar-schreib"><?= e($contact['h1']) ?></span><span class="k-h2"><?= e($contact['h2']) ?><span style="color:var(--accent)">.</span></span></h2>
<p class="k-intro"><?= e($contact['intro']) ?></p>
<div class="k-btns">
<?php if ($hasMail): ?><a class="btn-solid btn-lg" id="mailbtn" href="#kontakt" data-ev="mail" data-k="kontakt" data-mail="<?= e(AR_BASE) ?>/mail.php" data-note="<?= e(tr('Mailprogramm öffnet sich nicht? Adresse:')) ?>" data-copy="<?= e(tr('Kopieren')) ?>" data-copied="<?= e(tr('Kopiert')) ?>"><span><?= e($contact['mail_label'] !== '' ? $contact['mail_label'] : tr('E-Mail schreiben')) ?></span> <span aria-hidden="true">↗</span></a><noscript><span class="muted"><?= e(tr('Bitte JavaScript aktivieren, um die E-Mail-Adresse zu sehen – oder im Impressum nachsehen.')) ?></span></noscript><?php endif; ?>
<?php foreach ($social as $so): ?><a class="btn-ghost btn-lg" data-ev="social" data-k="<?= e(trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower($so['label'])), '-') ?: 'profil') ?>" href="<?= e($so['url']) ?>" target="_blank" rel="me noopener noreferrer"><?= e($so['label']) ?> <span aria-hidden="true">↗</span></a><?php endforeach; ?>
</div>
<p class="mailnote" id="mailnote" aria-live="polite" hidden></p>
<footer class="foot">
<span><?= e(implode(' · ', array_filter([$contact['copyright'], $contact['photo_credit']]))) ?></span>
<span style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;background:var(--mute);display:inline-block"></span><?= e($contact['end_note']) ?></span>
<span style="display:flex;gap:24px"><a href="<?= e(legal_url('impressum')) ?>"><?= tr('Impressum') ?></a><a href="<?= e(legal_url('datenschutz')) ?>"><?= tr('Datenschutz') ?></a></span>
</footer>
</section>

</main>
<a class="to-top" id="toTop" href="#top" aria-label="<?= e(tr('Nach oben')) ?>"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></a>

<div id="menu" class="menu" role="dialog" aria-modal="true" aria-label="<?= tr('Menü') ?>" hidden>
<div class="menu-top"><span style="display:flex;align-items:center;gap:10px"><?= rec_dot() ?>AR / Menü</span>
<button type="button" class="circ menu-x" id="menuClose" aria-label="<?= tr('Menü schließen') ?>"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 2l12 12M14 2L2 14"></path></svg></button></div>
<nav aria-label="<?= tr('Mobile Navigation') ?>"><ol>
<?php foreach ($nav as $i => $n): ?><li><a href="#<?= e($n['anchor']) ?>"><span class="mn"><?= sprintf('%02d', $i + 1) ?></span><span class="ml"><?= e($n['label']) ?></span></a></li>
<?php endforeach; ?>
</ol></nav>
<?php if ($hasMail && trim($contact['cta_label']) !== ''): ?><a class="btn-solid btn-block menu-cta" href="#kontakt" data-ev="mail" data-k="menue" data-mail="<?= e(AR_BASE) ?>/mail.php" style="margin-top:28px"><?= e($contact['cta_label']) ?> ↗</a><?php endif; ?>
<div class="menu-foot"><span class="lang-switch lang-menu"><a href="<?= e(lang_url('de', $page)) ?>" hreflang="de" lang="de">Deutsch</a> · <a href="<?= e(lang_url('en', $page)) ?>" hreflang="en" lang="en">English</a></span><span><?= e($hero['now_lines'] !== '' ? str_replace("\n", ' · ', trim(explode("\n", $hero['now_lines'])[0])) . ' · ' . $hero['tag_role'] : '') ?></span>
<?php foreach ($social as $so): ?><a href="<?= e($so['url']) ?>" target="_blank" rel="me noopener noreferrer"><?= e($so['label']) ?> ↗</a><?php endforeach; ?></div>
</div>

</div>
<script src="<?= AR_BASE ?>/assets/site.js?v=<?= @filemtime(AR_ROOT . '/assets/site.js') ?>" defer></script>
</body>
</html>
