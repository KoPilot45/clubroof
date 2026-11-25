<div class="ar-ed-desk editor">
<div class="ed-bar">
<span class="ed-t"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block"></span><?= e($sec['editor_title']) ?></span>
<span class="ed-icons"><?php foreach (['video' => 'Video', 'text' => 'Text', 'radio' => 'Radio', 'podcast' => 'Podcast', 'social' => 'Social'] as $k => $l): ?><span><?= icon($k, 14) ?><?= tr($l) ?></span><?php endforeach; ?></span>
<span style="color:#C9DEDA"><?= e(tr($sec['editor_hint'])) ?></span>
</div>
<div class="ed-body" style="--max:<?= e((string)$timeline['max']) ?>">
<div class="ed-tracks">
<div class="ed-row ed-head"><?= e(tr($sec['editor_track'])) ?></div>
<?php foreach ($tracks as $t): ?><div class="ed-row ed-tl"><?= icon($t['icon'], 18) ?><span class="tl-t"><span><?= e($t['code']) ?></span><span class="muted"><?= e($t['label']) ?></span></span></div><?php endforeach; ?>
</div>
<div class="ed-scroll">
<div class="ed-grid">
<div class="ed-ruler" aria-hidden="true"><?php for ($i = 0; $i < $timeline['ticks']; $i++): ?><span><?= ruler_label($i) ?></span><?php endfor; ?></div>
<?php foreach ($tracks as $t): $lane = $timeline['byTrack'][$t['code']] ?? []; ?>
<div class="ed-lane<?= $lane ? '' : ' is-empty' ?>" data-track="<?= e($t['code']) ?>">
<?php foreach ($lane as $b): $c = $clipsById[$b['id']]; ?>
<button type="button" class="ar-tlclip" data-id="<?= $c['_id'] ?>" aria-pressed="false" data-tip="<?= e(implode(' · ', array_filter([(string)$c['title'], (string)$c['outlet']]))) ?>" data-tip-title="<?= e((string)$c['title']) ?>" data-tip-outlet="<?= e((string)$c['outlet']) ?>"<?php $tImg = upload_url((string)$c['still']); if ($tImg !== ''): $tv = img_square_set((string)$c['still'], (string)($c['still_focus'] ?? '')); ?> data-tip-img="<?= e($tv['src'] ?? $tImg) ?>"<?php endif; ?> style="--w:<?= $b['w'] ?>;background:<?= css_color($t['bg'], '#172526') ?>;color:<?= css_color($t['fg'], '#F3ECDF') ?>"><?php if ($b['year'] !== ''): ?><span class="yr-flag" aria-hidden="true"><?= e($b['year']) ?></span><?php endif; ?><span class="tl-no"><?= e($c['_no']) ?></span><?php if ($c['short'] !== ''): ?><span class="tl-sh"><?= e($c['short']) ?></span><?php endif; ?></button>
<?php endforeach; ?>
</div>
<?php endforeach; ?>
<span class="playhead" id="playhead" aria-hidden="true"><span></span></span>
</div>
</div>
</div>
</div>

<div class="ar-ed-mob">
<div class="mob-tl">
<div class="mob-tl-l"><?php foreach ($tracks as $t): ?><div class="mob-lane-i"><?= icon($t['icon'], 15) ?></div><?php endforeach; ?></div>
<div class="mob-tl-r"><div class="mob-grid" style="--max:<?= e((string)$timeline['max']) ?>">
<?php foreach ($tracks as $t): $lane = $timeline['byTrack'][$t['code']] ?? []; ?><div class="mob-lane<?= $lane ? '' : ' is-empty' ?>"><?php foreach ($lane as $b): $c = $clipsById[$b['id']]; ?><button type="button" class="ar-tlclip mini" data-id="<?= $c['_id'] ?>" aria-pressed="false" aria-label="Clip <?= e($c['_no']) ?>: <?= e($c['short'] ?: $c['title']) ?>" data-tip="<?= e(implode(' · ', array_filter([(string)$c['title'], (string)$c['outlet']]))) ?>" style="--w:<?= $b['w'] ?>;background:<?= css_color($t['bg'], '#172526') ?>;color:<?= css_color($t['fg'], '#F3ECDF') ?>"><span class="tl-no"><?= e($c['_no']) ?></span></button><?php endforeach; ?></div><?php endforeach; ?>
<span class="playhead mob-ph" id="playheadm" aria-hidden="true"><span></span></span>
</div></div>
</div>
<p class="muted" style="margin:10px 0 0;font-size:12px"><?= e($tl['hint_mobile']) ?> · <?= e($yearSpan) ?></p>
</div>

