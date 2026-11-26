<?php if ($__tpl = style_template('cv')) { include $__tpl; return; } ?>
<div class="rf" id="rf">
<svg class="rf-svg" aria-hidden="true"><path class="rfp" fill="none"/></svg>
<ol class="rf-list">
<?php foreach ($cvGroups as $year => $rows): ?>
<?php if ($year !== '—'): ?><li class="rf-y <?= array_filter($rows, fn($x) => !empty($x['ongoing'])) ? 'now' : 'past' ?>" data-k="y"><span class="yn"><?= e($year) ?></span></li>
<?php endif; ?>
<?php foreach ($rows as $r):
    $side = $cvI % 2 === 0 ? 'l' : 'r';
    $pos = 'p' . (($cvI * 2 + intdiv($cvI, 3)) % 3);
    $when = trim(cv_when($r, tr($sec['cv_since'])) . ((string)$r['desk'] !== '' ? ' · ' . $r['desk'] : ''), ' ·');
    $lu = (string)$r['logo'] !== '' ? upload_url((string)$r['logo']) : '';
    $cvI++;
?>
<li class="rf-it <?= $side ?> <?= $pos ?><?= !empty($r['ongoing']) ? ' big' : '' ?> t<?= ($cvI - 1) % 4 ?>" data-k="c"><div class="rf-card">
<?php if ($lu !== ''): ?><span class="c-lg"><img src="<?= e($lu) ?>"<?= img_attrs((string)$r['logo']) ?> alt="" loading="lazy" decoding="async"></span><?php endif; ?>
<span class="c-role"><?= e($r['role'] !== '' ? $r['role'] : $r['org']) ?></span>
<?php if ($r['role'] !== ''): ?><span class="c-org"><?= e($r['org']) ?></span><?php endif; ?>
<span class="c-when"><?= e($when) ?></span>
</div></li>
<?php endforeach; ?>
<?php endforeach; ?>
<?php if ($before): ?>
<li class="rf-y end" data-k="e"><span class="yn"><?= e($sec['cv_before']) ?></span><span class="yb"><?php foreach ($before as $b): ?><span class="yb-r"><?= mk($b['text']) ?><?php if ($b['side'] !== ''): ?> <em><?= e($b['side']) ?></em><?php endif; ?></span><?php endforeach; ?></span></li>
<?php endif; ?>
</ol>
</div>
