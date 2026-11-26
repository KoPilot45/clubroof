<?php if ($questions && $sec['on_questions']): ?>
<section aria-label="<?= e(tr($sec['q_label'])) ?>" style="padding-top:112px">
<h2 class="sr-only"><?= e(tr($sec['q_label'])) ?></h2>
<?= sec_head($no['questions'], $sec['q_label'], $sec['q_right']) ?>
<div class="questions qz"><span class="qz-m" aria-hidden="true">?</span>
<div class="qz-l"><?php foreach ($questions as $q): ?><p class="qz-q"><span class="qz-n"><?= e($q['number']) ?></span><span class="qz-t"><?= mk($q['text']) ?></span></p><?php endforeach; ?></div>
</div>
</section>
<?php endif; ?>
