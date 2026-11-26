<div class="ck" id="rf">
<ul class="ck-g">
<?php foreach ($cvGroups as $year => $rows): foreach ($rows as $r):
    $when = trim(cv_when($r, tr($sec['cv_since'])) . ((string)$r['desk'] !== '' ? ' · ' . $r['desk'] : ''), ' ·');
    $lu = (string)$r['logo'] !== '' ? upload_url((string)$r['logo']) : ''; ?>
<li class="ck-c<?= !empty($r['ongoing']) ? ' now' : '' ?>"><?php if (!empty($r['ongoing'])): ?><span class="ck-nw"><?= e(tr('Aktuell')) ?></span><?php endif; ?>
<span class="ck-lg"><?php if ($lu !== ''): ?><img src="<?= e($lu) ?>"<?= img_attrs((string)$r['logo']) ?> alt="" loading="lazy" decoding="async"><?php endif; ?></span>
<span class="ck-role"><?= e($r['role'] !== '' ? $r['role'] : $r['org']) ?></span><?php if ($r['role'] !== ''): ?><span class="ck-org"><?= e($r['org']) ?></span><?php endif; ?><span class="ck-w"><?= e($when) ?></span></li>
<?php endforeach; endforeach; ?>
</ul>
<?php if ($before): ?><div class="ck-b"><span class="ck-bl"><?= e($sec['cv_before']) ?></span><?php foreach ($before as $b): ?><span class="ck-bf"><span><?= mk($b['text']) ?></span><?php if ($b['side'] !== ''): ?><em><?= e($b['side']) ?></em><?php endif; ?></span><?php endforeach; ?></div><?php endif; ?>
</div>
