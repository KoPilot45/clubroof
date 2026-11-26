<?php if ($off && $sec['on_off']): ?>
<section id="offtherecord" aria-label="<?= e(tr($sec['off_label'])) ?>" style="padding-top:144px">
<?= off_head($no['off'], $sec) ?>
<?php $ofLabel = (string)preg_replace('~\bthe\b~u', '<i>the</i>', e(tr($sec['off_label']))); ?>
<h2 class="of-h"><?= $ofLabel ?></h2>
<div class="ol-gl">
<?php foreach ($off as $i => $o): ?><div class="ol-r"><div class="ol-l"><span class="ol-n"><?= sprintf('%02d', $i + 1) ?></span><h3><?= e($o['question']) ?></h3></div><p><?= nl2br(e($o['answer'])) ?></p></div>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>
