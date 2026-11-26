<?php if ($questions && $sec['on_questions']): ?>
<section aria-label="<?= e(tr($sec['q_label'])) ?>" style="padding-top:112px">
<h2 class="sr-only"><?= e(tr($sec['q_label'])) ?></h2>
<?= sec_head($no['questions'], $sec['q_label'], $sec['q_right']) ?>
<div class="questions qk">
<?php foreach ($questions as $i => $q): ?>
<p class="qk-c<?= $i % 2 ? ' alt' : '' ?>"><span class="qk-g" aria-hidden="true"><?= e($q['number']) ?></span><span class="qk-l"><?= e($q['number']) ?> · <?= e(tr('Frage')) ?></span><span class="qk-t"><?= mk($q['text']) ?></span></p>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>
