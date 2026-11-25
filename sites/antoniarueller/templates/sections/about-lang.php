<?php if ($langs): ?>
<div class="about-block"><span class="muted lab"><?= e($sec['lang_label']) ?></span>
<p class="langs"><?php foreach ($langs as $i => $l): ?><?= $i ? ' <span class="sl">/</span> ' : '' ?><?= e($l['name']) ?><?= $l['note'] !== '' ? ' <span class="note">' . e($l['note']) . '</span>' : '' ?><?php endforeach; ?></p></div>
<?php endif; ?>
