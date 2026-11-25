<?php if ($episodes && $sec['on_podcast']): ?>
<section id="podcast" aria-label="<?= e(tr($sec['pod_label'])) ?>" style="padding-top:128px">
<?= sec_head($no['podcast'], $sec['pod_label'], $sec['pod_right'], '32px') ?>
<div class="pod-grid">
<?php if (trim($sec['pod_h1'] . $sec['pod_h2']) !== ''): ?><h2 class="pod-h"><span class="ph1"><?= e($sec['pod_h1']) ?></span><span class="ph2"><?= e($sec['pod_h2']) ?></span></h2><?php else: ?><h2 class="sr-only"><?= e($sec['pod_label']) ?></h2><?php endif; ?>
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
