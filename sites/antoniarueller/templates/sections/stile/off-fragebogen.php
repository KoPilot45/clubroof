<?php if ($off && $sec['on_off']): ?>
<section id="offtherecord" aria-label="<?= e(tr($sec['off_label'])) ?>" style="padding-top:144px">
<?= off_head($no['off'], $sec) ?>
<?php $ofLabel = (string)preg_replace('~\bthe\b~u', '<i>the</i>', e(tr($sec['off_label']))); ?>
<h2 class="of-h"><?= $ofLabel ?></h2>
<div class="of-qa">
<?php foreach ($off as $i => $o): ?><div class="of-it"><span class="of-n"><?= sprintf('%02d', $i + 1) ?></span><h3><?= e($o['question']) ?></h3><p><?= nl2br(e($o['answer'])) ?></p></div>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>
