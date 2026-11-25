<?= sec_head($no['arbeiten'], $sec['show_label'], $sec['show_right'] !== '' ? $sec['show_right'] : count($clips) . ' ' . tr($sec['show_unit']) . ' · ' . implode(', ', array_unique(array_map(fn($c) => $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']), $clips))) . ($yearSpan ? ' · ' . $yearSpan : ''), '24px') ?>
<?php if (trim($sec['show_h1'] . $sec['show_h2']) !== ''): ?><h2 class="big-h"><span class="bh1"><?= e($sec['show_h1']) ?></span><span class="bh2"><?= e($sec['show_h2']) ?></span></h2><?php else: ?><h2 class="sr-only"><?= e($sec['show_label']) ?></h2><?php endif; ?>

