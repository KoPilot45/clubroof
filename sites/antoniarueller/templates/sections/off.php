<?php if ($off && $sec['on_off']): ?>
<section id="offtherecord" aria-label="<?= e(tr($sec['off_label'])) ?>" style="padding-top:144px">
<?php if (style_of('head') !== 'aktuell'): ?><?= sec_head_style(style_of('head'), $no['off'], $sec['off_label'], (string)$sec['off_right'], '24px') ?><?php else: ?><div class="sec-head off-head" style="margin-bottom:24px"><span class="sec-l"><span style="width:10px;height:10px;border-radius:50%;border:1.5px solid var(--mute);box-sizing:border-box;display:inline-block"></span><span style="font-weight:600">Off</span><span><?= e($no['off']) ?> — <?= e(tr($sec['off_label'])) ?></span></span><span><?= e($sec['off_right']) ?></span></div><?php endif; ?>
<h2 class="big-h" style="margin-bottom:16px"><span class="oh1">Off <span class="the">the<span class="strike" aria-hidden="true"></span></span></span> <span class="oh2">record</span></h2>
<p class="muted" style="margin:0 0 32px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;font-family:var(--mono)"><?= e($sec['off_hint']) ?></p>
<dl class="off">
<?php foreach ($off as $o): ?><div class="off-r"><dt><?= e($o['question']) ?></dt><dd><button type="button" class="ar-redact"><?= e($o['answer']) ?></button></dd></div>
<?php endforeach; ?>
</dl>
</section>
<?php endif; ?>
