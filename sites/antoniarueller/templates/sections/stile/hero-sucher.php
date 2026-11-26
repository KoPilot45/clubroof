<section class="ar-hero hs" aria-label="<?= e(tr($sec['intro_label'])) ?>">
<div class="hs-frame">
<span class="hs-c c1"></span><span class="hs-c c2"></span><span class="hs-c c3"></span><span class="hs-c c4"></span>
<div class="hs-hud"><span><?= rec_dot() ?><b>REC</b> 00 — <?= e(tr($sec['intro_label'])) ?></span><span><?= e($hero['meta']) ?></span><span><?= e($sec['hero_tc']) ?></span></div>
<?= hero_photo_html($hero, 'hs-img', '(max-width: 700px) 60vw, 520px') ?>
<div class="hs-low">
<h1 class="hs-name" aria-label="<?= e(trim($hero['first'] . ' ' . $hero['last'])) ?>"><span aria-hidden="true"><?= e($hero['first']) ?> <i><?= e($hero['last']) ?></i></span></h1>
<?php if ($hero['lead'] !== ''): ?><p class="hs-sub"><?= e($hero['lead']) ?></p><?php endif; ?>
<?php $nl = hero_now_lines($hero); if ($nl): ?><div class="hs-now"><b><?= e($hero['now_label']) ?></b><?php foreach ($nl as $l): ?><span><?= e($l) ?></span><?php endforeach; ?></div><?php endif; ?>
</div>
</div>
</section>
