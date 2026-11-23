<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($legalTitle) ?> – <?= e($site['title']) ?></title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/fonts.css?v=1">
<link rel="stylesheet" href="<?= AR_BASE ?>/assets/site.css?v=<?= @filemtime(AR_ROOT . '/assets/site.css') ?>">
<style>:root{--accent:<?= e($site['accent']) ?>;--rec:<?= e($site['rec']) ?>}</style>
</head>
<body>
<div class="ar-root">
<header class="top"><div class="top-l"><?= rec_dot() ?><span><?= e($site['header_label']) ?></span></div><a href="<?= AR_BASE ?>/" class="back">← Zur Startseite</a></header>
<section style="padding-top:48px;padding-bottom:96px">
<h1 class="big-h"><span class="bh1"><?= e($legalTitle) ?></span></h1>
<div class="legal"><?= $legalBody ?></div>
</section>
</div>
</body>
</html>
