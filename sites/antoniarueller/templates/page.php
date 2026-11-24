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
<a class="top-l" href="#" data-top><?= rec_dot() ?><span><?= e($site['header_label']) ?></span></a>
<nav class="ar-nav" aria-label="<?= tr('Hauptnavigation') ?>">
<?php foreach ($nav as $n): if (!$n['desktop']) { continue; } $nDesktop++; ?>
<a href="#<?= e($n['anchor']) ?>" data-nav="<?= e($n['anchor']) ?>"><?= sprintf('%02d', $nDesktop) ?> <?= e($n['label']) ?></a>
<?php endforeach; ?>
</nav>
<span class="lang-switch" role="group" aria-label="<?= current_lang() === 'en' ? 'Language' : 'Sprache' ?>"><a data-ev="lang" data-k="de" href="<?= e(lang_url('de', $page)) ?>" hreflang="de" lang="de"<?= current_lang() === 'de' ? ' aria-current="true"' : '' ?>>DE</a><a data-ev="lang" data-k="en" href="<?= e(lang_url('en', $page)) ?>" hreflang="en" lang="en"<?= current_lang() === 'en' ? ' aria-current="true"' : '' ?>>EN</a></span>
<?php if ($hasMail && $sec['on_contact'] && trim($contact['cta_label']) !== ''): ?><a class="btn-solid btn-nav ar-nav-cta" href="#kontakt" data-ev="mail" data-k="kopfzeile" data-mail="<?= e(AR_BASE) ?>/mail.php"><?= e($contact['cta_label']) ?> <span aria-hidden="true">↗</span></a><?php endif; ?>
<button type="button" class="ar-burger" id="burger" aria-label="<?= tr('Menü öffnen') ?>" aria-expanded="false" aria-controls="menu"><svg aria-hidden="true" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 2h18M1 12h18"></path></svg></button>
</div>
<div class="pl" id="pl" aria-hidden="true"><span class="pl-fill"></span><span class="pl-dot"></span></div>
</header>

<main id="inhalt">
<section class="ar-hero" aria-label="<?= e(tr($sec['intro_label'])) ?>">
<div class="sec-head" style="margin-bottom:0"><span class="sec-l"><?= rec_dot() ?><span class="rec-t">REC</span><span>00 — <?= e(tr($sec['intro_label'])) ?></span></span>
<span class="muted"><?= e($hero['meta']) ?></span><span class="muted"><?= e($sec['hero_tc']) ?></span></div>
<h1 aria-label="<?= e(trim($hero['first'] . ' ' . $hero['last'])) ?>">
<span class="h1-first" aria-hidden="true"><span class="h1-in"><?= e($hero['first']) ?></span></span>
<span class="h1-last" aria-hidden="true"><span class="h1-in"><?= e($hero['last']) ?></span></span>
</h1>
<div class="hero-copy">
<?php if ($hero['lead'] !== ''): ?><p class="hero-lead"><?= e($hero['lead']) ?></p><?php endif; ?>
<?php $nl = array_values(array_filter(array_map('trim', explode("\n", $hero['now_lines'])))); if ($nl): ?>
<div class="hero-now"><span class="muted"><?= e($hero['now_label']) ?></span><?php foreach ($nl as $l): ?><span><?= e($l) ?></span><?php endforeach; ?></div>
<?php endif; ?>
</div>
<div class="ar-hero-media">
<span class="ar-hero-circle" aria-hidden="true"></span>
<?php if (upload_url($hero['photo']) !== ''): ?><?php $hv = img_width_set((string)$hero['photo']); ?><img class="ar-hero-img" src="<?= e(upload_url($hero['photo'])) ?>"<?= $hv ? ' srcset="' . e($hv['srcset']) . '" sizes="(max-width: 899px) 347px, 416px"' : '' ?><?= img_attrs($hero['photo']) ?> alt="<?= e($hero['photo_alt']) ?>" fetchpriority="high" decoding="async"><?php endif; ?>
</div>
</section>

<div class="cutband" aria-hidden="true"></div>

