<?php if ($episodes && $sub['podcast']): ?>
<section id="podcast" aria-label="<?= e(tr($sec['pod_label'])) ?>" style="padding-top:128px">
<?= sec_head($no['arbeiten'], $sec['pod_label'], $sec['pod_right'], '32px') ?>
<div class="pod-grid pd-wl">
<?php if (trim($sec['pod_h1']) !== ''): ?><h2 class="pod-h"><span class="ph1"><?= e($sec['pod_h1']) ?></span></h2><?php else: ?><h2 class="sr-only"><?= e(tr($sec['pod_label'])) ?></h2><?php endif; ?>
<div class="pod-list">
<?php foreach ($episodes as $n => $ep):
    $style = in_array($ep['wave'], ['1', '2', '3', '4'], true) ? (int)$ep['wave'] : ($n % 4) + 1;
    $bars = wave_bars($style, $ep['_id']); $half = (int)floor(count($bars) * .45); ?>
<article class="pd-e"><span class="pod-show"><?= e($ep['show']) ?><?= $ep['number'] !== '' ? ' · ' . e(tr($sec['pod_episode'])) . ' ' . e($ep['number']) : '' ?></span><h3 class="pd-t"><?= e($ep['title']) ?></h3>
<div class="pd-w" aria-hidden="true"><?php foreach ($bars as $bi => $h): ?><span<?= $bi < $half ? ' class="on"' : '' ?> style="height:<?= $h ?>%"></span><?php endforeach; ?></div>
<?php if (trim((string)$ep['desc']) !== ''): ?><p class="pd-d"><?= e($ep['desc']) ?></p><?php endif; ?>
<?php if ($ep['duration'] !== '' || $ep['outlet'] !== ''): ?><div class="pod-meta"><span><?= e($ep['duration']) ?></span><span><?= e($ep['outlet']) ?></span></div><?php endif; ?>
<?= podcast_links_html($ep, tr($sec['pod_listen']), 'pd-l') ?></article>
<?php endforeach; ?>
</div>
</div>
</section>
<?php endif; ?>
