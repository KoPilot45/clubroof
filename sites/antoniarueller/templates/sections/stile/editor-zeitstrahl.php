<?php
$zs = overview_sorted($clips);
$zn = count($zs);
$sc = overview_scale($clips);
$newest = overview_newest($clips);
$lv = ['u1', 'd1', 'u2', 'd2'];
$lastY = '';
?>
<div class="ar-ed-desk zs" style="--n:<?= $zn ?>">
<div class="sp-bar"><span class="sp-t"><?= e($sec['editor_title']) ?></span><span class="sp-h"><?= e(tr($sec['editor_hint'])) ?></span></div>
<div class="zs-scroll"><div class="zs-stage"><span class="zs-axis" aria-hidden="true"></span>
<?php foreach ($zs as $i => $c): [$tbg, $tfg] = track_colors($trackByCode[$c['tl_track']] ?? []); $y = preg_match('~^(\d{4})~', (string)$c['date'], $ym) ? $ym[1] : ''; ?>
<?php if ($y !== $lastY && $y !== ''): $lastY = $y; ?><span class="zs-y" style="left:<?= round($i / $zn * 100, 2) ?>%" aria-hidden="true"><?= e($y) ?></span><?php endif; ?>
<div class="zs-i <?= $lv[$i % 4] ?>" style="left:<?= round(($i + .5) / $zn * 100, 2) ?>%;--tbg:<?= e($tbg) ?>"><button type="button" class="tl-it<?= (string)$c['_id'] === $newest ? ' neu' : '' ?>" data-id="<?= $c['_id'] ?>" aria-label="<?= e(tr('Clip') . ' ' . $c['_no'] . ': ' . ($c['short'] ?: $c['title'])) ?>"><span class="y"><?= e($c['_date']) ?></span><span class="n"><?= e($c['_no']) ?></span><span class="t"><?= e($c['short'] ?: $c['title']) ?></span><?php if (trim((string)$c['outlet']) !== ''): ?><span class="o"><?= e($c['outlet']) ?></span><?php endif; ?><?php if ((string)$c['_id'] === $newest): ?><span class="nw"><?= e(tr('NEU')) ?></span><?php endif; ?></button><span class="zs-l" aria-hidden="true"></span><span class="zs-n" aria-hidden="true"></span></div>
<?php endforeach; ?>
</div></div>
<ul class="zs-leg" aria-hidden="true"><?php foreach ($tracks as $t): [$tbg] = track_colors($t); ?><li><i style="background:<?= e($tbg) ?>"></i><?= e($t['label']) ?></li><?php endforeach; ?></ul>
<p class="muted ed-hint2"><?= e($tl['hint_mobile']) ?></p>
</div>