<?php if ($questions && $sec['on_questions']): ?>
<section aria-label="<?= e(tr($sec['q_label'])) ?>" style="padding-top:112px">
<h2 class="sr-only"><?= e($sec['q_label']) ?></h2>
<?= sec_head('00', $sec['q_label'], $sec['q_right']) ?>
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
<div class="fa-mast"><span><?= e(tr($sec['feat_label'])) ?></span><span><?= e($fc['_cat'] !== '' ? $fc['_cat'] : media_label($fc['medium'])) ?></span><span><?= e(implode(' · ', array_filter([(string)$fc['outlet'], (string)$fc['_date']]))) ?></span></div>
<div class="fa-body<?= $fImg !== '' ? ' has-img' : '' ?>">
<div class="fa-main">
<?php $kick = implode(' · ', array_filter([(string)$fc['_cat'], (string)$fc['short']])); if ($kick !== ''): ?><p class="fa-kick"><?= e($kick) ?></p><?php endif; ?>
<h2 class="ar-feat-h"><?= e($fc['title']) ?></h2>
<?php if ($fc['desc'] !== ''): ?><p class="fa-stand"><?= e($fc['desc']) ?></p><?php endif; ?>
<div class="fa-foot">
<span class="fa-by"><?= $fBy ? e(tr($sec['feat_by'])) . ' <b>' . e(array_shift($fBy)) . '</b>' . ($fBy ? ' · ' . e(implode(' · ', $fBy)) : '') : '' ?></span>
<?php if ($fc['_hosted']): ?><button type="button" class="fa-cta" data-gal="<?= (int)$fc['_id'] ?>" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>"><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></button>
<?php elseif ($fc['_href'] !== ''): ?><a class="fa-cta" data-ev="clip" data-k="<?= (int)$fc['_id'] ?>" href="<?= e($fc['_href']) ?>" <?= $fc['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>><?= icon($fc['medium'], 16) ?><span><?= e(tr($fc['_cta'])) ?></span><span aria-hidden="true">→</span></a><?php endif; ?>
</div>
</div>
<?php if ($fImg !== ''): ?><figure class="fa-img"><?php $fv = img_square_set((string)$fc['still'], (string)($fc['still_focus'] ?? '')); ?><img src="<?= e($fv['src'] ?? $fImg) ?>"<?= $fv ? ' srcset="' . e($fv['srcset']) . '" sizes="(max-width: 900px) min(420px, calc(100vw - 40px)), min(400px, 28vw)" width="' . $fv['size'] . '" height="' . $fv['size'] . '"' : '' ?> alt="" loading="lazy" style="object-position:<?= e(focus_pos((string)($fc['still_focus'] ?? ''))) ?>"><?php if (trim((string)($fc['still_credit'] ?? '')) !== ''): ?><figcaption class="cred"><?= e($fc['still_credit']) ?></figcaption><?php endif; ?></figure><?php else: ?><div class="fa-no" aria-hidden="true"><?= e($fc['_no']) ?></div><?php endif; ?>
</div>
</article>
</section>
<?php endif; ?>

<?php if ($clips && $sec['on_show']): $first = $clips[0]; ?>
<section aria-label="<?= e(tr($sec['show_label'])) ?>" <?= $featured ? '' : 'id="arbeiten"' ?> style="padding-top:128px">
<?= sec_head('01', $sec['show_label'], $sec['show_right'] !== '' ? $sec['show_right'] : count($clips) . ' ' . tr($sec['show_unit']) . ' · ' . implode(', ', array_unique(array_map(fn($c) => $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']), $clips))) . ($yearSpan ? ' · ' . $yearSpan : ''), '24px') ?>
<h2 class="big-h"><span class="bh1"><?= e($sec['show_h1']) ?></span><span class="bh2"><?= e($sec['show_h2']) ?></span></h2>

<div class="ar-ed-desk editor">
<div class="ed-bar">
<span class="ed-t"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block"></span><?= e($sec['editor_title']) ?></span>
<span class="ed-icons"><?php foreach (['video' => 'Video', 'text' => 'Text', 'radio' => 'Radio', 'podcast' => 'Podcast', 'social' => 'Social'] as $k => $l): ?><span><?= icon($k, 14) ?><?= tr($l) ?></span><?php endforeach; ?></span>
<span style="color:#C9DEDA"><?= e(tr($sec['editor_hint'])) ?></span>
</div>
<div class="ed-body" style="--max:<?= e((string)$timeline['max']) ?>">
<div class="ed-tracks">
<div class="ed-row ed-head"><?= e(tr($sec['editor_track'])) ?></div>
<?php foreach ($tracks as $t): ?><div class="ed-row ed-tl"><?= icon($t['icon'], 18) ?><span class="tl-t"><span><?= e($t['code']) ?></span><span class="muted"><?= e($t['label']) ?></span></span></div><?php endforeach; ?>
</div>
<div class="ed-scroll">
<div class="ed-grid">
<div class="ed-ruler" aria-hidden="true"><?php for ($i = 0; $i < $timeline['ticks']; $i++): ?><span><?= ruler_label($i) ?></span><?php endfor; ?></div>
<?php foreach ($tracks as $t): $lane = $timeline['byTrack'][$t['code']] ?? []; ?>
<div class="ed-lane<?= $lane ? '' : ' is-empty' ?>" data-track="<?= e($t['code']) ?>">
<?php foreach ($lane as $b): $c = $clipsById[$b['id']]; ?>
<button type="button" class="ar-tlclip" data-id="<?= $c['_id'] ?>" aria-pressed="false" data-tip="<?= e(implode(' · ', array_filter([(string)$c['title'], (string)$c['outlet']]))) ?>" style="--w:<?= $b['w'] ?>;background:<?= css_color($t['bg'], '#172526') ?>;color:<?= css_color($t['fg'], '#F3ECDF') ?>"><?php if ($b['year'] !== ''): ?><span class="yr-flag" aria-hidden="true"><?= e($b['year']) ?></span><?php endif; ?><span class="tl-no"><?= e($c['_no']) ?></span><?php if ($c['short'] !== ''): ?><span class="tl-sh"><?= e($c['short']) ?></span><?php endif; ?></button>
<?php endforeach; ?>
</div>
<?php endforeach; ?>
<span class="playhead" id="playhead" aria-hidden="true"><span></span></span>
</div>
</div>
</div>
</div>

<div class="ar-ed-mob">
<div class="mob-tl">
<div class="mob-tl-l"><?php foreach ($tracks as $t): ?><div class="mob-lane-i"><?= icon($t['icon'], 15) ?></div><?php endforeach; ?></div>
<div class="mob-tl-r"><div class="mob-grid" style="--max:<?= e((string)$timeline['max']) ?>">
<?php foreach ($tracks as $t): $lane = $timeline['byTrack'][$t['code']] ?? []; ?><div class="mob-lane<?= $lane ? '' : ' is-empty' ?>"><?php foreach ($lane as $b): $c = $clipsById[$b['id']]; ?><button type="button" class="ar-tlclip mini" data-id="<?= $c['_id'] ?>" aria-pressed="false" aria-label="Clip <?= e($c['_no']) ?>: <?= e($c['short'] ?: $c['title']) ?>" data-tip="<?= e(implode(' · ', array_filter([(string)$c['title'], (string)$c['outlet']]))) ?>" style="--w:<?= $b['w'] ?>;background:<?= css_color($t['bg'], '#172526') ?>;color:<?= css_color($t['fg'], '#F3ECDF') ?>"><span class="tl-no"><?= e($c['_no']) ?></span></button><?php endforeach; ?></div><?php endforeach; ?>
<span class="playhead mob-ph" id="playheadm" aria-hidden="true"><span></span></span>
</div></div>
</div>
<p class="muted" style="margin:10px 0 0;font-size:12px"><?= e($tl['hint_mobile']) ?> · <?= e($yearSpan) ?></p>
</div>

<div class="muted list-h"><?= e($sec['show_all']) ?></div>
<ol class="clip-list">
<?php foreach ($clips as $n => $c): $cImg = upload_url((string)$c['still']); $ext = $c['_href']; $cat = $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']); ?>
<li class="ar-clip" id="clip-<?= $c['_id'] ?>" data-id="<?= $c['_id'] ?>">
<?php if ($c['_hosted']): ?><button type="button" class="cl-link" data-gal="<?= (int)$c['_id'] ?>" data-ev="clip" data-k="<?= (int)$c['_id'] ?>">
<?php elseif ($ext !== ''): ?><a class="cl-link" data-ev="clip" data-k="<?= (int)$c['_id'] ?>" href="<?= e($ext) ?>" <?= $c['_blank'] ? 'target="_blank" rel="noopener noreferrer"' : '' ?>>
<?php else: ?><div class="cl-link">
<?php endif; ?>
<span class="cl-fig<?= $cImg === '' ? ' txt t' . ($n % 2) : '' ?>"><?php if ($cImg !== ''): ?><?php $iv = img_square_set((string)$c['still'], (string)($c['still_focus'] ?? '')); ?><img src="<?= e($iv['src'] ?? $cImg) ?>"<?= $iv ? ' srcset="' . e($iv['srcset']) . '" sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1000px) calc(50vw - 60px), min(430px, calc((100vw - 152px) / 3))" width="' . $iv['size'] . '" height="' . $iv['size'] . '"' : img_attrs((string)$c['still']) ?> alt="" loading="lazy" decoding="async" style="object-position:<?= e(focus_pos((string)($c['still_focus'] ?? ''))) ?>"><?php endif; ?><span class="cl-no"><?= e($c['_no']) ?></span><span class="cl-kind"><?= icon($c['medium'], 14) ?><?= e($cat) ?></span><?php if ($cImg !== '' && trim((string)($c['still_credit'] ?? '')) !== ''): ?><span class="cl-cred cred"><?= e($c['still_credit']) ?></span><?php endif; ?></span>
<span class="ar-clip-title"><?= e($c['title']) ?></span>
<?php if (trim((string)$c['desc']) !== ''): ?><span class="cl-desc"><?= e($c['desc']) ?></span><?php endif; ?>
<span class="cl-meta"><?= implode('', array_map(fn($x) => '<span>' . e($x) . '</span>', array_filter([(string)$c['outlet'], (string)$c['_date']]))) ?></span>
<?php if (trim((string)$c['role']) !== ''): ?><span class="cl-role"><?= e(tr($sec['role_label'])) ?> <?= e($c['role']) ?></span><?php endif; ?>
<?php if ($c['_hosted']): ?><span class="cl-cta"><span><?= e(tr($c['_cta'])) ?></span><span aria-hidden="true">→</span></span></button>
<?php elseif ($ext !== ''): ?><span class="cl-cta"><span><?= e(tr($c['_cta'])) ?></span><span aria-hidden="true">→</span></span></a>
<?php else: ?></div>
<?php endif; ?>
</li>
<?php endforeach; ?>
</ol>
</section>
<?php endif; ?>

<?php if ($episodes && $sec['on_podcast']): ?>
<section id="podcast" aria-label="<?= e(tr($sec['pod_label'])) ?>" style="padding-top:128px">
<?= sec_head('01', $sec['pod_label'], $sec['pod_right'], '32px') ?>
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
<div class="pod-t"><span class="pod-show"><?= e($ep['show']) ?><?= $ep['number'] !== '' ? ' · ' . e(tr($sec['pod_episode'])) . ' ' . e($ep['number']) : '' ?></span><span class="pod-title"><?= e($ep['title']) ?></span><?php if (trim((string)$ep['desc']) !== ''): ?><span class="pod-desc"><?= e($ep['desc']) ?></span><?php endif; ?></div>
</div>
<div class="wave wave-<?= $style ?>" aria-hidden="true"><?php foreach ($bars as $h): ?><span style="height:<?= $h ?>%"></span><?php endforeach; ?></div>
<?php if ($ep['duration'] !== '' || $ep['outlet'] !== ''): ?><div class="pod-meta"><span><?= e($ep['duration']) ?></span><span><?= e($ep['outlet']) ?></span></div><?php endif; ?>
<?php if ($links): ?><div class="pod-btns"><span class="pod-lab"><?= e(tr($sec['pod_listen'])) ?></span><?php foreach ($links as $l): ?><a class="pod-btn" data-ev="podcast" data-k="<?= e(trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower($l[0])), '-') ?: 'mehr') ?>" href="<?= e($l[1]) ?>" target="_blank" rel="noopener noreferrer"><?= e($l[0]) ?> <span aria-hidden="true">↗</span><span class="sr-only"> (<?= e($ep['title']) ?>, <?= tr('öffnet in neuem Tab') ?>)</span></a><?php endforeach; ?></div><?php endif; ?>
</article>
<?php endforeach; ?>
</div>
</div>
</section>
<?php endif; ?>

<?php if ($sec['on_about']): ?>
<section id="ueber" aria-label="<?= e(tr($sec['about_label'])) ?>" style="padding-top:144px">
<h2 class="sr-only"><?= e($sec['about_label']) ?></h2>
<?= sec_head('02', $sec['about_label'], $about['right'], '48px') ?>
<div class="about">
<?php if (upload_url($about['portrait']) !== ''): ?>
<div class="about-img"><?php $pv = img_width_set((string)$about['portrait']); ?><img src="<?= e(upload_url($about['portrait'])) ?>"<?= $pv ? ' srcset="' . e($pv['srcset']) . '" sizes="(max-width: 500px) calc(100vw - 40px), 460px"' : '' ?><?= img_attrs($about['portrait']) ?> alt="<?= e($about['portrait_alt']) ?>" loading="lazy" decoding="async"><?php if ($about['onair'] !== ''): ?><span class="ar-onair"><?= e($about['onair']) ?></span><?php endif; ?></div>
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
<?php endif; ?>

<?php if ($showSt): ?>
<section id="lebenslauf" aria-label="<?= e(tr($sec['st_label'])) ?>" style="padding-top:144px">
<h2 class="sr-only"><?= e($sec['st_label']) ?></h2>
<?= sec_head('03', $sec['st_label'], $sec['st_right'], '24px') ?>
<?php if (($sec['st_mode'] ?? 'text') === 'logos'): ?>
<ul class="ar-logos" role="list" style="--c5:<?= logo_cols(count($stations), 5) ?>;--c4:<?= logo_cols(count($stations), 4) ?>;--c3:<?= logo_cols(count($stations), 3) ?>">
<?php foreach ($stations as $s):
    $lu = $s['logo'] !== '' ? upload_url((string)$s['logo']) : '';
    $capParts = array_values(array_filter([(string)$s['period'], (string)$s['desk']], fn($x) => $x !== ''));
    $tag = $s['url'] !== '' ? 'a' : 'div';
    $lnk = $tag === 'a' ? ' href="' . e($s['url']) . '" target="_blank" rel="noopener noreferrer"' : '';
?>
<li class="ar-logo"><<?= $tag ?> class="ar-logo-in"<?= $lnk ?>>
<span class="ar-logo-box"><?php if ($lu !== ''): ?><img src="<?= e($lu) ?>"<?= img_attrs((string)$s['logo']) ?> alt="" loading="lazy" decoding="async"><?php else: ?><span class="ar-logo-name"><?= e($s['name']) ?></span><?php endif; ?></span>
<span class="ar-logo-cap"><span class="ar-logo-cap-in"><?php if ($lu !== ''): ?><b><?= e($s['name']) ?></b><?php endif; ?><?php if ($capParts): ?><span class="ar-logo-sub"><?= e(implode(' · ', $capParts)) ?></span><?php endif; ?></span></span>
</<?= $tag ?>></li>
<?php endforeach; ?>
</ul>
<?php else: ?>
<p class="ar-wall">
<?php foreach ($stations as $i => $s): ?><span class="ar-st"><span class="<?= $s['highlight'] ? 'st-hl' : 'ar-outline' ?>"><?= e($s['name']) ?></span><?php if ($i < count($stations) - 1): ?><span class="ar-sl">/</span><?php endif; ?></span>
<?php endforeach; ?>
</p>
<?php endif; ?>
</section>
<?php endif; ?>

<?php if ($showCv): ?>
<section aria-label="<?= e(tr($sec['cv_label'])) ?>" <?= $showSt ? '' : 'id="lebenslauf"' ?> style="padding-top:120px">
<?= sec_head('03', $sec['cv_label'], ($cvMin ? $cvMin . ' — ' . tr($sec['cv_today']) : '') . ($sec['cv_right'] !== '' ? ' · ' . $sec['cv_right'] : ''), '24px') ?>
<h2 class="big-h" style="margin-bottom:56px"><span class="bh1"><?= e($sec['cv_h1']) ?></span><span class="bh2"><?= e($sec['cv_h2']) ?></span></h2>
<ol class="cv">
<?php foreach ($cvGroups as $year => $rows): ?>
<li><span class="cv-y <?= array_filter($rows, fn($x) => !empty($x['ongoing'])) ? 'ar-year-now' : 'ar-year-past' ?>"><?= e($year) ?></span>
<div class="cv-items">
<?php foreach ($rows as $r): ?><div class="cv-it"><span class="cv-dot" aria-hidden="true"></span><span class="cv-role"><?= $r['role'] !== '' ? e($r['role']) . ', ' : '' ?><span class="mk-i"><?= e($r['org']) ?></span></span><span class="cv-when"><?= e(cv_when($r, tr($sec['cv_since']))) ?></span></div>
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


<?php if ($off && $sec['on_off']): ?>
<section id="offtherecord" aria-label="<?= e(tr($sec['off_label'])) ?>" style="padding-top:144px">
<div class="sec-head off-head" style="margin-bottom:24px"><span class="sec-l"><span style="width:10px;height:10px;border-radius:50%;border:1.5px solid var(--mute);box-sizing:border-box;display:inline-block"></span><span style="font-weight:600">Off</span><span>03 — <?= e(tr($sec['off_label'])) ?></span></span><span><?= e($sec['off_right']) ?></span></div>
<h2 class="big-h" style="margin-bottom:16px"><span class="oh1">Off <span class="the">the<span class="strike" aria-hidden="true"></span></span></span> <span class="oh2">record</span></h2>
<p class="muted" style="margin:0 0 32px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;font-family:'JetBrains Mono',monospace"><?= e($sec['off_hint']) ?></p>
<dl class="off">
<?php foreach ($off as $o): ?><div class="off-r"><dt><?= e($o['question']) ?></dt><dd><button type="button" class="ar-redact"><?= e($o['answer']) ?></button></dd></div>
<?php endforeach; ?>
</dl>
</section>
<?php endif; ?>

<section id="kontakt" aria-label="<?= e(tr($sec['contact_label'])) ?>" style="padding-top:176px;padding-bottom:48px">
<?php if ($sec['on_contact']): ?>
<?= sec_head('04', $sec['contact_label'], $contact['right'], '0') ?>
<h2 class="k-h" aria-label="<?= e(trim($contact['h1'] . ' ' . $contact['h2'])) ?>"><span class="ar-schreib" aria-hidden="true"><?= e($contact['h1']) ?></span><span class="k-h2" aria-hidden="true"><?= e($contact['h2']) ?>.</span></h2>
<p class="k-intro"><?= e($contact['intro']) ?></p>
<div class="k-btns">
<?php if ($hasMail): ?><a class="btn-solid btn-lg" id="mailbtn" href="#kontakt" data-ev="mail" data-k="kontakt" data-mail="<?= e(AR_BASE) ?>/mail.php" data-note="<?= e(tr($sec['mail_fail'])) ?>" data-copy="<?= e(tr($sec['copy_label'])) ?>" data-copied="<?= e(tr($sec['copied_label'])) ?>"><span><?= e($contact['mail_label'] !== '' ? $contact['mail_label'] : tr('E-Mail schreiben')) ?></span> <span aria-hidden="true">↗</span></a><noscript><span class="muted"><?= e(tr('Bitte JavaScript aktivieren, um die E-Mail-Adresse zu sehen – oder im Impressum nachsehen.')) ?></span></noscript><?php endif; ?>
<?php foreach ($social as $so): ?><a class="btn-ghost btn-lg" data-ev="social" data-k="<?= e(trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower($so['label'])), '-') ?: 'profil') ?>" href="<?= e($so['url']) ?>" target="_blank" rel="me noopener noreferrer"><?= e($so['label']) ?> <span aria-hidden="true">↗</span></a><?php endforeach; ?>
</div>
<p class="mailnote" id="mailnote" aria-live="polite" hidden></p>
<?php endif; ?>
<footer class="foot">
<span><?= e($contact['copyright']) ?><?php if (trim((string)$contact['photo_credit']) !== ''): ?><?= trim((string)$contact['copyright']) !== '' ? ' · ' : '' ?><?php $pcu = safe_url((string)$contact['photo_credit_url']); if ($pcu !== ''): ?><a class="foot-credit" href="<?= e($pcu) ?>" target="_blank" rel="noopener noreferrer"><?= e($contact['photo_credit']) ?></a><?php else: ?><?= e($contact['photo_credit']) ?><?php endif; endif; ?></span>
<span style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;background:var(--mute);display:inline-block"></span><?= e($contact['end_note']) ?></span>
<span style="display:flex;gap:24px"><a href="<?= e(legal_url('impressum')) ?>"><?= e(tr($sec['foot_imprint'])) ?></a><a href="<?= e(legal_url('datenschutz')) ?>"><?= e(tr($sec['foot_privacy'])) ?></a></span>
</footer>
</section>

</main>
<a class="to-top" id="toTop" href="#top" aria-label="<?= e(tr('Nach oben')) ?>"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"></path></svg></a>

<div id="menu" class="menu" role="dialog" aria-modal="true" aria-label="<?= tr('Menü') ?>" hidden>
<div class="menu-top"><span style="display:flex;align-items:center;gap:10px"><?= rec_dot() ?><?= e(tr($site['menu_label'])) ?></span>
<button type="button" class="circ menu-x" id="menuClose" aria-label="<?= tr('Menü schließen') ?>"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 2l12 12M14 2L2 14"></path></svg></button></div>
<nav aria-label="<?= tr('Mobile Navigation') ?>"><ol>
<?php foreach ($nav as $i => $n): ?><li><a href="#<?= e($n['anchor']) ?>"><span class="mn"><?= sprintf('%02d', $i + 1) ?></span><span class="ml"><?= e($n['label']) ?></span></a></li>
<?php endforeach; ?>
</ol></nav>
<?php if ($hasMail && $sec['on_contact'] && trim($contact['cta_label']) !== ''): ?><a class="btn-solid btn-block menu-cta" href="#kontakt" data-ev="mail" data-k="menue" data-mail="<?= e(AR_BASE) ?>/mail.php" style="margin-top:28px"><?= e($contact['cta_label']) ?> ↗</a><?php endif; ?>
<div class="menu-foot"><span class="lang-switch lang-menu"><a href="<?= e(lang_url('de', $page)) ?>" hreflang="de" lang="de">Deutsch</a> · <a href="<?= e(lang_url('en', $page)) ?>" hreflang="en" lang="en">English</a></span><span><?= e($hero['now_lines'] !== '' ? str_replace("\n", ' · ', trim(explode("\n", $hero['now_lines'])[0])) : '') ?></span>
<?php foreach ($social as $so): ?><a href="<?= e($so['url']) ?>" target="_blank" rel="me noopener noreferrer"><?= e($so['label']) ?> ↗</a><?php endforeach; ?></div>
</div>

</div>
<?php
$galData = [];
foreach ($clips as $c) {
    if (!$c['_hosted']) {
        continue;
    }
    foreach ($c['gallery'] as $g) {
        $u = upload_url((string)($g['f'] ?? ''));
        if ($u !== '') {
            $galData[(string)$c['_id']][] = ['src' => $u, 'cap' => (string)($g['cap'] ?? ''), 'title' => (string)$c['title']];
        }
    }
}
if ($galData): ?>
<script type="application/json" id="ar-gal"><?= json_encode(['l' => ['gallery' => tr('Galerie'), 'close' => tr('Schließen'), 'prev' => tr('Zurück'), 'next' => tr('Weiter'), 'of' => tr('von')], 'g' => $galData], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
<?php endif; ?>
<script src="<?= AR_BASE ?>/assets/site.js?v=<?= @filemtime(AR_ROOT . '/assets/site.js') ?>" defer></script>
</body>
</html>
