<div class="muted list-h"><?= e($sec['show_all']) ?></div>
<ol class="clip-list cl-zl">
<?php foreach ($clips as $n => $c): $img = clip_img_html($c, '(max-width: 600px) 30vw, 220px'); $cat = $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']); ?>
<li class="ar-clip zl" id="clip-<?= $c['_id'] ?>" data-id="<?= $c['_id'] ?>"<?= $img === '' ? ' data-txt="1"' : '' ?>>
<?= clip_link_open($c) ?>
<span class="zl-img"><?= $img !== '' ? $img : '<span class="zl-no" aria-hidden="true">' . e($c['_no']) . '</span>' ?></span>
<span class="zl-b"><span class="zl-k"><b><?= icon($c['medium'], 14) ?><?= e($cat) ?></b><?php if (trim((string)$c['outlet']) !== ''): ?><span><?= e($c['outlet']) ?></span><?php endif; ?></span>
<span class="zl-t"><?= e($c['title']) ?></span><?php if (trim((string)$c['desc']) !== ''): ?><span class="zl-d"><?= e($c['desc']) ?></span><?php endif; ?></span>
<span class="zl-s"><span class="zl-dt"><em><?= e($c['_no']) ?></em><?php if ($c['_date'] !== ''): ?> <?= e($c['_date']) ?><?php endif; ?></span><?= clip_cta_html($c) ?></span>
<?= clip_link_close($c) ?>
</li>
<?php endforeach; ?>
</ol>
