<?php
$cvRowHtml = function (array $r) use ($sec): string {
    $when = trim(cv_when($r, tr($sec['cv_since'])) . ((string)$r['desk'] !== '' ? ' · ' . $r['desk'] : ''), ' ·');
    $lu = (string)$r['logo'] !== '' ? upload_url((string)$r['logo']) : '';
    return '<li class="ct-r"><span class="ct-lg">' . ($lu !== '' ? '<img src="' . e($lu) . '"' . img_attrs((string)$r['logo']) . ' alt="" loading="lazy" decoding="async">' : '') . '</span>'
        . '<span class="ct-t"><b>' . e($r['role'] !== '' ? $r['role'] : $r['org']) . '</b>' . ($r['role'] !== '' ? '<span>' . e($r['org']) . '</span>' : '') . '</span>'
        . '<span class="ct-w">' . e($when) . '</span></li>';
};
?>
<div class="ct" id="rf">
<?php foreach ($cvGroups as $year => $rows): ?>
<div class="ct-y"><div class="ct-yn"><?= e($year) ?></div><ul class="ct-l"><?php foreach ($rows as $r) { echo $cvRowHtml($r); } ?></ul></div>
<?php endforeach; ?>
<?php if ($before): ?><div class="ct-y ct-b"><div class="ct-yn small"><?= e($sec['cv_before']) ?></div><ul class="ct-l"><?php foreach ($before as $b): ?><li class="ct-bf"><span><?= mk($b['text']) ?></span><?php if ($b['side'] !== ''): ?><em><?= e($b['side']) ?></em><?php endif; ?></li><?php endforeach; ?></ul></div><?php endif; ?>
</div>
