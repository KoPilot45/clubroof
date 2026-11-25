<?php if ($questions && $sec['on_questions']): ?>
<section aria-label="<?= e(tr($sec['q_label'])) ?>" style="padding-top:112px">
<h2 class="sr-only"><?= e($sec['q_label']) ?></h2>
<?= sec_head($no['questions'], $sec['q_label'], $sec['q_right']) ?>
<div class="questions">
<?php foreach ($questions as $i => $q): ?>
<p class="<?= $i % 2 ? 'ar-q2' : '' ?>"><span class="q-no"><?= e($q['number']) ?></span><span class="q-text"><?= mk($q['text']) ?></span></p>
<?php endforeach; ?>
</div>
</section>
<?php endif; ?>
