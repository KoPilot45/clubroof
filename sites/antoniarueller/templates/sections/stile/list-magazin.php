<div class="muted list-h"><?= e($sec['show_all']) ?></div>
<ol class="clip-list cl-mag">
<?php foreach ($clips as $n => $c): $img = clip_img_html($c); $shot = $img !== '' && ($c['still_style'] ?? 'foto') === 'screenshot'; [$tbg, $tfg] = track_colors($trackByCode[$c['tl_track']] ?? []); $cat = $c['_cat'] !== '' ? $c['_cat'] : media_label($c['medium']); ?>
<li class="ar-clip mg<?= $shot ? ' shot' : '' ?>" id="clip-<?= $c['_id'] ?>" data-id="<?= $c['_id'] ?>"<?= $img === '' ? ' data-txt="1"' : '' ?>>
<?= clip_link_open($c) ?>
<span class="mg-media" style="--tbg:<?= e($tbg) ?>;--tfg:<?= e($tfg) ?>"><?= $img ?><span class="mg-ghost" aria-hidden="true"><?= e($c['_no']) ?></span></span>
<span class="mg-no"><?= e($c['_no']) ?></span><span class="mg-kind"><?= icon($c['medium'], 14) ?><?= e($cat) ?></span>
<span class="mg-body"><span class="mg-title"><?= e($c['title']) ?></span><span class="mg-meta"><?= e(implode(' · ', array_filter([(string)$c['outlet'], (string)$c['_date']]))) ?></span><?= clip_cta_html($c) ?></span>
<?= clip_link_close($c) ?>
</li>
<?php endforeach; ?>
</ol>
