<!DOCTYPE html>
<html lang="<?= e(current_lang()) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($legalTitle) ?> – <?= e($seo['title']) ?></title>
<meta name="robots" content="noindex">
<?php require __DIR__ . '/favicon.php'; ?>
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/fonts.css?v=1">
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/site.css?v=<?= @filemtime(AR_ROOT . '/assets/site.css') ?>">
<style>:root{--accent:<?= css_color($site['accent'], '#0E5C62') ?>;--rec:<?= css_color($site['rec'], '#C42F24') ?>}</style>
</head>
<body>
<div class="ar-root">
<header class="top-wrap" id="topbar"><div class="top"><div class="top-l"><?= rec_dot() ?><span><?= e($site['header_label']) ?></span></div><a href="<?= e(lang_url(current_lang(), '')) ?>" class="btn-solid btn-nav back"><span aria-hidden="true">←</span> <?= e(tr('Zur Startseite')) ?></a></div></header>
<main id="inhalt">
<?php if (!empty($isNotFound)): require __DIR__ . '/notfound.php'; else: ?>
<section style="padding-top:48px;padding-bottom:96px">
<h1 class="big-h"><span class="bh1"><?= e($legalTitle) ?></span></h1>
<div class="legal"><?= $legalBody ?></div>
</section>
<?php endif; ?>
</main>
</div>
<script src="<?= AR_BASE ?>/assets/site.js?v=<?= @filemtime(AR_ROOT . '/assets/site.js') ?>" defer></script>
</body>
</html>
