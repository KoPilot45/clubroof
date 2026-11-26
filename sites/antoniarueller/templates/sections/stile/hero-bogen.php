<section class="ar-hero hb" aria-label="<?= e(tr($sec['intro_label'])) ?>">
<?= hero_head($sec, $hero) ?>
<h1 class="hb-h" aria-label="<?= e(trim($hero['first'] . ' ' . $hero['last'])) ?>"><span class="hb-f" aria-hidden="true"><?= e($hero['first']) ?></span><span class="hb-arch"><span class="hb-in"><?= hero_photo_html($hero, 'hb-img', '(max-width: 700px) 70vw, 440px') ?></span></span><span class="hb-l" aria-hidden="true"><?= e($hero['last']) ?></span></h1>
<div class="hb-base">
<?php if ($hero['lead'] !== ''): ?><p class="hb-lead"><?= e($hero['lead']) ?></p><?php endif; ?>
<?php $nl = hero_now_lines($hero); if ($nl): ?><div class="hb-now"><b><?= e($hero['now_label']) ?></b><?php foreach ($nl as $l): ?><span><?= e($l) ?></span><?php endforeach; ?></div><?php endif; ?>
</div>
</section>
