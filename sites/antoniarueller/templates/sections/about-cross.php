<?php if ($cross): ?>
<div class="about-block"><span class="muted lab"><?= e($sec['cross_label']) ?></span>
<?php $nc = count($cross); $wide = $nc <= 5 ? $nc : (int)ceil($nc / 2); $mid = $nc <= 3 ? $nc : (int)ceil($nc / 2); ?><div class="cross-wrap"><div class="cross" style="--n:<?= $wide ?>;--m:<?= $mid ?>"><?php foreach ($cross as $c): ?><div class="cross-t"><span class="cross-h"><?= icon($c['icon'], 22) ?><?= e($c['label']) ?></span><span class="cross-o"><?= e($c['outlets']) ?></span></div><?php endforeach; ?></div></div></div>
<?php endif; ?>
