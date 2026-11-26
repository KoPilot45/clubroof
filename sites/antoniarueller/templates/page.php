<?php
/** Öffentliche Seite. Variablen kommen aus index.php. */
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
<meta name="theme-color" content="<?= e(palette_tokens(palette_base($colors))['paper']) ?>">
<?php require __DIR__ . '/favicon.php'; ?>
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/site.css?v=<?= @filemtime(AR_ROOT . '/assets/site.css') ?>">
<?= font_head($typo) ?><?= color_head($colors) ?>
<?= style_links() ?>
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
<?php if ($__tpl = style_template('hero')): include $__tpl; else: ?>
<section class="ar-hero" aria-label="<?= e(tr($sec['intro_label'])) ?>">
<?= hero_head($sec, $hero) ?>
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
<?php endif; ?>

<div class="cutband" aria-hidden="true"></div>

<?php foreach ($sectionOrder as $secId): include __DIR__ . '/sections/' . $secId . '.php'; endforeach; ?>

<section id="kontakt" class="ks ks-<?= style_of('contact') ?>" aria-label="<?= e(tr($sec['contact_label'])) ?>" style="padding-top:176px;padding-bottom:48px">
<?php if ($sec['on_contact']): ?>
<?php if ($__tpl = style_template('contact')) { include $__tpl; } else { ?>
<?= sec_head($no['contact'], $sec['contact_label'], $contact['right'], '0') ?>
<h2 class="k-h"><span class="ar-schreib"><?= e($contact['h1']) ?></span></h2>
<p class="k-intro"><?= e($contact['intro']) ?></p>
<div class="k-btns">
<?php if ($hasMail): ?><a class="btn-solid btn-lg" id="mailbtn" href="#kontakt" data-ev="mail" data-k="kontakt" data-mail="<?= e(AR_BASE) ?>/mail.php" data-note="<?= e(tr($sec['mail_fail'])) ?>" data-copy="<?= e(tr($sec['copy_label'])) ?>" data-copied="<?= e(tr($sec['copied_label'])) ?>"><span><?= e($contact['mail_label'] !== '' ? $contact['mail_label'] : tr('E-Mail schreiben')) ?></span> <span aria-hidden="true">↗</span></a><noscript><span class="muted"><?= e(tr('Bitte JavaScript aktivieren, um die E-Mail-Adresse zu sehen – oder im Impressum nachsehen.')) ?></span></noscript><?php endif; ?>
<?php foreach ($social as $so): ?><a class="btn-ghost btn-lg" data-ev="social" data-k="<?= e(trim((string)preg_replace('~[^a-z0-9]+~', '-', strtolower($so['label'])), '-') ?: 'profil') ?>" href="<?= e($so['url']) ?>" target="_blank" rel="me noopener noreferrer"><?= e($so['label']) ?> <span aria-hidden="true">↗</span></a><?php endforeach; ?>
</div>
<p class="mailnote" id="mailnote" aria-live="polite" hidden></p>
<?php } ?>
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
<?php $nMob = 0; foreach ($nav as $n): if (!$n['desktop']) { continue; } $nMob++; ?><li><a href="#<?= e($n['anchor']) ?>"><span class="mn"><?= sprintf('%02d', $nMob) ?></span><span class="ml"><?= e($n['label']) ?></span></a></li>
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
