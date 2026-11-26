<?php
$sc = overview_scale($clips);
$cols = $sc['keys'];
if ($sc['undated'] || !$cols) {
    $cols[] = '';
}
$newest = overview_newest($clips);
$cell = [];
foreach ($clips as $c) {
    $cell[(string)$c['tl_track']][overview_key($sc, (string)$c['date'])][] = $c;
}
?>
<div class="ar-ed-desk sp" style="--cols:<?= count($cols) ?>">
<div class="sp-bar"><span class="sp-t"><?= e($sec['editor_title']) ?></span><span class="sp-h"><?= e(tr($sec['editor_hint'])) ?></span></div>
<div class="sp-scroll"><table class="sp-tbl">
<caption class="sr-only"><?= e($sec['editor_title']) ?></caption>
<thead><tr><th scope="col"><?= e(tr($sec['editor_track'])) ?></th><?php foreach ($cols as $k): ?><th scope="col"><?= $k === '' ? '—' : e($sc['labels'][$k] ?? $k) ?></th><?php endforeach; ?></tr></thead>
<tbody>
<?php foreach ($tracks as $t): [$tbg, $tfg] = track_colors($t); $has = !empty($cell[$t['code']]); ?>
<tr class="<?= $has ? '' : 'is-empty' ?>" style="--tbg:<?= e($tbg) ?>;--tfg:<?= e($tfg) ?>"><th scope="row"><span class="sp-ic"><?= icon($t['icon'], 16) ?></span><span><b><?= e($t['code']) ?></b><small><?= e($t['label']) ?></small></span></th>
<?php foreach ($cols as $k): ?><td data-y="<?= $k === '' ? '—' : e($sc['labels'][$k] ?? $k) ?>"><?php foreach ($cell[$t['code']][$k] ?? [] as $c): ?><button type="button" class="tl-it<?= (string)$c['_id'] === $newest ? ' neu' : '' ?>" data-id="<?= $c['_id'] ?>" aria-label="<?= e(tr('Clip') . ' ' . $c['_no'] . ': ' . ($c['short'] ?: $c['title'])) ?>"><span class="n"><?= e($c['_no']) ?></span><span class="d"><?= e($c['_date']) ?></span><span class="t"><?= e($c['short'] ?: $c['title']) ?></span><?php if (trim((string)$c['outlet']) !== ''): ?><span class="o"><?= e($c['outlet']) ?></span><?php endif; ?><?php if ((string)$c['_id'] === $newest): ?><span class="nw"><?= e(tr('NEU')) ?></span><?php endif; ?></button><?php endforeach; ?></td><?php endforeach; ?></tr>
<?php endforeach; ?>
</tbody></table></div>
<p class="muted ed-hint2"><?= e($tl['hint_mobile']) ?></p>
</div>
