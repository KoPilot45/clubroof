<?php if ($episodes && $sub['podcast']): ?>
<section id="podcast" aria-label="<?= e(tr($sec['pod_label'])) ?>" style="padding-top:128px">
<?= sec_head($no['arbeiten'], $sec['pod_label'], $sec['pod_right'], '32px') ?>
<div class="pod-grid pd-vz">
<?php if (trim($sec['pod_h1']) !== ''): ?><h2 class="pod-h"><span class="ph1"><?= e($sec['pod_h1']) ?></span></h2><?php else: ?><h2 class="sr-only"><?= e(tr($sec['pod_label'])) ?></h2><?php endif; ?>
<div class="pod-list">
<?php foreach ($episodes as $n => $ep): ?>
<article class="pd-r"><span class="pd-ico" aria-hidden="true"><?= icon('podcast', 28) ?></span>
<div class="pd-b"><span class="pod-show"><?= e($ep['show']) ?><?= $ep['number'] !== '' ? ' · ' . e(tr($sec['pod_episode'])) . ' ' . e($ep['number']) : '' ?></span><h3 class="pd-t"><?= e($ep['title']) ?></h3><?php if (trim((string)$ep['desc']) !== ''): ?><p class="pd-d"><?= e($ep['desc']) ?></p><?php endif; ?><?= podcast_links_html($ep, tr($sec['pod_listen']), 'pd-l') ?></div>
<div class="pd-s"><span><?= e($ep['duration']) ?></span><span><?= e($ep['outlet']) ?></span></div></article>
<?php endforeach; ?>
</div>
</div>
</section>
<?php endif; ?>
